import { Flex, Tag } from 'antd';

import { useAuth } from '../../auth/useAuth';
import PageLayout from '../../components/pageLayout/PageLayout';

import ProgramsReport from './components/ProgramsReport/ProgramsReport';
import InteractionsReport from './components/InteractionsReport/InteractionsReport';
import ManagerReport from './components/ManagerReport.tsx/ManagerReport';
import ReportsTypeSwitcher from './components/ReportsTypeSwitcher/ReportsTypeSwitcher';
import { getReportsAccessConfig } from './reportsAccess';
import { useReportType } from './hooks/useReportType';

const ReportsPage = () => {
  const { user } = useAuth();

  const roles = user?.roles ?? [];
  const access = getReportsAccessConfig(roles);
  const { reportType, setReportType } = useReportType({ availableReportTypes: access.availableReportTypes });

  return (
    <PageLayout title="Отчёты" subtitle={access.subtitle(user?.full_name ?? 'Пользователь')}>
      <Flex vertical gap={20} style={{ padding: '24px 0' }}>
        <Tag color="blue" style={{ width: 'fit-content' }}>* B2C-показатели — агрегаты signals, не финансовые данные.</Tag>
        {access.availableReportTypes.length > 1 && <ReportsTypeSwitcher value={reportType} availableReportTypes={access.availableReportTypes} onChange={setReportType} />}
        {reportType === 'programs' && <ProgramsReport />}
        {reportType === 'interactions' && <><Tag color="gold" style={{ width: 'fit-content' }}>* Демо: legacy-взаимодействия используют сохранённый mock-набор.</Tag><InteractionsReport showResponsible={access.showResponsible} /></>}
        {reportType === 'manager' && <><Tag color="gold" style={{ width: 'fit-content' }}>* Демо: показатели команды используют сохранённый mock-набор.</Tag><ManagerReport /></>}
      </Flex>
    </PageLayout>
  );
};

export default ReportsPage;
