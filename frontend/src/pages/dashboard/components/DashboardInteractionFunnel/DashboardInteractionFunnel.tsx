import { theme } from 'antd';
import { useRef } from 'react';

import DownloadButton from '../../../../components/DownloadButton/DownloadButton';
import EChart, { type EChartRef } from '../../../../shared/charts/EChart/EChart';
import { exportChart } from '../../../../shared/export/exportChart';
import type { ChartExportFormat } from '../../../../shared/export/types';

import { dashboardInteractionFunnelMock } from './mocks';
import { getDashboardInteractionFunnelOptions } from './options';

import styles from './DashboardInteractionFunnel.module.scss';

const DashboardInteractionFunnel = () => {
  const { token } = theme.useToken();

  const chartRef = useRef<EChartRef>(null);

  const option = getDashboardInteractionFunnelOptions(dashboardInteractionFunnelMock, {
    primaryColor: token.colorPrimaryHover,
    backgroundColor: token.colorFillSecondary,
    textColor: token.colorText,
  });

  const handleDownload = async (format: ChartExportFormat) => {
    const chart = chartRef.current?.getInstance();

    if (!chart) {
      return;
    }

    await exportChart(chart, format, 'interaction-funnel');
  };

  return (
    <div className={styles.interactionFunnel}>
      <div className={styles.interactionFunnel__header}>
        <h2 className={styles.interactionFunnel__title}>Воронка взаимодействий</h2>

        <DownloadButton<ChartExportFormat>
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
    </div>
  );
};

export default DashboardInteractionFunnel;
