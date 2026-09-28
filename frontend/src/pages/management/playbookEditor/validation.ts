import { flattenStages } from './catalog';
import type { DraftIssue, DraftValidation, EditorStage, PlaybookDraft } from './types';

export const stageIssues = (stage: EditorStage): DraftIssue[] => {
  const issues: DraftIssue[] = [];
  if (!stage.name.trim()) issues.push({ level: 'error', stageId: stage.id, text: 'Нет названия этапа' });
  if (stage.blocks.length === 0) issues.push({ level: 'error', stageId: stage.id, text: 'Этап пустой' });
  if (stage.catalogCode !== 'control' && stage.slaDays == null) issues.push({ level: 'warning', stageId: stage.id, text: 'Нет SLA' });
  if (stage.slaDays != null && stage.slaDays < 1) issues.push({ level: 'error', stageId: stage.id, text: 'SLA должен быть больше 0' });
  const hasRequired = stage.blocks.some((block) => block.kind === 'lms' || block.kind === 'site' || block.required || block.fields?.some((field) => field.required) || block.items?.some((item) => item.required) || block.slots?.some((slot) => slot.required) || Object.values(block.flags ?? {}).some(Boolean));
  if (stage.blocks.length > 0 && !hasRequired) issues.push({ level: 'warning', stageId: stage.id, text: 'Нет обязательных фактов' });
  for (const block of stage.blocks) {
    if (block.kind === 'document' && block.required !== false && !block.docType) issues.push({ level: 'error', stageId: stage.id, text: `Блок «${block.title}» без типа документа` });
    if (block.kind === 'documents') {
      if (!(block.slots ?? []).length) issues.push({ level: 'error', stageId: stage.id, text: `Блок «${block.title}» без слотов` });
      block.slots?.forEach((slot) => {
        if (slot.required && !slot.docType) issues.push({ level: 'error', stageId: stage.id, text: `Слот «${slot.title || 'документ'}» без типа` });
      });
    }
    if (block.kind === 'fields' && !(block.fields ?? []).length) issues.push({ level: 'error', stageId: stage.id, text: `Добавьте хотя бы одно поле` });
    if (block.kind === 'checklist') {
      if (!(block.items ?? []).length) issues.push({ level: 'error', stageId: stage.id, text: `Чеклист «${block.title}» пустой` });
      (block.items ?? []).forEach((item) => {
        if (item.required && !item.text.trim()) issues.push({ level: 'error', stageId: stage.id, text: `Пустой обязательный пункт чеклиста` });
        if (item.mode === 'auto' && !item.factId) issues.push({ level: 'warning', stageId: stage.id, text: `Автопункт «${item.text || 'без текста'}» без факта` });
      });
    }
  }
  return issues;
};

export const validatePlaybookDraft = (draft: PlaybookDraft): DraftValidation => {
  const errors: DraftIssue[] = [];
  const warnings: DraftIssue[] = [];
  const stageErrors: Record<string, DraftIssue[]> = {};
  if (!draft.name.trim()) errors.push({ level: 'error', text: 'Нет названия плейбука' });
  const rows = flattenStages(draft);
  if (rows.length === 0) errors.push({ level: 'error', text: 'Нет этапов' });
  draft.phases.forEach((phase) => {
    if (!phase.name.trim()) errors.push({ level: 'error', text: 'Есть фаза без названия' });
  });
  for (const { stage } of rows) {
    const local = stageIssues(stage);
    stageErrors[stage.id] = local;
    local.forEach((item) => (item.level === 'error' ? errors : warnings).push(item));
  }
  return { errors, warnings, stageErrors };
};

export const draftIssues = (draft: PlaybookDraft) => {
  const result = validatePlaybookDraft(draft);
  return [...result.errors, ...result.warnings];
};