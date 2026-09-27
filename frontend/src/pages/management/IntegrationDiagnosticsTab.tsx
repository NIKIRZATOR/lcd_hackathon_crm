import { Alert, Button, Card, Descriptions, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';

type SourceSummary = { source: string; records: number; mapped: number; unmatched: number; errors: number };
type Signal = {
  id: string;
  source: string;
  external_key: string | null;
  status: 'received' | 'mapped' | 'unmatched' | 'error' | 'ignored';
  received_at: string;
  normalized_payload: Record<string, unknown>;
  program_instance_id: string | null;
  error_code: string | null;
  error_message: string | null;
  match_reason: string | null;
};
type Organization = { id: string; name: string };
type Page<T> = { items: T[] };
type Program = { id: string; direction_id: string; product_id: string; direction_name: string; product_name: string };
type Diagnostic = { source: string; external_course_name: string | null; external_stream_id: string | null; status: Signal['status']; records: number; program_instance_id: string | null; matched_program: string | null };

const uploadSources = [
  { value: 'VENDOR_CATALOG', label: 'Каталог вендоров · PROVIDED XLSX' },
  { value: 'B2C_USER', label: 'B2C пользователи · PROVIDED XLSX' },
  { value: 'PAYMENT', label: 'B2C заказы · PROVIDED JSON' },
  { value: 'WEBSITE', label: 'Сайт · TEAM DEMO fixture' },
  { value: 'LMS', label: 'LMS · TEAM DEMO fixture' },
];

const statusColor: Record<Signal['status'], string> = {
  received: 'blue', mapped: 'green', unmatched: 'gold', error: 'red', ignored: 'default',
};

const sourceBadge = (source: string) => (source === 'WEBSITE' || source === 'LMS' ? 'DEMO/STUB' : 'PROVIDED');

export const IntegrationDiagnosticsTab = () => {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [selectedSource, setSelectedSource] = useState('PAYMENT');
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [mappingSignal, setMappingSignal] = useState<Signal>();
  const [organizationId, setOrganizationId] = useState<string>();
  const [programId, setProgramId] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [nextSources, nextSignals, nextDiagnostics, nextOrganizations] = await Promise.all([
        apiRequest<SourceSummary[]>('/api/integrations/sources'),
        apiRequest<Signal[]>('/api/integrations/signals'),
        apiRequest<Diagnostic[]>('/api/integrations/diagnostics'),
        apiRequest<Page<Organization>>('/api/organizations?limit=100'),
      ]);
      setSources(nextSources);
      setSignals(nextSignals);
      setDiagnostics(nextDiagnostics);
      setOrganizations(nextOrganizations.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить диагностику интеграций.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const processFixture = async (file?: File) => {
    setLoading(true); setError(undefined); setNotice(undefined);
    try {
      const body = new FormData();
      if (file) body.append('file', file);
      const result = await apiRequest<{ processed: number; mapped: number; unmatched: number; errors: number; ignored: number }>(
        `/api/integrations/sources/${selectedSource}/process`, { method: 'POST', body },
      );
      setNotice(`Обработано: ${result.processed}; сопоставлено: ${result.mapped}; без сопоставления: ${result.unmatched}; ошибок: ${result.errors}; повторов: ${result.ignored}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось обработать fixture.');
    } finally { setLoading(false); }
  };

  const uploadProps: UploadProps = {
    maxCount: 1,
    accept: selectedSource === 'PAYMENT' ? '.json,application/json' : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    beforeUpload: (file) => { void processFixture(file as File); return Upload.LIST_IGNORE; },
    showUploadList: false,
  };

  const selectOrganization = async (value: string) => {
    setOrganizationId(value); setProgramId(undefined); setPrograms([]);
    try {
      const result = await apiRequest<Page<Program>>(`/api/organizations/${value}/program-instances?limit=100`);
      setPrograms(result.items);
    } catch { setError('Не удалось получить программы выбранной организации.'); }
  };

  const saveMapping = async () => {
    if (!mappingSignal || !programId) return;
    const program = programs.find((item) => item.id === programId);
    const course = String(mappingSignal.normalized_payload.external_course_name ?? '');
    const stream = String(mappingSignal.normalized_payload.external_stream_id ?? '');
    if (!program || !course || !stream) return;
    setLoading(true); setError(undefined);
    try {
      const replay = await apiRequest<{ replayed: number; mapped: number }>('/api/integrations/mappings/apply', { method: 'POST', body: JSON.stringify({ source: mappingSignal.source, external_course_name: course, external_stream_id: stream, program_instance_id: program.id }) });
      setNotice(`Сопоставление сохранено; перепроцессировано: ${replay.replayed}, сопоставлено: ${replay.mapped}.`);
      setMappingSignal(undefined); setOrganizationId(undefined); setProgramId(undefined); setPrograms([]);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить сопоставление.');
    } finally { setLoading(false); }
  };

  return <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Alert type="info" showIcon message="Stage 5 integration diagnostics" description="B2C-заказ — нейтральная запись из предоставленного JSON, не подтверждённая оплата и не выручка. Raw PII доступен только через ADMIN API и здесь не отображается." />
    {error && <Alert type="error" showIcon message={error} />}
    {notice && <Alert type="success" showIcon message={notice} />}
    <Card title="Загрузка fixture" size="small">
      <Space wrap>
        <Select value={selectedSource} onChange={setSelectedSource} style={{ minWidth: 280 }} options={uploadSources} />
        {selectedSource === 'WEBSITE' || selectedSource === 'LMS'
          ? <Button type="primary" loading={loading} onClick={() => void processFixture()}>Запустить TEAM DEMO fixture</Button>
          : <Upload {...uploadProps}><Button type="primary" loading={loading}>Выбрать и обработать файл</Button></Upload>}
      </Space>
    </Card>
    <Table<SourceSummary> size="small" rowKey="source" dataSource={sources} pagination={false} columns={[
      { title: 'Источник', dataIndex: 'source', render: (value: string) => <Space><strong>{value}</strong><Tag>{sourceBadge(value)}</Tag></Space> },
      { title: 'Всего', dataIndex: 'records' }, { title: 'Mapped', dataIndex: 'mapped' }, { title: 'Unmatched', dataIndex: 'unmatched' }, { title: 'Ошибки', dataIndex: 'errors' },
    ]} />
    <Card title="Сопоставления по курсам и потокам" size="small">
      <Table<Diagnostic> size="small" rowKey={(item) => `${item.source}:${item.external_course_name}:${item.external_stream_id}:${item.status}:${item.program_instance_id}`} dataSource={diagnostics} pagination={{ pageSize: 10 }} columns={[
        { title: 'Источник', dataIndex: 'source', render: (value: string) => <Space>{value}<Tag>{sourceBadge(value)}</Tag></Space> },
        { title: 'Курс', dataIndex: 'external_course_name', render: (value) => value ?? '—' },
        { title: 'Поток', dataIndex: 'external_stream_id', render: (value) => value ?? '—' },
        { title: 'Записей', dataIndex: 'records' },
        { title: 'Статус', dataIndex: 'status', render: (value: Signal['status']) => <Tag color={statusColor[value]}>{value}</Tag> },
        { title: 'ProgramInstance', dataIndex: 'matched_program', render: (value) => value ?? '—' },
      ]} />
    </Card>
    <Card title="Несопоставленные записи и ошибки" size="small">
      <Table<Signal> size="small" rowKey="id" dataSource={signals.filter((item) => item.status === 'unmatched' || item.status === 'error')} pagination={{ pageSize: 10 }} columns={[
        { title: 'Источник', dataIndex: 'source', render: (value: string) => <Space>{value}<Tag>{sourceBadge(value)}</Tag></Space> },
        { title: 'Курс / поток', render: (_, item) => <>{String(item.normalized_payload.external_course_name ?? '—')}<br /><Typography.Text type="secondary">{String(item.normalized_payload.external_stream_id ?? '—')}</Typography.Text></> },
        { title: 'Статус', dataIndex: 'status', render: (value: Signal['status']) => <Tag color={statusColor[value]}>{value}</Tag> },
        { title: 'Причина', render: (_, item) => item.error_message ?? item.match_reason ?? '—' },
        { title: 'Действие', render: (_, item) => item.status === 'unmatched' && item.source === 'PAYMENT' ? <Button size="small" onClick={() => setMappingSignal(item)}>Сопоставить</Button> : null },
      ]} />
    </Card>
    {mappingSignal && <Card title="Сопоставление B2C-заказа" size="small">
      <Descriptions size="small" column={1}><Descriptions.Item label="Курс">{String(mappingSignal.normalized_payload.external_course_name ?? '—')}</Descriptions.Item><Descriptions.Item label="Поток">{String(mappingSignal.normalized_payload.external_stream_id ?? '—')}</Descriptions.Item></Descriptions>
      <Space wrap style={{ marginTop: 12 }}>
        <Select showSearch optionFilterProp="label" value={organizationId} onChange={(value) => void selectOrganization(value)} placeholder="Организация" style={{ minWidth: 280 }} options={organizations.map((item) => ({ value: item.id, label: item.name }))} />
        <Select showSearch optionFilterProp="label" disabled={!organizationId} value={programId} onChange={setProgramId} placeholder="ProgramInstance" style={{ minWidth: 320 }} options={programs.map((item) => ({ value: item.id, label: `${item.direction_name} · ${item.product_name}` }))} />
        <Button type="primary" disabled={!programId} loading={loading} onClick={() => void saveMapping()}>Сохранить и перепроцессить</Button>
        <Button onClick={() => setMappingSignal(undefined)}>Отмена</Button>
      </Space>
    </Card>}
  </Space>;
};
