import { ApiOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Card, Flex, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

import type { KamSignal } from '../../types';

import styles from './KamSignals.module.scss';

const { Text } = Typography;

type KamSignalsProps = {
  signals?: KamSignal[];
};

const getSignalTitle = (signal: KamSignal) => {
  if (signal.organizationName && signal.productName) {
    return `${signal.organizationName} · ${signal.productName}`;
  }

  if (signal.programName) {
    return signal.programName;
  }

  if (signal.organizationName) {
    return signal.organizationName;
  }

  return 'Новый сигнал';
};

const getSignalDescription = (signal: KamSignal) => {
  switch (signal.type) {
    case 'applications_period':
      return `Новые заявки за период: ${signal.value ?? 0}`;

    case 'applications_unmatched':
      return 'Есть заявки без сопоставленной программы';

    case 'students_update':
      return `Изменение числа студентов: +${signal.value ?? 0}`;

    case 'streams_update':
      return `Количество потоков: ${signal.value ?? 0}`;

    case 'course_started':
      return 'Курс стартовал';

    case 'teacher_activity':
      return signal.days !== undefined
        ? `Последняя активность преподавателя: ${signal.days} дн. назад`
        : 'Обновлена активность преподавателя';

    case 'lms_silence':
      return `Нет активности в LMS: ${signal.days ?? 0} дн.`;

    default:
      return '';
  }
};

const KamSignals = ({ signals = [] }: KamSignalsProps) => {
  const navigate = useNavigate();

  const handleSignalClick = (signal: KamSignal) => {
    if (!signal.programInstanceId) {
      return;
    }

    navigate(`/workflow/${signal.programInstanceId}`);
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
          <ApiOutlined />
        </div>

        <Flex align="center" gap={6}>
          <Text strong className={styles.title}>
            Сигналы сайта и LMS
          </Text>

          <Tooltip title="Новые данные о заявках, студентах, потоках и активности программ">
            <InfoCircleOutlined className={styles.infoIcon} />
          </Tooltip>
        </Flex>
      </div>

      {signals.length > 0 ? (
        <div className={styles.signalList}>
          {signals.map((signal) => {
            const clickable = Boolean(signal.programInstanceId);

            return (
              <button
                key={signal.id}
                type="button"
                className={styles.signal}
                disabled={!clickable}
                onClick={() => handleSignalClick(signal)}
              >
                <Tag
                  bordered={false}
                  className={`${styles.sourceTag} ${
                    signal.source === 'lms' ? styles.lmsTag : styles.websiteTag
                  }`}
                >
                  {signal.source === 'lms' ? 'LMS' : 'сайт'}
                </Tag>

                <div className={styles.signalContent}>
                  <Text strong className={styles.signalTitle}>
                    {getSignalTitle(signal)}
                  </Text>

                  <Text className={styles.signalDescription}>{getSignalDescription(signal)}</Text>
                </div>

                {clickable && <RightOutlined className={styles.arrow} />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <Text className={styles.emptyText}>Новых сигналов нет</Text>
        </div>
      )}

      <Text className={styles.hint}>Клик по сигналу открывает соответствующую программу</Text>
    </Card>
  );
};

export default KamSignals;
