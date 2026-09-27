import { Alert, Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';

type User = {
  id: string;
  keycloak_user_id: string | null;
  username: string | null;
  full_name: string;
  email: string | null;
  roles: string[];
  is_active: boolean;
  updated_at: string;
};
type Page<T> = { items: T[]; total: number; limit: number; offset: number };

const UserAccessTab = () => {
  const [page, setPage] = useState<Page<User>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'true' | 'false'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (offset = page.offset) => {
      setLoading(true);
      setError(undefined);
      try {
        const query = new URLSearchParams({ limit: '20', offset: String(offset) });
        if (search.trim()) query.set('search', search.trim());
        if (status !== 'all') query.set('is_active', status);
        setPage(await apiRequest<Page<User>>(`/api/users?${query}`));
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Не удалось загрузить пользователей.',
        );
      } finally {
        setLoading(false);
      }
    },
    [page.offset, search, status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(0), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setUserStatus = async (user: User, isActive: boolean) => {
    try {
      await apiRequest(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось изменить статус пользователя.',
      );
    }
  };

  return (
    <>
      <Typography.Paragraph type="secondary">
        Роли назначаются в Keycloak и синхронизируются при входе. Здесь ADMIN управляет статусом
        CRM-учётных записей.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по ФИО, email или логину"
          style={{ width: 300 }}
        />
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Все статусы' },
            { value: 'true', label: 'Активные' },
            { value: 'false', label: 'Заблокированные' },
          ]}
          style={{ width: 180 }}
        />
        <Button onClick={() => void load(0)}>Обновить</Button>
      </Space>
      <Table<User>
        rowKey="id"
        loading={loading}
        dataSource={page.items}
        pagination={{
          current: page.offset / page.limit + 1,
          pageSize: page.limit,
          total: page.total,
          showSizeChanger: false,
          onChange: (nextPage) => void load((nextPage - 1) * page.limit),
        }}
        columns={[
          {
            title: 'Пользователь',
            render: (_, user) => (
              <>
                <Typography.Text strong>{user.full_name}</Typography.Text>
                <br />
                <Typography.Text type="secondary">
                  {user.email ?? user.username ?? '—'}
                </Typography.Text>
              </>
            ),
          },
          {
            title: 'Роли Keycloak',
            dataIndex: 'roles',
            render: (roles: string[]) =>
              roles.length ? roles.map((role) => <Tag key={role}>{role}</Tag>) : '—',
          },
          {
            title: 'Статус CRM',
            dataIndex: 'is_active',
            render: (isActive: boolean) => (
              <Tag color={isActive ? 'green' : 'red'}>{isActive ? 'Активен' : 'Заблокирован'}</Tag>
            ),
          },
          {
            title: 'Синхронизация',
            dataIndex: 'keycloak_user_id',
            render: (value) => (value ? <Tag color="green">Keycloak</Tag> : <Tag>Нет ID</Tag>),
          },
          {
            title: 'Последнее изменение',
            dataIndex: 'updated_at',
            render: (value) => new Date(value).toLocaleString('ru-RU'),
          },
          {
            title: 'Действие',
            render: (_, user) => (
              <Button
                danger={user.is_active}
                onClick={() => void setUserStatus(user, !user.is_active)}
              >
                {user.is_active ? 'Заблокировать' : 'Активировать'}
              </Button>
            ),
          },
        ]}
      />
    </>
  );
};

export default UserAccessTab;
