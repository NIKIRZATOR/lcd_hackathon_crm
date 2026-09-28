import {
  AuditOutlined,
  ClusterOutlined,
  FileTextOutlined,
  ImportOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from '../AdminHomePage.module.scss';
import type { AdminHomeSummary } from '../types';

type SummaryCard = {
  key: string;
  title: string;
  value: number;
  suffix: string;
  description: string;
  icon: ReactNode;
  path: string;
};

const AdminSummaryCards = ({ cards }: Pick<AdminHomeSummary, 'cards'>) => {
  const navigate = useNavigate();
  const items: SummaryCard[] = [
    {
      key: 'integrations',
      title: 'Интеграции',
      value: cards.integration_errors,
      suffix: cards.integration_errors === 1 ? ' ошибка' : ' ошибок',
      description: `${cards.unmatched_integrations} без сопоставления`,
      icon: <ClusterOutlined />,
      path: '/management?tab=integrations',
    },
    {
      key: 'imports',
      title: 'Импорты',
      value: cards.import_jobs,
      suffix: ' с ошибками',
      description: 'Глобальные загрузки данных',
      icon: <ImportOutlined />,
      path: '/management',
    },
    {
      key: 'mappings',
      title: 'Сопоставления',
      value: cards.unmatched_integrations,
      suffix: ' unmatched',
      description: 'Требуют решения ADMIN',
      icon: <SafetyCertificateOutlined />,
      path: '/management?tab=integrations',
    },
    {
      key: 'reports',
      title: 'Отчёты',
      value: cards.running_reports,
      suffix: ' в очереди',
      description: cards.report_jobs
        ? `${cards.report_jobs} завершились с ошибкой`
        : 'Ошибок в очереди нет',
      icon: <FileTextOutlined />,
      path: '/reports',
    },
    {
      key: 'users',
      title: 'Пользователи',
      value: cards.active_users,
      suffix: ' активных',
      description: 'Текущие учётные записи CRM',
      icon: <TeamOutlined />,
      path: '/management',
    },
    {
      key: 'templates',
      title: 'Эталоны',
      value: cards.draft_playbooks,
      suffix: ' черновика',
      description: 'Шаблоны workflow',
      icon: <AuditOutlined />,
      path: '/management?tab=playbooks',
    },
  ];

  return (
    <Row gutter={[16, 16]} className={styles.summaryCards}>
      {items.map((item) => (
        <Col key={item.key} xs={24} sm={12} lg={8} xxl={4}>
          <Card className={styles.summaryCard} hoverable onClick={() => navigate(item.path)}>
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon}>{item.icon}</span>
              <Typography.Text strong>{item.title}</Typography.Text>
            </div>
            <Statistic value={item.value} suffix={item.suffix} valueStyle={{ fontSize: 22 }} />
            <Typography.Text type="secondary">{item.description}</Typography.Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default AdminSummaryCards;
