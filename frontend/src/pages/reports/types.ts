import type { PeriodValue } from '../../components/MobilePeriodPicker/MobilePeriodPicker';

export type ReportType = 'interactions' | 'programs' | 'manager';

export type ReportFilterOption = {
  id: number;
  name: string;
};

export type ReportsFilterOptions = {
  universities: ReportFilterOption[];
  programs: ReportFilterOption[];
  products: ReportFilterOption[];
  responsibles: ReportFilterOption[];
};

export type ReportsFiltersValues = {
  period: PeriodValue;
  universityIds: number[];
  programIds: number[];
  productIds: number[];
  responsibleIds: number[];
};
