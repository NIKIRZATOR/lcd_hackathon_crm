import { Alert, Button, Card, Descriptions, List, Modal, Select, Spin, Steps, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../api/client';

type Organization = { id: string; name: string; short_name: string | null; region: string | null; city: string | null; status: string; comment: string | null };
type Stakeholder = { id: string; full_name: string; role_code: string; position: string | null; email: string | null; is_primary: boolean };
type ProgramInstance = { id: string; direction_name: string; product_name: string; status: string; kam_name: string | null; academic_window_title: string | null };
type Page<T> = { items: T[] };

const OrganizationDetailPage = () => {
  const { id } = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [programs, setPrograms] = useState<ProgramInstance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    Promise.all([apiRequest<Organization>(`/api/organizations/${id}`), apiRequest<Stakeholder[]>(`/api/organizations/${id}/stakeholders`), apiRequest<Page<ProgramInstance>>(`/api/organizations/${id}/program-instances`)])
      .then(([loadedOrganization, loadedStakeholders, loadedPrograms]) => { setOrganization(loadedOrganization); setStakeholders(loadedStakeholders); setPrograms(loadedPrograms.items); })
      .catch(() => setError('Не удалось загрузить карточку организации.'));
  }, [id]);

  if (error) return <Alert type="error" message={error} showIcon />;
  if (!organization) return <Spin size="large" />;

  return (
    <>
      <Card title={organization.name} extra={<><Button type="primary" onClick={() => setOpen(true)}>Новая программа</Button> <Tag color={organization.status === 'active' ? 'green' : 'default'}>{organization.status}</Tag></>}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Короткое название">{organization.short_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Регион">{organization.region ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Город">{organization.city ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Комментарий">{organization.comment ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
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

export default OrganizationDetailPage;
