import { ClockCircleOutlined, MailOutlined, PhoneOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons';

import styles from './ContactSearchStage.module.scss';

export type StageFactTile = {
  label: string;
  value: string;
  empty?: string;
  hint?: string;
  pending?: boolean;
  kind: 'person' | 'phone' | 'mail' | 'due';
  dueState?: 'ok' | 'today' | 'late';
  onClick?: () => void;
  disabled?: boolean;
};

const icons = {
  person: UserOutlined,
  phone: PhoneOutlined,
  mail: MailOutlined,
  due: ClockCircleOutlined,
} as const;

const iconClass = (tile: StageFactTile, missing: boolean) => {
  if (missing) return styles.iconWarning;
  if (tile.kind === 'person') return styles.iconResponsible;
  if (tile.kind === 'phone') return styles.iconPhone;
  if (tile.kind === 'mail') return styles.iconEmail;
  if (tile.dueState === 'late') return styles.iconDueLate;
  if (tile.dueState === 'today') return styles.iconDueToday;
  return styles.iconDue;
};

const tileTone = (tile: StageFactTile, missing: boolean) => {
  if (missing) return styles.tileWarning;
  if (tile.kind !== 'due') return '';
  if (tile.dueState === 'late') return styles.tileLate;
  if (tile.dueState === 'today') return styles.tileToday;
  return '';
};

const FactTile = ({ tile }: { tile: StageFactTile }) => {
  const missing = !tile.pending && Boolean(tile.empty) && !tile.value.trim();
  const Icon = icons[tile.kind];
  const className = `${styles.tile} ${tileTone(tile, missing)}`;
  const body = (
    <>
      <span className={`${styles.tileIcon} ${iconClass(tile, missing)}`} aria-hidden="true"><Icon /></span>
      <span className={styles.tileBody}>
        <span className={styles.tileLabel}>{tile.label}</span>
        {tile.pending ? <strong className={styles.tileValue}>Загрузка…</strong> : missing ? (
          <>
            <strong className={styles.tileValue}><span aria-hidden="true"><WarningOutlined /></span> {tile.empty}</strong>
            {tile.onClick && <span className={styles.tileHint}>Нажмите, чтобы заполнить</span>}
          </>
        ) : (
          <>
            <strong className={styles.tileValue}>{tile.value}</strong>
            {tile.hint && <span className={styles.tileHint}>{tile.hint}</span>}
          </>
        )}
      </span>
    </>
  );
  if (!tile.onClick) return <div className={className}>{body}</div>;
  return <button type="button" className={className} onClick={tile.onClick} disabled={tile.disabled}>{body}</button>;
};

const StageFactTiles = ({ tiles }: { tiles: StageFactTile[] }) => (
  <div className={styles.tiles}>
    {tiles.map((tile) => <FactTile key={tile.label} tile={tile} />)}
  </div>
);

export default StageFactTiles;
