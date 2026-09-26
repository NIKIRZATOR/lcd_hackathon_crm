export type ChartExportFormat = 'png' | 'jpeg' | 'svg';

export type TableExportFormat = 'xls' | 'xlsx' | 'pdf';

export type TableExportColumn<T extends object> = {
  key: Extract<keyof T, string>;
  title: string;
};

export type ExportTableOptions<T extends object> = {
  data: T[];
  columns: TableExportColumn<T>[];
  format: TableExportFormat;
  fileName: string;
  sheetName?: string;
  pdfTitle?: string;
};

