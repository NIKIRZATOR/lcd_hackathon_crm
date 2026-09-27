import { Alert, Button, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';

type Organization = {
  id: string;
  name: string;
  city: string | null;
  type_name: string;
  status: string;
  kam_name: string | null;
};
type Kam = { id: string; full_name: string };
type Assignment = {
  id: string;
  kam_name: string;
  status: 'active' | 'ended';
  assigned_at: string;
  ended_at: string | null;
  assigned_by_name: string | null;
};
type Page<T> = { items: T[]; total: number; limit: number; offset: number };

const OrganizationAssignmentsTab = () => {
  const [page, setPage] = useState<Page<Organization>>({
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  });
  const [search, setSearch] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Organization>();
  const [kams, setKams] = useState<Kam[]>([]);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [kamUserId, setKamUserId] = useState<string>();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError(undefined);
      try {
        const query = new URLSearchParams({ limit: '20', offset: String(offset) });
        if (search.trim()) query.set('search', search.trim());
        if (onlyUnassigned) query.set('unassigned_only', 'true');
        setPage(await apiRequest<Page<Organization>>(`/api/organizations?${query}`));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить организации.');
      } finally {
        setLoading(false);
      }
    },
    [onlyUnassigned, search],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openAssignment = async (organization: Organization) => {
    setSelected(organization);
    setKamUserId(undefined);
    setReason('');
    setError(undefined);
    try {
      const [availableKams, assignmentHistory] = await Promise.all([
        apiRequest<Kam[]>(`/api/organizations/${organization.id}/eligible-kams`),
        apiRequest<Assignment[]>(`/api/organizations/${organization.id}/assignments`),
      ]);
      setKams(availableKams);
      setHistory(assignmentHistory);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось загрузить данные назначения.',
      );
    }
  };

  const saveAssignment = async () => {
    if (!selected || !kamUserId) return;
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest(`/api/organizations/${selected.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ kam_user_id: kamUserId, reason: reason.trim() || null }),
      });
      setSelected(undefined);
      await load(page.offset);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить назначение.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Typography.Paragraph type="secondary">
        Назначайте KAM организациям и контролируйте организации без ответственного. История
        сохраняется при каждом переназначении.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию организации"
          style={{ width: 300 }}
        />
        <Select
          value={onlyUnassigned ? 'unassigned' : 'all'}
          onChange={(value) => setOnlyUnassigned(value === 'unassigned')}
          options={[
            { value: 'all', label: 'Все организации' },
            { value: 'unassigned', label: 'Только без KAM' },
          ]}
          style={{ width: 190 }}
        />
        <Button onClick={() => void load()}>Обновить</Button>
      </Space>
      <Table<Organization>
        rowKey="id"
        loading={loading}
        dataSource={page.items}
        locale={{ emptyText: 'Организации не найдены' }}
        pagination={{
          current: page.offset / page.limit + 1,
          pageSize: page.limit,
          total: page.total,
          showSizeChanger: false,
          onChange: (nextPage) => void load((nextPage - 1) * page.limit),
        }}
        columns={[
          {
            title: 'Организация',
            render: (_, organization) => (
              <>
                <Typography.Text strong>{organization.name}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {[organization.type_name, organization.city].filter(Boolean).join(' · ') || '—'}
                </Typography.Text>
              </>
            ),
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (status: string) => (
              <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>
            ),
          },
          {
            title: 'Ответственный KAM',
            dataIndex: 'kam_name',
            render: (kamName: string | null) =>
              kamName ? <Tag color="blue">{kamName}</Tag> : <Tag color="orange">Не назначен</Tag>,
          },
          {
            title: 'Действие',
            render: (_, organization) => (
              <Button type="link" onClick={() => void openAssignment(organization)}>
                {organization.kam_name ? 'Переназначить' : 'Назначить KAM'}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={selected ? `Назначение KAM: ${selected.name}` : 'Назначение KAM'}
        open={Boolean(selected)}
        onCancel={() => setSelected(undefined)}
        okText="Сохранить"
        okButtonProps={{ disabled: !kamUserId, loading: saving }}
        onOk={() => void saveAssignment()}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select
            value={kamUserId}
            onChange={setKamUserId}
            placeholder="Выберите KAM"
            options={kams.map((kam) => ({ value: kam.id, label: kam.full_name }))}
          />
          <Input.TextArea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Причина назначения (необязательно)"
            maxLength={1000}
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
          <div>
            <Typography.Text strong>История назначений</Typography.Text>
            {history.length ? (
              <Table<Assignment>
                size="small"
                rowKey="id"
                pagination={false}
                style={{ marginTop: 8 }}
                dataSource={history}
                columns={[
                  { title: 'KAM', dataIndex: 'kam_name' },
                  {
                    title: 'Период',
                    render: (_, item) =>
                      `${new Date(item.assigned_at).toLocaleString('ru-RU')} — ${item.ended_at ? new Date(item.ended_at).toLocaleString('ru-RU') : 'по настоящее время'}`,
                  },
                  {
                    title: 'Назначил',
                    dataIndex: 'assigned_by_name',
                    render: (value) => value ?? '—',
                  },
                ]}
              />
            ) : (
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                Назначений ещё не было.
              </Typography.Paragraph>
            )}
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default OrganizationAssignmentsTab;
