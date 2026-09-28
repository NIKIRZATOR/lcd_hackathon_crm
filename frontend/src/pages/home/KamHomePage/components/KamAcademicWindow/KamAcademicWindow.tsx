import { CalendarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Card, Flex, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

import type { AcademicWindow } from '../../types';

import styles from './KamAcademicWindow.module.scss';

dayjs.locale('ru');

const { Text } = Typography;

type KamAcademicWindowProps = {
  academicWindow?: AcademicWindow;
  atRiskProgramsCount?: number;
};

const formatDate = (date?: string | null) => {
  if (!date) {
    return '—';
  }

  return dayjs(date).format('D MMMM');
};

const KamAcademicWindow = ({ academicWindow, atRiskProgramsCount = 0 }: KamAcademicWindowProps) => {
  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <div className={styles.header}>
        <div className={styles.icon}>
          <CalendarOutlined />
        </div>

        <div className={styles.headerContent}>
          <Flex align="center" gap={6}>
            <Text strong className={styles.title}>
              Учебное окно
            </Text>

            <Tooltip title="Период, до которого программу ещё можно успеть включить в учебный план">
              <InfoCircleOutlined className={styles.infoIcon} />
            </Tooltip>
          </Flex>

          {academicWindow && <Text className={styles.windowTitle}>{academicWindow.title}</Text>}
        </div>
      </div>

      {academicWindow ? (
        <>
          <div className={styles.content}>
            <Text className={styles.date}>{formatDate(academicWindow.plan_cutoff_on)}</Text>

            <Text className={styles.description}>
              Отсечение плана · {academicWindow.title.toLowerCase()}
            </Text>
          </div>

          <div className={styles.summary}>
            <Text className={styles.summaryText}>
              {atRiskProgramsCount > 0
                ? `${atRiskProgramsCount} программы требуют действий до этой даты`
                : 'Все программы идут по плану'}
            </Text>
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <Text className={styles.emptyText}>Актуального учебного окна нет</Text>
        </div>
      )}
    </Card>
  );
};

export default KamAcademicWindow;
