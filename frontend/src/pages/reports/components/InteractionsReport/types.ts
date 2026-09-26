export type ReportStatus = 'В работе' | 'Требует внимания' | 'Просрочен' | 'Завершён';

export type ReportItem = {
  id: number;
  university: string;
  program: string;
  product: string;
  responsible: string;
  stage: string;
  status: ReportStatus;
  sla: number;

  licenseStatus: string;
  licenseExpiresAt: string | null;
  startDate: string;
  daysInProgress: number;
  students: number;
  streams: number;
  applications: number;
  healthScore: number;
};
