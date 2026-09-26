import * as XLSX from 'xlsx';

import type { TableExportColumn, TableExportFormat } from './types';

type ExcelExportFormat = Extract<TableExportFormat, 'xls' | 'xlsx'>;

type ExportTableToExcelOptions<T extends object> = {
  data: T[];
  columns: TableExportColumn<T>[];
  format: ExcelExportFormat;
  fileName: string;
  sheetName: string;
};

const getCellValue = <T extends object>(item: T, key: Extract<keyof T, string>) => {
  const value = item[key];

  return value ?? '—';
};

export const exportTableToExcel = <T extends object>({
  data,
  columns,
  format,
  fileName,
  sheetName,
}: ExportTableToExcelOptions<T>) => {
  const rows = [
    columns.map((column) => column.title),

    ...data.map((item) => columns.map((column) => getCellValue(item, column.key))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = columns.map((_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
      const value = String(row[columnIndex] ?? '');

      return Math.max(max, value.length);
    }, 0);

    return {
      wch: Math.min(Math.max(maxLength + 2, 12), 50),
    };
  });

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const bookType = format === 'xls' ? 'biff8' : 'xlsx';

  XLSX.writeFile(workbook, `${fileName}.${format}`, {
    bookType,
  });
};

