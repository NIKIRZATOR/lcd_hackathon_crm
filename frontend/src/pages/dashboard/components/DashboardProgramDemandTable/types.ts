export type DashboardProgramDemandItem = {
  id: string;
  program: string;
  product: string;
  universities: number;
  streams: number;
  students: number;
  applications: number;
  demandIndex: number;
};

export type ProgramDemandSort = 'demandIndex' | 'applications' | 'students' | 'universities';

export type ProgramDemandOrder = 'desc';

export type ProgramDemandExportFormat = 'xlsx' | 'png';

export type DashboardProgramDemandParams = {
  sortBy: ProgramDemandSort;
  order: ProgramDemandOrder;
};

export type DashboardProgramDemandResponse = {
  sortBy: ProgramDemandSort;
  order: ProgramDemandOrder;
  items: DashboardProgramDemandItem[];
};
