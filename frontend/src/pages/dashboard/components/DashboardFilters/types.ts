import type { Dayjs } from 'dayjs';

export type DashboardFiltersValues = {
  period: [Dayjs, Dayjs] | null;
  universityIds: number[];
  programIds: number[];
  productIds: number[];
  responsibleIds: number[];
};

export type SelectFilterName = Exclude<keyof DashboardFiltersValues, 'period'>;
