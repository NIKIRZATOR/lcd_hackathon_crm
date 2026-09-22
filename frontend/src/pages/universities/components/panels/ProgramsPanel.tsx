import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Table } from 'antd';
import { useState } from 'react';

import type { SectionProgram, UniversitySections } from '../../sectionData';
import { byNumber, byText, shownColumns, styles, useCompact } from './panelShared';
import { Details, Pill } from './panelUi';

const programLabel: Record<SectionProgram['status'], string> = { active: 'Активно', development: 'В разработке' };

export const ProgramsPanel = ({ sections }: { sections: UniversitySections }) => {
  const compact = useCompact();
  const [programs, setPrograms] = useState(sections.programs);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<Omit<SectionProgram, 'id'>>();
  const columns = shownColumns<SectionProgram>(compact, [
    { title: 'Программа', dataIndex: 'name', key: 'name', sorter: byText((row: SectionProgram) => row.name) },
    { title: 'ИТ-направление', dataIndex: 'direction', key: 'direction', wideOnly: true, sorter: byText((row: SectionProgram) => row.direction) },
    { title: 'ИТ-продукт / ПО', dataIndex: 'product', key: 'product', wideOnly: true, sorter: byText((row: SectionProgram) => row.product) },
    { title: 'Вендор', dataIndex: 'vendor', key: 'vendor', wideOnly: true, sorter: byText((row: SectionProgram) => row.vendor) },
    { title: 'Потоки', dataIndex: 'streams', key: 'streams', width: 100, wideOnly: true, sorter: byNumber((row: SectionProgram) => row.streams) },
    { title: 'Обучающиеся', dataIndex: 'students', key: 'students', width: 140, wideOnly: true, sorter: byNumber((row: SectionProgram) => row.students) },
    { title: 'Статус', key: 'status', width: compact ? undefined : 150, sorter: byText((row: SectionProgram) => programLabel[row.status]), render: (_v, row) => <Pill className={row.status === 'active' ? styles.green : styles.yellow}>{programLabel[row.status]}</Pill> },
  ]);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Программы и продукты</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>Добавить связь</Button>
      </div>
      <div className={styles.card}>
        <Table rowKey="id" size="middle" pagination={false} columns={columns} dataSource={programs} expandable={compact ? { expandedRowRender: (row) => <Details rows={[['Направление', row.direction], ['Продукт', row.product], ['Вендор', row.vendor], ['Потоки', row.streams], ['Обучающиеся', row.students]]} /> } : undefined} />
      </div>
      <div className={styles.split}>
        <div className={styles.block}>
          <h3>Договоры и лицензии</h3>
          <Table
            rowKey="contract"
            size="small"
            pagination={false}
            dataSource={sections.licenses}
            columns={[
              { title: 'Продукт', dataIndex: 'product', key: 'product', sorter: byText((row) => row.product) },
              { title: 'Договор', dataIndex: 'contract', key: 'contract', sorter: byText((row) => row.contract) },
              { title: 'Подписание', dataIndex: 'signedAt', key: 'signedAt', sorter: byText((row) => row.signedAt) },
              { title: 'Срок', dataIndex: 'due', key: 'due', sorter: byText((row) => row.due) },
              { title: 'Передача', key: 'transfer', sorter: byText((row) => row.transfer), render: (_v, row) => <Pill className={row.transfer === 'done' ? styles.green : styles.yellow}>{row.transfer === 'done' ? 'Передано' : 'Истекает'}</Pill> },
            ]}
          />
        </div>
        <div className={styles.block}>
          <h3>Связанные направления</h3>
          <div className={styles.chips}>
            {sections.directions.map((direction) => <span key={direction} className={styles.chip}>{direction}</span>)}
          </div>
          <p className={styles.note}>Связи используются для фильтрации взаимодействий, отчётов и статистики по этому вузу.</p>
        </div>
      </div>
      <Modal open={open} title="Новая связь" okText="Добавить" cancelText="Отмена" onCancel={() => setOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(values) => { setPrograms((current) => [{ ...values, id: `new-${Date.now()}`, streams: Number(values.streams), students: Number(values.students) }, ...current]); setOpen(false); }}>
          <Form.Item name="name" label="Программа" rules={[{ required: true, message: 'Укажите программу' }]}><Input /></Form.Item>
          <Form.Item name="direction" label="Направление" rules={[{ required: true, message: 'Укажите направление' }]}><Input /></Form.Item>
          <Form.Item name="product" label="Продукт" rules={[{ required: true, message: 'Укажите продукт' }]}><Input /></Form.Item>
          <Form.Item name="vendor" label="Вендор" rules={[{ required: true, message: 'Укажите вендора' }]}><Input /></Form.Item>
          <Form.Item name="streams" label="Потоки" initialValue={1} rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="students" label="Обучающиеся" initialValue={0} rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="status" label="Статус" initialValue="active" rules={[{ required: true }]}><Select options={[{ value: 'active', label: 'Активно' }, { value: 'development', label: 'В разработке' }]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
