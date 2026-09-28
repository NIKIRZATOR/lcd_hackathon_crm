import type { CustomChecklistItem } from './contactSearch';

export const SIGN_LICENSE_SLA_DAYS = 10;
export const LICENSE_FILE_KIND = 'license';

export const licenseStatuses = [
  { value: 'requested', label: 'Запрошена' },
  { value: 'sent', label: 'Направлена' },
  { value: 'received', label: 'Получена подписанная' },
  { value: 'returned', label: 'Возврат' },
] as const;

export type LicenseStatus = (typeof licenseStatuses)[number]['value'];

export const signLicenseChecks = [
  { id: 'received', label: 'Статус «получена подписанная»' },
  { id: 'number', label: 'Номер указан' },
  { id: 'signed', label: 'Дата указана' },
  { id: 'term', label: 'Срок указан' },
  { id: 'file', label: 'Файл приложен' },
] as const;

export type LicenseCheckId = (typeof signLicenseChecks)[number]['id'];

export type LicenseDraft = {
  number: string;
  status: LicenseStatus | null;
  signedOn: string | null;
  volume: string;
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyLicenseDraft = (): LicenseDraft => ({ number: '', status: null, signedOn: null, volume: '', order: [], custom: [] });

export const parseLicenseDraft = (raw: string | null | undefined): LicenseDraft => {
  const empty = emptyLicenseDraft();
  if (!raw?.trim()) return empty;
  try {
    const data = JSON.parse(raw) as { v?: number; number?: unknown; status?: unknown; signedOn?: unknown; volume?: unknown; order?: unknown; custom?: unknown };
    if (data.v !== 1) return { ...empty, number: raw.trim() };
    const status = licenseStatuses.find((item) => item.value === data.status)?.value ?? null;
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
      signedOn: typeof data.signedOn === 'string' && data.signedOn ? data.signedOn : null,
      volume: typeof data.volume === 'string' ? data.volume : '',
      order,
      custom,
    };
  } catch {
    return { ...empty, number: raw.trim() };
  }
};

export const serializeLicenseDraft = (draft: LicenseDraft) => JSON.stringify({
  v: 1, number: draft.number, status: draft.status, signedOn: draft.signedOn, volume: draft.volume, order: draft.order, custom: draft.custom,
});

export const signLicensePlan = (input: { number: string; status: LicenseStatus | null; signedOn: string | null; validUntil: string | null; hasFile: boolean; volume: string; fileId: string | null }) => ({
  button: 'Закрыть и перейти к передаче и доступу',
  enabled: input.status === 'received' && input.number.trim().length > 0 && Boolean(input.signedOn) && Boolean(input.validUntil) && input.hasFile,
  hint: null as string | null,
  number: input.number.trim(),
  signedOn: input.signedOn,
  validUntil: input.validUntil,
  volume: input.volume.trim(),
  fileId: input.fileId,
});

export type SignLicensePlan = ReturnType<typeof signLicensePlan>;
