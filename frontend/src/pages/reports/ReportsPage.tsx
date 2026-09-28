import { Flex } from 'antd';

import { useAuth } from '../../auth/useAuth';
import PageLayout from '../../components/pageLayout/PageLayout';

import ProgramsReport from './components/ProgramsReport/ProgramsReport';
import ManagerReport from './components/ManagerReport.tsx/ManagerReport';
import ProgramsRatingReport from './components/ProgramsRatingReport/ProgramsRatingReport';
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
        return <ProgramsReport showResponsible={showResponsible} />;

      case 'manager':
        return <ManagerReport />;

      case 'programs-rating':
      default:
        return <ProgramsRatingReport />;
    }
  };

  return (
    <PageLayout title="Отчёты" subtitle={subtitle(user?.full_name ?? 'Пользователь')}>
      <Flex vertical gap={20} style={{ padding: '24px 0' }}>
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
