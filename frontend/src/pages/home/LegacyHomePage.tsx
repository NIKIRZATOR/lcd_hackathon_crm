import { Flex } from 'antd';

import PageLayout from '../../components/pageLayout/PageLayout';

import DashboardAttentionTable from './components/DashboardAttentionTable';
import DashboardDynamics from './components/DashboardDynamics';
import DashboardFilters from './components/DashboardFilters';
import type { DashboardFiltersValues } from './components/DashboardFilters/types';
import DashboardInteractionFunnel from './components/DashboardInteractionFunnel';
import DashboardKpiCards from './components/DashboardKpiCards';
import DashboardProgramDemandTable from './components/DashboardProgramDemandTable';

import styles from './HomePage.module.scss';

const HomePage = () => {
  const handleApplyFilters = (values: DashboardFiltersValues) => {
    console.log('apply filters', values);
  };
  return (
    <PageLayout title="Главная">
      <Flex vertical gap={20} style={{ padding: '24px 0' }}>
        <DashboardFilters onApply={handleApplyFilters} />
        <DashboardKpiCards />
        <DashboardAttentionTable />
        <div className={styles.charts}>
          <DashboardInteractionFunnel />
          <DashboardDynamics />
        </div>
        <DashboardProgramDemandTable />
      </Flex>
    </PageLayout>
  );
};

export default HomePage;
