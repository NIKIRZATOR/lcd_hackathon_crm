import { apiRequest } from '../../../api/client';
import { stageBlueprints, stageCodeOf } from '../../workflow/shared/stageBlueprints';
import { PHASE_BY_CODE, cloneDraft, defaultBlocksFor, emptyDraft, fullCycleDraft, humanPhaseName, makeStage, normalizeDraft, uid } from './catalog';
import type { EditorPhase, EditorStage, PlaybookDraft, PublishedPlaybook } from './types';

type ApiStage = {
  name: string;
  code?: string | null;
  order_index?: number;
  is_optional?: boolean;
  default_duration_days?: number | null;
  description?: string | null;
  phase?: string | null;
  phase_name?: string | null;
};
type CatalogStage = { code: string; name: string; phase: string };
type WorkflowVersion = { id: string; status: string };
type Page<T> = { items?: T[] };

const looksLikeFullCycle = (source: PublishedPlaybook) => {
  const text = `${source.id} ${source.name}`.toLowerCase();
  return text.includes('full cycle') || text.includes('полный цикл') || source.id === 'full-cycle';
};

const loadApiStages = async (templateId: string): Promise<ApiStage[]> => {
  if (templateId.length < 20) return [];
  const versions = await apiRequest<WorkflowVersion[]>(`/api/workflows/templates/${templateId}/versions`).catch(() => []);
  const version = versions.find((item) => String(item.status).toLowerCase() === 'published') ?? versions[0];
  if (!version) return [];
  const loaded = await apiRequest<Page<ApiStage> | ApiStage[]>(`/api/workflows/stages?workflow_template_id=${templateId}&workflow_version_id=${version.id}&limit=100`).catch(() => []);
  return Array.isArray(loaded) ? loaded : loaded.items ?? [];
};

const stageFromApi = (row: ApiStage, order: number, catalog: CatalogStage[]): { phaseKey: string; stage: EditorStage } => {
  const code = stageCodeOf(row.code, row.name);
  const catalogPhase = catalog.find((item) => item.code === code || item.name === row.name)?.phase;
  const raw = (row.phase_name || row.phase || catalogPhase || PHASE_BY_CODE[code] || 'outreach').trim();
  const phaseName = humanPhaseName(raw);
  const blueprint = stageBlueprints[code];
  return {
    phaseKey: phaseName,
    stage: {
      id: uid(),
      name: row.name || blueprint?.title || 'Этап',
      description: row.description?.trim() || blueprint?.note || '',
      order,
      slaDays: row.default_duration_days ?? 7,
      canSkip: Boolean(row.is_optional),
      catalogCode: code,
      blocks: defaultBlocksFor(code).map((item, index) => ({ ...item, order: index })),
    },
  };
};

const phasesFromGroups = (items: Array<{ phaseKey: string; stage: EditorStage }>): EditorPhase[] => {
  const names: string[] = [];
  for (const item of items) if (!names.includes(item.phaseKey)) names.push(item.phaseKey);
  return names.map((name, order) => ({
    id: uid(),
    name,
    order,
    stages: items.filter((item) => item.phaseKey === name).map((item, index) => ({ ...item.stage, order: index })),
  }));
};

const pack = (id: string, name: string, groups: Array<{ key: string; codes: string[] }>): PlaybookDraft => {
  let order = 0;
  const phases: EditorPhase[] = groups.map((group, phaseOrder) => ({
    id: uid(),
    name: humanPhaseName(group.key),
    order: phaseOrder,
    stages: group.codes.map((code) => makeStage(code, order++)),
  }));
  return normalizeDraft({ ...emptyDraft(id, name), name, sourceTemplateId: id, phases });
};

const knownPack = (source: PublishedPlaybook): PlaybookDraft | null => {
  const text = `${source.id} ${source.name}`.toLowerCase();
  if (looksLikeFullCycle(source)) return { ...fullCycleDraft(source.id, source.name), name: source.name, sourceTemplateId: source.id };
  if (text.includes('expansion') || text.includes('расширен')) {
    return pack(source.id, source.name, [
      { key: 'outreach', codes: ['identify_need'] },
      { key: 'paperwork', codes: ['sign_license'] },
      { key: 'onboarding', codes: ['transfer_access', 'curriculum'] },
      { key: 'operations', codes: ['start_classes'] },
    ]);
  }
  if (text.includes('renewal') || text.includes('продлен')) {
    return pack(source.id, source.name, [
      { key: 'paperwork', codes: ['sign_license'] },
      { key: 'onboarding', codes: ['transfer_access'] },
    ]);
  }
  if (text.includes('school') || text.includes('школьн')) {
    return pack(source.id, source.name, [
      { key: 'outreach', codes: ['find_contact', 'first_meeting'] },
      { key: 'operations', codes: ['start_classes', 'classes_running'] },
      { key: 'retention', codes: ['period_results'] },
    ]);
  }
  if (text.includes('replace') || text.includes('замен')) {
    return pack(source.id, source.name, [
      { key: 'onboarding', codes: ['train_teacher', 'confirm_teacher'] },
    ]);
  }
  return null;
};

export const mapPlaybookTemplateToDraft = async (source: PublishedPlaybook, mode: 'open' | 'copy' = 'copy'): Promise<PlaybookDraft> => {
  const catalog = await apiRequest<CatalogStage[]>('/api/management/stages').catch(() => []);
  const apiStages = await loadApiStages(source.id);
  const asCopy = mode === 'copy';
  const draftId = asCopy ? uid() : source.id;
  const title = asCopy ? `Копия: ${source.name}` : source.name;
  if (apiStages.length) {
    const sorted = [...apiStages].sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
    const mapped = sorted.map((row, index) => stageFromApi(row, index, catalog));
    if (looksLikeFullCycle(source) && !mapped.some((item) => item.stage.catalogCode === 'control' || item.stage.name.toLowerCase().includes('контроль'))) {
      mapped.push({ phaseKey: humanPhaseName('retention'), stage: makeStage('control', mapped.length) });
    }
    const draft = emptyDraft(draftId, source.name);
    draft.name = title;
    draft.sourceTemplateId = source.id;
    draft.status = asCopy ? 'draft' : (source.status as PlaybookDraft['status']) || 'published';
    draft.phases = phasesFromGroups(mapped);
    return normalizeDraft(asCopy ? cloneDraft({ ...draft, id: draftId }) : draft);
  }
  const known = knownPack(source);
  if (known) {
    const draft = { ...known, id: draftId, name: title, basedOn: source.name, sourceTemplateId: source.id, status: asCopy ? 'draft' as const : known.status };
    return asCopy ? cloneDraft(draft) : normalizeDraft(draft);
  }
  const draft = emptyDraft(draftId, source.name);
  draft.name = title;
  draft.sourceTemplateId = source.id;
  return draft;
};