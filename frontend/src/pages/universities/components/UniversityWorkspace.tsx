import { EditOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { Button, Form, Input, List, Modal, Select, Switch, Table, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiDownload } from '../../../api/client';
import { createStakeholder, deactivateStakeholder, updateLicense, updateStakeholder } from '../api';
import type { StakeholderDraft } from '../api';
import { isGapRecord } from '../backendFieldGaps';
import type { UniversityCard, UniversityLicense, UniversityPerson } from '../screenModel';
import { programStatusLabels, stakeholderRoles, teacherStatusLabels, transferLabel, transferStatusOptions } from '../screenModel';
import HealthMark from './HealthMark';
import { Details } from './panels/panelUi';
import { hiddenRowDetails, useTableLayout, visibleColumns, type ResponsiveColumn } from './tableLayout';
import panelStyles from './UniversityPanels.module.scss';

type UniversityWorkspaceProps = {
  card: UniversityCard;
  section: string;
  onChanged: () => void;
};

const downloadAttachment = async (attachmentId: string, fileName: string) => {
  const blob = await apiDownload(`/api/workflows/attachments/${attachmentId}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const yearOf = (value: string) => (value && value !== 'Срок не указан' ? value.slice(0, 4) : 'Год не указан');

const ProgramsSection = ({ card }: { card: UniversityCard }) => {
  const navigate = useNavigate();
  const layout = useTableLayout();
  const columns: ResponsiveColumn<UniversityCard['programs'][number]>[] = [
    { title: 'Направление', dataIndex: 'directionName', show: ['wide', 'mid', 'narrow'] },
    { title: 'Продукт', dataIndex: 'productName', show: ['wide', 'mid'] },
    { title: 'Плейбук', dataIndex: 'playbookName', show: ['wide'] },
    { title: 'Этап', dataIndex: 'stageName', show: ['wide', 'mid', 'narrow'] },
    { title: 'Здоровье', show: ['wide', 'mid', 'narrow'], width: 150, render: (_, row) => <HealthMark score={row.healthScore} band={row.healthBand} empty="Нет оценки" /> },
    { title: 'Студенты', dataIndex: 'students', show: ['wide'], width: 110 },
    { title: 'Лицензия', dataIndex: 'license', show: ['wide'] },
  ];

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.head}><h2>Программы</h2></div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={card.programs}
          locale={{ emptyText: 'Программ пока нет. Нажмите «+ программа» в шапке.' }}
          columns={visibleColumns(layout, columns)}
          onRow={(row) => ({
            onClick: () => { if (!isGapRecord(row.id)) navigate(`/v2/workflows/${row.id}`); },
            style: { cursor: isGapRecord(row.id) ? 'default' : 'pointer' },
          })}
          expandable={hiddenRowDetails<UniversityCard['programs'][number]>(layout, (row) => <Details rows={[
            ['Продукт', row.productName],
            ['Плейбук', row.playbookName],
            ['Студенты', row.students],
            ['Лицензия', row.license],
            ['Статус', programStatusLabels[row.status] ?? row.status],
          ]} />)}
        />
      </div>
    </div>
  );
};

const PeopleSection = ({ card, onChanged }: { card: UniversityCard; onChanged: () => void }) => {
  const [showHidden, setShowHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UniversityPerson | null>(null);
  const [form] = Form.useForm<StakeholderDraft>();
  const rows = card.people.filter((person) => showHidden || person.isActive);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ roleCode: 'other', isPrimary: false, name: '', position: '', email: '', phone: '' });
    setOpen(true);
  };

  const openEdit = (person: UniversityPerson) => {
    setEditing(person);
    form.setFieldsValue({
      roleCode: person.roleCode,
      name: person.name,
      position: person.position === 'Должность не указана' ? '' : person.position,
      email: person.email === 'Почта не указана' ? '' : person.email,
      phone: person.phone === 'Телефон не указан' ? '' : person.phone,
      isPrimary: person.isPrimary,
      programId: person.programId ?? undefined,
    });
    setOpen(true);
  };

  const save = async () => {
    const draft = await form.validateFields();
    if (editing) await updateStakeholder(editing.id, draft);
    else await createStakeholder(card.id, draft);
    setOpen(false);
    message.success(editing ? 'Человек обновлён' : 'Человек добавлен');
    onChanged();
  };

  const hide = async (person: UniversityPerson) => {
    await deactivateStakeholder(person.id);
    message.success('Человек скрыт');
    onChanged();
  };

  const layout = useTableLayout();
  const columns: ResponsiveColumn<UniversityPerson>[] = [
    { title: 'Роль', dataIndex: 'roleLabel', show: ['wide', 'mid', 'narrow'], width: 140 },
    { title: 'ФИО', dataIndex: 'name', show: ['wide', 'mid', 'narrow'], render: (name: string, person) => <>{name} {person.isPrimary && <Tag color="blue">Основной</Tag>} {!person.isActive && <Tag>Скрыт</Tag>}</> },
    { title: 'Должность', dataIndex: 'position', show: ['wide'] },
    { title: 'Почта', dataIndex: 'email', show: ['wide', 'mid'] },
    { title: 'Телефон', dataIndex: 'phone', show: ['wide', 'mid'], width: 160 },
    { title: 'Программа', dataIndex: 'programLabel', show: ['wide'] },
    {
      title: '',
      show: ['wide', 'mid', 'narrow'],
      width: 76,
      className: panelStyles.iconCell,
      align: 'right',
      render: (_, person) => person.isActive && (
        <>
          <Tooltip title="Изменить"><Button type="text" size="small" icon={<EditOutlined />} aria-label="Изменить" onClick={() => (isGapRecord(person.id) ? message.info('Это демо-запись, её опишет бэкенд') : openEdit(person))} /></Tooltip>
          <Tooltip title="Скрыть"><Button type="text" size="small" danger icon={<EyeInvisibleOutlined />} aria-label="Скрыть" onClick={() => (isGapRecord(person.id) ? message.info('Это демо-запись, её опишет бэкенд') : void hide(person))} /></Tooltip>
        </>
      ),
    },
  ];

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.head}>
        <h2>Люди</h2>
        <div className={panelStyles.actions}>
          <span className={panelStyles.hiddenToggle}><Switch checked={showHidden} onChange={setShowHidden} /> Показать скрытых</span>
          <Button type="primary" onClick={openCreate}>Добавить человека</Button>
        </div>
      </div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={rows}
          locale={{ emptyText: 'Контактов площадки пока нет' }}
          columns={visibleColumns(layout, columns)}
          expandable={hiddenRowDetails<UniversityPerson>(layout, (person) => <Details rows={[
            ['Должность', person.position],
            ['Почта', person.email],
            ['Телефон', person.phone],
            ['Программа', person.programLabel],
            ['Основной', person.isPrimary ? 'Да' : 'Нет'],
          ]} />)}
        />
      </div>
      <Modal open={open} title={editing ? 'Человек площадки' : 'Новый человек'} okText="Сохранить" cancelText="Отмена" onCancel={() => setOpen(false)} onOk={() => void save().catch(() => undefined)}>
        <Form form={form} layout="vertical">
          <Form.Item name="roleCode" label="Роль" rules={[{ required: true }]}>
            <Select options={stakeholderRoles.map((role) => ({ value: role.value, label: role.label }))} />
          </Form.Item>
          <Form.Item name="name" label="ФИО" rules={[{ required: true, whitespace: true, message: 'Укажите ФИО' }]}><Input /></Form.Item>
          <Form.Item name="position" label="Должность"><Input /></Form.Item>
          <Form.Item name="email" label="Почта"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="programId" label="Программа"><Select allowClear placeholder="На всю площадку" options={card.programs.map((program) => ({ value: program.id, label: `${program.directionName} · ${program.productName}` }))} /></Form.Item>
          <Form.Item name="isPrimary" label="Основной контакт" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const ContractsSection = ({ card, onChanged }: { card: UniversityCard; onChanged: () => void }) => {
  const layout = useTableLayout();
  const [license, setLicense] = useState<UniversityLicense | null>(null);
  const [form] = Form.useForm<{ number: string; validUntil: string; transferStatus: string; access: string }>();

  const openLicense = (row: UniversityLicense) => {
    setLicense(row);
    form.setFieldsValue({
      number: row.number === 'Номер не указан' ? '' : row.number,
      validUntil: row.validUntil === 'Срок не указан' ? '' : row.validUntil,
      transferStatus: row.transferStatus,
      access: row.access === 'Доступ не описан' ? '' : row.access,
    });
  };

  const save = async () => {
    if (!license) return;
    const draft = await form.validateFields();
    await updateLicense(license.id, draft);
    setLicense(null);
    message.success('Лицензия обновлена');
    onChanged();
  };

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.head}><h2>Договоры и лицензии</h2></div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={card.contracts}
          locale={{ emptyText: 'Рамочного договора пока нет' }}
          columns={visibleColumns<UniversityCard['contracts'][number]>(layout, [
            { title: 'Номер', dataIndex: 'number', show: ['wide', 'mid', 'narrow'], render: (number: string, row) => <span className={panelStyles.contractNumber}>{number} {row.current && <Tag color="green">Действующий</Tag>}</span> },
            { title: 'Дата', dataIndex: 'signedOn', show: ['wide', 'mid', 'narrow'], width: 140 },
            { title: 'Файл', dataIndex: 'fileName', show: ['wide', 'mid'], width: 220 },
          ])}
          expandable={hiddenRowDetails<UniversityCard['contracts'][number]>(layout, (row) => <Details rows={[['Файл', row.fileName], ['Срок', row.validUntil], ['Статус', row.status]]} />)}
        />
      </div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={card.licenses}
          locale={{ emptyText: 'Лицензий по программам пока нет' }}
          columns={visibleColumns<UniversityLicense>(layout, [
            { title: 'ПО', dataIndex: 'productName', show: ['wide', 'mid', 'narrow'] },
            { title: 'Номер', dataIndex: 'number', show: ['wide', 'mid', 'narrow'], width: 140 },
            { title: 'Подписание', dataIndex: 'signedOn', show: ['wide', 'mid'], width: 140 },
            { title: 'Год срока', dataIndex: 'validUntil', show: ['wide'], width: 110, render: (value: string) => yearOf(value) },
            { title: 'Передача', dataIndex: 'transferStatus', show: ['wide', 'mid'], width: 150, render: (status: string) => transferLabel(status) },
            { title: 'Файл', dataIndex: 'fileName', show: ['wide'], width: 180 },
            { title: '', show: ['wide', 'mid', 'narrow'], width: 48, className: panelStyles.iconCell, align: 'right', render: (_, row) => <Tooltip title="Изменить"><Button type="text" size="small" icon={<EditOutlined />} aria-label="Изменить" onClick={() => (isGapRecord(row.id) ? message.info('Это демо-запись, её опишет бэкенд') : openLicense(row))} /></Tooltip> },
          ])}
          expandable={hiddenRowDetails<UniversityLicense>(layout, (row) => <Details rows={[
            ['Подписание', row.signedOn],
            ['Год срока', yearOf(row.validUntil)],
            ['Передача', transferLabel(row.transferStatus)],
            ['Доступ', row.access],
            ['Файл', row.fileName],
          ]} />)}
        />
      </div>
      <Modal open={Boolean(license)} title="Лицензия программы" okText="Сохранить" cancelText="Отмена" onCancel={() => setLicense(null)} onOk={() => void save().catch(() => undefined)}>
        <Form form={form} layout="vertical">
          <Form.Item name="number" label="Номер"><Input /></Form.Item>
          <Form.Item name="validUntil" label="Действует до"><Input type="date" /></Form.Item>
          <Form.Item name="transferStatus" label="Статус передачи" rules={[{ required: true }]}>
            <Select options={transferStatusOptions.map((item) => ({ value: item.value, label: item.label }))} />
          </Form.Item>
          <Form.Item name="access" label="Доступ к продукту"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const TeachersSection = ({ card }: { card: UniversityCard }) => {
  const layout = useTableLayout();
  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.head}><h2>Преподаватели</h2></div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={card.teachers}
          locale={{ emptyText: 'Носителей продукта пока нет' }}
          columns={visibleColumns<UniversityCard['teachers'][number]>(layout, [
            { title: 'ФИО', dataIndex: 'name', show: ['wide', 'mid', 'narrow'] },
            { title: 'Продукт', dataIndex: 'productName', show: ['wide', 'mid', 'narrow'] },
            { title: 'Обучение', dataIndex: 'trainedOn', show: ['wide', 'mid'], width: 140 },
            { title: 'Квалификация до', dataIndex: 'qualificationUntil', show: ['wide'], width: 160 },
            { title: 'Активность LMS', dataIndex: 'lastLmsActivity', show: ['wide'], width: 150 },
            { title: 'Статус', dataIndex: 'status', show: ['wide', 'mid', 'narrow'], width: 160, render: (status: string) => teacherStatusLabels[status] ?? status },
          ])}
          expandable={hiddenRowDetails<UniversityCard['teachers'][number]>(layout, (row) => <Details rows={[
            ['Обучение', row.trainedOn],
            ['Квалификация до', row.qualificationUntil],
            ['Активность LMS', row.lastLmsActivity],
          ]} />)}
        />
      </div>
    </div>
  );
};

const DocumentsSection = ({ card }: { card: UniversityCard }) => {
  const layout = useTableLayout();
  const [kind, setKind] = useState('');
  const kinds = [...new Set(card.documents.map((document) => document.kind))];
  const rows = card.documents.filter((document) => !kind || document.kind === kind);

  return (
    <div className={panelStyles.section}>
      <div className={panelStyles.head}>
        <h2>Документы</h2>
        <Select allowClear placeholder="Тип файла" style={{ minWidth: 180 }} value={kind || undefined} options={kinds.map((item) => ({ value: item, label: item }))} onChange={(value) => setKind(value ?? '')} />
      </div>
      <div className={panelStyles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={rows}
          locale={{ emptyText: 'Вложений пока нет' }}
          columns={visibleColumns<UniversityCard['documents'][number]>(layout, [
            { title: 'Файл', dataIndex: 'name', show: ['wide', 'mid', 'narrow'] },
            { title: 'Тип', dataIndex: 'kind', show: ['wide', 'mid', 'narrow'], width: 140 },
            { title: 'Программа', dataIndex: 'programName', show: ['wide', 'mid'] },
            { title: 'Этап', dataIndex: 'stageName', show: ['wide'] },
            { title: 'Кто загрузил', dataIndex: 'uploadedBy', show: ['wide'] },
            { title: 'Дата', dataIndex: 'createdAt', show: ['wide', 'mid'], width: 120, render: (value: string) => value || 'Дата не указана' },
            { title: '', show: ['wide', 'mid', 'narrow'], width: 110, render: (_, row) => row.attachmentId && <Button type="link" size="small" onClick={() => void downloadAttachment(row.attachmentId as string, row.name)}>Скачать</Button> },
          ])}
          expandable={hiddenRowDetails<UniversityCard['documents'][number]>(layout, (row) => <Details rows={[
            ['Программа', row.programName],
            ['Этап', row.stageName],
            ['Кто загрузил', row.uploadedBy],
            ['Дата', row.createdAt || 'Дата не указана'],
          ]} />)}
        />
      </div>
    </div>
  );
};

const FeedSection = ({ card }: { card: UniversityCard }) => (
  <div className={panelStyles.section}>
    <div className={panelStyles.head}><h2>Лента</h2></div>
    <div className={`${panelStyles.card} ${panelStyles.feed}`}>
      <List
        dataSource={card.feed}
        locale={{ emptyText: 'Событий пока нет' }}
        renderItem={(event) => (
          <List.Item>
            <List.Item.Meta
              title={`${event.title} · ${dayjs(event.createdAt).isValid() ? dayjs(event.createdAt).format('D MMM YYYY, HH:mm') : event.createdAt}`}
              description={`${event.description} · ${event.actor}`}
            />
          </List.Item>
        )}
      />
    </div>
  </div>
);

const UniversityWorkspace = ({ card, section, onChanged }: UniversityWorkspaceProps) => {
  if (section === 'people') return <PeopleSection card={card} onChanged={onChanged} />;
  if (section === 'contracts') return <ContractsSection card={card} onChanged={onChanged} />;
  if (section === 'teachers') return <TeachersSection card={card} />;
  if (section === 'documents') return <DocumentsSection card={card} />;
  if (section === 'feed') return <FeedSection card={card} />;
  return <ProgramsSection card={card} />;
};

export default UniversityWorkspace;
