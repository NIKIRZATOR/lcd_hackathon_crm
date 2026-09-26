import type { ReportColumnDefinition, ReportColumnKey } from '../ReportsTable/types';

import type { ReportItem } from './types';

type InteractionReportColumnDefinition = ReportColumnDefinition<ReportItem> & {
  requiresResponsibleAccess?: boolean;
};

const INTERACTION_REPORT_COLUMN_DEFINITIONS: InteractionReportColumnDefinition[] = [
  {
    key: 'university',
    title: 'Вуз',
    minWidth: 160,
    sorter: (a, b) => a.university.localeCompare(b.university, 'ru'),
  },
  {
    key: 'program',
    title: 'Программа',
    minWidth: 160,
    sorter: (a, b) => a.program.localeCompare(b.program, 'ru'),
  },
  {
    key: 'product',
    title: 'ИТ-продукт',
    minWidth: 140,
    sorter: (a, b) => a.product.localeCompare(b.product, 'ru'),
  },
  {
    key: 'responsible',
    title: 'Ответственный',
    minWidth: 150,
    sorter: (a, b) => a.responsible.localeCompare(b.responsible, 'ru'),
    requiresResponsibleAccess: true,
  },
  {
    key: 'stage',
    title: 'Текущий этап',
    minWidth: 160,
    sorter: (a, b) => a.stage.localeCompare(b.stage, 'ru'),
  },
  {
    key: 'status',
    title: 'Статус',
    minWidth: 130,
    sorter: (a, b) => a.status.localeCompare(b.status, 'ru'),
  },
  {
    key: 'healthScore',
    title: 'Health score',
    minWidth: 110,
    sorter: (a, b) => a.healthScore - b.healthScore,
  },
  {
    key: 'sla',
    title: 'SLA',
    minWidth: 100,
    sorter: (a, b) => a.sla - b.sla,
    render: (item) => `${item.sla} дн.`,
  },
  {
    key: 'licenseStatus',
    title: 'Статус лицензии',
    minWidth: 140,
    sorter: (a, b) => a.licenseStatus.localeCompare(b.licenseStatus, 'ru'),
  },
  {
    key: 'licenseExpiresAt',
    title: 'Лицензия до',
    minWidth: 120,
    sorter: (a, b) => {
      if (!a.licenseExpiresAt) return 1;
      if (!b.licenseExpiresAt) return -1;

      return new Date(a.licenseExpiresAt).getTime() - new Date(b.licenseExpiresAt).getTime();
    },
  },
  {
    key: 'startDate',
    title: 'Дата начала',
    minWidth: 110,
    sorter: (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  },
  {
    key: 'daysInProgress',
    title: 'Дней в работе',
    minWidth: 120,
    sorter: (a, b) => a.daysInProgress - b.daysInProgress,
  },
  {
    key: 'students',
    title: 'Обучающиеся',
    minWidth: 120,
    sorter: (a, b) => a.students - b.students,
  },
  {
    key: 'streams',
    title: 'Потоки',
    minWidth: 80,
    sorter: (a, b) => a.streams - b.streams,
  },
  {
    key: 'applications',
    title: 'Заявки',
    minWidth: 80,
    sorter: (a, b) => a.applications - b.applications,
  },
];

const DEFAULT_COLUMN_KEYS: ReportColumnKey<ReportItem>[] = [
  'university',
  'program',
  'product',
  'responsible',
  'stage',
  'status',
  'healthScore',
  'sla',
  'licenseStatus',
  'licenseExpiresAt',
];

export const getAvailableInteractionReportColumns = (
  showResponsible: boolean,
): ReportColumnDefinition<ReportItem>[] =>
  INTERACTION_REPORT_COLUMN_DEFINITIONS.filter(
    (column) => showResponsible || !column.requiresResponsibleAccess,
  );

export const getDefaultInteractionReportColumnKeys = (
  showResponsible: boolean,
): ReportColumnKey<ReportItem>[] =>
  DEFAULT_COLUMN_KEYS.filter((key) => showResponsible || key !== 'responsible');
