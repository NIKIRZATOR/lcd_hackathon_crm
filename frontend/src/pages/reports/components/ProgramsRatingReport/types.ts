import type { PeriodValue } from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

export type ProgramsRatingReportFilterOption = {
  id: string;
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
  universityIds: string[];
  programIds: string[];
  productIds: string[];
  responsibleIds: string[];
};

export type ProgramImplementationStatus = 'implemented' | 'inProgress';

export type ProgramsRatingReportUniversityItem = {
  university: {
    id: string;
    name: string;
  };

  responsible: {
    id: string | null;
    name: string;
  };

  implementationStatus: ProgramImplementationStatus;

  applications: number;
  students: number;
  streams: number;
};

export type ProgramRatingReportItem = {
  id: string;

  programId: string;
  program: string;

  productId: string;
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

export type ProgramsRatingReportResponse = {
  items: ProgramRatingReportItem[];
  total: number;
};
