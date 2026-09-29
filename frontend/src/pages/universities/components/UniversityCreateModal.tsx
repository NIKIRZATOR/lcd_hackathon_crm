import { Col, Form, Input, Modal, Row, Select } from 'antd';
import { useEffect } from 'react';

import { listUniversityManagers, listUniversityProfiles } from '../api';
import { universityStatusLabels, universityTypeLabels } from '../types';
import type { UniversityDraft, UniversityStatus, UniversityType } from '../types';

type UniversityCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: UniversityDraft) => void;
};

const typeOptions = (Object.entries(universityTypeLabels) as Array<[UniversityType, string]>).map(([value, label]) => ({
  value,
  label,
}));

const statusOptions = (Object.entries(universityStatusLabels) as Array<[UniversityStatus, string]>).map(([value, label]) => ({
  value,
  label,
}));

const UniversityCreateModal = ({ open, onClose, onCreate }: UniversityCreateModalProps) => {
  const [form] = Form.useForm<UniversityDraft>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [form, open]);

  return (
    <Modal
      open={open}
      title="Добавить вуз"
      okText="Добавить"
      cancelText="Отмена"
      width={720}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ type: 'federal', status: 'active' }}
        onFinish={(values) => {
          onCreate({
            ...values,
            name: values.name.trim(),
            shortName: values.shortName.trim() || values.name.trim(),
            city: values.city.trim(),
            region: values.region.trim(),
            manager: values.manager.trim(),
            profile: values.profile.trim(),
            product: values.product.trim(),
          });
          onClose();
        }}
      >
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label="Название организации" rules={[{ required: true, whitespace: true, message: 'Введите название' }]}>
              <Input placeholder="Полное название" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="shortName" label="Краткое название" rules={[{ required: true, whitespace: true, message: 'Введите краткое название' }]}>
              <Input placeholder="МГТУ" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="city" label="Город" rules={[{ required: true, whitespace: true, message: 'Введите город' }]}>
              <Input placeholder="Москва" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="region" label="Регион" rules={[{ required: true, whitespace: true, message: 'Введите регион' }]}>
              <Input placeholder="Москва" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="type" label="Тип" rules={[{ required: true, message: 'Выберите тип' }]}>
              <Select options={typeOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="status" label="Статус" rules={[{ required: true, message: 'Выберите статус' }]}>
              <Select options={statusOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="profile" label="ИТ-направление" rules={[{ required: true, whitespace: true, message: 'Укажите направление' }]}>
              <Select
                showSearch
                placeholder="DevOps"
                options={listUniversityProfiles().map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="product" label="ИТ-продукт" rules={[{ required: true, whitespace: true, message: 'Укажите продукт' }]}>
              <Input placeholder="GitLab" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="manager" label="Менеджер" rules={[{ required: true, whitespace: true, message: 'Укажите менеджера' }]}>
              <Select
                showSearch
                placeholder="А. Андреев"
                options={listUniversityManagers().map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default UniversityCreateModal;
