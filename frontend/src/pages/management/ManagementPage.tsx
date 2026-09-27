import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { apiRequest } from '../../api/client';
import { useAuth } from '../../auth';
import { IntegrationDiagnosticsTab } from './IntegrationDiagnosticsTab';
import ManagerMembershipsTab from './ManagerMembershipsTab';
import OrganizationAssignmentsTab from './OrganizationAssignmentsTab';
import UserAccessTab from './UserAccessTab';

type Stage = {
  id: string;
  name: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
  is_optional: boolean;
  default_duration_days: number | null;
};
type CatalogStage = { code: string; name: string; phase: string };
type Playbook = {
  id: string;
  code: string | null;
  name: string;
  applies_to_type: string;
  status: string;
  published_version: number | null;
};
type WorkflowVersion = { id: string; version: number; status: string };
type ChecklistItem = {
  id: string;
  code: string;
  label: string;
  item_type: 'checkbox' | 'file' | 'date' | 'stakeholder_role' | 'number' | 'text';
  required: boolean;
  required_stakeholder_role: string | null;
  required_attachment_kind: string | null;
};
type Page<T> = { items: T[] };
type DocumentationRequest = {
  id: string;
  author_name: string | null;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
};

const ManagementPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = Boolean(user?.roles.includes('ADMIN'));
  const [catalogStages, setCatalogStages] = useState<CatalogStage[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selected, setSelected] = useState<Playbook>();
  const [draft, setDraft] = useState<WorkflowVersion>();
  const [stages, setStages] = useState<Stage[]>([]);
  const [newName, setNewName] = useState('');
  const [stageName, setStageName] = useState('');
  const [stageSla, setStageSla] = useState<number | null>(null);
  const [stageOptional, setStageOptional] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [factStage, setFactStage] = useState<Stage>();
  const [facts, setFacts] = useState<ChecklistItem[]>([]);
  const [factCode, setFactCode] = useState('');
  const [factLabel, setFactLabel] = useState('');
  const [factType, setFactType] = useState<ChecklistItem['item_type']>('text');
  const [factKind, setFactKind] = useState('');
  const [documentationRequests, setDocumentationRequests] = useState<DocumentationRequest[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatus, setRequestStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [requestDateFrom, setRequestDateFrom] = useState<string>();
  const [requestDateTo, setRequestDateTo] = useState<string>();
  const [requestDetail, setRequestDetail] = useState<DocumentationRequest>();
  const filteredDocumentationRequests = useMemo(
    () =>
      documentationRequests.filter((request) => {
        const search = requestSearch.trim().toLowerCase();
        const matchesSearch =
          !search ||
          `${request.subject} ${request.message} ${request.author_name ?? ''}`
            .toLowerCase()
            .includes(search);
        const matchesStatus = requestStatus === 'all' || request.status === requestStatus;
        const createdAt = new Date(request.created_at).getTime();
        const matchesFrom = !requestDateFrom || createdAt >= new Date(requestDateFrom).getTime();
        const matchesTo = !requestDateTo || createdAt <= new Date(requestDateTo).getTime();
        return matchesSearch && matchesStatus && matchesFrom && matchesTo;
      }),
    [documentationRequests, requestDateFrom, requestDateTo, requestSearch, requestStatus],
  );

  const load = useCallback(async () => {
    try {
      const [loadedStages, loadedPlaybooks] = await Promise.all([
        apiRequest<CatalogStage[]>('/api/management/stages'),
        apiRequest<Playbook[]>('/api/management/playbooks'),
      ]);
      setCatalogStages(loadedStages);
      setPlaybooks(loadedPlaybooks);
    } catch {
      setError('Не удалось загрузить управление.');
    }
  }, []);

  const loadDraft = async (template: Playbook) => {
    setError(undefined);
    setSelected(template);
    try {
      const versions = await apiRequest<WorkflowVersion[]>(
        `/api/workflows/templates/${template.id}/versions`,
      );
      let current = versions.find((version) => version.status === 'DRAFT');
      if (!current)
        current = await apiRequest<WorkflowVersion>(
          `/api/workflows/templates/${template.id}/versions/draft`,
          { method: 'POST' },
        );
      const loaded = await apiRequest<Page<Stage>>(
        `/api/workflows/stages?workflow_template_id=${template.id}&workflow_version_id=${current.id}&limit=100`,
      );
      setDraft(current);
      setStages([...loaded.items].sort((left, right) => left.order_index - right.order_index));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось открыть черновик.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await load();
    };
    void fetchData();
  }, [load]);
  useEffect(() => {
    if (isAdmin)
      void apiRequest<DocumentationRequest[]>('/api/documentation/requests').then(
        setDocumentationRequests,
      );
  }, [isAdmin]);

  const createTemplate = async () => {
    if (!newName.trim()) {
      setError('Введите название нового эталона перед созданием.');
      return;
    }
    setError(undefined);
    setCreating(true);
    try {
      const template = await apiRequest<Playbook>('/api/workflows/templates', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      await load();
      await loadDraft(template);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать эталон.');
    } finally {
      setCreating(false);
    }
  };

  const addStage = async () => {
    if (!selected || !draft || !stageName.trim()) return;
    const previous = stages[stages.length - 1];
    try {
      if (previous)
        await apiRequest(`/api/workflows/stages/${previous.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_final: false }),
        });
      const created = await apiRequest<Stage>('/api/workflows/stages', {
        method: 'POST',
        body: JSON.stringify({
          workflow_template_id: selected.id,
          workflow_version_id: draft.id,
          name: stageName.trim(),
          order_index: stages.length + 1,
          is_initial: !previous,
          is_final: true,
          is_optional: stageOptional,
          default_duration_days: stageSla,
        }),
      });
      if (previous)
        await apiRequest('/api/workflows/transitions', {
          method: 'POST',
          body: JSON.stringify({
            workflow_template_id: selected.id,
            workflow_version_id: draft.id,
            from_stage_id: previous.id,
            to_stage_id: created.id,
            name: `${previous.name} → ${created.name}`,
            is_default: true,
          }),
        });
      setStages([...stages, created]);
      setStageName('');
      setStageSla(null);
      setStageOptional(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось добавить этап.');
    }
  };

  const publish = async () => {
    if (!draft) return;
    try {
      await apiRequest(`/api/workflows/versions/${draft.id}/publish`, { method: 'POST' });
      setDraft(undefined);
      setStages([]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось опубликовать эталон.');
    }
  };

  const openFacts = async (stage: Stage) => {
    try {
      setFactStage(stage);
      setFacts(
        await apiRequest<ChecklistItem[]>(`/api/workflows/stages/${stage.id}/checklist-items`),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось загрузить факты этапа.');
    }
  };

  const addFact = async () => {
    if (!factStage || !factCode.trim() || !factLabel.trim()) return;
    try {
      const item = await apiRequest<ChecklistItem>(
        `/api/workflows/stages/${factStage.id}/checklist-items`,
        {
          method: 'POST',
          body: JSON.stringify({
            code: factCode.trim(),
            label: factLabel.trim(),
            item_type: factType,
            required: true,
            required_attachment_kind: factType === 'file' ? factKind.trim() || null : null,
          }),
        },
      );
      setFacts([...facts, item]);
      setFactCode('');
      setFactLabel('');
      setFactKind('');
      setFactType('text');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось добавить факт.');
    }
  };

  return (
    <Card title="Управление">
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Tabs
        activeKey={searchParams.get('tab') ?? 'playbooks'}
        onChange={(key) => setSearchParams(key === 'playbooks' ? {} : { tab: key })}
        items={[
          {
            key: 'playbooks',
            label: 'Плейбуки',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Название нового эталона"
                  />
                  <Button type="primary" loading={creating} onClick={() => void createTemplate()}>
                    Создать эталон
                  </Button>
                </Space>
                <Table<Playbook>
                  rowKey="id"
                  dataSource={playbooks}
                  pagination={false}
                  columns={[
                    { title: 'Код', dataIndex: 'code', render: (value) => value ?? '—' },
                    { title: 'Название', dataIndex: 'name' },
                    {
                      title: 'Статус',
                      dataIndex: 'status',
                      render: (value) => (
                        <Tag color={value === 'published' ? 'green' : 'default'}>{value}</Tag>
                      ),
                    },
                    {
                      title: 'Версия',
                      dataIndex: 'published_version',
                      render: (value) => value ?? '—',
                    },
                    {
                      title: 'Действие',
                      render: (_, record) => (
                        <Button onClick={() => void loadDraft(record)}>
                          Редактировать черновик
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'catalog',
            label: 'Каталог этапов',
            children: (
              <Table<CatalogStage>
                rowKey="code"
                dataSource={catalogStages}
                pagination={false}
                columns={[
                  { title: 'Код', dataIndex: 'code' },
                  { title: 'Название', dataIndex: 'name' },
                  { title: 'Фаза', dataIndex: 'phase' },
                ]}
              />
            ),
          },
          ...(isAdmin
            ? [
                {
                  key: 'integrations',
                  label: 'Интеграции',
                  children: <IntegrationDiagnosticsTab />,
                },
              ]
            : []),
          ...(isAdmin
            ? [
                {
                  key: 'assignments',
                  label: 'Организации и назначения',
                  children: <OrganizationAssignmentsTab />,
                },
                {
                  key: 'manager-memberships',
                  label: 'MANAGER и KAM',
                  children: <ManagerMembershipsTab />,
                },
                { key: 'users', label: 'Пользователи и доступ', children: <UserAccessTab /> },
              ]
            : []),
          ...(isAdmin
            ? [
                {
                  key: 'documentation-requests',
                  label: 'Обращения',
                  children: (
                    <>
                      <Space wrap style={{ marginBottom: 16 }}>
                        <Input
                          allowClear
                          value={requestSearch}
                          onChange={(event) => setRequestSearch(event.target.value)}
                          placeholder="Поиск по теме, автору или тексту"
                          style={{ width: 280 }}
                        />
                        <Select
                          value={requestStatus}
                          onChange={setRequestStatus}
                          style={{ width: 140 }}
                          options={[
                            { value: 'all', label: 'Все статусы' },
                            { value: 'open', label: 'Открыто' },
                            { value: 'closed', label: 'Закрыто' },
                          ]}
                        />
                        <DatePicker
                          value={requestDateFrom ? dayjs(requestDateFrom) : null}
                          placeholder="Дата с"
                          onChange={(value) =>
                            setRequestDateFrom(value?.startOf('day').toISOString())
                          }
                        />
                        <DatePicker
                          value={requestDateTo ? dayjs(requestDateTo) : null}
                          placeholder="Дата по"
                          onChange={(value) => setRequestDateTo(value?.endOf('day').toISOString())}
                        />
                        <Button
                          onClick={() => {
                            setRequestSearch('');
                            setRequestStatus('all');
                            setRequestDateFrom(undefined);
                            setRequestDateTo(undefined);
                          }}
                        >
                          Сбросить
                        </Button>
                      </Space>
                      <Table<DocumentationRequest>
                        rowKey="id"
                        tableLayout="fixed"
                        dataSource={filteredDocumentationRequests}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        onRow={(record) => ({
                          onClick: () => setRequestDetail(record),
                          style: { cursor: 'pointer' },
                        })}
                        columns={[
                          { title: '№', width: 52, render: (_, __, index) => index + 1 },
                          { title: 'Тема', dataIndex: 'subject', width: 130, ellipsis: true },
                          {
                            title: 'Автор',
                            dataIndex: 'author_name',
                            width: 120,
                            ellipsis: true,
                            render: (value) => value ?? '—',
                          },
                          { title: 'Сообщение', dataIndex: 'message', width: 180, ellipsis: true },
                          {
                            title: 'Дата обращения',
                            dataIndex: 'created_at',
                            width: 150,
                            ellipsis: true,
                            render: (value) => dayjs(value).format('DD.MM.YYYY HH:mm'),
                          },
                          {
                            title: 'Статус',
                            dataIndex: 'status',
                            width: 110,
                            render: (value: DocumentationRequest['status']) => (
                              <Tag color={value === 'closed' ? 'green' : 'blue'}>
                                {value === 'closed' ? 'Закрыто' : 'Открыто'}
                              </Tag>
                            ),
                          },
                        ]}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
      <Modal
        title={selected ? `Черновик: ${selected.name}` : 'Черновик эталона'}
        open={Boolean(selected && draft)}
        onCancel={() => {
          setSelected(undefined);
          setDraft(undefined);
          setStages([]);
        }}
        footer={
          <Space>
            <Button
              onClick={() => {
                setSelected(undefined);
                setDraft(undefined);
                setStages([]);
              }}
            >
              Закрыть
            </Button>
            <Button type="primary" disabled={!stages.length} onClick={() => void publish()}>
              Опубликовать
            </Button>
          </Space>
        }
        width={760}
      >
        {!draft ? (
          <Spin />
        ) : (
          <>
            <Typography.Paragraph type="secondary">
              Версия {draft.version}. Добавьте этапы в нужном порядке; последний этап автоматически
              считается финальным.
            </Typography.Paragraph>
            <List
              dataSource={stages}
              locale={{ emptyText: 'Добавьте первый этап.' }}
              renderItem={(stage) => (
                <List.Item
                  actions={[
                    <Button key="facts" size="small" onClick={() => void openFacts(stage)}>
                      Факты
                    </Button>,
                  ]}
                >
                  <Tag>{stage.order_index}</Tag>
                  {stage.name}
                  <Space>
                    <Tag>{stage.is_optional ? 'optional' : 'required'}</Tag>
                    <Typography.Text type="secondary">
                      SLA: {stage.default_duration_days ?? '—'} дней
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
            <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
              <Input
                value={stageName}
                onChange={(event) => setStageName(event.target.value)}
                placeholder="Название этапа"
              />
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Или выбрать из каталога"
                options={catalogStages.map((stage) => ({
                  value: stage.name,
                  label: `${stage.name} · ${stage.phase}`,
                }))}
                onChange={(value) => setStageName(value)}
              />
              <InputNumber
                min={1}
                value={stageSla}
                onChange={setStageSla}
                placeholder="SLA в днях"
                style={{ width: '100%' }}
              />
              <Checkbox
                checked={stageOptional}
                onChange={(event) => setStageOptional(event.target.checked)}
              >
                Этап можно пропустить
              </Checkbox>
              <Button onClick={() => void addStage()}>Добавить этап</Button>
            </Space>
          </>
        )}
      </Modal>
      <Modal
        title={factStage ? `Факты: ${factStage.name}` : 'Факты'}
        open={Boolean(factStage)}
        onCancel={() => setFactStage(undefined)}
        footer={<Button onClick={() => setFactStage(undefined)}>Закрыть</Button>}
      >
        <List
          size="small"
          dataSource={facts}
          locale={{ emptyText: 'Факты пока не добавлены.' }}
          renderItem={(fact) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  danger
                  size="small"
                  onClick={async () => {
                    if (!factStage) return;
                    await apiRequest(
                      `/api/workflows/stages/${factStage.id}/checklist-items/${fact.id}`,
                      { method: 'DELETE' },
                    );
                    setFacts(facts.filter((item) => item.id !== fact.id));
                  }}
                >
                  Удалить
                </Button>,
              ]}
            >
              <Space direction="vertical" size={0}>
                <Typography.Text>{fact.label}</Typography.Text>
                <Typography.Text type="secondary">
                  {fact.code} · {fact.item_type}
                  {fact.required_attachment_kind ? ` · ${fact.required_attachment_kind}` : ''}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          <Input
            value={factCode}
            onChange={(event) => setFactCode(event.target.value)}
            placeholder="Код факта, например contract_file"
          />
          <Input
            value={factLabel}
            onChange={(event) => setFactLabel(event.target.value)}
            placeholder="Название факта"
          />
          <Select
            value={factType}
            onChange={setFactType}
            options={['checkbox', 'file', 'date', 'stakeholder_role', 'number', 'text'].map(
              (value) => ({ value, label: value }),
            )}
          />
          {factType === 'file' && (
            <Input
              value={factKind}
              onChange={(event) => setFactKind(event.target.value)}
              placeholder="Вид вложения, например signed_contract"
            />
          )}
          <Button onClick={() => void addFact()}>Добавить факт</Button>
        </Space>
      </Modal>
      <Modal
        title="Обращение"
        open={Boolean(requestDetail)}
        onCancel={() => setRequestDetail(undefined)}
        footer={<Button onClick={() => setRequestDetail(undefined)}>Закрыть</Button>}
      >
        {requestDetail && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="№">
                {documentationRequests.findIndex((item) => item.id === requestDetail.id) + 1}
              </Descriptions.Item>
              <Descriptions.Item label="Автор">
                {requestDetail.author_name ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Дата обращения">
                {dayjs(requestDetail.created_at).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Select
                  value={requestDetail.status}
                  style={{ width: 140 }}
                  options={[
                    { value: 'open', label: 'Открыто' },
                    { value: 'closed', label: 'Закрыто' },
                  ]}
                  onChange={async (status: 'open' | 'closed') => {
                    await apiRequest(`/api/documentation/requests/${requestDetail.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status }),
                    });
                    const updated = { ...requestDetail, status };
                    setDocumentationRequests(
                      documentationRequests.map((item) =>
                        item.id === updated.id ? updated : item,
                      ),
                    );
                    setRequestDetail(updated);
                  }}
                />
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>Тема</Typography.Title>
            <Typography.Paragraph>{requestDetail.subject}</Typography.Paragraph>
            <Typography.Title level={5}>Описание</Typography.Title>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {requestDetail.message}
            </Typography.Paragraph>
          </>
        )}
      </Modal>
    </Card>
  );
};

export default ManagementPage;
