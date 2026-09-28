import { Checkbox, Form, Input, Modal, Select } from 'antd';

import { stakeholderRoles } from '../../organizations/screenModel';
import { contactSources } from '../stages/contactSearch';
import type { SiteContact } from '../stages/contactSearch';

import styles from './ContactSearchStage.module.scss';

export type SiteContactFormValues = {
  roleCode: string;
  name: string;
  phone: string;
  email: string;
  primary: boolean;
};

type SiteContactModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  variant?: 'contact' | 'teacher';
  saving?: boolean;
  contact?: SiteContact | null;
  defaultPrimary?: boolean;
  source: string | null;
  onSourceChange: (value: string | null) => void;
  onCancel: () => void;
  onSubmit: (values: SiteContactFormValues) => void;
};

const roleOptions = stakeholderRoles.map((role) => ({ value: role.value, label: role.label }));
const sourceOptions = contactSources.map((source) => ({ value: source.value, label: source.label }));

const SiteContactModal = ({ open, mode, variant = 'contact', saving, contact, defaultPrimary, source, onSourceChange, onCancel, onSubmit }: SiteContactModalProps) => {
  const teacher = variant === 'teacher';
  const [form] = Form.useForm<SiteContactFormValues>();
  const knownRole = stakeholderRoles.some((role) => role.value === contact?.roleCode);
  return (
    <Modal
      open={open}
      destroyOnHidden
      title={teacher ? 'Новый преподаватель' : mode === 'edit' ? 'Контакт площадки' : 'Новый контакт'}
      okText={mode === 'edit' ? 'Сохранить' : 'Добавить'}
      cancelText="Отмена"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      {open && (
        <Form
          key={mode === 'edit' ? contact?.id ?? 'edit' : 'create'}
          form={form}
          className={styles.form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            roleCode: teacher ? 'teacher' : knownRole ? contact?.roleCode : 'other',
            name: contact?.name ?? '',
            phone: contact?.phone ?? '',
            email: contact?.email ?? '',
            primary: contact ? contact.primary : Boolean(defaultPrimary),
          }}
          onFinish={onSubmit}
        >
          {!teacher && (
            <Form.Item name="roleCode" label="Должность" rules={[{ required: true, message: 'Выберите должность' }]}>
              <Select options={roleOptions} />
            </Form.Item>
          )}
          <Form.Item name="name" label="ФИО" rules={[{ required: true, whitespace: true, message: 'Введите ФИО' }]}>
            <Input maxLength={255} autoComplete="name" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input maxLength={64} autoComplete="tel" />
          </Form.Item>
          <Form.Item name="email" label="Почта">
            <Input maxLength={255} autoComplete="email" />
          </Form.Item>
          {!teacher && (
            <>
              <Form.Item label="Откуда контакт">
                <Select
                  allowClear
                  placeholder="Не указан"
                  value={source ?? undefined}
                  options={sourceOptions}
                  onChange={(value) => onSourceChange(value ?? null)}
                />
              </Form.Item>
              <Form.Item name="primary" valuePropName="checked">
                <Checkbox>Сделать основным контактом вуза</Checkbox>
              </Form.Item>
            </>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default SiteContactModal;
