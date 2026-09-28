import { normalizeDraft } from './catalog';
import type { PlaybookDraft } from './types';

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