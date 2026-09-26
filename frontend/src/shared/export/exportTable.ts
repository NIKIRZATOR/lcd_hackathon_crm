import type { ExportTableOptions } from './types';

export const exportTable = async <T extends object>({
  data,
  columns,
  format,
  fileName,
  sheetName = 'Отчёт',
  pdfTitle,
}: ExportTableOptions<T>) => {
  if (format === 'pdf') {
    const { exportTableToPdf } = await import('./exportTableToPdf');

    exportTableToPdf({
      data,
      columns,
      fileName,
      title: pdfTitle,
    });

    return;
  }

  const { exportTableToExcel } = await import('./exportTableToExcel');

  exportTableToExcel({
    data,
    columns,
    format,
    fileName,
    sheetName,
  });
};
