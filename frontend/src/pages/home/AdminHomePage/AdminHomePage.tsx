import { Alert, Button, Flex, Spin, Typography } from 'antd';
import PageLayout from '../../../components/pageLayout/PageLayout';

import AdminAttentionQueue from './components/AdminAttentionQueue';
import AdminSidebar from './components/AdminSidebar';
import AdminSummaryCards from './components/AdminSummaryCards';
import styles from './AdminHomePage.module.scss';
import { useAdminHome } from './useAdminHome';

const AdminHomePage = () => {
  const { summary, error, refreshing, refresh } = useAdminHome();

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!summary) return <Spin size="large" />;

  return (
    <PageLayout>
      <div className={styles.page}>
        <Flex justify="space-between" align="start" gap={16} className={styles.pageHeader}>
          <div>
            <Typography.Title level={2} className={styles.pageTitle}>
              Платформа
            </Typography.Title>
            <Typography.Paragraph type="secondary" className={styles.pageSubtitle}>
              Контроль данных, интеграций, пользователей и технического состояния RTK EduFlow.
              Операционная работа KAM по вузам не управляется с этой страницы.
            </Typography.Paragraph>
          </div>
          <Button
            className={styles.actionButton}
            loading={refreshing}
            onClick={() => void refresh()}
          >
            Обновить
          </Button>
        </Flex>
        <AdminSummaryCards cards={summary.cards} />
        <div className={styles.dashboard}>
          <AdminAttentionQueue
            items={summary.attention_items}
            activity={summary.recent_activity}
            jobs={summary.recent_jobs}
          />
          <AdminSidebar summary={summary} />
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminHomePage;
