export type ManagerProgramHealth = 'green' | 'yellow' | 'red';

export type ManagerFilterOption = {
  id: string;
  name: string;
};

export type ManagerReportFilterOptions = {
  managers: ManagerFilterOption[];
};

export type ManagerProgramItem = {
  id: string;
  university: string;
  name: string;
  product: string;
  health: ManagerProgramHealth;
};

export type ManagerTaskItem = {
  id: string;
  university: string;
  program: string;
  reason: string;
};

export type ManagerOverdueTaskItem = ManagerTaskItem & {
  overdueDays: number;
};

export type ManagerReportItem = {
  id: string;
  kamId: string;
  kam: string;

  activePrograms: number;

  greenHealth: number;
  yellowHealth: number;
  redHealth: number;

  overdueTasks: number;
  attentionTasks: number;

  programItems: ManagerProgramItem[];
  overdueTaskItems: ManagerOverdueTaskItem[];
  attentionTaskItems: ManagerTaskItem[];
};
