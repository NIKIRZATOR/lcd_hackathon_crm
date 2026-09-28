import { Tag } from 'antd';
import type { ReportColumnDefinition, ReportColumnKey } from '../ReportsTable/types';

import type { ReportItem } from './types/types';

type ProgramReportColumnDefinition = ReportColumnDefinition<ReportItem> & {
  requiresResponsibleAccess?: boolean;
};

const health = (band: string, score: number) => (
  <Tag color={band === 'green' ? 'green' : band === 'yellow' ? 'gold' : 'red'}>{score}</Tag>
);

const compareNullableStrings = (first: string | null, second: string | null) =>
  (first ?? '').localeCompare(second ?? '', 'ru');

const PROGRAM_REPORT_COLUMN_DEFINITIONS: ProgramReportColumnDefinition[] = [
  {
    key: 'organization',
    title: 'Организация',
    minWidth: 220,
    sorter: (a, b) => a.organization.localeCompare(b.organization, 'ru'),
  },
  {
    key: 'direction',
    title: 'Направление',
    minWidth: 180,
    sorter: (a, b) => a.direction.localeCompare(b.direction, 'ru'),
  },
  {
    key: 'product',
    title: 'ИТ-продукт',
    minWidth: 220,
    sorter: (a, b) => a.product.localeCompare(b.product, 'ru'),
  },
  {
    key: 'responsible',
    title: 'Ответственный',
    minWidth: 160,
    sorter: (a, b) => compareNullableStrings(a.responsible, b.responsible),
    render: (item) => item.responsible ?? '—',
    requiresResponsibleAccess: true,
  },
  {
    key: 'stage',
    title: 'Этап',
    minWidth: 180,
    sorter: (a, b) => compareNullableStrings(a.stage, b.stage),
    render: (item) => item.stage ?? '—',
  },
  {
    key: 'status',
    title: 'Статус',
    minWidth: 120,
    sorter: (a, b) => a.status.localeCompare(b.status, 'ru'),
  },
  {
    key: 'health_score',
    title: 'Health',
    minWidth: 110,
    sorter: (a, b) => a.health_score - b.health_score,
    render: (item) => health(item.health_band, item.health_score),
  },
  {
    key: 'playbook',
    title: 'Плейбук',
    minWidth: 190,
    sorter: (a, b) => a.playbook.localeCompare(b.playbook, 'ru'),
  },
  {
    key: 'license_number',
    title: 'Номер лицензии',
    minWidth: 150,
    sorter: (a, b) => compareNullableStrings(a.license_number, b.license_number),
    render: (item) => item.license_number ?? '—',
  },
  {
    key: 'applications',
    title: 'Заявки',
    minWidth: 90,
    sorter: (a, b) => a.applications - b.applications,
  },
  {
    key: 'students',
    title: 'Студенты',
    minWidth: 120,
    sorter: (a, b) => a.students - b.students,
  },
  {
    key: 'streams',
    title: 'Потоки',
    minWidth: 80,
    sorter: (a, b) => a.streams - b.streams,
  },
];

const DEFAULT_COLUMN_KEYS: ReportColumnKey<ReportItem>[] = [
  'organization',
  'direction',
  'product',
  'responsible',
  'stage',
  'status',
  'health_score',
  'playbook',
];

export const getAvailableProgramReportColumns = (
  showResponsible: boolean,
): ReportColumnDefinition<ReportItem>[] =>
  PROGRAM_REPORT_COLUMN_DEFINITIONS.filter(
    (column) => showResponsible || !column.requiresResponsibleAccess,
  );

export const getDefaultProgramReportColumnKeys = (
  showResponsible: boolean,
): ReportColumnKey<ReportItem>[] =>
  DEFAULT_COLUMN_KEYS.filter((key) => showResponsible || key !== 'responsible');
