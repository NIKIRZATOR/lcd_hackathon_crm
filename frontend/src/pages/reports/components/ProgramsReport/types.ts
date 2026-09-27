import type { PeriodValue } from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

export type ProgramsReportFilterOption = { id: string; name: string };
export type ProgramsReportFilterOptions = {
  universities: ProgramsReportFilterOption[]; directions: ProgramsReportFilterOption[]; products: ProgramsReportFilterOption[]; responsibles: ProgramsReportFilterOption[]; playbooks: ProgramsReportFilterOption[];
};
export type ProgramsReportFiltersValues = { period: PeriodValue; universityIds: string[]; directionIds: string[]; productIds: string[]; responsibleIds: string[]; playbookIds: string[] };
export type ProgramReportItem = { id: string; organization: string; direction: string; product: string; status: string; stage: string | null; responsible: string | null; playbook: string; health_band: string; health_score: number | null; license_number: string | null; applications: number; payment_records: number; students: number; streams: number };
