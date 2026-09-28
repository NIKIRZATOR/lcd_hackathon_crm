import type { PeriodValue } from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

export type ProgramsRatingReportFilterOption = {
  id: number;
  name: string;
};

export type ProgramsRatingReportFilterOptions = {
  universities: ProgramsRatingReportFilterOption[];
  programs: ProgramsRatingReportFilterOption[];
  products: ProgramsRatingReportFilterOption[];
  responsibles: ProgramsRatingReportFilterOption[];
};

export type ProgramsRatingReportFiltersValues = {
  period: PeriodValue;
  universityIds: number[];
  programIds: number[];
  productIds: number[];
  responsibleIds: number[];
};

export type ProgramImplementationStatus = 'implemented' | 'inProgress';

export type ProgramsRatingReportUniversityItem = {
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

export type ProgramRatingReportItem = {
  id: string;

  programId: number;
  program: string;

  productId: number;
  product: string;

  universities: number;
  implementedUniversities: number;
  implementationShare: number;

  applications: number;
  students: number;
  streams: number;

  rating: number;

  universityItems: ProgramsRatingReportUniversityItem[];
};

export type ProgramsRatingReportMock = {
  filters: ProgramsRatingReportFilterOptions;
  items: ProgramRatingReportItem[];
  total: number;
};
