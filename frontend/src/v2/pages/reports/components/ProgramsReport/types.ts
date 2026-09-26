import type { PeriodValue } from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

export type ProgramsReportFilterOption = {
  id: number;
  name: string;
};

export type ProgramsReportFilterOptions = {
  universities: ProgramsReportFilterOption[];
  programs: ProgramsReportFilterOption[];
  products: ProgramsReportFilterOption[];
  responsibles: ProgramsReportFilterOption[];
};

export type ProgramsReportFiltersValues = {
  period: PeriodValue;
  universityIds: number[];
  programIds: number[];
  productIds: number[];
  responsibleIds: number[];
};

export type ProgramImplementationStatus = 'implemented' | 'inProgress';

export type ProgramReportMetricItem = {
  id: number;
  date: string;

  university: {
    id: number;
    name: string;
  };

  responsible: {
    id: number;
    name: string;
  };

  programId: number;
  program: string;

  productId: number;
  product: string;

  applications: number;
  students: number;
  streams: number;

  implementationStatus: ProgramImplementationStatus;
};

export type ProgramReportUniversityItem = {
  university: {
    id: number;
    name: string;
  };

  responsible: {
    id: number;
    name: string;
  };

  implementationStatus: ProgramImplementationStatus;

  applications: number;
  students: number;
  streams: number;
};

export type ProgramReportItem = {
  id: string;

  programId: number;
  program: string;

  productId: number;
  product: string;

  applications: number;
  students: number;
  streams: number;

  universities: number;
  responsibles: number;

  implementedUniversities: number;
  implementationShare: number;

  universityItems: ProgramReportUniversityItem[];
};

export type ProgramsReportMock = {
  filters: ProgramsReportFilterOptions;
  metrics: ProgramReportMetricItem[];
};

