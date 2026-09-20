import EChart from '../../../../shared/charts/EChart/EChart';

import { dashboardInteractionFunnelMock } from './mocks';
import { getDashboardInteractionFunnelOptions } from './options';

import styles from './DashboardInteractionFunnel.module.scss';

const DashboardInteractionFunnel = () => {
  const option = getDashboardInteractionFunnelOptions(dashboardInteractionFunnelMock);

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Воронка взаимодействий</h2>

      <div className={styles.chart}>
        <EChart option={option} />
      </div>
    </div>
  );
};

export default DashboardInteractionFunnel;
