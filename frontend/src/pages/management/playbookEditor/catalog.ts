import { stageBlueprints } from '../../workflow/shared/stageBlueprints';
import type { BlockKind, EditorPhase, EditorStage, FactOption, StageBlock } from './types';

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

export const FACT_CATALOG: FactOption[] = [
  { id: 'contact', label: 'Контакт площадки', group: 'Контакт' },
  { id: 'meeting_date', label: 'Дата встречи', group: 'Встреча' },
  { id: 'meeting_participant', label: 'Участник встречи', group: 'Встреча' },
  { id: 'meeting_protocol', label: 'Протокол или заметка', group: 'Встреча' },
  { id: 'need_comment', label: 'Причина потребности', group: 'Потребность' },
  { id: 'contract_number', label: 'Номер договора', group: 'Договор' },
  { id: 'contract_signed_on', label: 'Дата подписания договора', group: 'Договор' },
  { id: 'license_number', label: 'Номер лицензии', group: 'Лицензия' },
  { id: 'license_valid_until', label: 'Срок лицензии', group: 'Лицензия' },
  { id: 'transfer_status', label: 'Статус передачи', group: 'Доступ' },
  { id: 'product_access', label: 'Доступ к продукту', group: 'Доступ' },
  { id: 'teacher', label: 'Преподаватель-носитель', group: 'Преподаватель' },
  { id: 'trained_on', label: 'Дата обучения', group: 'Преподаватель' },
  { id: 'teacher_ready', label: 'Готовность преподавателя', group: 'Преподаватель' },
  { id: 'curriculum', label: 'Учебный план', group: 'Занятия' },
  { id: 'classes_started_on', label: 'Дата старта занятий', group: 'Занятия' },
  { id: 'period_result', label: 'Итог периода', group: 'Отчёт' },
];

export const DOC_TYPES = [
  { id: 'project_contract', label: 'Проект договора' },
  { id: 'signed_contract', label: 'Подписанный договор' },
  { id: 'license', label: 'Лицензия' },
  { id: 'transfer', label: 'Акт передачи' },
  { id: 'certificate', label: 'Сертификат преподавателя' },
  { id: 'curriculum', label: 'Учебный план' },
  { id: 'period_result', label: 'Итог периода' },
  { id: 'direction_materials', label: 'Материалы направления' },
  { id: 'product_description', label: 'Описание продукта' },
];

export const BLOCK_LIBRARY: Array<{ kind: BlockKind; title: string; group: string }> = [
  { kind: 'fields', title: 'Информационные поля', group: 'Основные' },
  { kind: 'checklist', title: 'Чеклист', group: 'Основные' },
  { kind: 'comment', title: 'Комментарий', group: 'Основные' },
  { kind: 'confirm', title: 'Ручное подтверждение', group: 'Основные' },
  { kind: 'document', title: 'Один документ', group: 'Документы' },
  { kind: 'documents', title: 'Несколько документов', group: 'Документы' },
  { kind: 'contact', title: 'Контакт вуза', group: 'Бизнес-блоки' },
  { kind: 'contract', title: 'Договор', group: 'Бизнес-блоки' },
  { kind: 'license', title: 'Лицензия', group: 'Бизнес-блоки' },
  { kind: 'access', title: 'Доступ к продукту', group: 'Бизнес-блоки' },
  { kind: 'teacher', title: 'Преподаватель', group: 'Бизнес-блоки' },
  { kind: 'curriculum', title: 'Учебный план', group: 'Бизнес-блоки' },
  { kind: 'lms', title: 'LMS-показатели', group: 'Интеграции' },
  { kind: 'site', title: 'Сигналы сайта', group: 'Интеграции' },
];

export const PHASE_LABELS: Record<string, string> = {
  outreach: 'Выход на вуз',
  paperwork: 'Оформление',
  paper: 'Оформление',
  onboarding: 'Онбординг',
  operations: 'Эксплуатация',
  retention: 'Удержание',
  license: 'Оформление',
  teacher: 'Онбординг',
  classes: 'Эксплуатация',
  result: 'Удержание',
};

const PHASE_BY_CODE: Record<string, string> = {
  find_contact: 'outreach',
  first_meeting: 'outreach',
  identify_need: 'outreach',
  document_package: 'paperwork',
  sign_contract: 'paperwork',
  sign_license: 'paperwork',
  transfer_access: 'onboarding',
  train_teacher: 'onboarding',
  confirm_teacher: 'onboarding',
  curriculum: 'onboarding',
  start_classes: 'operations',
  classes_running: 'operations',
  period_results: 'retention',
  control: 'retention',
};

const block = (kind: BlockKind, title: string, extra: Partial<StageBlock> = {}): StageBlock => ({
  id: uid(),
  kind,
  title,
  order: extra.order ?? 0,
  ...extra,
});

const checks = (items: Array<{ text: string; mode?: 'auto' | 'manual'; required?: boolean; factId?: string }>) =>
  block('checklist', 'Закрытие этапа', {
    items: items.map((item) => ({ id: uid(), text: item.text, required: item.required !== false, mode: item.mode ?? 'manual', factId: item.factId })),
  });

export const defaultBlocksFor = (code: string): StageBlock[] => {
  if (code === 'find_contact') return [
    block('contact', 'Контакт вуза', { flags: { person: true, phone: true, role: true } }),
    checks([{ text: 'Контакт найден или создан', mode: 'auto', factId: 'contact' }, { text: 'Есть телефон или почта', mode: 'auto', factId: 'contact' }]),
  ];
  if (code === 'first_meeting') return [
    block('fields', 'Факты встречи', { fields: [{ factId: 'meeting_date', required: true }, { factId: 'meeting_participant', required: true }] }),
    block('comment', 'Протокол', { required: true, minLength: 40, hint: 'Не короче 40 символов' }),
    checks([{ text: 'Дата встречи указана', mode: 'auto', factId: 'meeting_date' }, { text: 'Протокол не короче 40 символов', mode: 'auto', factId: 'meeting_protocol' }]),
  ];
  if (code === 'identify_need') return [
    block('comment', 'Потребность', { required: true, hint: 'Зачем площадке этот продукт' }),
    checks([{ text: 'Причина потребности зафиксирована', mode: 'auto', factId: 'need_comment' }]),
  ];
  if (code === 'document_package') return [
    block('documents', 'Пакет документов', { slots: [
      { id: uid(), title: 'Проект договора', docType: 'project_contract', required: true },
      { id: uid(), title: 'Материалы направления', docType: 'direction_materials', required: true },
      { id: uid(), title: 'Описание продукта', docType: 'product_description', required: true },
    ] }),
    checks([{ text: 'Три слота заполнены', mode: 'manual' }]),
  ];
  if (code === 'sign_contract') return [
    block('contract', 'Договор', { flags: { number: true, date: true, file: true } }),
    checks([{ text: 'Номер, дата и файл договора', mode: 'auto', factId: 'contract_number' }]),
  ];
  if (code === 'sign_license') return [
    block('license', 'Лицензия', { flags: { number: true, until: true, file: true } }),
    checks([{ text: 'Номер, срок и файл лицензии', mode: 'auto', factId: 'license_number' }]),
  ];
  if (code === 'transfer_access') return [
    block('access', 'Доступ к продукту', { flags: { transfer: true, access: true, file: true } }),
    checks([{ text: 'Статус передачи подтверждён', mode: 'auto', factId: 'transfer_status' }, { text: 'Доступ к продукту указан', mode: 'auto', factId: 'product_access' }]),
  ];
  if (code === 'train_teacher') return [
    block('teacher', 'Преподаватель', { flags: { person: true, product: true, trainedOn: true, status: true, certificate: true } }),
    checks([{ text: 'Носитель выбран', mode: 'auto', factId: 'teacher' }, { text: 'Дата обучения указана', mode: 'auto', factId: 'trained_on' }]),
  ];
  if (code === 'confirm_teacher') return [
    block('confirm', 'Подтверждение готовности', { required: true }),
    checks([{ text: 'Преподаватель готов вести', mode: 'manual' }]),
  ];
  if (code === 'curriculum') return [
    block('curriculum', 'Учебный план', { flags: { file: true, comment: true } }),
    checks([{ text: 'План или комментарий согласования', mode: 'auto', factId: 'curriculum' }]),
  ];
  if (code === 'start_classes') return [
    block('fields', 'Старт', { fields: [{ factId: 'classes_started_on', required: true }] }),
    block('confirm', 'Подтверждение старта', { required: true }),
    block('lms', 'Сигнал LMS', { flags: { students: true, signal: true } }),
    checks([{ text: 'Дата старта указана', mode: 'auto', factId: 'classes_started_on' }, { text: 'Старт подтверждён вручную', mode: 'manual' }]),
  ];
  if (code === 'classes_running') return [
    block('lms', 'LMS-показатели', { flags: { students: true, applications: true, signal: true } }),
    block('site', 'Сигналы сайта', { flags: { signal: true } }),
    checks([{ text: 'Занятия ведутся в учебном окне', mode: 'manual' }]),
  ];
  if (code === 'period_results') return [
    block('comment', 'Итог периода', { required: true }),
    block('document', 'Файл итога', { docType: 'period_result', required: false, formats: ['pdf', 'docx'] }),
    checks([{ text: 'Комментарий итога заполнен', mode: 'auto', factId: 'period_result' }]),
  ];
  if (code === 'control') return [
    block('lms', 'Контроль LMS', { flags: { students: true, applications: true, signal: true } }),
    block('site', 'Сигналы сайта', { flags: { signal: true } }),
    block('comment', 'Комментарий контроля'),
    checks([{ text: 'Контроль ведётся в фоне', mode: 'manual' }]),
  ];
  return [];
};

const withOrder = (blocks: StageBlock[]) => blocks.map((item, index) => ({ ...item, order: index }));

export const makeStage = (code: string, order: number): EditorStage => {
  const item = stageBlueprints[code] ?? { title: 'Контроль исполнения', note: 'Постоянный контроль исполнения этапов 1–13.' };
  return {
    id: uid(),
    name: code === 'control' ? 'Контроль исполнения' : item.title,
    description: code === 'control' ? 'Постоянный контроль исполнения этапов 1–13.' : item.note,
    order,
    slaDays: 7,
    canSkip: code === 'document_package',
    catalogCode: code,
    blocks: withOrder(defaultBlocksFor(code)),
  };
};

export const fullCycleDraft = (id: string, basedOn: string): import('./types').PlaybookDraft => {
  const groups: Array<{ key: string; codes: string[] }> = [
    { key: 'outreach', codes: ['find_contact', 'first_meeting', 'identify_need'] },
    { key: 'paperwork', codes: ['document_package', 'sign_contract', 'sign_license'] },
    { key: 'onboarding', codes: ['transfer_access', 'train_teacher', 'confirm_teacher', 'curriculum'] },
    { key: 'operations', codes: ['start_classes', 'classes_running'] },
    { key: 'retention', codes: ['period_results', 'control'] },
  ];
  let order = 0;
  const phases: EditorPhase[] = groups.map((group, phaseOrder) => ({
    id: uid(),
    name: PHASE_LABELS[group.key],
    order: phaseOrder,
    stages: group.codes.map((code) => makeStage(code, order++)),
  }));
  return { id, name: `Копия: ${basedOn}`, description: '', status: 'draft', basedOn, sourceTemplateId: undefined, visibility: { mode: 'all', kamIds: [] }, phases, savedAt: null };
};

export const emptyDraft = (id: string, basedOn: string | null = null): import('./types').PlaybookDraft => ({
  id,
  name: '',
  description: '',
  basedOn,
  status: 'draft',
  visibility: { mode: 'all', kamIds: [] },
  phases: [],
  savedAt: null,
});

export const cloneBlock = (item: StageBlock): StageBlock => ({
  ...item,
  id: uid(),
  fields: item.fields?.map((field) => ({ ...field })),
  items: item.items?.map((row) => ({ ...row, id: uid() })),
  slots: item.slots?.map((row) => ({ ...row, id: uid() })),
  formats: item.formats ? [...item.formats] : undefined,
  flags: item.flags ? { ...item.flags } : undefined,
});

export const cloneStage = (stage: EditorStage, name = stage.name): EditorStage => ({
  ...stage,
  id: uid(),
  name,
  blocks: stage.blocks.map((item) => cloneBlock(item)),
});

export const clonePhase = (phase: EditorPhase): EditorPhase => ({
  ...phase,
  id: uid(),
  stages: phase.stages.map((stage) => cloneStage(stage)),
});

export const cloneDraft = (draft: import('./types').PlaybookDraft): import('./types').PlaybookDraft => ({
  ...draft,
  id: uid(),
  visibility: { mode: draft.visibility.mode, kamIds: [...draft.visibility.kamIds] },
  phases: draft.phases.map((phase) => clonePhase(phase)),
});

export const flattenStages = (draft: import('./types').PlaybookDraft) =>
  [...draft.phases].sort((left, right) => left.order - right.order).flatMap((phase) => [...phase.stages].sort((left, right) => left.order - right.order).map((stage) => ({ phase, stage })));

export const normalizeDraft = (draft: import('./types').PlaybookDraft): import('./types').PlaybookDraft => ({
  ...draft,
  phases: draft.phases.map((phase, phaseOrder) => ({
    ...phase,
    order: phaseOrder,
    stages: phase.stages.map((stage, stageOrder) => ({
      ...stage,
      order: stageOrder,
      blocks: stage.blocks.map((item, blockOrder) => ({ ...item, order: blockOrder })),
    })),
  })),
});

export const humanPhaseName = (value: string) => PHASE_LABELS[value.trim().toLowerCase()] ?? (/^[a-z_]+$/i.test(value.trim()) ? PHASE_LABELS[value.trim().toLowerCase()] ?? value : value);

export { PHASE_BY_CODE };

export const newBlock = (kind: BlockKind): StageBlock => {
  const title = BLOCK_LIBRARY.find((item) => item.kind === kind)?.title ?? 'Блок';
  if (kind === 'fields') return block(kind, title, { fields: [] });
  if (kind === 'checklist') return block(kind, title, { items: [{ id: uid(), text: 'Новый пункт', required: true, mode: 'manual' }] });
  if (kind === 'comment') return block(kind, title, { required: false, hint: '' });
  if (kind === 'confirm') return block(kind, title, { required: true });
  if (kind === 'document') return block(kind, title, { required: true, docType: '', formats: ['pdf', 'docx'], description: '' });
  if (kind === 'documents') return block(kind, title, { slots: [{ id: uid(), title: 'Документ', docType: '', required: true }] });
  if (kind === 'contact') return block(kind, title, { flags: { person: true, phone: true, role: true } });
  if (kind === 'contract') return block(kind, title, { flags: { number: true, date: true, file: true } });
  if (kind === 'license') return block(kind, title, { flags: { number: true, until: true, file: true } });
  if (kind === 'access') return block(kind, title, { flags: { transfer: true, access: true, file: true } });
  if (kind === 'lms') return block(kind, title, { flags: { students: true, applications: true, signal: true } });
  if (kind === 'site') return block(kind, title, { flags: { signal: true } });
  if (kind === 'teacher') return block(kind, title, { flags: { person: true, product: true, trainedOn: true, status: true, certificate: false } });
  if (kind === 'curriculum') return block(kind, title, { flags: { file: true, comment: true } });
  return block(kind, title);
};

export { uid };