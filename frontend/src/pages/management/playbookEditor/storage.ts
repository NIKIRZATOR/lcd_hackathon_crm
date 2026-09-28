import { emptyDraft, normalizeDraft, uid } from './catalog';
import type { EditorPhase, EditorStage, PlaybookDraft } from './types';

const key = (id: string) => `rtk-eduflow:playbook-editor:${id}`;

const hydrate = (raw: unknown): PlaybookDraft | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const phases = Array.isArray(value.phases) ? value.phases as Array<Record<string, unknown>> : [];
  const nested = phases[0] && Array.isArray(phases[0].stages);
  if (nested) {
    const draft = emptyDraft(String(value.id ?? uid()), (value.basedOn as string | null) ?? null);
    return normalizeDraft({
      ...draft,
      name: String(value.name ?? ''),
      description: String(value.description ?? ''),
      status: (value.status as PlaybookDraft['status']) ?? 'draft',
      sourceTemplateId: value.sourceTemplateId as string | undefined,
      visibility: (value.visibility as PlaybookDraft['visibility']) ?? (value.access as PlaybookDraft['visibility']) ?? draft.visibility,
      savedAt: (value.savedAt as string | null) ?? null,
      phases: phases.map((phase, order) => ({
        id: String(phase.id ?? uid()),
        name: String(phase.name ?? ''),
        order: Number(phase.order ?? order),
        stages: ((phase.stages as EditorStage[]) ?? []).map((stage, index) => ({
          ...stage,
          canSkip: stage.canSkip ?? (stage as EditorStage & { optional?: boolean }).optional ?? false,
          order: stage.order ?? index,
          blocks: (stage.blocks ?? []).map((block, blockOrder) => ({ ...block, order: block.order ?? blockOrder })),
        })),
      })),
    });
  }
  const stages = Array.isArray(value.stages) ? value.stages as Array<EditorStage & { phaseId?: string; optional?: boolean }> : [];
  const mapped: EditorPhase[] = phases.map((phase, order) => ({
    id: String(phase.id ?? uid()),
    name: String(phase.name ?? ''),
    order,
    stages: stages.filter((stage) => stage.phaseId === phase.id).map((stage, index) => ({
      id: stage.id,
      name: stage.name,
      description: stage.description,
      order: index,
      slaDays: stage.slaDays,
      canSkip: stage.canSkip ?? stage.optional ?? false,
      catalogCode: stage.catalogCode,
      blocks: (stage.blocks ?? []).map((block, blockOrder) => ({ ...block, order: block.order ?? blockOrder })),
    })),
  }));
  const draft = emptyDraft(String(value.id ?? uid()), (value.basedOn as string | null) ?? null);
  return normalizeDraft({
    ...draft,
    name: String(value.name ?? ''),
    description: String(value.description ?? ''),
    status: (value.status as PlaybookDraft['status']) ?? 'draft',
    visibility: (value.access as PlaybookDraft['visibility']) ?? draft.visibility,
    phases: mapped,
    savedAt: (value.savedAt as string | null) ?? null,
  });
};

export const readDraft = (id: string): PlaybookDraft | null => {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? hydrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export type PlaybookIndexItem = {
  id: string;
  name: string;
  status: string;
  code: string | null;
  published_version: number | null;
  basedOn: string | null;
};

const indexKey = 'rtk-eduflow:playbook-editor:index';

export const listLocalPlaybooks = (): PlaybookIndexItem[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(indexKey) || '[]');
    return Array.isArray(raw) ? raw as PlaybookIndexItem[] : [];
  } catch {
    return [];
  }
};

const rememberPlaybook = (draft: PlaybookDraft) => {
  const items = listLocalPlaybooks().filter((item) => item.id !== draft.id);
  items.unshift({
    id: draft.id,
    name: draft.name || 'Без названия',
    status: draft.status,
    code: null,
    published_version: draft.status === 'published' ? 1 : null,
    basedOn: draft.basedOn,
  });
  localStorage.setItem(indexKey, JSON.stringify(items));
};

export const writeDraft = (draft: PlaybookDraft) => {
  const next = normalizeDraft(draft);
  localStorage.setItem(key(next.id), JSON.stringify(next));
  if (next.name.trim()) rememberPlaybook(next);
};