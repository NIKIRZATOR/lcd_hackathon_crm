import type { ManagerReportItem } from '../../reports/components/ManagerReport/types';

export type ManagerLoadItem = Pick<
  ManagerReportItem,
  | 'id'
  | 'kamId'
  | 'kam'
  | 'activePrograms'
  | 'redHealth'
  | 'overdueTasks'
  | 'attentionTasks'
  | 'programItems'
>;

export type ManagerBottleneckItem = {
  stageId: string;
  stageName: string;
  count: number;
};

export type ManagerOrganizationHealthStatus = 'critical' | 'warning' | 'healthy';

export type ManagerOrganizationHealthItem = {
  organizationId: string;
  organizationName: string;
  kamId: string;
  kamName: string;
  programsCount: number;
  healthScore: number | null;
  healthStatus: ManagerOrganizationHealthStatus;
};

export type ManagerKamItem = {
  kamId: string;
  kamName: string;
};

export type ManagerDashboardSummary = {
  kamCount: number;
  organizationsCount: number;
  activeProgramsCount: number;
  redProgramsCount: number;
};

export type ManagerProgramsRatingItem = {
  program: string;
  applications: number;
  students: number;
  streams: number;
  demandIndex: number;
};
