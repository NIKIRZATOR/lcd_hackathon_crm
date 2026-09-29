import { RightOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ManagerKamItem, ManagerLoadItem, ManagerOrganizationHealthItem } from '../../types';
import ManagerReassignModal, {
  type ManagerReassignPayload,
} from '../ManagerReassignModal/ManagerReassignModal';

import styles from './ManagerLoadTable.module.scss';

const { Text, Title } = Typography;

type ManagerLoadTableProps = {
  items: ManagerLoadItem[];
  loading?: boolean;
  error?: string | null;
  kams: ManagerKamItem[];
  organizations: ManagerOrganizationHealthItem[];
  onReassign: (payload: ManagerReassignPayload) => Promise<void>;
};

const COMPACT_TABLE_WIDTH = 900;

const ManagerLoadTable = ({
  items,
  loading = false,
  error,
  kams,
  organizations,
  onReassign,
}: ManagerLoadTableProps) => {
  const navigate = useNavigate();

  const tableWrapperRef = useRef<HTMLDivElement>(null);

  const [isCompact, setIsCompact] = useState(false);
  const [reassignKam, setReassignKam] = useState<ManagerLoadItem | null>(null);
  const [reassignError, setReassignError] = useState<string | null>(null);

  useEffect(() => {
    const element = tableWrapperRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setIsCompact(entry.contentRect.width < COMPACT_TABLE_WIDTH);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const columns: TableColumnsType<ManagerLoadItem> = [
    {
      title: 'KAM',
      dataIndex: 'kam',
      key: 'kam',
      minWidth: 140,
      sorter: (a, b) => a.kam.localeCompare(b.kam, 'ru'),
      render: (_, item) => <Text className={styles.managerName}>{item.kam}</Text>,
    },
    {
      title: 'Программы',
      dataIndex: 'activePrograms',
      key: 'activePrograms',
      responsive: ['sm'],
      sorter: (a, b) => a.activePrograms - b.activePrograms,
    },
  ];

  if (!isCompact) {
    columns.push(
      {
        title: 'Красные программы',
        dataIndex: 'redHealth',
        key: 'redHealth',
        sorter: (a, b) => a.redHealth - b.redHealth,
      },
      {
        title: 'Просроченные задачи',
        dataIndex: 'overdueTasks',
        key: 'overdueTasks',
        sorter: (a, b) => a.overdueTasks - b.overdueTasks,
      },
      {
        title: 'Требуют внимания',
        dataIndex: 'attentionTasks',
        key: 'attentionTasks',
        sorter: (a, b) => a.attentionTasks - b.attentionTasks,
      },
    );
  }

  columns.push({
    title: '',
    key: 'action',
    width: 160,
    align: 'right',
    render: (_, item) => (
      <Button type="primary" onClick={() => setReassignKam(item)}>
        Переназначить
      </Button>
    ),
  });

  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
    >
      <Flex
        justify="space-between"
        align="flex-start"
        gap={16}
        wrap="wrap"
        className={styles.header}
      >
        <div>
          <Title level={4} className={styles.title}>
            Нагрузка KAM
          </Title>

          <Text type="secondary" className={styles.subtitle}>
            Текущая загрузка команды и ключевые метрики
          </Text>
        </div>

        <Button
          type="link"
          className={styles.reportsLink}
          onClick={() => navigate('/reports?report=manager')}
        >
          Открыть в отчётах
          <RightOutlined />
        </Button>
      </Flex>

      {error && <Alert type="error" message={error} showIcon />}

      <div ref={tableWrapperRef}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={false}
          tableLayout="auto"
          className={styles.table}
          expandable={
            isCompact
              ? {
                  columnWidth: 44,
                  expandedRowRender: (item) => (
                    <div className={styles.expandedDetails}>
                      <div className={styles.expandedItem}>
                        <Text type="secondary">Красные программы</Text>
                        <Text>{item.redHealth}</Text>
                      </div>

                      <div className={styles.expandedItem}>
                        <Text type="secondary">Просроченные задачи</Text>
                        <Text>{item.overdueTasks}</Text>
                      </div>

                      <div className={styles.expandedItem}>
                        <Text type="secondary">Требуют внимания</Text>
                        <Text>{item.attentionTasks}</Text>
                      </div>
                    </div>
                  ),
                }
              : undefined
          }
        />
      </div>
      {reassignKam && (
        <ManagerReassignModal
          currentKam={reassignKam}
          kams={kams}
          organizations={organizations}
          error={reassignError}
          onCancel={() => {
            setReassignError(null);
            setReassignKam(null);
          }}
          onSubmit={async (payload: ManagerReassignPayload) => {
            try {
              setReassignError(null);
              await onReassign(payload);
              setReassignKam(null);
            } catch (submitError) {
              setReassignError(
                submitError instanceof Error
                  ? submitError.message
                  : 'Не удалось переназначить организации',
              );
            }
          }}
        />
      )}
    </Card>
  );
};

export default ManagerLoadTable;
