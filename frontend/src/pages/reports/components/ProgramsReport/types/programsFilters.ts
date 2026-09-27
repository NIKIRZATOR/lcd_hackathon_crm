import type { Dayjs } from 'dayjs';

export type ProgramFilterOption = {
  id: string;
  name: string;
};

export type ProgramsFilterOptions = {
  organizations: ProgramFilterOption[];
  directions: ProgramFilterOption[];
  products: ProgramFilterOption[];
  responsibles: ProgramFilterOption[];
  playbooks: ProgramFilterOption[];
  stages: ProgramFilterOption[];
  health_bands: string[];
  statuses: string[];
};

export type ProgramsFilterValues = {
  period: [Dayjs, Dayjs] | null;
  organization_ids: string[];
  direction_ids: string[];
  product_ids: string[];
  responsible_user_ids: string[];
  playbook_ids: string[];
  stage_ids: string[];
  health_bands: string[];
  statuses: string[];
};

export const createEmptyProgramsFilters = (): ProgramsFilterValues => ({
  period: null,
  organization_ids: [],
  direction_ids: [],
  product_ids: [],
  responsible_user_ids: [],
  playbook_ids: [],
  stage_ids: [],
  health_bands: [],
  statuses: [],
});
