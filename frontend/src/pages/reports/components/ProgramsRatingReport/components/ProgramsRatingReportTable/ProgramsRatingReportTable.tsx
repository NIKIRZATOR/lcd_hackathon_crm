import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Grid, Popover } from 'antd';

import ReportsTable from '../../../ReportsTable/ReportsTable';

import type { ProgramRatingReportItem } from '../../types';

import ProgramDetailsPopoverContent from './components/ProgramDetailsPopoverContent/ProgramDetailsPopoverContent';
import {
  PROGRAM_RATING_REPORT_COLUMN_DEFINITIONS,
  PROGRAM_RATING_REPORT_DEFAULT_COLUMN_KEYS,
} from './columns';

type ProgramsRatingReportTableProps = {
  items: ProgramRatingReportItem[];
  total: number;
};

const ProgramsRatingReportTable = ({ items, total }: ProgramsRatingReportTableProps) => {
  const screens = Grid.useBreakpoint();

  const isMobile = screens.sm === false;

  return (
    <ReportsTable<ProgramRatingReportItem>
      items={items}
      columnDefinitions={PROGRAM_RATING_REPORT_COLUMN_DEFINITIONS}
      defaultColumnKeys={PROGRAM_RATING_REPORT_DEFAULT_COLUMN_KEYS}
      subtitle={`Найдено программ: ${total}`}
      exportConfig={{
        fileName: 'programs-rating-report',
        sheetName: 'Рейтинг программ',
        pdfTitle: 'Рейтинг программ',
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

export default ProgramsRatingReportTable;
