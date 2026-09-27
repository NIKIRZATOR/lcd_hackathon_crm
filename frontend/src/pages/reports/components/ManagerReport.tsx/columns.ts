import type { ReportColumnDefinition, ReportColumnKey } from '../ReportsTable/types';

import type { ManagerReportItem } from './types';

export const MANAGER_REPORT_COLUMN_DEFINITIONS: ReportColumnDefinition<ManagerReportItem>[] = [
  {
    key: 'kam',
    title: 'KAM',
    minWidth: 160,
    sorter: (a, b) => a.kam.localeCompare(b.kam, 'ru'),
  },
  {
    key: 'activePrograms',
    title: 'Активные программы',
    minWidth: 150,
    sorter: (a, b) => a.activePrograms - b.activePrograms,
  },
  {
    key: 'greenHealth',
    title: 'Зелёный Health',
    minWidth: 130,
    sorter: (a, b) => a.greenHealth - b.greenHealth,
  },
  {
    key: 'yellowHealth',
    title: 'Жёлтый Health',
    minWidth: 130,
    sorter: (a, b) => a.yellowHealth - b.yellowHealth,
  },
  {
    key: 'redHealth',
    title: 'Красный Health',
    minWidth: 130,
    sorter: (a, b) => a.redHealth - b.redHealth,
  },
  {
    key: 'overdueTasks',
    title: 'Просроченные задачи',
    minWidth: 160,
    sorter: (a, b) => a.overdueTasks - b.overdueTasks,
  },
  {
    key: 'attentionTasks',
    title: 'Требуют внимания',
    minWidth: 150,
    sorter: (a, b) => a.attentionTasks - b.attentionTasks,
  },
];

export const MANAGER_REPORT_DEFAULT_COLUMN_KEYS: ReportColumnKey<ManagerReportItem>[] =
  MANAGER_REPORT_COLUMN_DEFINITIONS.map(({ key }) => key);
