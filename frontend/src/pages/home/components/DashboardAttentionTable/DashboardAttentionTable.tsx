import { Grid, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { useNavigate } from 'react-router-dom';

import { dashboardAttentionMock } from './mocks';
import type { AttentionStatus, DashboardAttentionItem } from './types';

import styles from './DashboardAttentionTable.module.scss';
import { DownOutlined, UpOutlined } from '@ant-design/icons';

const { useBreakpoint } = Grid;

const statusConfig: Record<
  AttentionStatus,
  {
    label: string;
    tagClassName: string;
    dotClassName: string;
    priority: number;
  }
> = {
  critical: {
    label: 'Критический',
    tagClassName: styles.statusTagCritical,
    dotClassName: styles.statusDotCritical,
    priority: 3,
  },
  high: {
    label: 'Высокий',
    tagClassName: styles.statusTagHigh,
    dotClassName: styles.statusDotHigh,
    priority: 2,
  },
  attention: {
    label: 'Требует внимания',
    tagClassName: styles.statusTagAttention,
    dotClassName: styles.statusDotAttention,
    priority: 1,
  },
};

const renderStatus = (status: AttentionStatus, compact: boolean) => {
  const config = statusConfig[status];

  if (compact) {
    return (
      <Tooltip title={config.label}>
        <span className={`${styles.statusDot} ${config.dotClassName}`} />
      </Tooltip>
    );
  }

  return <Tag className={`${styles.statusTag} ${config.tagClassName}`}>{config.label}</Tag>;
};

const desktopColumns: TableColumnsType<DashboardAttentionItem> = [
  {
    title: 'Вуз',
    dataIndex: 'university',
    key: 'university',
  },
  {
    title: 'Программа',
    dataIndex: 'program',
    key: 'program',
  },
  {
    title: 'Этап',
    dataIndex: 'stage',
    key: 'stage',
  },
  {
    title: 'Причина',
    dataIndex: 'reason',
    key: 'reason',
  },
  {
    title: 'Дней',
    dataIndex: 'days',
    key: 'days',
    width: 80,
  },
  {
    title: 'Статус',
    dataIndex: 'status',
    key: 'status',
    defaultSortOrder: 'descend',
    sorter: (a, b) => statusConfig[a.status].priority - statusConfig[b.status].priority,
    render: (status: AttentionStatus) => renderStatus(status, false),
  },
];

const mobileColumns: TableColumnsType<DashboardAttentionItem> = [
  {
    title: 'Вуз',
    dataIndex: 'university',
    key: 'university',
  },
  {
    title: 'Программа',
    dataIndex: 'program',
    key: 'program',
  },
  {
    title: 'Статус',
    dataIndex: 'status',
    key: 'status',
    defaultSortOrder: 'descend',
    sorter: (a, b) => statusConfig[a.status].priority - statusConfig[b.status].priority,
    render: (status: AttentionStatus) => renderStatus(status, true),
  },
];

const DashboardAttentionTable = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();

  const isMobile = !screens.lg;

  const columns = isMobile ? mobileColumns : desktopColumns;

  const handleRowClick = (interaction: DashboardAttentionItem) => {
    navigate(`/interactions/${interaction.id}`);
  };

  return (
    <section className={styles.attentionTable}>
      <h3 className={styles.attentionTableTitle}>Требуют внимания</h3>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={dashboardAttentionMock}
        pagination={false}
        size="small"
        rowClassName={styles.clickableRow}
        onRow={(interaction) => ({
          onClick: () => handleRowClick(interaction),
        })}
        expandable={
          isMobile
            ? {
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
                expandedRowRender: (interaction) => (
                  <div className={styles.expandedDetails}>
                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Этап</span>
                      <p className={styles.expandedDetailsValue}>{interaction.stage}</p>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Причина</span>
                      <p className={styles.expandedDetailsValue}>{interaction.reason}</p>
                    </div>

                    <div className={styles.expandedDetailsRow}>
                      <span className={styles.expandedDetailsLabel}>Дней</span>
                      <p className={styles.expandedDetailsValue}>{interaction.days}</p>
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

export default DashboardAttentionTable;
