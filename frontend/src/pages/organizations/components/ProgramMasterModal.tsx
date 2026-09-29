import { Alert, Button, Form, Modal, Select, Steps } from 'antd';
import { ApiError } from '../../../api/client';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { listPlaybookChoices, loadMasterOptions, startUniversityProgram, type PlaybookChoice } from '../api';
import type { AcademicWindowOption, CatalogOption, UniversityProgramRow } from '../screenModel';

type ProgramMasterModalProps = {
  open: boolean;
  organizationId: string;
  programs: UniversityProgramRow[];
  onClose: () => void;
  onCreated: (programId: string) => void;
};

type MasterValues = {
  directionId?: string;
  productId?: string;
  windowId?: string;
};

const liveStatuses = new Set(['draft', 'active', 'paused']);

const ProgramMasterModal = ({ open, organizationId, programs, onClose, onCreated }: ProgramMasterModalProps) => {
  const [form] = Form.useForm<MasterValues>();
  const [step, setStep] = useState(0);
  const [directions, setDirections] = useState<CatalogOption[]>([]);
  const [products, setProducts] = useState<CatalogOption[]>([]);
  const [windows, setWindows] = useState<AcademicWindowOption[]>([]);
  const [duplicateId, setDuplicateId] = useState<string>();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookChoice[]>([]);
  const [pairs, setPairs] = useState<Array<{ directionId: string; productId: string }>>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setStep(0);
      setDuplicateId(undefined);
      setTemplateId(null);
      setError('');
      form.resetFields();
      loadMasterOptions().then((options) => {
        setDirections(options.directions);
        setProducts(options.products);
        setWindows(options.windows);
        setPairs(options.pairs);
        const current = options.windows.find((item) => item.current);
        if (current) form.setFieldValue('windowId', current.id);
      }).catch(() => setError('Не удалось загрузить направления и продукты'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [form, open]);

  const values = Form.useWatch([], form) as MasterValues | undefined;
  const directionName = directions.find((item) => item.id === values?.directionId)?.name ?? '';
  const allowedProductIds = new Set(pairs.filter((pair) => pair.directionId === values?.directionId).map((pair) => pair.productId));
  const visibleProducts = values?.directionId ? products.filter((item) => allowedProductIds.has(item.id)) : products;
  const productName = products.find((item) => item.id === values?.productId)?.name ?? '';
  const windowName = windows.find((item) => item.id === values?.windowId)?.name ?? 'Без учебного окна';

  const lookForDuplicate = () => {
    const found = programs.find((program) => (
      program.directionId === values?.directionId
      && program.productId === values?.productId
      && liveStatuses.has(program.status)
    ));
    setDuplicateId(found?.id);
    return found;
  };

  const goNext = async () => {
    setError('');
    if (step === 0) {
      await form.validateFields(['directionId', 'productId']);
      if (lookForDuplicate()) return;
      if (!values?.directionId || !values.productId) return;
      setSaving(true);
      try {
        const choices = await listPlaybookChoices(organizationId, values.directionId, values.productId);
        setPlaybooks(choices);
        const recommended = choices.find((item) => item.recommended && !item.disabled);
        setTemplateId(recommended?.id ?? choices.find((item) => !item.disabled)?.id ?? null);
        setStep(1);
      } catch {
        setError('Не удалось получить пути для этой площадки');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 1) {
      if (!templateId) {
        setError('Выберите доступный путь');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) setStep(3);
  };

  const create = async () => {
    if (!values?.directionId || !values.productId || !templateId) return;
    setSaving(true);
    setError('');
    try {
      const created = await startUniversityProgram(organizationId, {
        directionId: values.directionId,
        productId: values.productId,
        playbookTemplateId: templateId,
        windowId: values.windowId,
      });
      onCreated(created.id);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Программу не удалось создать. Проверьте, что такой заход ещё не идёт.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Новая программа"
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>Закрыть</Button>,
        step > 0 && <Button key="back" onClick={() => setStep((current) => current - 1)}>Назад</Button>,
        step < 3 && <Button key="next" type="primary" loading={saving} onClick={() => void goNext()}>Дальше</Button>,
        step === 3 && <Button key="create" type="primary" loading={saving} disabled={!templateId} onClick={() => void create()}>Создать</Button>,
      ]}
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 20 }}
        items={[{ title: 'Пара' }, { title: 'Плейбук' }, { title: 'Окно' }, { title: 'Сводка' }]}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {duplicateId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Такая программа уже идёт"
          description={<Link to={`/workflows/${duplicateId}`}>Открыть существующий заход</Link>}
        />
      )}
      <Form form={form} layout="vertical" preserve>
        <div hidden={step !== 0}>
          <Form.Item name="directionId" label="Направление вуза" rules={[{ required: true, message: 'Выберите направление' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={directions.map((item) => ({ value: item.id, label: item.name }))}
              placeholder="Направление"
              onChange={(value) => {
                form.setFieldValue('directionId', value);
                const allowed = new Set(pairs.filter((pair) => pair.directionId === value).map((pair) => pair.productId));
                if (!allowed.has(form.getFieldValue('productId'))) form.setFieldValue('productId', undefined);
              }}
            />
          </Form.Item>
          <Form.Item name="productId" label="Продукт Ростелекома" rules={[{ required: true, message: 'Выберите продукт' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={visibleProducts.map((item) => ({ value: item.id, label: item.name }))}
              placeholder={values?.directionId && visibleProducts.length === 0 ? 'Для этого направления нет продукта' : 'Продукт'}
              notFoundContent="Для этого направления нет связанного продукта"
            />
          </Form.Item>
        </div>
        {step === 1 && (
          <div className="playbookChoices">
            {playbooks.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => setTemplateId(item.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 8,
                  padding: '12px 14px',
                  textAlign: 'left',
                  borderRadius: 10,
                  border: templateId === item.id ? '1px solid #7700ff' : '1px solid #f0f0f0',
                  background: item.disabled ? '#fafafa' : item.recommended ? '#f6f0ff' : '#fff',
                  color: item.disabled ? '#8c8c8c' : 'inherit',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <strong>{item.name}</strong>
                {item.recommended && !item.disabled && <span style={{ marginLeft: 8, color: '#7700ff' }}>рекомендуем</span>}
                <div style={{ marginTop: 4, color: '#667085' }}>{item.reason || (item.recommended ? 'Подходит этой площадке по правилам мастера' : 'Можно взять вручную')}</div>
              </button>
            ))}
            {playbooks.length === 0 && <Alert type="warning" showIcon message="Опубликованных путей пока нет" />}
          </div>
        )}
        <div hidden={step !== 2}>
          <Form.Item name="windowId" label="Учебное окно">
            <Select allowClear options={windows.map((item) => ({ value: item.id, label: item.current ? `${item.name} · текущее` : item.name }))} placeholder="Можно не выбирать" />
          </Form.Item>
        </div>
        {step === 3 && (
          <Alert
            type="success"
            showIcon
            message={`${directionName} · ${productName}`}
            description={`Окно: ${windowName}. После создания откроется карточка программы.`}
          />
        )}
      </Form>
    </Modal>
  );
};

export default ProgramMasterModal;
