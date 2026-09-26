import { Grid } from 'antd';
import type { TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

export const EXPAND_COLUMN_WIDTH = 36;

export type TableLayout = 'wide' | 'mid' | 'narrow';

const intermediateQuery = '(min-width: 986px) and (max-width: 1246px)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(intermediateQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

export const useTableLayout = (): TableLayout => {
  const compact = !Grid.useBreakpoint().lg;
  const intermediate = useSyncExternalStore(subscribe, () => window.matchMedia(intermediateQuery).matches, () => false);
  if (compact) return 'narrow';
  if (intermediate) return 'mid';
  return 'wide';
};

export type ResponsiveColumn<Row> = TableColumnsType<Row>[number] & {
  show: TableLayout[];
  detailLabel?: string;
};

export const hiddenRowDetails = <Row,>(layout: TableLayout, render: (row: Row) => ReactNode) => (
  layout === 'wide' ? undefined : { columnWidth: EXPAND_COLUMN_WIDTH, expandedRowRender: render }
);

export const visibleColumns = <Row,>(layout: TableLayout, columns: ResponsiveColumn<Row>[]) => (
  columns
    .filter((column) => column.show.includes(layout))
    .map(({ show, detailLabel, ...visible }) => {
      void show;
      void detailLabel;
      return visible;
    })
);

