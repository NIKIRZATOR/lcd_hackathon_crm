import type { CustomChecklistItem } from './contactSearch';

export const TRANSFER_SLA_DAYS = 7;
export const TRANSFER_FILE_KIND = 'transfer';

export const transferStatuses = [
  { value: 'not_transferred', label: 'Не передана' },
  { value: 'requested', label: 'Запрошена у вендора' },
  { value: 'transferred', label: 'Передана' },
  { value: 'revoked', label: 'Отозвана' },
] as const;

export type TransferStatus = (typeof transferStatuses)[number]['value'];

export const transferChecks = [
  { id: 'license', label: 'Лицензия захода есть' },
  { id: 'status', label: 'Статус «передана»' },
  { id: 'recipient', label: 'Получатель выбран' },
  { id: 'access', label: 'Сведения о доступе указаны' },
  { id: 'date', label: 'Дата передачи указана' },
  { id: 'file', label: 'Файл приложен' },
] as const;

export type TransferCheckId = (typeof transferChecks)[number]['id'];

export type TransferDraft = {
  status: TransferStatus | null;
  recipientId: string | null;
  access: string;
  transferredOn: string | null;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyTransferDraft = (): TransferDraft => ({ status: null, recipientId: null, access: '', transferredOn: null, order: [], custom: [] });

export const parseTransferDraft = (raw: string | null | undefined, accessText?: string | null): TransferDraft => {
  const empty = emptyTransferDraft();
  if (!raw?.trim()) return { ...empty, access: accessText?.trim() && !accessText.trim().startsWith('{') ? accessText.trim() : '' };
  try {
    const data = JSON.parse(raw) as { v?: number; status?: unknown; recipientId?: unknown; access?: unknown; transferredOn?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return { ...empty, access: raw.trim() };
    const status = transferStatuses.find((item) => item.value === data.status)?.value ?? null;
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
      status,
      recipientId: typeof data.recipientId === 'string' ? data.recipientId : null,
      access: typeof data.access === 'string' ? data.access : '',
      transferredOn: typeof data.transferredOn === 'string' && data.transferredOn ? data.transferredOn : null,
      order,
      custom,
    };
  } catch {
    return { ...empty, access: raw.trim() };
  }
};

export const serializeTransferDraft = (draft: TransferDraft) => JSON.stringify({
  v: 1, status: draft.status, recipientId: draft.recipientId, access: draft.access, transferredOn: draft.transferredOn, order: draft.order, custom: draft.custom,
});

export const transferClosePlan = (input: { status: TransferStatus | null; recipientId: string | null; access: string; transferredOn: string | null; hasFile: boolean; hasLicense: boolean; licenseId: string | null; fileId: string | null }) => ({
  button: 'Закрыть и перейти к обучению преподавателя',
  enabled: input.status === 'transferred' && Boolean(input.recipientId) && input.access.trim().length > 0 && Boolean(input.transferredOn) && input.hasFile && input.hasLicense,
  hint: null as string | null,
  status: input.status === 'transferred' ? 'transferred' : input.status === 'requested' ? 'in_progress' : input.status === 'revoked' ? 'revoked' : 'not_transferred',
  access: input.access.trim(),
  transferredOn: input.transferredOn,
  licenseId: input.licenseId,
  fileId: input.fileId,
});

export type TransferClosePlan = ReturnType<typeof transferClosePlan>;
