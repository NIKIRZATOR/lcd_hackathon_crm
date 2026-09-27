import { CalendarOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { NbaItem } from '../../types';

import styles from './KamActionQueue.module.scss';

const { Text, Title } = Typography;

type KamActionQueueProps = {
  items: NbaItem[];
};

const SEVERITY_CONFIG: Record<
  NbaItem['severity'],
  {
    label: string;
    className: string;
  }
> = {
  critical: {
    label: 'Критический',
    className: styles.critical,
  },
  high: {
    label: 'Высокий',
    className: styles.high,
  },
  medium: {
    label: 'Средний',
    className: styles.medium,
  },
  low: {
    label: 'Низкий',
    className: styles.low,
  },
};

const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const getDueText = (dueAt: string | null) => {
  if (!dueAt) {
    return null;
  }

  const dueDate = dayjs(dueAt);
  const today = dayjs().startOf('day');
  const diff = dueDate.startOf('day').diff(today, 'day');

  if (diff < 0) {
    return `Просрочено на ${Math.abs(diff)} дн.`;
  }

  if (diff === 0) {
    return 'Сегодня';
  }

  return `${dueDate.format('DD.MM.YYYY')} (через ${diff} дн.)`;
};

const KamActionQueue = ({ items }: KamActionQueueProps) => {
  const [sort, setSort] = useState<'priority' | 'date'>('priority');
  const navigate = useNavigate();

  const sortedItems = useMemo(() => {
    const result = [...items];

    if (sort === 'priority') {
      return result.sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
      );
    }

    return result.sort((a, b) => {
      if (!a.due_at) {
        return 1;
      }

      if (!b.due_at) {
        return -1;
      }

      return dayjs(a.due_at).valueOf() - dayjs(b.due_at).valueOf();
    });
  }, [items, sort]);

  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <Flex className={styles.header} align="center" justify="space-between" gap={16}>
        <Flex align="center" gap={10}>
          <Title level={4} className={styles.title}>
            Очередь действий
          </Title>

          <span className={styles.count}>{items.length} задач</span>
        </Flex>

        <Select
          value={sort}
          onChange={setSort}
          className={styles.sort}
          options={[
            {
              value: 'priority',
              label: 'По приоритету',
            },
            {
              value: 'date',
              label: 'По сроку',
            },
          ]}
        />
      </Flex>

      <div className={styles.list}>
        {sortedItems.map((item) => {
          const severity = SEVERITY_CONFIG[item.severity];
          const dueText = getDueText(item.due_at);

          return (
            <div key={item.id} className={`${styles.item} ${severity.className}`}>
              <div className={styles.severityColumn}>
                <span className={styles.severity}>
                  <span className={styles.severityDot} />
                  {severity.label}
                </span>
              </div>

              <div className={styles.content}>
                <div className={styles.itemTitle}>
                  <Text className={styles.organizationName}>{item.organization_name}</Text>

                  {item.product_name && (
                    <Text className={styles.productName}>· {item.product_name}</Text>
                  )}
                </div>

                <Text className={styles.reason}>{item.reason}</Text>

                {dueText && (
                  <Flex align="center" gap={5} className={styles.dueDate}>
                    <CalendarOutlined />
                    <span>{dueText}</span>
                  </Flex>
                )}
              </div>

              <Button
                type={
                  item.severity === 'critical' || item.severity === 'high' ? 'primary' : 'default'
                }
                className={styles.action}
                onClick={() => navigate(item.program_instance_id ? `/programs/${item.program_instance_id}?focus=${item.action_target ?? 'program'}` : `/organizations/${item.organization_id}`)}
              >
                {item.action}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default KamActionQueue;
