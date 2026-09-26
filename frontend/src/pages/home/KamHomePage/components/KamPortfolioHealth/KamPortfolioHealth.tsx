import { FolderOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import styles from './KamPortfolioHealth.module.scss';

const { Text } = Typography;

type HealthItem = {
  key: 'green' | 'yellow' | 'red';
  label: string;
  count: number;
  progress: number;
};

const HEALTH_ITEMS: HealthItem[] = [
  {
    key: 'green',
    label: 'Зелёные',
    count: 4,
    progress: 68,
  },
  {
    key: 'yellow',
    label: 'Жёлтые',
    count: 4,
    progress: 68,
  },
  {
    key: 'red',
    label: 'Красные',
    count: 3,
    progress: 48,
  },
];

const ACTIVE_PROGRAMS_COUNT = 11;

const KamPortfolioHealth = () => {
  const navigate = useNavigate();

  const handleOpenReports = () => {
    navigate('/reports');
  };

  return (
    <Card
      extra={<Text type="warning">* Демо</Text>}
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <div className={styles.header}>
        <div className={styles.icon}>
          <FolderOutlined />
        </div>

        <div className={styles.headerContent}>
          <Flex align="center" gap={6}>
            <Text strong className={styles.title}>
              Здоровье портфеля
            </Text>

            <Tooltip title="Распределение активных программ по уровню Health Score">
              <InfoCircleOutlined className={styles.infoIcon} />
            </Tooltip>
          </Flex>

          <Button type="text" className={styles.reportsButton} onClick={handleOpenReports}>
            Открыть в отчётах
            <RightOutlined />
          </Button>
        </div>
      </div>

      <div className={styles.healthList}>
        {HEALTH_ITEMS.map((item) => (
          <div key={item.key} className={styles.healthRow}>
            <Text className={styles.label}>{item.label}</Text>

            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${styles[item.key]}`}
                style={{ width: `${item.progress}%` }}
              />
            </div>

            <Text strong className={styles.count}>
              {item.count}
            </Text>
          </div>
        ))}
      </div>

      <div className={styles.summary}>
        <Text className={styles.summaryText}>{ACTIVE_PROGRAMS_COUNT} активных программ</Text>
      </div>
    </Card>
  );
};

export default KamPortfolioHealth;
