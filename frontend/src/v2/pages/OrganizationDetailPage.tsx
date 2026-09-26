import { Alert, Button, Card, Checkbox, Descriptions, Input, List, Modal, Select, Spin, Steps, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { ApiError, apiDownload, apiRequest } from '../../api/client';

type Organization = { id: string; name: string; short_name: string | null; region: string | null; city: string | null; status: string; comment: string | null };
type Stakeholder = { id: string; full_name: string; role_code: string; position: string | null; email: string | null; phone: string | null; is_primary: boolean; is_active: boolean };
type ProgramInstance = { id: string; direction_name: string; product_name: string; status: string; kam_name: string | null; academic_window_title: string | null; health_score: number | null; health_band: string };
type OrganizationHealth = { active_programs_count: number; worst_health_score: number | null; worst_health_band: string | null };
type Organization360 = { type_name: string; kam_name: string | null; documents_count: number; feed_events_count: number };
type OrganizationDocument = { file_id: string; attachment_id: string | null; filename: string; kind: string | null; program_name: string | null; stage_name: string | null; created_at: string; uploaded_by_name: string | null };
type FeedItem = { id: string; kind: string; title: string; description: string | null; created_at: string; actor_name: string | null };
type Page<T> = { items: T[] };
type Contract = { id: string; number: string; signed_on: string | null; valid_until: string | null; status: string | null; comment: string | null };
type License = { id: string; product_name: string; license_number: string | null; valid_until: string | null; transfer_status: string; product_access: string | null };
type Teacher = { id: string; full_name: string; product_name: string; status: string; trained_on: string | null; qualification_until: string | null; last_lms_activity_on: string | null };

const OrganizationDetailPage = () => {
  const { id } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [programs, setPrograms] = useState<ProgramInstance[]>([]);
  const [organizationHealth, setOrganizationHealth] = useState<OrganizationHealth | null>(null);
  const [summary, setSummary] = useState<Organization360 | null>(null);
  const [documents, setDocuments] = useState<OrganizationDocument[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [stakeholderOpen, setStakeholderOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [stakeholderValues, setStakeholderValues] = useState<Record<string, string | boolean>>({ role_code: 'other' });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [eligibleKams, setEligibleKams] = useState<{ id: string; full_name: string }[]>([]);
  const [newKamId, setNewKamId] = useState<string>();
  const [reassignReason, setReassignReason] = useState('');
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [startError, setStartError] = useState<string>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([apiRequest<Organization>(`/api/organizations/${id}`), apiRequest<Stakeholder[]>(`/api/organizations/${id}/stakeholders`), apiRequest<Page<ProgramInstance>>(`/api/organizations/${id}/program-instances`), apiRequest<OrganizationHealth>(`/api/organizations/${id}/health`), apiRequest<Organization360>(`/api/organizations/${id}/360`), apiRequest<OrganizationDocument[]>(`/api/organizations/${id}/documents`), apiRequest<FeedItem[]>(`/api/organizations/${id}/feed`)])
      .then(([loadedOrganization, loadedStakeholders, loadedPrograms, loadedHealth, loadedSummary, loadedDocuments, loadedFeed]) => { setOrganization(loadedOrganization); setStakeholders(loadedStakeholders); setPrograms(loadedPrograms.items); setOrganizationHealth(loadedHealth); setSummary(loadedSummary); setDocuments(loadedDocuments); setFeed(loadedFeed); })
      .catch(() => setError('Не удалось загрузить карточку организации.'));
  }, [id]);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!organization) return <Spin size="large" />;

  return (
    <>
      <Card title={organization.name} extra={<><Button onClick={async () => { await Promise.all(programs.map((program) => apiRequest(`/api/integrations/program-instances/${program.id}/sync`, { method: 'POST' }))); window.location.reload(); }}>Синхронизировать</Button> <Button onClick={() => navigate('/v2/reports')}>Отчёт</Button> <Button type="primary" disabled={organization.status === 'archived'} title={organization.status === 'archived' ? 'Нельзя запускать программы в архивной организации' : undefined} onClick={() => { setStartError(undefined); setOpen(true); }}>Новая программа</Button> <Tag color={organization.status === 'active' ? 'green' : 'default'}>{organization.status}</Tag></>}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Тип">{summary?.type_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="KAM">{summary?.kam_name ?? '—'} <Button size="small" onClick={async () => { setEligibleKams(await apiRequest<{ id: string; full_name: string }[]>(`/api/organizations/${id}/eligible-kams`)); setReassignOpen(true); }}>Переназначить</Button></Descriptions.Item>
          <Descriptions.Item label="Короткое название">{organization.short_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Регион">{organization.region ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Город">{organization.city ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Комментарий">{organization.comment ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Худший health">{organizationHealth?.worst_health_band ? <Tag color={organizationHealth.worst_health_band === 'green' ? 'green' : organizationHealth.worst_health_band === 'yellow' ? 'gold' : 'red'}>{organizationHealth.worst_health_score} · {organizationHealth.worst_health_band}</Tag> : 'Нет активных программ'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Документы" style={{ marginTop: 16 }}>
        <List size="small" dataSource={documents} locale={{ emptyText: 'Документов пока нет' }} renderItem={(item) => <List.Item actions={item.attachment_id ? [<Button key="download" size="small" onClick={async () => { const blob = await apiDownload(`/api/workflows/attachments/${item.attachment_id}/download`); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = item.filename; link.click(); URL.revokeObjectURL(url); }}>Скачать</Button>] : []}><List.Item.Meta title={item.filename} description={`${item.kind ?? 'без вида'} · ${item.stage_name ?? 'без этапа'} · ${item.uploaded_by_name ?? '—'}`} /></List.Item>} />
      </Card>
      <Card title="Лента" style={{ marginTop: 16 }}>
        <List size="small" dataSource={feed} locale={{ emptyText: 'Событий пока нет' }} renderItem={(item) => <List.Item><List.Item.Meta title={`${item.title} · ${new Date(item.created_at).toLocaleString()}`} description={`${item.description ?? item.kind}${item.actor_name ? ` · ${item.actor_name}` : ''}`} /></List.Item>} />
      </Card>
      <Card title="Люди" extra={<Button size="small" onClick={() => { setEditingStakeholder(null); setStakeholderValues({ role_code: 'other' }); setStakeholderOpen(true); }}>Добавить</Button>} style={{ marginTop: 16 }}>
        <List dataSource={stakeholders} locale={{ emptyText: 'Стейкхолдеры пока не добавлены' }} renderItem={(person) => (
          <List.Item actions={[<Button key="edit" size="small" onClick={() => { setEditingStakeholder(person); setStakeholderValues({ role_code: person.role_code, full_name: person.full_name, position: person.position ?? '', email: person.email ?? '', phone: person.phone ?? '', is_primary: person.is_primary }); setStakeholderOpen(true); }}>Изменить</Button>, <Button key="deactivate" danger size="small" onClick={async () => { await apiRequest(`/api/organizations/stakeholders/${person.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: false }) }); window.location.reload(); }}>Деактивировать</Button>]}><List.Item.Meta title={<>{person.full_name} {person.is_primary && <Tag color="blue">Основной</Tag>}</>} description={`${person.role_code}${person.position ? ` · ${person.position}` : ''}${person.email ? ` · ${person.email}` : ''}`} /></List.Item>
        )} />
      </Card>
      <Card title="Программы" style={{ marginTop: 16 }}>
        <Table<ProgramInstance> rowKey="id" dataSource={programs} pagination={false} onRow={(record) => ({ onClick: () => navigate(`/v2/programs/${record.id}`), style: { cursor: 'pointer' } })} locale={{ emptyText: 'Программы пока не добавлены' }} columns={[
          { title: 'Направление', dataIndex: 'direction_name' },
          { title: 'Продукт', dataIndex: 'product_name', render: (name, record) => <Link to={`/v2/programs/${record.id}`}>{name}</Link> },
          { title: 'Статус', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
          { title: 'KAM', dataIndex: 'kam_name', render: (value) => value ?? 'По организации' },
          { title: 'Учебное окно', dataIndex: 'academic_window_title', render: (value) => value ?? '—' },
          { title: 'Health', dataIndex: 'health_band', render: (value, record) => <Tag color={value === 'green' ? 'green' : value === 'yellow' ? 'gold' : 'red'}>{record.health_score ?? '—'} · {value}</Tag> },
        ]} />
      </Card>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>Программы, договоры и лента будут подключены на следующих этапах.</Typography.Paragraph>
      <Modal title="Новая программа" open={open} onCancel={() => setOpen(false)} onOk={async () => {
        if (step < 3) { setStep(step + 1); return; }
        try {
          const created = await apiRequest<{ id: string }>(`/api/organizations/${id}/program-instances`, { method: 'POST', body: JSON.stringify(values) });
          navigate(`/v2/programs/${created.id}`);
        } catch (caught) {
          setStartError(caught instanceof ApiError ? caught.message : 'Не удалось запустить программу.');
        }
      }} okText={step === 3 ? 'Создать' : 'Далее'}>
        <Steps current={step} size="small" items={[{ title: 'Направление' }, { title: 'Продукт' }, { title: 'Плейбук' }, { title: 'Окно' }]} style={{ marginBottom: 24 }} />
        {startError && <Alert type="error" showIcon message={startError} style={{ marginBottom: 12 }} />}
        <WizardStep organizationId={id!} step={step} values={values} onChange={setValues} />
      </Modal>
      <Modal title={editingStakeholder ? 'Изменить контакт' : 'Новый контакт'} open={stakeholderOpen} onCancel={() => setStakeholderOpen(false)} onOk={async () => { const body = { ...stakeholderValues }; if (editingStakeholder) await apiRequest(`/api/organizations/stakeholders/${editingStakeholder.id}`, { method: 'PATCH', body: JSON.stringify(body) }); else await apiRequest(`/api/organizations/${id}/stakeholders`, { method: 'POST', body: JSON.stringify(body) }); window.location.reload(); }}>
        <Input placeholder="ФИО" value={String(stakeholderValues.full_name ?? '')} onChange={(event) => setStakeholderValues({ ...stakeholderValues, full_name: event.target.value })} />
        <Select style={{ width: '100%', marginTop: 12 }} value={String(stakeholderValues.role_code ?? 'other')} options={['vice_rector', 'dean', 'methodist', 'lawyer', 'chair', 'teacher', 'director', 'school_teacher', 'other'].map((value) => ({ value, label: value }))} onChange={(value) => setStakeholderValues({ ...stakeholderValues, role_code: value })} />
        <Input style={{ marginTop: 12 }} placeholder="Должность" value={String(stakeholderValues.position ?? '')} onChange={(event) => setStakeholderValues({ ...stakeholderValues, position: event.target.value })} />
        <Input style={{ marginTop: 12 }} placeholder="E-mail" value={String(stakeholderValues.email ?? '')} onChange={(event) => setStakeholderValues({ ...stakeholderValues, email: event.target.value })} />
        <Input style={{ marginTop: 12 }} placeholder="Телефон" value={String(stakeholderValues.phone ?? '')} onChange={(event) => setStakeholderValues({ ...stakeholderValues, phone: event.target.value })} />
        <Checkbox style={{ marginTop: 12 }} checked={Boolean(stakeholderValues.is_primary)} onChange={(event) => setStakeholderValues({ ...stakeholderValues, is_primary: event.target.checked })}>Основной контакт</Checkbox>
      </Modal>
      <Modal title="Переназначить KAM" open={reassignOpen} onCancel={() => setReassignOpen(false)} onOk={async () => { if (!newKamId) return; await apiRequest(`/api/organizations/${id}/assignments`, { method: 'POST', body: JSON.stringify({ kam_user_id: newKamId, reason: reassignReason || null }) }); window.location.reload(); }}>
        <Typography.Paragraph>Текущий KAM: {summary?.kam_name ?? 'не назначен'}</Typography.Paragraph>
        <Select style={{ width: '100%' }} placeholder="Новый KAM" value={newKamId} options={eligibleKams.map((kam) => ({ value: kam.id, label: kam.full_name }))} onChange={setNewKamId} />
        <Input.TextArea style={{ marginTop: 12 }} placeholder="Причина переназначения" value={reassignReason} onChange={(event) => setReassignReason(event.target.value)} />
      </Modal>
      <ContractsAndTeachers organizationId={id!} />
    </>
  );
};

const WizardStep = ({ organizationId, step, values, onChange }: { organizationId: string; step: number; values: Record<string, string>; onChange: (value: Record<string, string>) => void }) => {
  const [options, setOptions] = useState<{ label: string; value: string; recommended?: boolean; disabled?: boolean }[]>([]);
  const [kams, setKams] = useState<{ label: string; value: string }[]>([]);
  const playbookQuery = new URLSearchParams();
  if (values.direction_id) playbookQuery.set('direction_id', values.direction_id);
  if (values.product_id) playbookQuery.set('product_id', values.product_id);
  if (values.parent_program_id) playbookQuery.set('parent_program_id', values.parent_program_id);
  const paths = ['/api/it-directions?limit=100', '/api/it-products?limit=100', `/api/organizations/${organizationId}/available-playbooks?${playbookQuery.toString()}`, '/api/academic-windows'];
  const keys = ['direction_id', 'product_id', 'playbook_template_id', 'academic_window_id'];
  useEffect(() => {
    apiRequest<any>(paths[step]).then((data) => setOptions((data.items ?? data).map((item: any) => ({ value: item.id, recommended: item.recommended, disabled: item.disabled, label: `${item.name ?? item.title ?? item.code}${item.recommended ? ' · рекомендуется' : ''}${item.reason ? ` — ${item.reason}` : ''}` }))));
    if (step === 3) apiRequest<any[]>(`/api/organizations/${organizationId}/eligible-kams`).then((data) => setKams(data.map((item) => ({ value: item.id, label: item.full_name }))));
  }, [organizationId, step, values.direction_id, values.product_id, values.parent_program_id]);
  return <>
    <Select style={{ width: '100%' }} placeholder="Выберите значение" options={options} value={values[keys[step]]} onChange={(value) => onChange({ ...values, [keys[step]]: value })} />
    {step === 3 && <Select allowClear style={{ width: '100%', marginTop: 12 }} placeholder="KAM: наследовать назначение организации" options={kams} value={values.kam_user_id} onChange={(value) => { const next = { ...values }; if (value) next.kam_user_id = value; else delete next.kam_user_id; onChange(next); }} />}
  </>;
};

const ContractsAndTeachers = ({ organizationId }: { organizationId: string }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [programs, setPrograms] = useState<{ id: string; product_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [createKind, setCreateKind] = useState<'contract' | 'license' | 'teacher' | null>(null);
  const [values, setValues] = useState<Record<string, string>>({ transfer_status: 'not_transferred', status: 'planned' });

  const load = () => Promise.all([
    apiRequest<Contract[]>(`/api/organizations/${organizationId}/contracts`),
    apiRequest<License[]>(`/api/organizations/${organizationId}/licenses`),
    apiRequest<Teacher[]>(`/api/organizations/${organizationId}/teachers`),
    apiRequest<Page<{ id: string; product_name: string }>>(`/api/organizations/${organizationId}/program-instances`),
    apiRequest<Page<{ id: string; name: string }>>('/api/it-products?limit=100'),
  ]).then(([loadedContracts, loadedLicenses, loadedTeachers, loadedPrograms, loadedProducts]) => {
    setContracts(loadedContracts); setLicenses(loadedLicenses); setTeachers(loadedTeachers);
    setPrograms(loadedPrograms.items); setProducts(loadedProducts.items);
  });

  useEffect(() => {
    load().catch(() => undefined);
  }, [organizationId]);

  const create = async () => {
    if (!createKind) return;
    const paths = {
      contract: `/api/organizations/${organizationId}/contracts`,
      license: `/api/organizations/${organizationId}/licenses`,
      teacher: `/api/organizations/${organizationId}/teachers`,
    };
    const payload = createKind === 'contract'
      ? { number: values.number, signed_on: values.signed_on || null, valid_until: values.valid_until || null, status: values.contract_status || null, comment: values.contract_comment || null }
      : createKind === 'license'
        ? { program_instance_id: values.program_instance_id, license_number: values.license_number || null, signed_at: values.license_signed_at || null, valid_until: values.license_valid_until || null, transfer_status: values.transfer_status, product_access: values.product_access || null, comment: values.license_comment || null }
        : { product_id: values.product_id, full_name: values.full_name, trained_on: values.trained_on || null, qualification_until: values.qualification_until || null, last_lms_activity_on: values.last_lms_activity_on || null, status: values.status };
    await apiRequest(paths[createKind], { method: 'POST', body: JSON.stringify(payload) });
    setCreateKind(null); setValues({ transfer_status: 'not_transferred', status: 'planned' }); await load();
  };

  return <>
    <Card title="Договоры и лицензии" style={{ marginTop: 16 }}>
      <Typography.Text strong>Рамочные договоры</Typography.Text> <Button size="small" onClick={() => setCreateKind('contract')}>Добавить</Button>
      <Table<Contract> rowKey="id" dataSource={contracts} pagination={false} size="small" locale={{ emptyText: 'Договоров пока нет' }} columns={[
        { title: 'Номер', dataIndex: 'number' },
        { title: 'Подписан', dataIndex: 'signed_on', render: (value) => value ?? '—' },
        { title: 'Действует до', dataIndex: 'valid_until', render: (value) => value?.slice(0, 10) ?? '—' },
        { title: 'Статус', dataIndex: 'status', render: (value) => value ?? '—' },
      ]} />
      <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>Лицензии программ <Button size="small" onClick={() => setCreateKind('license')}>Добавить</Button></Typography.Text>
      <Table<License> rowKey="id" dataSource={licenses} pagination={false} size="small" locale={{ emptyText: 'Лицензий пока нет' }} columns={[
        { title: 'Продукт', dataIndex: 'product_name' },
        { title: 'Номер', dataIndex: 'license_number', render: (value) => value ?? '—' },
        { title: 'Срок', dataIndex: 'valid_until', render: (value) => value?.slice(0, 10) ?? '—' },
        { title: 'Передача', dataIndex: 'transfer_status', render: (value) => <Tag>{value}</Tag> },
        { title: 'Доступ к продукту', dataIndex: 'product_access', render: (value) => value ?? '—' },
      ]} />
    </Card>
    <Card title="Преподаватели-носители" extra={<Button size="small" onClick={() => setCreateKind('teacher')}>Добавить</Button>} style={{ marginTop: 16 }}>
      <Table<Teacher> rowKey="id" dataSource={teachers} pagination={false} size="small" locale={{ emptyText: 'Преподавателей пока нет' }} columns={[
        { title: 'ФИО', dataIndex: 'full_name' },
        { title: 'Продукт', dataIndex: 'product_name' },
        { title: 'Статус', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
        { title: 'Обучен', dataIndex: 'trained_on', render: (value) => value ?? '—' },
        { title: 'Квалификация до', dataIndex: 'qualification_until', render: (value) => value ?? '—' },
      ]} />
    </Card>
    <Modal title="Новая запись" open={createKind !== null} onCancel={() => setCreateKind(null)} onOk={() => void create()} okText="Сохранить">
      {createKind === 'contract' && <><Input placeholder="Номер договора" value={values.number} onChange={(event) => setValues({ ...values, number: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Дата подписания (YYYY-MM-DD)" value={values.signed_on} onChange={(event) => setValues({ ...values, signed_on: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Действует до (ISO datetime)" value={values.valid_until} onChange={(event) => setValues({ ...values, valid_until: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Статус" value={values.contract_status} onChange={(event) => setValues({ ...values, contract_status: event.target.value })} /><Input.TextArea style={{ marginTop: 12 }} placeholder="Комментарий" value={values.contract_comment} onChange={(event) => setValues({ ...values, contract_comment: event.target.value })} /></>}
      {createKind === 'license' && <><Select style={{ width: '100%' }} placeholder="Программа" options={programs.map((program) => ({ value: program.id, label: program.product_name }))} value={values.program_instance_id} onChange={(value) => setValues({ ...values, program_instance_id: value })} /><Input style={{ marginTop: 12 }} placeholder="Номер лицензии" value={values.license_number} onChange={(event) => setValues({ ...values, license_number: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Подписана (ISO datetime)" value={values.license_signed_at} onChange={(event) => setValues({ ...values, license_signed_at: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Действует до (ISO datetime)" value={values.license_valid_until} onChange={(event) => setValues({ ...values, license_valid_until: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Доступ к продукту: URL, логин или описание" value={values.product_access} onChange={(event) => setValues({ ...values, product_access: event.target.value })} /><Input.TextArea style={{ marginTop: 12 }} placeholder="Комментарий" value={values.license_comment} onChange={(event) => setValues({ ...values, license_comment: event.target.value })} /><Select style={{ width: '100%', marginTop: 12 }} options={['not_transferred', 'in_progress', 'transferred', 'revoked'].map((value) => ({ value, label: value }))} value={values.transfer_status} onChange={(value) => setValues({ ...values, transfer_status: value })} /></>}
      {createKind === 'teacher' && <><Input placeholder="ФИО" value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} /><Select style={{ width: '100%', marginTop: 12 }} placeholder="Продукт" options={products.map((product) => ({ value: product.id, label: product.name }))} value={values.product_id} onChange={(value) => setValues({ ...values, product_id: value })} /><Input style={{ marginTop: 12 }} placeholder="Дата обучения (YYYY-MM-DD)" value={values.trained_on} onChange={(event) => setValues({ ...values, trained_on: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Квалификация до (YYYY-MM-DD)" value={values.qualification_until} onChange={(event) => setValues({ ...values, qualification_until: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="LMS активность (YYYY-MM-DD)" value={values.last_lms_activity_on} onChange={(event) => setValues({ ...values, last_lms_activity_on: event.target.value })} /><Select style={{ width: '100%', marginTop: 12 }} options={['planned', 'trained', 'active', 'expired', 'left'].map((value) => ({ value, label: value }))} value={values.status} onChange={(value) => setValues({ ...values, status: value })} /></>}
    </Modal>
  </>;
};

export default OrganizationDetailPage;
