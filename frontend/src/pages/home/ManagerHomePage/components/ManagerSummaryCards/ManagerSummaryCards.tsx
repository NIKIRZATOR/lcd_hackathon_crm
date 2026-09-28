import {
  BankOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Card, Flex, Typography } from 'antd';

import styles from './ManagerSummaryCards.module.scss';

const { Text } = Typography;

type ManagerSummaryCardsProps = {
  kamCount?: number;
  organizationsCount?: number;
  activeProgramsCount?: number;
  redProgramsCount?: number;
};

const ManagerSummaryCards = ({
  kamCount,
  organizationsCount,
  activeProgramsCount,
  redProgramsCount,
}: ManagerSummaryCardsProps) => {
  return (
    <div className={styles.grid}>
      <Card
        className={styles.card}
        classNames={{
          body: styles.cardBody,
        }}
      >
        <Flex align="center" gap={12}>
          <div className={`${styles.icon} ${styles.team}`}>
            <TeamOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{kamCount ?? '—'}</Text>

            <Text type="secondary" className={styles.label}>
              KAM в команде
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
          <div className={`${styles.icon} ${styles.universities}`}>
            <BankOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{organizationsCount ?? '—'}</Text>

            <Text type="secondary" className={styles.label}>
              Организаций
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
          <div className={`${styles.icon} ${styles.programs}`}>
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
          <div className={`${styles.icon} ${styles.critical}`}>
            <ExclamationCircleOutlined />
          </div>

          <div className={styles.content}>
            <Text className={styles.value}>{redProgramsCount ?? '—'}</Text>

            <Text type="secondary" className={styles.label}>
              Красных программ
            </Text>
          </div>
        </Flex>
      </Card>
    </div>
  );
};

export default ManagerSummaryCards;
