import { Tag } from 'antd';

import type { HealthBand } from '../screenModel';

const colors: Record<HealthBand, string> = { green: 'green', yellow: 'gold', red: 'red' };
const labels: Record<HealthBand, string> = { green: 'зелёное', yellow: 'жёлтое', red: 'красное' };

type HealthMarkProps = {
  score: number | null;
  band: HealthBand | null;
  empty?: string;
};

const HealthMark = ({ score, band, empty = 'Заходов нет' }: HealthMarkProps) => {
  if (score == null || !band) return <Tag>{empty}</Tag>;
  return <Tag color={colors[band]}>{score} · {labels[band]}</Tag>;
};

export default HealthMark;
