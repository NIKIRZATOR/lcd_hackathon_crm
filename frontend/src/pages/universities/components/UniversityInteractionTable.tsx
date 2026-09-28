import { Grid, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';

import { isInPeriod, usePeriod } from '../domain/period';
import type { CardInteraction, StageTone } from '../domain/universityCard';

import styles from './UniversityInteractionTable.module.scss';

const { useBreakpoint } = Grid;

const stageClassName: Record<StageTone, string> = {
  danger: styles.stageDanger,
  progress: styles.stageProgress,
  warning: styles.stageWarning,
  success: styles.stageSuccess,
  neutral: styles.stageNeutral,
};

const dotClassName: Record<StageTone, string> = {
  danger: styles.dotDanger,
  progress: styles.dotProgress,
  warning: styles.dotWarning,
  success: styles.dotSuccess,
  neutral: styles.dotNeutral,
};

type UniversityInteractionTableProps = {
  rows: CardInteraction[];
  preview?: boolean;
  onOpen?: (id: string) => void;
};

const UniversityInteractionTable = ({ rows, preview = false, onOpen }: UniversityInteractionTableProps) => {
  const screens = useBreakpoint();
  const compact = !screens.xl;
  const period = usePeriod();
  const data = (preview ? rows.slice(0, 4) : rows).filter((row) => isInPeriod(row.at, period));

  const stageTag = (item: CardInteraction) => (
    <Tag className={`${styles.stage} ${stageClassName[item.tone]}`}>{item.stage}</Tag>
  );

  const columns: TableColumnsType<CardInteraction> = compact
    ? [
        {
          title: 'Программа / продукт',
          key: 'program',
          sorter: (left, right) => `${left.program} ${left.product}`.localeCompare(`${right.program} ${right.product}`, 'ru'),
          render: (_value, item) => <span className={styles.program}>{item.program} · {item.product}</span>,
        },
        {
          title: 'Этап',
          key: 'stage',
          width: 72,
          align: 'center',
          render: (_value, item) => (
            <Tooltip title={item.stage}>
              <span className={`${styles.dot} ${dotClassName[item.tone]}`} aria-label={item.stage} />
            </Tooltip>
          ),
        },
      ]
    : [
        {
          title: 'Программа / продукт',
          key: 'program',
          sorter: (left, right) => `${left.program} ${left.product}`.localeCompare(`${right.program} ${right.product}`, 'ru'),
          render: (_value, item) => <span className={styles.program}>{item.program} · {item.product}</span>,
        },
        {
          title: 'Текущий этап',
          sorter: (left, right) => left.stage.localeCompare(right.stage, 'ru'),
          key: 'stage',
          width: 150,
          render: (_value, item) => stageTag(item),
        },
        { title: 'Следующий шаг', dataIndex: 'nextStep', key: 'nextStep', sorter: (left, right) => left.nextStep.localeCompare(right.nextStep, 'ru') },
        { title: 'Срок', dataIndex: 'due', key: 'due', width: 110, sorter: (left, right) => left.due.localeCompare(right.due, 'ru') },
        { title: 'Ответственный', dataIndex: 'owner', key: 'owner', width: 140, sorter: (left, right) => left.owner.localeCompare(right.owner, 'ru') },
      ];

  return (
    <Table
      className={styles.table}
      rowKey="id"
      size="middle"
      pagination={false}
      columns={columns}
      dataSource={data}
      locale={{ emptyText: 'Взаимодействий пока нет' }}
      onRow={onOpen ? (row) => ({
        onClick: (event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.ant-table-row-expand-icon, .ant-table-row-expand-icon-cell')) return;
          onOpen(String(row.id));
        },
        style: { cursor: 'pointer' },
      }) : undefined}
      expandable={compact ? {
        expandedRowRender: (item) => (
          <div className={styles.details}>
            <div><span>Этап</span>{stageTag(item)}</div>
            <div><span>Следующий шаг</span><strong>{item.nextStep}</strong></div>
            <div><span>Срок</span><strong>{item.due}</strong></div>
            <div><span>Ответственный</span><strong>{item.owner}</strong></div>
          </div>
        ),
      } : undefined}
    />
  );
};

export default UniversityInteractionTable;
