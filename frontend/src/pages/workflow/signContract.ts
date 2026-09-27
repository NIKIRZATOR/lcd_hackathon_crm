import type { CustomChecklistItem } from './contactSearch';

export const SIGN_CONTRACT_SLA_DAYS = 10;
export const SIGNED_CONTRACT_KIND = 'signed_contract';

export const contractStatuses = [
  { value: 'sent', label: 'Направлен' },
  { value: 'received', label: 'Получен подписанный' },
  { value: 'returned', label: 'Возврат' },
] as const;

export type ContractStatus = (typeof contractStatuses)[number]['value'];

export const signContractChecks = [
  { id: 'received', label: 'Статус «получен подписанный»' },
  { id: 'number', label: 'Номер указан' },
  { id: 'date', label: 'Дата подписания указана' },
  { id: 'file', label: 'Подписанный договор приложен' },
] as const;

export type SignDraft = {
  number: string;
  status: ContractStatus | null;
  validUntil: string | null;
  signer: string;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptySignDraft = (): SignDraft => ({ number: '', status: null, validUntil: null, signer: '', order: [], custom: [] });

export const parseSignDraft = (raw: string | null | undefined): SignDraft => {
  const empty = emptySignDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as { v?: number; number?: unknown; status?: unknown; validUntil?: unknown; signer?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return { ...empty, number: raw.trim() };
    const status = contractStatuses.find((item) => item.value === data.status)?.value ?? null;
    const custom = Array.isArray(data.custom)
      ? data.custom.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as CustomChecklistItem;
        if (!row.id || !row.label?.trim()) return [];
        return [{ id: row.id, label: row.label.trim(), done: Boolean(row.done) }];
      })
      : [];
    const known = new Set(custom.map((item) => item.id));
    const order = Array.isArray(data.order) ? data.order.filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
    for (const item of custom) if (!order.includes(item.id)) order.push(item.id);
    return {
      number: typeof data.number === 'string' ? data.number : '',
      status,
      validUntil: typeof data.validUntil === 'string' && data.validUntil ? data.validUntil : null,
      signer: typeof data.signer === 'string' ? data.signer : '',
      order,
      custom,
    };
  } catch {
    return { ...empty, number: raw.trim() };
  }
};

export const serializeSignDraft = (draft: SignDraft) => JSON.stringify({
  v: 1,
  number: draft.number,
  status: draft.status,
  validUntil: draft.validUntil,
  signer: draft.signer,
  order: draft.order,
  custom: draft.custom,
});

export const signClosePlan = (input: { number: string; status: ContractStatus | null; signedOn: string | null; hasFile: boolean; validUntil: string | null; signer: string; fileId: string | null }) => {
  const enabled = input.status === 'received' && input.number.trim().length > 0 && Boolean(input.signedOn) && input.hasFile;
  return {
    button: 'Закрыть и перейти к подписанию лицензии',
    enabled,
    hint: null as string | null,
    number: input.number.trim(),
    signedOn: input.signedOn,
    validUntil: input.validUntil,
    signer: input.signer.trim(),
    fileId: input.fileId,
  };
};

export type SignClosePlan = ReturnType<typeof signClosePlan>;
