import { Grid } from 'antd';
import type { TableColumnsType } from 'antd';

import type { WorkStatus } from '../../sectionData';

import styles from '../UniversityPanels.module.scss';

const { useBreakpoint } = Grid;

export const workLabel: Record<WorkStatus, string> = { active: 'Активно', done: 'Завершено', paused: 'На паузе' };
export const workClass: Record<WorkStatus, string> = { active: styles.green, done: styles.blue, paused: styles.yellow };

export const unique = (values: string[]) => [...new Set(values)];

export const byText = <Row,>(pick: (row: Row) => string) => (left: Row, right: Row) => pick(left).localeCompare(pick(right), 'ru');

export const byNumber = <Row,>(pick: (row: Row) => number) => (left: Row, right: Row) => pick(left) - pick(right);

export const useCompact = () => !useBreakpoint().lg;

type ShownColumn<Row> = TableColumnsType<Row>[number] & { wideOnly?: boolean };

export const shownColumns = <Row,>(compact: boolean, columns: ShownColumn<Row>[]) => (
  columns
    .filter((column) => !compact || !column.wideOnly)
    .map((column) => {
      const visible = { ...column };
      delete visible.wideOnly;
      return visible;
    })
);

export { styles };

