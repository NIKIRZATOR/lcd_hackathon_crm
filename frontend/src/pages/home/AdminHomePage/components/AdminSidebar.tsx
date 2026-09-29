import { Button, Card, List, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import styles from '../AdminHomePage.module.scss';
import type { AdminHomeSummary } from '../types';

const imageNames: Record<string, string> = {
  Backend: 'backend.png',
  PostgreSQL: 'postgresql.png',
  Redis: 'Simpleicons-Team-Simple-Redis.512 (1).png',
  'Report queue': 'reports.png',
  'Backup scheduler': 'backup.png',
  MinIO: 'Minio_logo_light.png',
  Keycloak: 'keycloak-logo-png_seeklogo-505405.png',
};
const imageBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const formatStatusDetail = (detail: string) =>
  detail.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, (timestamp) => new Date(timestamp).toLocaleString('ru-RU'));

const AdminSidebar = ({ summary }: { summary: AdminHomeSummary }) => {
  const navigate = useNavigate();

  return (
    <aside className={styles.sidebar}>
      <Card
        title="Интеграции"
        extra={
          <Button onClick={() => navigate('/management?tab=integrations')}>Все интеграции</Button>
        }
      >
        <List
          size="small"
          dataSource={summary.integration_summary}
          locale={{ emptyText: 'Источники пока не настроены' }}
          renderItem={(item) => (
            <List.Item>
              <div>
                <Typography.Text strong>{item.source}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {item.mapped} mapped · {item.unmatched} unmatched · {item.errors} ошибок
                </Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {item.last_package_at
                    ? `Последний пакет: ${new Date(item.last_package_at).toLocaleString('ru-RU')}`
                    : 'Пакетов пока нет'}
                </Typography.Text>
              </div>
              <Tag color={item.errors ? 'red' : item.unmatched ? 'gold' : 'green'}>
                {item.errors ? 'Ошибка' : item.unmatched ? 'Внимание' : 'OK'}
              </Tag>
            </List.Item>
          )}
        />
      </Card>
      <Card title="Быстрые действия">
        <div className={styles.quickActions}>
          {summary.quick_actions.map((item) => (
            <Button key={item.path} onClick={() => navigate(item.path)}>
              {item.label}
            </Button>
          ))}
        </div>
      </Card>
      <Card title="Состояние платформы">
        <div className={styles.platformStatus} aria-label="Состояние сервисов">
          {summary.system_status.map((item) => (
            <Tooltip
              key={item.component}
              title={
                <div>
                  <strong>{item.component}</strong>
                  <br />
                  {formatStatusDetail(item.detail)}
                  <br />
                  {item.status} ·{' '}
                  {new Date(item.checked_at).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              }
            >
              <span
                className={`${styles.systemImage} ${styles[`systemStatus${item.status}`]}`}
                aria-label={`${item.component}: ${item.status}. ${item.detail}`}
              >
                {imageNames[item.component] && (
                  <img
                    src={`${imageBaseUrl}/images/${encodeURIComponent(imageNames[item.component])}`}
                    alt=""
                  />
                )}
              </span>
            </Tooltip>
          ))}
        </div>
      </Card>
    </aside>
  );
};

export default AdminSidebar;
