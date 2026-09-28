import { ClearOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip } from 'antd';

import { useAuth } from '../../auth/useAuth';
import PageLayout from '../../components/pageLayout/PageLayout';

import ManagerReport from './components/ManagerReport/ManagerReport';
import ProgramsRatingReport from './components/ProgramsRatingReport/ProgramsRatingReport';
import ProgramsReport from './components/ProgramsReport/ProgramsReport';
import ReportsTypeSwitcher from './components/ReportsTypeSwitcher/ReportsTypeSwitcher';
import { useReportType } from './hooks/useReportType';
import { useResetAllReportFilters } from './hooks/useResetAllReportFilters';
import { getReportsAccessConfig } from './reportsAccess';

const ReportsPage = () => {
  const { user } = useAuth();

  const roles = user?.roles ?? [];

  const { availableReportTypes, subtitle, showResponsible } = getReportsAccessConfig(roles);

  const { reportType, setReportType } = useReportType({
    availableReportTypes,
  });

  const { hasActiveFilters, resetAllReportFilters } = useResetAllReportFilters();

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
          <Flex align="center" justify="space-between" gap={16} wrap>
            <ReportsTypeSwitcher
              value={reportType}
              availableReportTypes={availableReportTypes}
              onChange={setReportType}
            />

            {hasActiveFilters && (
              <Tooltip title="Сбросить фильтры во всех типах отчётов">
                <Button type="text" icon={<ClearOutlined />} onClick={resetAllReportFilters}>
                  Сбросить все фильтры
                </Button>
              </Tooltip>
            )}
          </Flex>
        )}

        {renderReport()}
      </Flex>
    </PageLayout>
  );
};

export default ReportsPage;
