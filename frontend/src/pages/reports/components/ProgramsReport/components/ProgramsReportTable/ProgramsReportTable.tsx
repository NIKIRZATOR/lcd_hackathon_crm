import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Grid, Popover } from 'antd';

import ReportsTable from '../../../ReportsTable/ReportsTable';

import type { ProgramReportItem } from '../../types';

import ProgramDetailsPopoverContent from './components/ProgramDetailsPopoverContent/ProgramDetailsPopoverContent';
import { PROGRAM_REPORT_COLUMN_DEFINITIONS, PROGRAM_REPORT_DEFAULT_COLUMN_KEYS } from './columns';

type ProgramsReportTableProps = {
  items: ProgramReportItem[];
};

const ProgramsReportTable = ({ items }: ProgramsReportTableProps) => {
  const screens = Grid.useBreakpoint();

  const isMobile = screens.sm === false;

  return (
    <ReportsTable<ProgramReportItem>
      items={items}
      columnDefinitions={PROGRAM_REPORT_COLUMN_DEFINITIONS}
      defaultColumnKeys={PROGRAM_REPORT_DEFAULT_COLUMN_KEYS}
      subtitle={`Найдено программ: ${items.length}`}
      exportConfig={{
        fileName: 'programs-report',
        sheetName: 'Программы',
        pdfTitle: 'Отчёт по программам',
      }}
      rowActions={{
        title: '',
        width: 44,
        render: (item) => (
          <Popover
            trigger={['hover', 'click']}
            placement={isMobile ? 'bottom' : 'bottomRight'}
            arrow
            autoAdjustOverflow
            mouseEnterDelay={0.05}
            mouseLeaveDelay={0.08}
            destroyOnHidden
            content={<ProgramDetailsPopoverContent item={item} />}
          >
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              aria-label={`Подробнее о программе ${item.program}`}
            />
          </Popover>
        ),
      }}
    />
  );
};

export default ProgramsReportTable;

