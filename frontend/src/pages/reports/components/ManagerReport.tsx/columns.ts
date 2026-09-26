import type { ReportColumnDefinition, ReportColumnKey } from '../ReportsTable/types';

import type { ManagerReportItem } from './types';

export const MANAGER_REPORT_COLUMN_DEFINITIONS: ReportColumnDefinition<ManagerReportItem>[] = [
  {
    key: 'kam',
    title: 'KAM',
    minWidth: 150,
    sorter: (a, b) => a.kam.localeCompare(b.kam, 'ru'),
  },
  {
    key: 'programs',
    title: 'Программ',
    minWidth: 90,
    sorter: (a, b) => a.programs - b.programs,
  },
  {
    key: 'activeInteractions',
    title: 'Активных взаимодействий',
    minWidth: 150,
    sorter: (a, b) => a.activeInteractions - b.activeInteractions,
  },
  {
    key: 'completedInteractions',
    title: 'Завершённых',
    minWidth: 120,
    sorter: (a, b) => a.completedInteractions - b.completedInteractions,
  },
  {
    key: 'overdueInteractions',
    title: 'Просроченных',
    minWidth: 120,
    sorter: (a, b) => a.overdueInteractions - b.overdueInteractions,
  },
  {
    key: 'attentionRequired',
    title: 'Требуют внимания',
    minWidth: 140,
    sorter: (a, b) => a.attentionRequired - b.attentionRequired,
  },
  {
    key: 'averageStageDuration',
    title: 'Среднее время этапа',
    minWidth: 150,
    sorter: (a, b) => a.averageStageDuration - b.averageStageDuration,
  },
];

export const MANAGER_REPORT_DEFAULT_COLUMN_KEYS: ReportColumnKey<ManagerReportItem>[] =
  MANAGER_REPORT_COLUMN_DEFINITIONS.map(({ key }) => key);
