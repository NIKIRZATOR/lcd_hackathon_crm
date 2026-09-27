import { Tag } from 'antd';
import type { ReportColumnDefinition, ReportColumnKey } from '../../../ReportsTable/types';
import type { ProgramReportItem } from '../../types';

const health = (value: string) => <Tag color={value === 'green' ? 'green' : value === 'yellow' ? 'gold' : 'red'}>{value}</Tag>;
export const PROGRAM_REPORT_COLUMN_DEFINITIONS: ReportColumnDefinition<ProgramReportItem>[] = [
  { key: 'organization', title: 'Вуз', minWidth: 180 }, { key: 'direction', title: 'Направление', minWidth: 140 }, { key: 'product', title: 'Продукт', minWidth: 140 },
  { key: 'status', title: 'Статус', minWidth: 105 }, { key: 'stage', title: 'Текущий этап', minWidth: 150, render: (row) => row.stage ?? '—' }, { key: 'responsible', title: 'KAM', minWidth: 130, render: (row) => row.responsible ?? '—' },
  { key: 'playbook', title: '* Плейбук', minWidth: 140 }, { key: 'health_band', title: '* Health', minWidth: 100, render: (row) => health(row.health_band) }, { key: 'license_number', title: '* Лицензия', minWidth: 120, render: (row) => row.license_number ?? '—' },
  { key: 'applications', title: '* Заявки', minWidth: 90 }, { key: 'payment_records', title: '* Заказы', minWidth: 90 }, { key: 'students', title: '* Студенты', minWidth: 100 }, { key: 'streams', title: '* Потоки', minWidth: 80 },
];
export const PROGRAM_REPORT_DEFAULT_COLUMN_KEYS: ReportColumnKey<ProgramReportItem>[] = ['organization', 'direction', 'product', 'status', 'stage', 'responsible', 'health_band', 'applications', 'payment_records', 'students', 'streams'];
