import type { Key, ReactNode } from 'react';

export type ReportTableItem = {
  id: Key;
};

export type ReportColumnKey<T extends ReportTableItem> = Extract<keyof T, string>;

export type ReportColumnDefinition<T extends ReportTableItem> = {
  key: ReportColumnKey<T>;
  title: string;
  minWidth: number;
  render?: (item: T) => ReactNode;
  sorter?: (a: T, b: T) => number;
};

export type ReportTableExportConfig = {
  fileName: string;
  sheetName: string;
  pdfTitle: string;
};

export type ReportRowActions<T extends ReportTableItem> = {
  title?: ReactNode;
  width?: number;
  render: (item: T) => ReactNode;
};
