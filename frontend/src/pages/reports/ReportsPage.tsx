import { Flex, Tag } from 'antd';

import { useAuth } from '../../auth/useAuth';
import PageLayout from '../../components/pageLayout/PageLayout';

import InteractionsReport from './components/InteractionsReport/InteractionsReport';
import ManagerReport from './components/ManagerReport.tsx/ManagerReport';
import ProgramsReport from './components/ProgramsReport/ProgramsReport';
import ReportsTypeSwitcher from './components/ReportsTypeSwitcher/ReportsTypeSwitcher';
import { useReportType } from './hooks/useReportType';
import { getReportsAccessConfig } from './reportsAccess';

const ReportsPage = () => {
  const { user } = useAuth();

  const roles = user?.roles ?? [];

  const { availableReportTypes, subtitle, showResponsible } = getReportsAccessConfig(roles);

  const { reportType, setReportType } = useReportType({
    availableReportTypes,
  });

  const renderReport = () => {
    switch (reportType) {
      case 'programs':
        return <ProgramsReport />;

      case 'manager':
        return <ManagerReport />;

      case 'interactions':
      default:
        return <InteractionsReport showResponsible={showResponsible} />;
    }
  };

  return (
    <PageLayout title="Отчёты" subtitle={subtitle(user?.full_name ?? 'Пользователь')}>
      <Flex vertical gap={20} style={{ padding: '24px 0' }}>
        <Tag color="gold" style={{ width: 'fit-content' }}>
          * Демо-данные: отчёты пока используют моковые наборы.
        </Tag>
        {availableReportTypes.length > 1 && (
          <ReportsTypeSwitcher
            value={reportType}
            availableReportTypes={availableReportTypes}
            onChange={setReportType}
          />
        )}

        {renderReport()}
      </Flex>
    </PageLayout>
  );
};

export default ReportsPage;
