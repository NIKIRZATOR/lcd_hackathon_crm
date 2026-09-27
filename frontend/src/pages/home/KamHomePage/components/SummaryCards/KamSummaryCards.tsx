import {
  CalendarOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Card, Flex, Typography } from 'antd';

import styles from './KamSummaryCards.module.scss';

const { Text } = Typography;

type KamSummaryCardsProps = {
  todayTasksCount?: number;
  attentionCount?: number;
  activeProgramsCount?: number;
  academicWindowsCount?: number;
};

const KamSummaryCards = ({ todayTasksCount, attentionCount, activeProgramsCount, academicWindowsCount }: KamSummaryCardsProps) => {
  return (
    <div className={styles.grid}>
      <Card
        className={styles.card}
        classNames={{
          body: styles.cardBody,
        }}
      >
        <Flex align="center" gap={12}>
          <div className={`${styles.icon} ${styles.primary}`}>
            <FolderOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{activeProgramsCount ?? '—'}</Text>
            <Text type="secondary" className={styles.label}>
              Активных программ
            </Text>
          </div>
        </Flex>
      </Card>

      <Card
        className={styles.card}
        classNames={{
          body: styles.cardBody,
        }}
      >
        <Flex align="center" gap={12}>
          <div className={`${styles.icon} ${styles.calendar}`}>
            <CalendarOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{todayTasksCount ?? '—'}</Text>
            <Text type="secondary" className={styles.label}>
              Задач на сегодня
            </Text>
          </div>
        </Flex>
      </Card>

      <Card
        className={styles.card}
        classNames={{
          body: styles.cardBody,
        }}
      >
        <Flex align="center" gap={12}>
          <div className={`${styles.icon} ${styles.critical}`}>
            <ExclamationCircleOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{attentionCount ?? '—'}</Text>
            <Text type="secondary" className={styles.label}>
              Требуют внимания
            </Text>
          </div>
        </Flex>
      </Card>

      <Card
        className={styles.card}
        classNames={{
          body: styles.cardBody,
        }}
      >
        <Flex align="center" gap={12}>
          <div className={`${styles.icon} ${styles.success}`}>
            <ReadOutlined />
          </div>

          <div className={styles.content}>
            <Flex align="baseline" gap={4}>
              <Text className={styles.value}>{academicWindowsCount ?? '—'}</Text>
              <Text className={styles.valueSuffix}>окна</Text>
            </Flex>

            <Text type="secondary" className={styles.label}>
              До начала учебного семестра
            </Text>
          </div>
        </Flex>
      </Card>
    </div>
  );
};

export default KamSummaryCards;
