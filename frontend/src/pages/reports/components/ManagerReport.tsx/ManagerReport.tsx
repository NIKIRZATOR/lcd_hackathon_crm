import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Grid, Popover, Typography } from 'antd';
import { useMemo, useState } from 'react';

import ReportsTable from '../ReportsTable/ReportsTable';

import ManagerDetailsPopoverContent from './components/ManagerDetailsPopoverContent/ManagerDetailsPopoverContent';
import ManagerTabsFilter from './components/ManagerTabsFilter/ManagerTabsFilter';
import { MANAGER_REPORT_COLUMN_DEFINITIONS, MANAGER_REPORT_DEFAULT_COLUMN_KEYS } from './columns';
import { managerReportMock } from './mock';
import type { ManagerReportItem } from './types';

const { Title } = Typography;

const ManagerReport = () => {
  const screens = Grid.useBreakpoint();

  const isMobile = screens.sm === false;

  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);

  const managers = useMemo(
    () =>
      managerReportMock.map((item) => ({
        id: item.kamId,
        name: item.kam,
      })),
    [],
  );

  const filteredItems = useMemo(() => {
    if (selectedManagerId === null) {
      return managerReportMock;
    }

    return managerReportMock.filter((item) => item.kamId === selectedManagerId);
  }, [selectedManagerId]);

  return (
    <Flex vertical gap={20}>
      <Title level={4} style={{ margin: 0 }}>
        Показатели команды
      </Title>

      <ManagerTabsFilter
        managers={managers}
        value={selectedManagerId}
        onChange={setSelectedManagerId}
      />

      <ReportsTable<ManagerReportItem>
        items={filteredItems}
        columnDefinitions={MANAGER_REPORT_COLUMN_DEFINITIONS}
        defaultColumnKeys={MANAGER_REPORT_DEFAULT_COLUMN_KEYS}
        subtitle={`Найдено KAM: ${filteredItems.length}`}
        exportConfig={{
          fileName: 'team-performance-report',
          sheetName: 'Показатели команды',
          pdfTitle: 'Показатели команды',
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
