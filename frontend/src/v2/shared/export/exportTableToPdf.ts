import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

import type { TableExportColumn } from './types';

pdfMake.addVirtualFileSystem(pdfFonts);

type ExportTableToPdfOptions<T extends object> = {
  data: T[];
  columns: TableExportColumn<T>[];
  fileName: string;
  title?: string;
};

const A4_LANDSCAPE_WIDTH = 841.89;
const PAGE_MARGIN = 20;

const CELL_HORIZONTAL_PADDING = 4;

const MIN_COLUMN_WIDTH = 30;
const MAX_CONTENT_LENGTH = 30;

const getCellValue = <T extends object>(item: T, key: Extract<keyof T, string>) => {
  const value = item[key];

  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
};

const calculateColumnWidths = <T extends object>(data: T[], columns: TableExportColumn<T>[]) => {
  if (!columns.length) {
    return [];
  }

  const pageContentWidth = A4_LANDSCAPE_WIDTH - PAGE_MARGIN * 2;

  const tableHorizontalSpace = CELL_HORIZONTAL_PADDING * 2 * columns.length;

  const availableWidth = pageContentWidth - tableHorizontalSpace;

  const weights = columns.map((column) => {
    const maxContentLength = data.reduce((maxLength, item) => {
      const value = getCellValue(item, column.key);

      return Math.max(maxLength, value.length);
    }, column.title.length);

    return Math.min(maxContentLength, MAX_CONTENT_LENGTH);
  });

  const minWidthsTotal = MIN_COLUMN_WIDTH * columns.length;

  if (minWidthsTotal >= availableWidth) {
    const width = availableWidth / columns.length;

    return columns.map(() => width);
  }

  const remainingWidth = availableWidth - minWidthsTotal;

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) => {
    const additionalWidth = totalWeight > 0 ? (weight / totalWeight) * remainingWidth : 0;

    return MIN_COLUMN_WIDTH + additionalWidth;
  });
};

export const exportTableToPdf = <T extends object>({
  data,
  columns,
  fileName,
  title,
}: ExportTableToPdfOptions<T>) => {
  const widths = calculateColumnWidths(data, columns);

  const body = [
    columns.map((column) => ({
      text: column.title,
      bold: true,
      fillColor: '#F7F8FC',
      margin: [0, 4, 0, 4] as [number, number, number, number],
    })),

    ...data.map((item) =>
      columns.map((column) => ({
        text: getCellValue(item, column.key),
        margin: [0, 3, 0, 3] as [number, number, number, number],
      })),
    ),
  ];

  const documentDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',

    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN],

    content: [
      ...(title
        ? [
            {
              text: title,
              fontSize: 16,
              bold: true,
              margin: [0, 0, 0, 12] as [number, number, number, number],
            },
          ]
        : []),

      {
        table: {
          headerRows: 1,
          widths,
          body,
        },

        layout: {
          hLineWidth: (i) => (i === 1 ? 1 : 0.5),

          vLineWidth: () => 0,

          hLineColor: () => '#D9D9D9',

          paddingLeft: () => CELL_HORIZONTAL_PADDING,

          paddingRight: () => CELL_HORIZONTAL_PADDING,

          paddingTop: () => 2,

          paddingBottom: () => 2,
        },
      },
    ],

    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
    },
  };

  pdfMake.createPdf(documentDefinition).download(`${fileName}.pdf`);
};

