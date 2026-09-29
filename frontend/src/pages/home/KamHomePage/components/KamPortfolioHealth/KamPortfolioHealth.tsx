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

type KamPortfolioHealthProps = {
  health?: Partial<Record<HealthItem['key'], number>>;
  activePrograms?: number;
};

const KamPortfolioHealth = ({ health = {}, activePrograms = 0 }: KamPortfolioHealthProps) => {
  const navigate = useNavigate();
  const total = Math.max(activePrograms, 1);
  const items: HealthItem[] = [
    {
      key: 'green',
      label: 'Зелёные',
      count: health.green ?? 0,
      progress: ((health.green ?? 0) / total) * 100,
    },
    {
      key: 'yellow',
      label: 'Жёлтые',
      count: health.yellow ?? 0,
      progress: ((health.yellow ?? 0) / total) * 100,
    },
    {
      key: 'red',
      label: 'Красные',
      count: health.red ?? 0,
      progress: ((health.red ?? 0) / total) * 100,
    },
  ];

  const handleOpenReports = () => {
    navigate('/reports');
  };

  return (
    <Card
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

          <Button type="link" className={styles.reportsButton} onClick={handleOpenReports}>
            Открыть в отчётах
            <RightOutlined />
          </Button>
        </div>
      </div>

      <div className={styles.healthList}>
        {items.map((item) => (
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
        <Text className={styles.summaryText}>{activePrograms} активных программ</Text>
      </div>
    </Card>
  );
};

export default KamPortfolioHealth;
