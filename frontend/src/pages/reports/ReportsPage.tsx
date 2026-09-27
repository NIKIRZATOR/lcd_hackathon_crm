import { Flex, Tag } from 'antd';

import { useAuth } from '../../auth/useAuth';
import PageLayout from '../../components/pageLayout/PageLayout';

import ProgramsReport from './components/ProgramsReport/ProgramsReport';

const ReportsPage = () => {
  const { user } = useAuth();

  const roles = user?.roles ?? [];

  return (
    <PageLayout title="Отчёты" subtitle={`${user?.full_name ?? 'Пользователь'} · отчёт строится по ProgramInstance в доступном вам scope`}>
      <Flex vertical gap={20} style={{ padding: '24px 0' }}>
        <Tag color="blue" style={{ width: 'fit-content' }}>* B2C-показатели — агрегаты signals, не финансовые данные.</Tag>
        <ProgramsReport />
      </Flex>
    </PageLayout>
  );
};

export default ReportsPage;
