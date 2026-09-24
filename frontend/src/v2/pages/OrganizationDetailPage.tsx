import { Alert, Button, Card, Descriptions, Input, List, Modal, Select, Spin, Steps, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type Organization = { id: string; name: string; short_name: string | null; region: string | null; city: string | null; status: string; comment: string | null };
type Stakeholder = { id: string; full_name: string; role_code: string; position: string | null; email: string | null; is_primary: boolean };
type ProgramInstance = { id: string; direction_name: string; product_name: string; status: string; kam_name: string | null; academic_window_title: string | null; health_score: number | null; health_band: string };
type OrganizationHealth = { active_programs_count: number; worst_health_score: number | null; worst_health_band: string | null };
type Organization360 = { type_name: string; kam_name: string | null; documents_count: number; feed_events_count: number };
type Page<T> = { items: T[] };
type Contract = { id: string; number: string; signed_on: string | null; valid_until: string | null };
type License = { id: string; product_name: string; license_number: string | null; valid_until: string | null; transfer_status: string };
type Teacher = { id: string; full_name: string; product_name: string; status: string; qualification_until: string | null };

const OrganizationDetailPage = () => {
  const { id } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [programs, setPrograms] = useState<ProgramInstance[]>([]);
  const [organizationHealth, setOrganizationHealth] = useState<OrganizationHealth | null>(null);
  const [summary, setSummary] = useState<Organization360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([apiRequest<Organization>(`/api/organizations/${id}`), apiRequest<Stakeholder[]>(`/api/organizations/${id}/stakeholders`), apiRequest<Page<ProgramInstance>>(`/api/organizations/${id}/program-instances`), apiRequest<OrganizationHealth>(`/api/organizations/${id}/health`), apiRequest<Organization360>(`/api/organizations/${id}/360`)])
      .then(([loadedOrganization, loadedStakeholders, loadedPrograms, loadedHealth, loadedSummary]) => { setOrganization(loadedOrganization); setStakeholders(loadedStakeholders); setPrograms(loadedPrograms.items); setOrganizationHealth(loadedHealth); setSummary(loadedSummary); })
      .catch(() => setError('Не удалось загрузить карточку организации.'));
  }, [id]);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!organization) return <Spin size="large" />;

  return (
    <>
      <Card title={organization.name} extra={<><Button onClick={async () => { await Promise.all(programs.map((program) => apiRequest(`/api/integrations/program-instances/${program.id}/sync`, { method: 'POST' }))); window.location.reload(); }}>Синхронизировать</Button> <Button onClick={() => navigate('/v2/reports')}>Отчёт</Button> <Button type="primary" onClick={() => setOpen(true)}>Новая программа</Button> <Tag color={organization.status === 'active' ? 'green' : 'default'}>{organization.status}</Tag></>}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Тип">{summary?.type_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="KAM">{summary?.kam_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Короткое название">{organization.short_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Регион">{organization.region ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Город">{organization.city ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Комментарий">{organization.comment ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Худший health">{organizationHealth?.worst_health_band ? <Tag color={organizationHealth.worst_health_band === 'green' ? 'green' : organizationHealth.worst_health_band === 'yellow' ? 'gold' : 'red'}>{organizationHealth.worst_health_score} · {organizationHealth.worst_health_band}</Tag> : 'Нет активных программ'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Документы и лента" style={{ marginTop: 16 }}><Descriptions size="small" column={2}><Descriptions.Item label="Документы">{summary?.documents_count ?? 0}</Descriptions.Item><Descriptions.Item label="События ленты">{summary?.feed_events_count ?? 0}</Descriptions.Item></Descriptions></Card>
      <Card title="Люди" style={{ marginTop: 16 }}>
        <List dataSource={stakeholders} locale={{ emptyText: 'Стейкхолдеры пока не добавлены' }} renderItem={(person) => (
          <List.Item><List.Item.Meta title={<>{person.full_name} {person.is_primary && <Tag color="blue">Основной</Tag>}</>} description={`${person.role_code}${person.position ? ` · ${person.position}` : ''}${person.email ? ` · ${person.email}` : ''}`} /></List.Item>
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
        const created = await apiRequest<{ id: string }>(`/api/organizations/${id}/program-instances`, { method: 'POST', body: JSON.stringify(values) });
        navigate(`/v2/programs/${created.id}`);
      }} okText={step === 3 ? 'Создать' : 'Далее'}>
        <Steps current={step} size="small" items={[{ title: 'Направление' }, { title: 'Продукт' }, { title: 'Плейбук' }, { title: 'Окно' }]} style={{ marginBottom: 24 }} />
        <WizardStep step={step} values={values} onChange={setValues} />
      </Modal>
      <ContractsAndTeachers organizationId={id!} />
    </>
  );
};

const WizardStep = ({ step, values, onChange }: { step: number; values: Record<string, string>; onChange: (value: Record<string, string>) => void }) => {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const paths = ['/api/it-directions?limit=100', '/api/it-products?limit=100', '/api/management/playbooks', '/api/academic-windows'];
  const keys = ['direction_id', 'product_id', 'playbook_template_id', 'academic_window_id'];
  useEffect(() => { apiRequest<any>(paths[step]).then((data) => setOptions((data.items ?? data).filter((item: any) => step !== 2 || item.status === 'published').map((item: any) => ({ value: item.id, label: item.name ?? item.title ?? item.code })))); }, [step]);
  return <Select style={{ width: '100%' }} placeholder="Выберите значение" options={options} value={values[keys[step]]} onChange={(value) => onChange({ ...values, [keys[step]]: value })} />;
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
      ? { number: values.number, signed_on: values.signed_on || null }
      : createKind === 'license'
        ? { program_instance_id: values.program_instance_id, license_number: values.license_number || null, transfer_status: values.transfer_status }
        : { product_id: values.product_id, full_name: values.full_name, status: values.status };
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
      ]} />
      <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>Лицензии программ <Button size="small" onClick={() => setCreateKind('license')}>Добавить</Button></Typography.Text>
      <Table<License> rowKey="id" dataSource={licenses} pagination={false} size="small" locale={{ emptyText: 'Лицензий пока нет' }} columns={[
        { title: 'Продукт', dataIndex: 'product_name' },
        { title: 'Номер', dataIndex: 'license_number', render: (value) => value ?? '—' },
        { title: 'Срок', dataIndex: 'valid_until', render: (value) => value?.slice(0, 10) ?? '—' },
        { title: 'Передача', dataIndex: 'transfer_status', render: (value) => <Tag>{value}</Tag> },
      ]} />
    </Card>
    <Card title="Преподаватели-носители" extra={<Button size="small" onClick={() => setCreateKind('teacher')}>Добавить</Button>} style={{ marginTop: 16 }}>
      <Table<Teacher> rowKey="id" dataSource={teachers} pagination={false} size="small" locale={{ emptyText: 'Преподавателей пока нет' }} columns={[
        { title: 'ФИО', dataIndex: 'full_name' },
        { title: 'Продукт', dataIndex: 'product_name' },
        { title: 'Статус', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
        { title: 'Квалификация до', dataIndex: 'qualification_until', render: (value) => value ?? '—' },
      ]} />
    </Card>
    <Modal title="Новая запись" open={createKind !== null} onCancel={() => setCreateKind(null)} onOk={() => void create()} okText="Сохранить">
      {createKind === 'contract' && <><Input placeholder="Номер договора" value={values.number} onChange={(event) => setValues({ ...values, number: event.target.value })} /><Input style={{ marginTop: 12 }} placeholder="Дата подписания (YYYY-MM-DD)" value={values.signed_on} onChange={(event) => setValues({ ...values, signed_on: event.target.value })} /></>}
      {createKind === 'license' && <><Select style={{ width: '100%' }} placeholder="Программа" options={programs.map((program) => ({ value: program.id, label: program.product_name }))} value={values.program_instance_id} onChange={(value) => setValues({ ...values, program_instance_id: value })} /><Input style={{ marginTop: 12 }} placeholder="Номер лицензии" value={values.license_number} onChange={(event) => setValues({ ...values, license_number: event.target.value })} /><Select style={{ width: '100%', marginTop: 12 }} options={['not_transferred', 'in_progress', 'transferred', 'revoked'].map((value) => ({ value, label: value }))} value={values.transfer_status} onChange={(value) => setValues({ ...values, transfer_status: value })} /></>}
      {createKind === 'teacher' && <><Input placeholder="ФИО" value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} /><Select style={{ width: '100%', marginTop: 12 }} placeholder="Продукт" options={products.map((product) => ({ value: product.id, label: product.name }))} value={values.product_id} onChange={(value) => setValues({ ...values, product_id: value })} /><Select style={{ width: '100%', marginTop: 12 }} options={['planned', 'trained', 'active', 'expired', 'left'].map((value) => ({ value, label: value }))} value={values.status} onChange={(value) => setValues({ ...values, status: value })} /></>}
    </Modal>
  </>;
};

export default OrganizationDetailPage;
