export type ManagerProgramHealth = 'green' | 'yellow' | 'red';

export type ManagerProgramItem = {
  id: number;
  university: string;
  name: string;
  product: string;
  health: ManagerProgramHealth;
};

export type ManagerTaskItem = {
  id: number;
  university: string;
  program: string;
  reason: string;
};

export type ManagerOverdueTaskItem = ManagerTaskItem & {
  overdueDays: number;
};

export type ManagerReportItem = {
  id: number;
  kamId: number;
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
