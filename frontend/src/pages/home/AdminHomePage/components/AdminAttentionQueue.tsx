import { Badge, Button, Card, Empty, List, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useTableLayout } from '../../../organizations/components/tableLayout';
import styles from '../AdminHomePage.module.scss';
import type { Activity, AttentionItem, RecentJob } from '../types';

const attentionColor = { P1: 'red', WARNING: 'gold', INFO: 'blue' };

type AdminAttentionQueueProps = { items: AttentionItem[]; activity: Activity[]; jobs: RecentJob[] };

const AdminAttentionQueue = ({ items, activity, jobs }: AdminAttentionQueueProps) => {
  const navigate = useNavigate();
  const layout = useTableLayout();

  return (
    <section className={styles.mainColumn}>
      <section className={styles.attentionSection} aria-labelledby="attention-title">
        <div className={styles.sectionHeader}>
          <Typography.Title level={4} id="attention-title">
            Требует внимания
          </Typography.Title>
          <Badge className={styles.attentionCount} count={items.length} showZero />
        </div>
        <Table<AttentionItem>
          rowKey={(item) => `${item.priority}-${item.event}`}
          dataSource={items}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                description="Административных проблем не найдено"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          size={layout === 'narrow' ? 'small' : 'middle'}
          scroll={layout === 'narrow' ? { x: 640 } : undefined}
          columns={[
            {
              title: 'Приоритет',
              dataIndex: 'priority',
              width: layout === 'wide' ? '10%' : 88,
              render: (value: AttentionItem['priority']) => (
                <Tag color={attentionColor[value]}>{value}</Tag>
              ),
            },
            { title: 'Событие', dataIndex: 'event' },
            { title: 'Источник', dataIndex: 'source', width: 180 },
            {
              title: 'Когда',
              dataIndex: 'occurred_at',
              width: 155,
              render: (value: string | null) =>
                value ? new Date(value).toLocaleString('ru-RU') : '—',
            },
            {
              title: 'Действие',
              width: 170,
              render: (_, item) => (
                <Button type="link" onClick={() => navigate(item.path)}>
                  {item.action}
                </Button>
              ),
            },
          ]}
        />
      </section>
      <Card
        title="Последняя активность"
        extra={<Button onClick={() => navigate('/management')}>Управление</Button>}
      >
        <List
          size="small"
          dataSource={activity}
          locale={{ emptyText: 'Административных событий пока нет' }}
          renderItem={(item) => (
            <List.Item>
              <Tag color={item.result === 'FAILED' ? 'red' : 'green'}>{item.result}</Tag>
              <span>
                <Typography.Text>{item.title}</Typography.Text>
                {item.details && (
                  <Typography.Text type="secondary"> · {item.details}</Typography.Text>
                )}
              </span>
              <Typography.Text type="secondary" className={styles.activityTime}>
                {new Date(item.occurred_at).toLocaleString('ru-RU')}
              </Typography.Text>
            </List.Item>
          )}
        />
      </Card>
      <Card title="Последние фоновые задачи">
        <List
          size="small"
          dataSource={jobs}
          locale={{ emptyText: 'Задач импорта и отчётов пока нет' }}
          renderItem={(item) => (
            <List.Item>
              <Tag>{item.kind}</Tag>
              <Typography.Text>{item.status}</Typography.Text>
              <Typography.Text type="secondary"> · {item.reason}</Typography.Text>
              <Typography.Text type="secondary" className={styles.activityTime}>
                {new Date(item.occurred_at).toLocaleString('ru-RU')}
              </Typography.Text>
            </List.Item>
          )}
        />
      </Card>
    </section>
  );
};

export default AdminAttentionQueue;
