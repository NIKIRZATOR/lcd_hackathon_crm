import { useRef } from 'react';

import EChart, { type EChartRef } from '../../../../shared/charts/EChart/EChart';
import DownloadButton from '../../../../components/DownloadButton/DownloadButton';
import { exportChart, type ChartExportFormat } from '../../../../shared/utils/exportChart';

import { dashboardInteractionFunnelMock } from './mocks';
import { getDashboardInteractionFunnelOptions } from './options';

import styles from './DashboardInteractionFunnel.module.scss';
import { theme } from 'antd';

const DashboardInteractionFunnel = () => {
  const chartRef = useRef<EChartRef>(null);
  const { token } = theme.useToken();

  const option = getDashboardInteractionFunnelOptions(dashboardInteractionFunnelMock, {
    primaryColor: token.colorPrimaryHover,
    backgroundColor: token.colorFillSecondary,
    textColor: token.colorText,
  });

  const handleDownload = (format: ChartExportFormat) => {
    const chart = chartRef.current?.getInstance();

    if (!chart) {
      return;
    }

    exportChart(chart, format, 'interaction-funnel');
  };

  return (
    <div className={styles.interactionFunnel}>
      <div className={styles.interactionFunnel__header}>
        <h2 className={styles.interactionFunnel__title}>Воронка взаимодействий</h2>

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
    </div>
  );
};

export default DashboardInteractionFunnel;
