import type { CustomChecklistItem } from './contactSearch';

export const TRAIN_TEACHER_SLA_DAYS = 14;
export const CERTIFICATE_KIND = 'certificate';

export const carrierStatuses = [
  { value: 'planned', label: 'К обучению' },
  { value: 'trained', label: 'Обучен' },
  { value: 'active', label: 'Ведёт' },
  { value: 'left', label: 'Ушёл' },
] as const;

export const trainFormats = [
  { value: 'vendor', label: 'Вендор' },
  { value: 'school', label: 'Школа' },
  { value: 'certificate', label: 'Имеющийся сертификат' },
] as const;

export type CarrierStatus = (typeof carrierStatuses)[number]['value'];
export type TrainFormat = (typeof trainFormats)[number]['value'];

export const trainChecks = [
  { id: 'person', label: 'Преподаватель выбран' },
  { id: 'status', label: 'Статус «обучен» или «ведёт»' },
  { id: 'date', label: 'Дата обучения указана' },
  { id: 'proof', label: 'Есть сертификат' },
] as const;

export type TrainCheckId = (typeof trainChecks)[number]['id'];

export type TrainDraft = {
  status: CarrierStatus | null;
  personId: string | null;
  format: TrainFormat | null;
  trainedOn: string | null;
  qualificationUntil: string | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyTrainDraft = (): TrainDraft => ({ status: null, personId: null, format: null, trainedOn: null, qualificationUntil: null, order: [], custom: [] });

const customOf = (raw: unknown) => {
  const custom = Array.isArray(raw)
    ? raw.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as CustomChecklistItem;
      if (!row.id || !row.label?.trim()) return [];
      return [{ id: row.id, label: row.label.trim(), done: Boolean(row.done) }];
    })
    : [];
  return custom;
};

export const parseTrainDraft = (raw: string | null | undefined): TrainDraft => {
  const empty = emptyTrainDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.v !== 1) return empty;
    const custom = customOf(data.custom);
    const known = new Set(custom.map((item) => item.id));
    const order = Array.isArray(data.order) ? data.order.filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
    for (const item of custom) if (!order.includes(item.id)) order.push(item.id);
    return {
      status: carrierStatuses.find((item) => item.value === data.status)?.value ?? null,
      personId: typeof data.personId === 'string' ? data.personId : null,
      format: trainFormats.find((item) => item.value === data.format)?.value ?? null,
      trainedOn: typeof data.trainedOn === 'string' && data.trainedOn ? data.trainedOn : null,
      qualificationUntil: typeof data.qualificationUntil === 'string' && data.qualificationUntil ? data.qualificationUntil : null,
      order,
      custom,
    };
  } catch {
    return empty;
  }
};

export const serializeTrainDraft = (draft: TrainDraft) => JSON.stringify({ v: 1, ...draft });

export const trainClosePlan = (input: { status: CarrierStatus | null; personId: string | null; personName: string; trainedOn: string | null; qualificationUntil: string | null; hasFile: boolean; priorCertificate: boolean; productId: string | null; carrierId: string | null }) => {
  const readyStatus = input.status === 'trained' || input.status === 'active';
  return {
    button: 'Закрыть и перейти к подтверждению преподавателя',
    enabled: Boolean(input.personId) && readyStatus && Boolean(input.trainedOn) && (input.hasFile || input.priorCertificate),
    hint: null as string | null,
    status: input.status === 'active' ? 'active' as const : 'trained' as const,
    personId: input.personId,
    personName: input.personName,
    trainedOn: input.trainedOn,
    qualificationUntil: input.qualificationUntil,
    productId: input.productId,
    carrierId: input.carrierId,
  };
};

export type TrainClosePlan = ReturnType<typeof trainClosePlan>;
