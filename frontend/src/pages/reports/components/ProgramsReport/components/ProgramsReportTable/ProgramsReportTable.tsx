import { Descriptions } from 'antd';
import ReportsTable from '../../../ReportsTable/ReportsTable';
import type { ProgramReportItem } from '../../types';
import type { TableExportFormat } from '../../../../../../shared/export/types';
import { PROGRAM_REPORT_COLUMN_DEFINITIONS, PROGRAM_REPORT_DEFAULT_COLUMN_KEYS } from './columns';

type Props = { items: ProgramReportItem[]; total: number; aggregates?: Record<string, number>; onDownload: (format: TableExportFormat, columns: string[]) => Promise<void>; onSort: (key: string | null, order: 'ascend' | 'descend' | null) => void };
const ProgramsReportTable = ({ items, total, aggregates = {}, onDownload, onSort }: Props) => <>
  <Descriptions size="small" column={4} title="* B2C aggregates текущей выборки" items={[
    { key: 'applications', label: 'Заявки', children: aggregates.applications ?? 0 }, { key: 'orders', label: 'Заказы', children: aggregates.payment_records ?? 0 }, { key: 'students', label: 'Студенты', children: aggregates.students ?? 0 }, { key: 'streams', label: 'Потоки', children: aggregates.streams ?? 0 },
  ]} />
  <ReportsTable<ProgramReportItem> items={items} columnDefinitions={PROGRAM_REPORT_COLUMN_DEFINITIONS} defaultColumnKeys={PROGRAM_REPORT_DEFAULT_COLUMN_KEYS} subtitle={`Найдено ProgramInstance: ${total}`} exportConfig={{ fileName: 'program-instances-report', sheetName: 'Программы', pdfTitle: 'Отчёт по программам' }} onDownload={onDownload} onSort={onSort} />
</>;
export default ProgramsReportTable;
