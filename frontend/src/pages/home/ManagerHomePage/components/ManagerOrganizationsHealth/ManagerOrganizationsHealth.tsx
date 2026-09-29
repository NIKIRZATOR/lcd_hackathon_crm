import { Card, Typography } from 'antd';

import type { ManagerOrganizationHealthItem } from '../../types';

import styles from './ManagerOrganizationsHealth.module.scss';

const { Text, Title } = Typography;

type ManagerOrganizationsHealthProps = {
  items: ManagerOrganizationHealthItem[];
  onOrganizationClick?: (organizationId: number) => void;
};

const getProgramsLabel = (count: number) => {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'программ';
  }

  if (lastDigit === 1) {
    return 'программа';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'программы';
  }

  return 'программ';
};

const ManagerOrganizationsHealth = ({
  items,
  onOrganizationClick,
}: ManagerOrganizationsHealthProps) => {
  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <div className={styles.header}>
        <Title level={4} className={styles.title}>
          Состояние организаций
        </Title>

        <Text type="secondary" className={styles.subtitle}>
          Самый низкий Health среди активных программ организации
        </Text>
      </div>

      <div className={styles.list}>
        {items.map((item) => (
          <button
            key={item.organizationId}
            type="button"
            className={`${styles.item} ${styles[item.healthStatus]}`}
            onClick={() => onOrganizationClick?.(item.organizationId)}
          >
            <Text strong className={styles.organization}>
              {item.organizationName}
            </Text>

            <Text className={styles.kam}>{item.kamName}</Text>

            <Text type="secondary" className={styles.programs}>
              {item.programsCount} {getProgramsLabel(item.programsCount)}
            </Text>

            <Text strong className={styles.health}>
              Health {item.healthScore}
            </Text>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default ManagerOrganizationsHealth;
