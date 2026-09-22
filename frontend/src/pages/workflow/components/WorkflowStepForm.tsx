import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Space } from 'antd';
import { useEffect } from 'react';

import type { WorkflowStepConfig } from '../types';

import SortableChecklistItem from './SortableChecklistItem';
import styles from './WorkflowStepForm.module.scss';

export type WorkflowStepFormValues = Omit<WorkflowStepConfig, 'id'>;

type WorkflowStepFormProps = {
  mode: 'create' | 'edit';
  step?: WorkflowStepConfig;
  onSave: (values: WorkflowStepFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
};

const defaultValues: WorkflowStepFormValues = {
  name: '',
  description: '',
  defaultDurationDays: undefined,
  isInitial: false,
  isFinal: false,
  isOptional: false,
  requiresComment: false,
  requiresAttachment: false,
  completionConditions: [],
  checklistItems: [],
};

const mapStepToForm = (step: WorkflowStepConfig): WorkflowStepFormValues => ({
  name: step.name,
  description: step.description,
  defaultDurationDays: step.defaultDurationDays,
  isInitial: step.isInitial,
  isFinal: step.isFinal,
  isOptional: step.isOptional,
  requiresComment: step.requiresComment,
  requiresAttachment: step.requiresAttachment,
  completionConditions: step.completionConditions,
  checklistItems: step.checklistItems,
});

const WorkflowStepForm = ({ mode, step, onSave, onCancel, onDelete, isSaving = false, onDirtyChange }: WorkflowStepFormProps) => {
  const [form] = Form.useForm<WorkflowStepFormValues>();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(step ? mapStepToForm(step) : defaultValues);
    onDirtyChange?.(false);
  }, [form, mode, onDirtyChange, step]);

  const handleFinish = (values: WorkflowStepFormValues) => {
    onSave({
      ...values,
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
      completionConditions: values.completionConditions?.map((value) => value.trim()).filter(Boolean) ?? [],
      checklistItems: values.checklistItems?.map((value) => value.trim()).filter(Boolean) ?? [],
    });
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} onValuesChange={() => onDirtyChange?.(true)} className={styles.form}>
      <Card title="Основные настройки" size="small">
        <Form.Item name="name" label="Название этапа" rules={[{ required: true, whitespace: true, message: 'Введите название этапа' }]}>
          <Input placeholder="Введите название этапа" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="defaultDurationDays" label="Срок, дней">
              <InputNumber min={1} max={3650} style={{ width: '100%' }} placeholder="Не задан" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Параметры этапа">
              <Space direction="vertical">
                <Form.Item name="isOptional" valuePropName="checked" noStyle><Checkbox>Необязательный этап</Checkbox></Form.Item>
                <Form.Item name="isFinal" valuePropName="checked" noStyle><Checkbox>Финальный этап</Checkbox></Form.Item>
              </Space>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="Описание этапа">
          <Input.TextArea rows={3} showCount maxLength={500} placeholder="Опишите назначение этапа" />
        </Form.Item>
      </Card>

      <Card title="Условия завершения" size="small">
        <Form.List name="completionConditions">
          {(fields, { add, remove }) => (
            <div className={styles.list}>
              {fields.map(({ key, name, ...field }) => (
                <div key={key} className={styles.listRow}>
                  <Form.Item {...field} name={name} rules={[{ required: true, whitespace: true, message: 'Введите условие' }]}>
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} placeholder="Условие завершения" />
                  </Form.Item>
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="Удалить условие" onClick={() => remove(name)} />
                </div>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add('')}>Добавить условие</Button>
            </div>
          )}
        </Form.List>
      </Card>

      <Card title="Чек-лист" size="small">
        <Form.List name="checklistItems">
          {(fields, { add, remove, move }) => {
            const handleChecklistDragEnd = ({ active, over }: DragEndEvent) => {
              if (!over || active.id === over.id) return;
              const oldIndex = fields.findIndex((field) => field.key === active.id);
              const newIndex = fields.findIndex((field) => field.key === over.id);
              if (oldIndex >= 0 && newIndex >= 0) move(oldIndex, newIndex);
            };

            return (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChecklistDragEnd}>
                <SortableContext items={fields.map((field) => field.key)} strategy={verticalListSortingStrategy}>
                  <div className={styles.list}>
                    {fields.map(({ key, name, ...field }) => (
                      <SortableChecklistItem key={key} field={{ key, name, ...field }} onRemove={() => remove(name)}>
                        <Form.Item {...field} name={name} rules={[{ required: true, whitespace: true, message: 'Введите пункт' }]}>
                          <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} placeholder="Название пункта чек-листа" />
                        </Form.Item>
                      </SortableChecklistItem>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add('')}>Добавить пункт</Button>
                  </div>
                </SortableContext>
              </DndContext>
            );
          }}
        </Form.List>
      </Card>

      <div className={styles.actions}>
        {mode === 'edit' && onDelete && <Button danger onClick={onDelete}>Удалить этап</Button>}
        <div className={styles.actionsRight}>
          <Button onClick={onCancel}>Отмена</Button>
          <Button type="primary" htmlType="submit" loading={isSaving}>{mode === 'create' ? 'Создать этап' : 'Сохранить изменения'}</Button>
        </div>
      </div>
    </Form>
  );
};

export default WorkflowStepForm;
