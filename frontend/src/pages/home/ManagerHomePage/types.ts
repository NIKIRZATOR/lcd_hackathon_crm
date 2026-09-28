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
  stageId: number;
  stageName: string;
  count: number;
};

export type ManagerOrganizationHealthStatus = 'critical' | 'warning' | 'healthy';

export type ManagerOrganizationHealthItem = {
  organizationId: number;
  organizationName: string;
  kamId: number;
  kamName: string;
  programsCount: number;
  healthScore: number;
  healthStatus: ManagerOrganizationHealthStatus;
};

export type ManagerProgramsRatingItem = {
  program: string;
  applications: number;
  students: number;
  streams: number;
  demandIndex: number;
};
