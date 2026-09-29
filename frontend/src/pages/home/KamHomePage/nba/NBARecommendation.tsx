import { Tooltip, Typography } from 'antd';

import type { NbaRecommendation } from './nbaTypes';

import styles from './NBARecommendation.module.scss';

const { Text } = Typography;

type Props = {
  recommendation?: NbaRecommendation | null;
};

const NBARecommendation = ({ recommendation }: Props) => {
  if (!recommendation) return null;

  return (
    <div className={styles.block}>
      <Tooltip
        title="Next Best Action — следующее действие, которое система рекомендует по этой программе. Закройте этот пункт в карточке захода, чтобы продвинуть этап."
      >
        <span className={styles.star} aria-label="Next Best Action">
          ✦
        </span>
      </Tooltip>
      <Text className={styles.text}>{recommendation.text}</Text>
    </div>
  );
};

export default NBARecommendation;
