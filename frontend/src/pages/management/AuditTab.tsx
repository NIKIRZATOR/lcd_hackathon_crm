import { Alert, Button, DatePicker, Input, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import InfiniteScrollTrigger from './InfiniteScrollTrigger';

type AuditEvent = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_roles: string[];
  action: string;
  entity_type: string;
  entity_id: string | null;
  result: string;
  reason: string | null;
  error_code: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type User = { id: string; full_name: string };
type Page<T> = { items: T[]; total: number; limit: number; offset: number };

const actionLabels: Record<string, string> = {
  'user.status.update': 'Изменён статус пользователя',
  'manager_membership.create': 'Назначен KAM менеджеру',
  'manager_membership.deactivate': 'Завершена связь MANAGER–KAM',
  'organization.kam_reassigned': 'Переназначен KAM организации',
  'import.mapping.update': 'Изменено сопоставление импорта',
  'import.validate': 'Проверен импорт',
  'import.diff': 'Построен diff импорта',
  'import.confirm': 'Подтверждён импорт',
  'import.complete': 'Импорт завершён',
  'integration.package.process': 'Обработан пакет интеграции',
  'integration.mapping.apply_and_replay': 'Создано сопоставление и выполнен replay',
  'integration.replay': 'Повторно обработаны сигналы',
  'workflow.transition': 'Выполнен переход workflow',
  'file.download': 'Скачан файл',
};

const safeDetails = (event: AuditEvent) => {
  const details = event.reason || event.error_code;
  if (details) return details;
  if (!event.metadata) return '—';
  return (
    Object.entries(event.metadata)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ') || '—'
  );
};

const AuditTab = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<Page<AuditEvent>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [actorUserId, setActorUserId] = useState<string>();
  const [actorRole, setActorRole] = useState<string>();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [result, setResult] = useState<string>();
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (offset = 0, append = false) => {
      setLoading(true);
      setError(undefined);
      try {
        const query = new URLSearchParams({ limit: '20', offset: String(offset) });
        if (actorUserId) query.set('actor_user_id', actorUserId);
        if (actorRole) query.set('actor_role', actorRole);
        if (action.trim()) query.set('action', action.trim());
        if (entityType.trim()) query.set('entity_type', entityType.trim());
        if (result) query.set('result', result);
        if (range?.[0]) query.set('date_from', range[0].startOf('day').toISOString());
        if (range?.[1]) query.set('date_to', range[1].endOf('day').toISOString());
        const nextPage = await apiRequest<Page<AuditEvent>>(`/api/audit/events?${query}`);
        setPage((current) =>
          append
            ? { ...nextPage, items: [...current.items, ...nextPage.items], offset: 0 }
            : nextPage,
        );
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить аудит.');
      } finally {
        setLoading(false);
      }
    },
    [action, actorRole, actorUserId, entityType, range, result],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    void apiRequest<Page<User>>('/api/users?limit=100&offset=0')
      .then((data) => setUsers(data.items))
      .catch(() => setUsers([]));
  }, []);

  const reset = () => {
    setActorUserId(undefined);
    setActorRole(undefined);
    setAction('');
    setEntityType('');
    setResult(undefined);
    setRange(null);
  };
  const actorOptions = useMemo(
    () => users.map((user) => ({ value: user.id, label: user.full_name })),
    [users],
  );
  const goToRelated = (event: AuditEvent) => {
    if (event.action.startsWith('import.')) navigate('/management?tab=imports');
    else if (event.action.startsWith('integration.')) navigate('/management?tab=integrations');
    else if (event.entity_type === 'user' || event.action.startsWith('manager_membership.'))
      navigate('/management?tab=users');
    else if (event.entity_type === 'organization') navigate('/management?tab=assignments');
    else if (event.action.startsWith('workflow.')) navigate('/management?tab=playbooks');
  };

  return (
    <>
      <Typography.Paragraph type="secondary">
        Журнал фиксирует административные и технические действия. Детали ограничены безопасным
        контекстом без raw payload, токенов и избыточных персональных данных.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={range} onChange={setRange} />
        <Select
          allowClear
          showSearch
          value={actorUserId}
          onChange={setActorUserId}
          placeholder="Пользователь"
          options={actorOptions}
          style={{ width: 200 }}
        />
        <Select
          allowClear
          value={actorRole}
          onChange={setActorRole}
          placeholder="Роль"
          options={['ADMIN', 'MANAGER', 'KAM'].map((value) => ({ value, label: value }))}
          style={{ width: 130 }}
        />
        <Input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Код события"
          style={{ width: 190 }}
        />
        <Input
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          placeholder="Тип объекта"
          style={{ width: 160 }}
        />
        <Select
          allowClear
          value={result}
          onChange={setResult}
          placeholder="Результат"
          options={[
            { value: 'SUCCESS', label: 'Успех' },
            { value: 'ERROR', label: 'Ошибка' },
            { value: 'FAILURE', label: 'Ошибка' },
          ]}
          style={{ width: 140 }}
        />
        <Button onClick={() => void load()}>Обновить</Button>
        <Button onClick={reset}>Сбросить</Button>
      </Space>
      <Table<AuditEvent>
        rowKey="id"
        loading={loading}
        dataSource={page.items}
        locale={{ emptyText: 'События не найдены' }}
        pagination={false}
        columns={[
          {
            title: 'Время',
            dataIndex: 'created_at',
            render: (value: string) => new Date(value).toLocaleString('ru-RU'),
          },
          {
            title: 'Исполнитель',
            render: (_, event) => (
              <>
                {event.actor_name ?? 'Система'}
                <br />
                {event.actor_roles.map((role) => (
                  <Tag key={role}>{role}</Tag>
                ))}
              </>
            ),
          },
          {
            title: 'Событие',
            render: (_, event) => (
              <>
                <Typography.Text>{actionLabels[event.action] ?? event.action}</Typography.Text>
                <br />
                <Typography.Text type="secondary">{event.action}</Typography.Text>
              </>
            ),
          },
          {
            title: 'Объект',
            render: (_, event) => (
              <>
                {event.entity_type}
                <br />
                <Typography.Text type="secondary">{event.entity_id ?? '—'}</Typography.Text>
              </>
            ),
          },
          {
            title: 'Результат',
            dataIndex: 'result',
            render: (value: string) => (
              <Tag color={value === 'SUCCESS' ? 'green' : 'red'}>{value}</Tag>
            ),
          },
          {
            title: 'Детали',
            render: (_, event) => (
              <Typography.Text type="secondary">{safeDetails(event)}</Typography.Text>
            ),
          },
          {
            title: 'Переход',
            render: (_, event) => (
              <Button
                type="link"
                disabled={
                  !['import', 'organization', 'user', 'manager_membership'].includes(
                    event.entity_type,
                  ) &&
                  !event.action.startsWith('integration.') &&
                  !event.action.startsWith('workflow.')
                }
                onClick={() => goToRelated(event)}
              >
                Открыть
              </Button>
            ),
          },
        ]}
      />
      <InfiniteScrollTrigger
        hasMore={page.items.length < page.total}
        loading={loading}
        onLoadMore={() => void load(page.items.length, true)}
      />
    </>
  );
};

export default AuditTab;
