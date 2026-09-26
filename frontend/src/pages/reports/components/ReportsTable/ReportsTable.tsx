import {
  DownloadOutlined,
  DownOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Table } from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { exportTable } from '../../../../shared/export/exportTable';
import type { TableExportColumn, TableExportFormat } from '../../../../shared/export/types';

import ReportColumnsSelector from './components/ReportColumnsSelector';
import {
  EXPAND_COLUMN_WIDTH,
  useResponsiveReportColumns,
} from './hooks/useResponsiveReportColumns';
import type {
  ReportColumnDefinition,
  ReportColumnKey,
  ReportRowActions,
  ReportTableExportConfig,
  ReportTableItem,
} from './types';

import styles from './ReportsTable.module.scss';

type ReportsTableProps<T extends ReportTableItem> = {
  items: T[];
  columnDefinitions: ReportColumnDefinition<T>[];
  defaultColumnKeys: ReportColumnKey<T>[];
  subtitle: ReactNode;
  exportConfig: ReportTableExportConfig;
  title?: ReactNode;
  rowActions?: ReportRowActions<T>;
  onDownload?: (format: TableExportFormat) => void;
};

const ReportsTable = <T extends ReportTableItem>({
  items,
  columnDefinitions,
  defaultColumnKeys,
  subtitle,
  exportConfig,
  title = 'Результаты отчёта',
  rowActions,
  onDownload,
}: ReportsTableProps<T>) => {
  const [selectedColumnKeys, setSelectedColumnKeys] =
    useState<ReportColumnKey<T>[]>(defaultColumnKeys);

  const rowActionsWidth = rowActions?.width ?? 44;

  const { tableContainerRef, columns, hiddenDefinitions } = useResponsiveReportColumns(
    selectedColumnKeys,
    columnDefinitions,
    rowActions ? rowActionsWidth : 0,
  );

  const tableColumns = useMemo<TableColumnsType<T>>(() => {
    if (!rowActions) {
      return columns;
    }

    return [
      ...columns,
      {
        key: '__actions',
        title: rowActions.title ?? '',
        width: rowActionsWidth,
        render: (_value, item) => rowActions.render(item),
      },
    ];
  }, [columns, rowActions, rowActionsWidth]);

  const exportColumns = useMemo<TableExportColumn<T>[]>(
    () =>
      columnDefinitions
        .filter((column) => selectedColumnKeys.includes(column.key))
        .map(({ key, title: columnTitle }) => ({
          key,
          title: columnTitle,
        })),
    [columnDefinitions, selectedColumnKeys],
  );

  const handleDownload = async (format: TableExportFormat) => {
    await exportTable<T>({
      data: items,
      columns: exportColumns,
      format,
      fileName: exportConfig.fileName,
      sheetName: exportConfig.sheetName,
      pdfTitle: exportConfig.pdfTitle,
    });

    onDownload?.(format);
  };

  const downloadMenu: MenuProps = {
    items: [
      {
        key: 'xlsx',
        icon: <FileExcelOutlined />,
        label: 'Excel (.xlsx)',
      },
      {
        key: 'xls',
        icon: <FileExcelOutlined />,
        label: 'Excel (.xls)',
      },
      {
        key: 'pdf',
        icon: <FilePdfOutlined />,
        label: 'PDF (.pdf)',
      },
    ],
    onClick: ({ key }) => {
      void handleDownload(key as TableExportFormat);
    },
  };

  const renderColumnValue = (definition: ReportColumnDefinition<T>, item: T): ReactNode => {
    if (definition.render) {
      return definition.render(item);
    }

    return item[definition.key] as ReactNode;
  };

  return (
    <section className={styles.reportsTable}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>

          <span className={styles.subtitle}>{subtitle}</span>
        </div>

        <div className={styles.actions}>
          <ReportColumnsSelector<T>
            value={selectedColumnKeys}
            definitions={columnDefinitions}
            defaultValue={defaultColumnKeys}
            onChange={setSelectedColumnKeys}
          />

          <Dropdown trigger={['click']} placement="bottomRight" menu={downloadMenu}>
            <Button type="primary" icon={<DownloadOutlined />}>
              Скачать
              <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      <div ref={tableContainerRef} className={styles.tableContainer}>
        <Table<T>
          rowKey="id"
          columns={tableColumns}
          dataSource={items}
          pagination={false}
          size="small"
          tableLayout="auto"
          expandable={
            hiddenDefinitions.length
              ? {
                  expandRowByClick: false,
                  columnWidth: EXPAND_COLUMN_WIDTH,
                  expandIcon: ({ expanded, onExpand, record }) => (
                    <span
                      className={styles.expandIcon}
                      onClick={(event) => {
                        event.stopPropagation();
                        onExpand(record, event);
                      }}
                    >
                      {expanded ? <UpOutlined /> : <DownOutlined />}
                    </span>
                  ),
                  expandedRowRender: (item) => (
                    <div className={styles.expandedDetails}>
                      {hiddenDefinitions.map((column) => (
                        <div key={column.key} className={styles.expandedDetailsRow}>
                          <span className={styles.expandedDetailsLabel}>{column.title}</span>

                          <div className={styles.expandedDetailsValue}>
                            {renderColumnValue(column, item)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
                }
              : undefined
          }
        />
      </div>
    </section>
  );
};

export default ReportsTable;

