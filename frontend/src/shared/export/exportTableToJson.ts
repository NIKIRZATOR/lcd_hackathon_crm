import { downloadBlob } from './download';
import type { TableExportColumn } from './types';

type ExportTableToJsonOptions<T extends object> = {
  data: T[];
  columns: TableExportColumn<T>[];
  fileName: string;
};

export const buildTableJson = <T extends object>(data: T[], columns: TableExportColumn<T>[]) =>
  JSON.stringify(
    {
      schema_version: '1.0',
      report_type: 'table',
      generated_at: new Date().toISOString(),
      filters: {},
      columns: columns.map(({ key, title }) => ({ key, title })),
      row_count: data.length,
      items: data.map((item) =>
        Object.fromEntries(columns.map(({ key }) => [key, item[key] ?? null])),
      ),
    },
    null,
    2,
  );

export const exportTableToJson = <T extends object>({
  data,
  columns,
  fileName,
}: ExportTableToJsonOptions<T>) => {
  const content = buildTableJson(data, columns);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });

  downloadBlob(blob, `${fileName}.json`);
};
