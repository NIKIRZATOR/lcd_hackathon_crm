import type { Dayjs } from 'dayjs';

export type ReportsFiltersValues = {
  period: [Dayjs, Dayjs] | null;
  universityIds: number[];
  programIds: number[];
  productIds: number[];
  responsibleIds: number[];
};

