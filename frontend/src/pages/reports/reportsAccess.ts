import type { ReportType } from './types';

export type ReportsAccess = 'kam' | 'manager' | 'admin';

type ReportsAccessConfig = {
  availableReportTypes: ReportType[];
  subtitle: (userName: string) => string;
  showResponsible: boolean;
};

const REPORTS_ACCESS_CONFIG: Record<ReportsAccess, ReportsAccessConfig> = {
  kam: {
    availableReportTypes: ['interactions'],
    subtitle: (userName) =>
      `${userName} · формирование и скачивание отчётов по вашим взаимодействиям`,
    showResponsible: false,
  },

  manager: {
    availableReportTypes: ['interactions', 'programs', 'manager'],
    subtitle: (userName) => `${userName} · формирование и скачивание отчётов по вашей группе KAM`,
    showResponsible: true,
  },

  admin: {
    availableReportTypes: ['interactions', 'programs', 'manager'],
    subtitle: (userName) =>
      `${userName} · формирование и скачивание отчётов по всем доступным данным`,
    showResponsible: true,
  },
};

export const getReportsAccess = (roles: string[]): ReportsAccess => {
  if (roles.includes('ADMIN')) {
    return 'admin';
  }

  if (roles.includes('MANAGER')) {
    return 'manager';
  }

  return 'kam';
};

export const getReportsAccessConfig = (roles: string[]) => {
  const access = getReportsAccess(roles);

  return REPORTS_ACCESS_CONFIG[access];
};
