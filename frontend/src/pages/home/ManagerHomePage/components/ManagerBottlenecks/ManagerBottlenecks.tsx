import { Card, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ManagerBottleneckItem } from '../../types';

import styles from './ManagerBottlenecks.module.scss';

const { Text, Title } = Typography;

type ManagerBottlenecksProps = {
  items: ManagerBottleneckItem[];
};

const MIN_VISIBLE_PROGRESS = 8;

const getProgressClassName = (progress: number) => {
  if (progress >= 75) {
    return styles.critical;
  }

  if (progress >= 50) {
    return styles.warning;
  }

  if (progress >= 25) {
    return styles.healthy;
  }

  return styles.neutral;
};

const ManagerBottlenecks = ({ items }: ManagerBottlenecksProps) => {
  const navigate = useNavigate();

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.stageId - b.stageId;
      }),
    [items],
  );

  const maxCount = sortedItems[0]?.count ?? 0;

  const handleStageClick = (item: ManagerBottleneckItem) => {
    navigate(`/workflow?stage=${item.stageId}`);
  };

  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <div className={styles.header}>
        <Title level={4} className={styles.title}>
          Где застряли программы
        </Title>

        <Text type="secondary" className={styles.subtitle}>
          Количество программ на этапах
        </Text>
      </div>

      <div className={styles.list}>
        {sortedItems.map((item) => {
          const progress = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          const visibleProgress = item.count > 0 ? Math.max(progress, MIN_VISIBLE_PROGRESS) : 0;

          return (
            <button
              key={item.stageId}
              type="button"
              className={styles.row}
              onClick={() => handleStageClick(item)}
            >
              <Text className={styles.stageName}>{item.stageName}</Text>

              <div className={styles.progressTrack}>
                <div
                  className={`${styles.progressFill} ${getProgressClassName(progress)}`}
                  style={{
                    width: `${visibleProgress}%`,
                  }}
                />
              </div>

              <Text className={styles.count}>{item.count}</Text>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default ManagerBottlenecks;
