import { theme } from 'antd';
import type { EChartsType } from 'echarts/core';
import { useMemo, useRef } from 'react';

import DownloadButton from '../../../../components/DownloadButton/DownloadButton';
import EChart from '../../../../shared/charts/EChart/EChart';
import { exportChart, type ChartExportFormat } from '../../../../shared/utils/exportChart';

import { dashboardDynamicsMock } from './mocks';
import { getDashboardDynamicsOptions } from './options';

import styles from './DashboardDynamics.module.scss';

type EChartRef = {
  getInstance: () => EChartsType | null;
};

const DashboardDynamics = () => {
  const { token } = theme.useToken();

  const chartRef = useRef<EChartRef>(null);

  const option = useMemo(
    () =>
      getDashboardDynamicsOptions(dashboardDynamicsMock, {
        applications: token.colorInfo,
        students: token.colorPrimary,
        streams: token.orange,

        text: token.colorText,
        textSecondary: token.colorTextSecondary,

        border: token.colorBorderSecondary,
        tooltipBackground: token.colorBgElevated,
      }),
    [token],
  );

  const handleDownload = (format: ChartExportFormat) => {
    const chart = chartRef.current?.getInstance();

    if (!chart) {
      return;
    }

    exportChart(chart, format, 'dashboard-dynamics');
  };

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Динамика показателей</h2>

        <DownloadButton
          defaultFormat="png"
          options={[
            {
              key: 'png',
              label: 'PNG',
            },
            {
              key: 'jpeg',
              label: 'JPEG',
            },
            {
              key: 'svg',
              label: 'SVG',
            },
          ]}
          onDownload={handleDownload}
          trigger={['hover']}
        />
      </div>

      <div className={styles.chart}>
        <EChart ref={chartRef} option={option} />
      </div>
    </section>
  );
};

export default DashboardDynamics;
