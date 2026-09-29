import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Grid, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { useNavigate } from 'react-router-dom';

import { dashboardAttentionMock } from './mocks';
import type { AttentionStatus, AttentionStatusCode, DashboardAttentionItem } from './types';

import styles from './DashboardAttentionTable.module.scss';

const { useBreakpoint } = Grid;

const statusStyles: Record<
  AttentionStatusCode,
  {
    tagClassName: string;
    dotClassName: string;
  }
> = {
  critical: {
    tagClassName: styles.statusTagCritical,
    dotClassName: styles.statusDotCritical,
  },
  high: {
    tagClassName: styles.statusTagHigh,
    dotClassName: styles.statusDotHigh,
  },
  attention: {
    tagClassName: styles.statusTagAttention,
    dotClassName: styles.statusDotAttention,
  },
};

const renderStatus = (status: AttentionStatus, compact: boolean) => {
  const statusStyle = statusStyles[status.code];

  if (compact) {
    return (
      <Tooltip title={status.label}>
        <span className={`${styles.statusDot} ${statusStyle.dotClassName}`} />
      </Tooltip>
    );
  }

  return <Tag className={`${styles.statusTag} ${statusStyle.tagClassName}`}>{status.label}</Tag>;
};

const desktopColumns: TableColumnsType<DashboardAttentionItem> = [
  {
    title: 'Организация',
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
    sorter: (a, b) => a.status.priority - b.status.priority,
    render: (status: AttentionStatus) => renderStatus(status, false),
  },
];

const mobileColumns: TableColumnsType<DashboardAttentionItem> = [
  {
    title: 'Организация',
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
    sorter: (a, b) => a.status.priority - b.status.priority,
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
        dataSource={dashboardAttentionMock.attention}
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
