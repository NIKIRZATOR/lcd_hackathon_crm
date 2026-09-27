import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Grid, Popover } from 'antd';
import { useMemo, useState } from 'react';

import ReportsTable from '../ReportsTable/ReportsTable';

import ManagerDetailsPopoverContent from './components/ManagerDetailsPopoverContent/ManagerDetailsPopoverContent';
import ManagerTabsFilter from './components/ManagerTabsFilter/ManagerTabsFilter';
import { MANAGER_REPORT_COLUMN_DEFINITIONS, MANAGER_REPORT_DEFAULT_COLUMN_KEYS } from './columns';
import { managerReportMock } from './mock';
import type { ManagerReportItem } from './types';

const KAM_OPTIONS = managerReportMock.map((item) => ({
  id: item.kamId,
  name: item.kam,
}));

const ManagerReport = () => {
  const screens = Grid.useBreakpoint();

  const isMobile = screens.sm === false;

  const [selectedKamId, setSelectedKamId] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedKamId === null) {
      return managerReportMock;
    }

    return managerReportMock.filter((item) => item.kamId === selectedKamId);
  }, [selectedKamId]);

  return (
    <Flex vertical gap={20}>
      <ManagerTabsFilter managers={KAM_OPTIONS} value={selectedKamId} onChange={setSelectedKamId} />

      <ReportsTable<ManagerReportItem>
        items={filteredItems}
        columnDefinitions={MANAGER_REPORT_COLUMN_DEFINITIONS}
        defaultColumnKeys={MANAGER_REPORT_DEFAULT_COLUMN_KEYS}
        subtitle={`Найдено KAM: ${filteredItems.length}`}
        exportConfig={{
          fileName: 'kam-portfolio-report',
          sheetName: 'Показатели KAM',
          pdfTitle: 'Показатели KAM',
        }}
        rowActions={{
          title: '',
          width: 44,
          render: (item) => (
            <Popover
              trigger={['hover', 'click']}
              placement={isMobile ? 'bottom' : 'bottomLeft'}
              arrow
              autoAdjustOverflow
              mouseEnterDelay={0.05}
              mouseLeaveDelay={0.08}
              destroyOnHidden
              content={<ManagerDetailsPopoverContent item={item} />}
            >
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                aria-label={`Подробнее о KAM ${item.kam}`}
              />
            </Popover>
          ),
        }}
      />
    </Flex>
  );
};

export default ManagerReport;
