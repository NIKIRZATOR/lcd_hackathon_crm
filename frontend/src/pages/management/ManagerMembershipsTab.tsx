import { Alert, Button, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import InfiniteScrollTrigger from './InfiniteScrollTrigger';

type User = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  roles: string[];
};
type Membership = {
  id: string;
  manager_user_id: string;
  kam_user_id: string;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
};
type Page<T> = { items: T[]; total: number; limit: number; offset: number };

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU') : 'Без ограничения';

const ManagerMembershipsTab = () => {
  const [page, setPage] = useState<Page<Membership>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [managerUserId, setManagerUserId] = useState<string>();
  const [kamUserId, setKamUserId] = useState<string>();
  const [saving, setSaving] = useState(false);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeManagers = useMemo(
    () => users.filter((user) => user.is_active && user.roles.includes('MANAGER')),
    [users],
  );
  const activeKams = useMemo(
    () => users.filter((user) => user.is_active && user.roles.includes('KAM')),
    [users],
  );

  const load = useCallback(
    async (offset = 0, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const query = new URLSearchParams({ limit: '20', offset: String(offset) });
        if (status === 'active') query.set('is_active', 'true');
        const nextPage = await apiRequest<Page<Membership>>(
          `/api/users/manager-memberships?${query}`,
        );
        setPage((current) =>
          append
            ? { ...nextPage, items: [...current.items, ...nextPage.items], offset: 0 }
            : nextPage,
        );
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Не удалось загрузить связи менеджеров и KAM.',
        );
      } finally {
        setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const [managerPage, kamPage] = await Promise.all([
          apiRequest<Page<User>>('/api/users?role=MANAGER&limit=100&offset=0'),
          apiRequest<Page<User>>('/api/users?role=KAM&limit=100&offset=0'),
        ]);
        setUsers([...managerPage.items, ...kamPage.items]);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Не удалось загрузить пользователей.',
        );
      }
    };
    void loadUsers();
  }, []);

  const openCreate = () => {
    setManagerUserId(undefined);
    setKamUserId(undefined);
    setDialogOpen(true);
  };

  const createMembership = async () => {
    if (!managerUserId || !kamUserId) return;
    setSaving(true);
    setError(undefined);
    try {
      await apiRequest('/api/users/manager-memberships', {
        method: 'POST',
        body: JSON.stringify({ manager_user_id: managerUserId, kam_user_id: kamUserId }),
      });
      setDialogOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить связь.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (membership: Membership) => {
    setError(undefined);
    try {
      await apiRequest(`/api/users/manager-memberships/${membership.id}/deactivate`, {
        method: 'PATCH',
      });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось завершить связь.');
    }
  };

  const userName = (id: string) =>
    usersById.get(id)?.full_name ?? 'Пользователь удалён или не синхронизирован';

  return (
    <>
      <Typography.Paragraph type="secondary">
        Связи определяют область данных, доступную MANAGER. Завершённые связи сохраняются в истории
        и больше не дают доступ к данным KAM.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Текущие связи' },
            { value: 'all', label: 'Вся история' },
          ]}
          style={{ width: 180 }}
        />
        <Button onClick={() => void load()}>Обновить</Button>
        <Button type="primary" onClick={openCreate}>
          Назначить KAM менеджеру
        </Button>
      </Space>
      <Table<Membership>
        rowKey="id"
        loading={loading}
        dataSource={page.items}
        locale={{ emptyText: 'Связи не найдены' }}
        pagination={false}
        columns={[
          { title: 'MANAGER', render: (_, membership) => userName(membership.manager_user_id) },
          { title: 'KAM', render: (_, membership) => userName(membership.kam_user_id) },
          {
            title: 'Статус',
            dataIndex: 'is_active',
            render: (isActive: boolean) => (
              <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Активна' : 'Завершена'}</Tag>
            ),
          },
          {
            title: 'Срок действия',
            render: (_, membership) => (
              <Typography.Text type="secondary">
                {formatDate(membership.valid_from)} — {formatDate(membership.valid_to)}
              </Typography.Text>
            ),
          },
          {
            title: 'Создана',
            dataIndex: 'created_at',
            render: (value: string) => new Date(value).toLocaleString('ru-RU'),
          },
          {
            title: 'Действие',
            render: (_, membership) =>
              membership.is_active ? (
                <Button danger type="link" onClick={() => void deactivate(membership)}>
                  Завершить связь
                </Button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <InfiniteScrollTrigger
        hasMore={page.items.length < page.total}
        loading={loading}
        onLoadMore={() => void load(page.items.length, true)}
      />
      <Modal
        title="Назначить KAM менеджеру"
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={() => void createMembership()}
        okText="Назначить"
        okButtonProps={{ disabled: !managerUserId || !kamUserId, loading: saving }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            value={managerUserId}
            onChange={setManagerUserId}
            placeholder="Выберите MANAGER"
            options={activeManagers.map((user) => ({ value: user.id, label: user.full_name }))}
          />
          <Select
            value={kamUserId}
            onChange={setKamUserId}
            placeholder="Выберите KAM"
            options={activeKams.map((user) => ({ value: user.id, label: user.full_name }))}
          />
        </Space>
      </Modal>
    </>
  );
};

export default ManagerMembershipsTab;
