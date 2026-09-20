import { Flex } from 'antd';
import PageLayout from '../../components/pageLayout/PageLayout';
import DashboardFilters from './components/DashboardFilters';
import type { DashboardFiltersValues } from './components/DashboardFilters/types';
import DashboardKpiCards from './components/DashboardKpiCards/DashboardKpiCards';
import DashboardAttentionTable from './components/DashboardAttentionTable/DashboardAttentionTable';
import DashboardInteractionFunnel from './components/DashboardInteractionFunnel/DashboardInteractionFunnel';

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
        <DashboardInteractionFunnel />
      </Flex>
    </PageLayout>
  );
};

export default HomePage;
