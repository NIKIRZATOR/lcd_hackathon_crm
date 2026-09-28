import type { CustomChecklistItem } from './contactSearch';

export const DOCUMENT_PACKAGE_SLA_DAYS = 10;

export const documentSlots = [
  { kind: 'project_contract', title: 'Проект договора', check: 'Договор приложен', code: 'contract_project' },
  { kind: 'direction_materials', title: 'Материалы по направлению', check: 'Материалы приложены', code: 'direction_materials' },
  { kind: 'product_description', title: 'Описание продукта', check: 'Описание приложено', code: 'product_description' },
] as const;

export type DocumentSlotKind = (typeof documentSlots)[number]['kind'];

export type DocumentTasks = {
  order: string[];
  custom: CustomChecklistItem[];
};

export const emptyDocumentTasks = (): DocumentTasks => ({ order: [], custom: [] });

export const parseDocumentTasks = (raw: string | null | undefined): DocumentTasks => {
  if (!raw?.trim()) return emptyDocumentTasks();
  try {
    const data = JSON.parse(raw) as { v?: number; order?: unknown; custom?: unknown };
    if (data.v !== 1) return emptyDocumentTasks();
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
    return { order, custom };
  } catch {
    return emptyDocumentTasks();
  }
};

export const serializeDocumentTasks = (tasks: DocumentTasks) => JSON.stringify({ v: 1, order: tasks.order, custom: tasks.custom });

export type FrameworkContract = {
  id: string;
  number: string;
  status: string | null;
  validUntil: string | null;
  attachmentId: string | null;
};

export const activeFramework = (contracts: FrameworkContract[], now = new Date()) => contracts.find((contract) => {
  const status = (contract.status ?? '').toLowerCase();
  const open = !status || status === 'active' || status === 'signed' || status === 'действующий';
  if (!open) return false;
  if (!contract.validUntil) return true;
  const until = new Date(contract.validUntil);
  return Number.isNaN(until.getTime()) || until >= now;
}) ?? null;

export const documentClosePlan = (filled: Record<DocumentSlotKind, boolean>) => {
  const missing = documentSlots.filter((slot) => !filled[slot.kind]).map((slot) => slot.title.toLowerCase());
  return {
    button: 'Закрыть и перейти к подписанию договора',
    enabled: missing.length === 0,
    hint: null,
  };
};
