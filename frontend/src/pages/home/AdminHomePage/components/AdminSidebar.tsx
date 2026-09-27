import { DatabaseOutlined } from '@ant-design/icons';
import { Button, Card, List, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import styles from '../AdminHomePage.module.scss';
import type { AdminHomeSummary } from '../types';

const statusColor = { OK: 'green', Warning: 'gold', Error: 'red', Unknown: 'default' };

const AdminSidebar = ({ summary }: { summary: AdminHomeSummary }) => {
  const navigate = useNavigate();
  return (
    <aside className={styles.sidebar}>
      <Card
        title="Интеграции"
        extra={
          <Button type="link" onClick={() => navigate('/management?tab=integrations')}>
            Все интеграции
          </Button>
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
        <List
          size="small"
          dataSource={summary.quick_actions}
          renderItem={(item) => (
            <List.Item>
              <Button type="link" onClick={() => navigate(item.path)}>
                {item.label}
              </Button>
            </List.Item>
          )}
        />
      </Card>
      <Card title="Состояние платформы">
        <List
          size="small"
          dataSource={summary.system_status}
          renderItem={(item) => (
            <List.Item>
              <DatabaseOutlined className={styles.systemIcon} />
              <div>
                <Typography.Text>{item.component}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{item.detail}</Typography.Text>
              </div>
              <span className={styles.status}>
                <Tag color={statusColor[item.status]}>{item.status}</Tag>
                <Typography.Text type="secondary">
                  {new Date(item.checked_at).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography.Text>
              </span>
            </List.Item>
          )}
        />
      </Card>
    </aside>
  );
};

export default AdminSidebar;
