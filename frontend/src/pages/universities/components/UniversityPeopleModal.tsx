import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select } from 'antd';

import { listUniversityManagers } from '../api';
import type { UniversityResponsible } from '../types';

type UniversityPeopleModalProps = {
  open: boolean;
  manager: string;
  responsibles: UniversityResponsible[];
  onClose: () => void;
  onSave: (manager: string, responsibles: UniversityResponsible[]) => void;
};

const UniversityPeopleModal = ({ open, manager, responsibles, onClose, onSave }: UniversityPeopleModalProps) => {
  const [form] = Form.useForm<{ manager: string; responsibles: UniversityResponsible[] }>();

  return (
    <Modal
      open={open}
      title="Ответственные"
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnHidden
      onCancel={onClose}
      onOk={() => form.submit()}
      afterOpenChange={(visible) => {
        if (visible) form.setFieldsValue({ manager, responsibles });
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSave(
          values.manager?.trim() ?? '',
          (values.responsibles ?? []).map((person) => ({ name: person.name.trim(), role: person.role.trim() })).filter((person) => person.name),
        )}
      >
        <Form.Item name="manager" label="Менеджер от РТК">
          <Select
            allowClear
            showSearch
            placeholder="Не назначен"
            options={listUniversityManagers().map((value) => ({ value, label: value }))}
          />
        </Form.Item>
        <Form.List name="responsibles">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <Form.Item name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: 'Укажите имя' }]}>
                    <Input placeholder="ФИО от вуза" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'role']}>
                    <Input placeholder="Роль" />
                  </Form.Item>
                  <Button type="text" aria-label="Удалить ответственного" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                </div>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', role: 'Ответственный от вуза' })}>Назначить ответственного</Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default UniversityPeopleModal;
