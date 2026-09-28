import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Table, message } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createUniversityWorkflow } from '../../../workflow/api';
import type { WorkflowStatus } from '../../../workflow/types';
import { listUniversityWorkflows } from '../../api';
import { isInPeriod, usePeriod } from '../../domain/period';
import type { UniversityItem } from '../../types';
import { byText, shownColumns, styles, unique, useCompact } from './panelShared';
import { Details, Pill } from './panelUi';

const flowLabel: Record<WorkflowStatus, string> = {
  active: 'В работе',
  attention: 'Требует внимания',
  completed: 'Завершён',
  overdue: 'Просрочен',
};
const flowClass: Record<WorkflowStatus, string> = {
  active: styles.blue,
  attention: styles.yellow,
  completed: styles.green,
  overdue: styles.red,
};

export const InteractionsPanel = ({ university }: { university: UniversityItem }) => {
  const navigate = useNavigate();
  const compact = useCompact();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WorkflowStatus | ''>('');
  const [stage, setStage] = useState('');
  const [program, setProgram] = useState('');
  const [product, setProduct] = useState('');
  const [owner, setOwner] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ program: string; product: string; owner: string; due: string }>();
  const period = usePeriod();
  const rows = listUniversityWorkflows(university.id);
  void version;

  const filtered = rows.filter((row) => {
    const haystack = `${row.program} ${row.product}`.toLowerCase();
    return isInPeriod(row.at, period)
      && (!query || haystack.includes(query.trim().toLowerCase()))
      && (!status || row.status === status)
      && (!stage || row.stage === stage)
      && (!program || row.program === program)
      && (!product || row.product === product)
      && (!owner || row.owner === owner);
  });

  type InteractionRow = (typeof rows)[number];
  const columns = shownColumns<InteractionRow>(compact, [
    { title: 'Программа / продукт', key: 'name', sorter: byText((row: InteractionRow) => `${row.program} ${row.product}`), render: (_v, row) => <strong>{row.program} · {row.product}</strong> },
    { title: 'Текущий этап', dataIndex: 'stage', key: 'stage', wideOnly: true, sorter: byText((row: InteractionRow) => row.stage) },
    { title: 'Следующий шаг', dataIndex: 'nextStep', key: 'nextStep', wideOnly: true, sorter: byText((row: InteractionRow) => row.nextStep) },
    { title: 'Срок', dataIndex: 'due', key: 'due', width: 110, wideOnly: true, sorter: byText((row: InteractionRow) => row.due) },
    { title: 'Ответственный', dataIndex: 'owner', key: 'owner', width: 140, wideOnly: true, sorter: byText((row: InteractionRow) => row.owner) },
    { title: 'Статус', key: 'status', width: compact ? 168 : 176, sorter: byText((row: InteractionRow) => flowLabel[row.status]), render: (_v, row) => <Pill className={`${styles.statusPill} ${flowClass[row.status]}`}>{flowLabel[row.status]}</Pill> },
  ]);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Взаимодействия</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ owner: university.manager, due: dayjs().add(14, 'day').format('YYYY-MM-DD') }); setOpen(true); }}>Создать взаимодействие</Button>
        <div className={styles.filters}>
          <Input className={styles.search} allowClear prefix={<SearchOutlined />} placeholder="Поиск по программе или продукту" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className={styles.filter} allowClear placeholder="Статус" value={status || undefined} options={(Object.keys(flowLabel) as WorkflowStatus[]).map((value) => ({ value, label: flowLabel[value] }))} onChange={(value) => setStatus(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Этап" value={stage || undefined} options={unique(rows.map((row) => row.stage)).map((value) => ({ value, label: value }))} onChange={(value) => setStage(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Программа" value={program || undefined} options={unique(rows.map((row) => row.program)).map((value) => ({ value, label: value }))} onChange={(value) => setProgram(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Продукт" value={product || undefined} options={unique(rows.map((row) => row.product)).map((value) => ({ value, label: value }))} onChange={(value) => setProduct(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Ответственный" value={owner || undefined} options={unique(rows.map((row) => row.owner)).map((value) => ({ value, label: value }))} onChange={(value) => setOwner(value ?? '')} />
        </div>
      </div>
      <div className={styles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          columns={columns}
          dataSource={filtered}
          locale={{ emptyText: 'Взаимодействий пока нет' }}
          onRow={(row) => ({
            onClick: (event) => {
              const target = event.target as HTMLElement;
              if (target.closest('.ant-table-row-expand-icon, .ant-table-row-expand-icon-cell')) return;
              navigate(`/workflow/${row.id}`);
            },
            style: { cursor: 'pointer' },
          })}
          expandable={compact ? { expandedRowRender: (row) => <Details rows={[['Этап', row.stage], ['Следующий шаг', row.nextStep], ['Срок', row.due], ['Ответственный', row.owner]]} /> } : undefined}
        />
      </div>
      <Modal open={open} title="Новое взаимодействие" okText="Создать" cancelText="Отмена" onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const result = createUniversityWorkflow({
              universityId: university.id,
              university: university.name,
              universityShort: university.shortName,
              program: values.program,
              product: values.product,
              responsible: values.owner,
              deadline: values.due,
            });
            setOpen(false);
            setVersion((current) => current + 1);
            if (!result.created) message.info('Такое взаимодействие уже есть, открываю его');
            navigate(`/workflow/${result.item.id}`);
          }}
        >
          <Form.Item name="program" label="ИТ-программа" rules={[{ required: true, whitespace: true, message: 'Укажите программу' }]}><Input /></Form.Item>
          <Form.Item name="product" label="ИТ-продукт" rules={[{ required: true, whitespace: true, message: 'Укажите продукт' }]}><Input /></Form.Item>
          <Form.Item name="due" label="Срок" rules={[{ required: true, message: 'Укажите срок' }]}><Input type="date" /></Form.Item>
          <Form.Item name="owner" label="Ответственный" rules={[{ required: true, whitespace: true, message: 'Укажите ответственного' }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
