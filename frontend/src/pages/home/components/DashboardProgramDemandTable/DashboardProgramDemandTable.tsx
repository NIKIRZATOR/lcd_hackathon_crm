import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Grid, Progress, Select, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useRef, useState } from 'react';

import DownloadButton from '../../../../components/DownloadButton/DownloadButton';

import { getDashboardProgramDemandMock } from './mocks';
import type {
  DashboardProgramDemandItem,
  ProgramDemandExportFormat,
  ProgramDemandSort,
} from './types';
import {
  exportProgramDemandToExcel,
  exportProgramDemandToPng,
} from '../../../../shared/utils/exportProgramDemand';

import styles from './DashboardProgramDemandTable.module.scss';

const { useBreakpoint } = Grid;

const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(value);

const renderProgram = (value: string) => (
  <Tooltip title={value}>
    <span className={styles.ellipsis}>{value}</span>
  </Tooltip>
);

const renderProduct = (value: string) => (
  <Tooltip title={value}>
    <Tag className={styles.productTag}>{value}</Tag>
  </Tooltip>
);

const renderDemandIndex = (value: number) => (
  <div className={styles.demandIndex}>
    <Progress
      percent={value}
      showInfo={false}
      strokeWidth={12}
      className={styles.demandIndexProgress}
    />

    <span className={styles.demandIndexValue}>{value}</span>
  </div>
);

const desktopColumns: TableColumnsType<DashboardProgramDemandItem> = [
  {
    title: 'Программа',
    dataIndex: 'program',
    key: 'program',
    render: renderProgram,
  },
  {
    title: 'ИТ-продукт',
    dataIndex: 'product',
    key: 'product',
    render: renderProduct,
  },
  {
    title: 'Вузов',
    dataIndex: 'universities',
    key: 'universities',
    width: 90,
  },
  {
    title: 'Потоков',
    dataIndex: 'streams',
    key: 'streams',
    width: 90,
  },
  {
    title: 'Обучающихся',
    dataIndex: 'students',
    key: 'students',
    width: 120,
    render: formatNumber,
  },
  {
    title: 'Заявок',
    dataIndex: 'applications',
    key: 'applications',
    width: 120,
    render: formatNumber,
  },
  {
    title: 'Индекс востребованности',
    dataIndex: 'demandIndex',
    key: 'demandIndex',
    render: renderDemandIndex,
  },
];

const mobileColumns: TableColumnsType<DashboardProgramDemandItem> = [
  {
    title: 'Программа',
    dataIndex: 'program',
    key: 'program',
    render: renderProgram,
  },
  {
    title: 'Индекс',
    dataIndex: 'demandIndex',
    key: 'demandIndex',
    width: 170,
    render: renderDemandIndex,
  },
];

const sortOptions = [
  {
    value: 'demandIndex',
    label: 'По популярности',
  },
  {
    value: 'applications',
    label: 'По заявкам',
  },
  {
    value: 'students',
    label: 'По обучающимся',
  },
  {
    value: 'universities',
    label: 'По количеству вузов',
  },
];

const DashboardProgramDemandTable = () => {
  const screens = useBreakpoint();

  const exportRef = useRef<HTMLElement>(null);

  const [sortBy, setSortBy] = useState<ProgramDemandSort>('demandIndex');

  const [data, setData] = useState<DashboardProgramDemandItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const isMobile = !screens.lg;

  const columns = isMobile ? mobileColumns : desktopColumns;

  useEffect(() => {
    let cancelled = false;

    const loadProgramDemand = async () => {
      setIsLoading(true);

      try {
        const response = await getDashboardProgramDemandMock({
          sortBy,
          order: 'desc',
        });

        if (!cancelled) {
          setData(response.items);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadProgramDemand();

    return () => {
      cancelled = true;
    };
  }, [sortBy]);

  const handleDownload = async (format: ProgramDemandExportFormat) => {
    if (format === 'xlsx') {
      exportProgramDemandToExcel(data);
      return;
    }

    if (format === 'png' && exportRef.current) {
      await exportProgramDemandToPng(exportRef.current);
    }
  };

  return (
    <section ref={exportRef} className={styles.programDemandTable}>
      <div className={styles.header}>
        <h3 className={styles.title}>Востребованность программ</h3>

        <div className={styles.headerActions} data-html2canvas-ignore>
          <Select
            value={sortBy}
            options={sortOptions}
            className={styles.sort}
            onChange={setSortBy}
          />

          <DownloadButton
            defaultFormat="xlsx"
            options={[
              {
                key: 'xlsx',
                label: 'Excel',
              },
              {
                key: 'png',
                label: 'PNG',
              },
            ]}
            onDownload={handleDownload}
            trigger={['hover']}
          />
        </div>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={false}
        size="small"
        tableLayout="fixed"
        expandable={
          isMobile
            ? {
                columnWidth: 48,
                expandRowByClick: false,
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
                expandedRowRender: (program) => (
                  <div className={styles.expandedDetails}>
                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>ИТ-продукт</span>

                      <div className={styles.expandedDetailsValue}>
                        {renderProduct(program.product)}
                      </div>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Вузов</span>

                      <p className={styles.expandedDetailsValue}>{program.universities}</p>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Потоков</span>

                      <p className={styles.expandedDetailsValue}>{program.streams}</p>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Обучающихся</span>

                      <p className={styles.expandedDetailsValue}>
                        {formatNumber(program.students)}
                      </p>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Заявок</span>

                      <p className={styles.expandedDetailsValue}>
                        {formatNumber(program.applications)}
                      </p>
                    </div>
                  </div>
                ),
              }
            : undefined
        }
      />
    </section>
  );
};

export default DashboardProgramDemandTable;
