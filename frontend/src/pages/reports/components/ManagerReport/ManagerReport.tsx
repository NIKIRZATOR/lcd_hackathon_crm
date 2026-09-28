import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Grid, Popover, Spin } from 'antd';
import { useMemo } from 'react';

import { useManagerReport } from '../../hooks/useManagerReport';
import { useManagerReportFilterOptions } from '../../hooks/useManagerReportFilterOptions';
import { useManagerReportSearchParams } from '../../hooks/useManagerReportSearchParams';

import ReportsTable from '../ReportsTable/ReportsTable';

import ManagerDetailsPopoverContent from './components/ManagerDetailsPopoverContent/ManagerDetailsPopoverContent';
import ManagerTabsFilter from './components/ManagerTabsFilter/ManagerTabsFilter';
import { MANAGER_REPORT_COLUMN_DEFINITIONS, MANAGER_REPORT_DEFAULT_COLUMN_KEYS } from './columns';
import type { ManagerReportItem } from './types';

const ManagerReport = () => {
  const screens = Grid.useBreakpoint();

  const isMobile = screens.sm === false;

  const { options, error: filtersError } = useManagerReportFilterOptions();

  const { data, loading, error } = useManagerReport();

  const { selectedKamId, setSelectedKamId } = useManagerReportSearchParams();

  const filteredItems = useMemo(() => {
    if (selectedKamId === null) {
      return data;
    }

    return data.filter((item) => item.kamId === selectedKamId);
  }, [data, selectedKamId]);

  return (
    <Flex vertical gap={20}>
      {options && (
        <ManagerTabsFilter
          managers={options.managers}
          value={selectedKamId}
          onChange={setSelectedKamId}
        />
      )}

      {filtersError && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить список KAM"
          description={filtersError}
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить отчёт по менеджерам"
          description={error}
        />
      )}

      <Spin spinning={loading}>
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
      </Spin>
    </Flex>
  );
};

export default ManagerReport;
