import { normalizeDraft } from './catalog';
import type { PlaybookDraft, PlaybookStatus } from './types';

export const mapDraftToPayload = (draft: PlaybookDraft) => {
  const next = normalizeDraft(draft);
  return {
    id: next.id,
    name: next.name,
    description: next.description,
    status: next.status,
    source_template_id: next.sourceTemplateId ?? null,
    visibility: { mode: next.visibility.mode, kam_ids: next.visibility.kamIds },
    phases: next.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      order: phase.order,
      stages: phase.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        description: stage.description,
        order: stage.order,
        sla_days: stage.slaDays,
        can_skip: stage.canSkip,
        catalog_code: stage.catalogCode ?? null,
        blocks: stage.blocks.map((block) => ({ ...block, order: block.order })),
      })),
    })),
  };
};

export const mapPayloadToDraft = (id: string, status: string, payload: unknown): PlaybookDraft | null => {
  if (!payload || typeof payload !== 'object') return null;
  const source = payload as Record<string, any>;
  const phases = Array.isArray(source.phases) ? source.phases : [];
  return normalizeDraft({
    id,
    name: String(source.name ?? ''),
    description: String(source.description ?? ''),
    status: (['draft', 'published', 'archived'].includes(String(status).toLowerCase()) ? String(status).toLowerCase() : 'draft') as PlaybookStatus,
    basedOn: source.source_template_id ? String(source.source_template_id) : null,
    sourceTemplateId: source.source_template_id ? String(source.source_template_id) : undefined,
    visibility: {
      mode: source.visibility?.mode === 'selected' ? 'selected' : 'all',
      kamIds: Array.isArray(source.visibility?.kam_ids) ? source.visibility.kam_ids.map(String) : [],
    },
    phases: phases.map((phase: Record<string, any>, phaseIndex: number) => ({
      id: String(phase.id ?? `phase-${phaseIndex}`),
      name: String(phase.name ?? ''),
      order: Number(phase.order ?? phaseIndex),
      stages: (Array.isArray(phase.stages) ? phase.stages : []).map((stage: Record<string, any>, stageIndex: number) => ({
        id: String(stage.id ?? `stage-${phaseIndex}-${stageIndex}`),
        name: String(stage.name ?? ''),
        description: String(stage.description ?? ''),
        order: Number(stage.order ?? stageIndex),
        slaDays: stage.sla_days == null ? null : Number(stage.sla_days),
        canSkip: Boolean(stage.can_skip),
        catalogCode: stage.catalog_code ? String(stage.catalog_code) : undefined,
        blocks: (Array.isArray(stage.blocks) ? stage.blocks : []).map((block: Record<string, any>, blockIndex: number) => ({ ...block, id: String(block.id ?? `block-${stageIndex}-${blockIndex}`), order: Number(block.order ?? blockIndex) })),
      })),
    })),
    savedAt: null,
  });
};
