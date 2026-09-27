import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, apiRequest } from '../../../api/client';
import type { AcademicWindow, CatalogItem, CatalogKind, Page, VendorOption } from './types';

type FormValues = {
  name: string;
  code?: string;
  description?: string;
  vendor_id?: string;
  documentation_url?: string;
};

const catalogMeta: Record<
  Exclude<CatalogKind, 'academic-windows'>,
  { label: string; endpoint: string }
> = {
  directions: { label: 'Направления', endpoint: '/api/it-directions' },
  products: { label: 'Продукты', endpoint: '/api/it-products' },
  vendors: { label: 'Вендоры', endpoint: '/api/vendors' },
};

const CatalogsTab = () => {
  const navigate = useNavigate();
  const [kind, setKind] = useState<CatalogKind>('directions');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [academicWindows, setAcademicWindows] = useState<AcademicWindow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'true' | 'false'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<CatalogItem>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const meta = kind === 'academic-windows' ? undefined : catalogMeta[kind];
  const vendorNameById = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor.name])),
    [vendors],
  );

  const loadCatalog = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    setError(undefined);
    try {
      const query = new URLSearchParams({ limit: '100', offset: '0' });
      if (search.trim()) query.set('search', search.trim());
      if (status !== 'all') query.set('is_active', status);
      const page = await apiRequest<Page<CatalogItem>>(`${meta.endpoint}?${query}`);
      setItems(page.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить справочник.');
    } finally {
      setLoading(false);
    }
  }, [meta, search, status]);

  const loadAcademicWindows = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setAcademicWindows(await apiRequest<AcademicWindow[]>('/api/academic-windows'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить учебные окна.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVendors = useCallback(async () => {
    try {
      const page = await apiRequest<Page<VendorOption>>('/api/vendors?limit=100&offset=0');
      setVendors(page.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить вендоров.');
    }
  }, []);

  useEffect(() => {
    if (kind === 'academic-windows') void loadAcademicWindows();
    else void loadCatalog();
  }, [kind, loadAcademicWindows, loadCatalog]);

  useEffect(() => {
    if (kind === 'products') void loadVendors();
  }, [kind, loadVendors]);

  const openCreate = () => {
    setEditing(undefined);
    form.resetFields();
    setDialogOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    form.setFieldsValue({
      name: item.name,
      code: item.code ?? undefined,
      description: item.description ?? undefined,
      vendor_id: item.vendor_id ?? undefined,
      documentation_url: item.documentation_url ?? undefined,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!meta) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError(undefined);
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        ...(kind === 'directions' ? { code: values.code?.trim() || null } : {}),
        ...(kind === 'products'
          ? {
              vendor_id: values.vendor_id || null,
              documentation_url: values.documentation_url?.trim() || null,
            }
          : {}),
      };
      await apiRequest(editing ? `${meta.endpoint}/${editing.id}` : meta.endpoint, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setDialogOpen(false);
      await loadCatalog();
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item: CatalogItem) => {
    if (!meta) return;
    setError(undefined);
    try {
      await apiRequest(
        item.is_active ? `${meta.endpoint}/${item.id}/deactivate` : `${meta.endpoint}/${item.id}`,
        item.is_active
          ? { method: 'PATCH' }
          : { method: 'PATCH', body: JSON.stringify({ is_active: true }) },
      );
      await loadCatalog();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось изменить статус записи.');
    }
  };

  return (
    <>
      <Typography.Paragraph type="secondary">
        Справочники используются при создании программ и импорте. Используемые записи не удаляются,
        а переводятся в неактивный статус.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Tabs
        activeKey={kind}
        onChange={(nextKind) => {
          setKind(nextKind as CatalogKind);
          setSearch('');
          setStatus('all');
        }}
        items={[
          { key: 'directions', label: 'Направления' },
          { key: 'products', label: 'Продукты' },
          { key: 'vendors', label: 'Вендоры' },
          { key: 'academic-windows', label: 'Учебные окна' },
        ]}
      />
      {kind === 'academic-windows' ? (
        <>
          <Typography.Paragraph type="secondary">
            Учебные окна доступны для просмотра. В действующем API нет операций их изменения,
            поэтому они остаются read-only.
          </Typography.Paragraph>
          <Table<AcademicWindow>
            rowKey="id"
            loading={loading}
            dataSource={academicWindows}
            pagination={false}
            locale={{ emptyText: 'Учебные окна не найдены' }}
            columns={[
              { title: 'Код', dataIndex: 'code' },
              { title: 'Название', dataIndex: 'title' },
              { title: 'План до', dataIndex: 'plan_cutoff_on' },
              {
                title: 'Занятия',
                render: (_, item) => `${item.classes_start_on} — ${item.classes_end_on}`,
              },
              {
                title: 'Статус',
                dataIndex: 'is_current',
                render: (isCurrent: boolean) => (
                  <Tag color={isCurrent ? 'green' : 'default'}>
                    {isCurrent ? 'Текущее' : 'Архивное'}
                  </Tag>
                ),
              },
            ]}
          />
        </>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию"
              style={{ width: 280 }}
            />
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Все статусы' },
                { value: 'true', label: 'Активные' },
                { value: 'false', label: 'Неактивные' },
              ]}
            />
            <Button onClick={() => void loadCatalog()}>Обновить</Button>
            <Button onClick={() => navigate('/organizations')}>Организации</Button>
            <Button type="primary" onClick={openCreate}>
              Создать
            </Button>
          </Space>
          <Table<CatalogItem>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={false}
            locale={{ emptyText: 'Записи не найдены' }}
            columns={[
              { title: 'Название', dataIndex: 'name' },
              ...(kind === 'directions'
                ? [
                    {
                      title: 'Код',
                      dataIndex: 'code',
                      render: (value: string | null) => value ?? '—',
                    },
                  ]
                : []),
              ...(kind === 'products'
                ? [
                    {
                      title: 'Вендор',
                      dataIndex: 'vendor_id',
                      render: (value: string | null) =>
                        value ? (vendorNameById.get(value) ?? 'Не указан') : 'Не указан',
                    },
                  ]
                : []),
              {
                title: 'Описание',
                dataIndex: 'description',
                render: (value: string | null) => value ?? '—',
              },
              {
                title: 'Статус',
                dataIndex: 'is_active',
                render: (isActive: boolean) => (
                  <Tag color={isActive ? 'green' : 'default'}>
                    {isActive ? 'Активна' : 'Неактивна'}
                  </Tag>
                ),
              },
              {
                title: 'Действие',
                render: (_, item) => (
                  <Space>
                    <Button type="link" onClick={() => openEdit(item)}>
                      Редактировать
                    </Button>
                    <Button
                      type="link"
                      danger={item.is_active}
                      onClick={() => void changeStatus(item)}
                    >
                      {item.is_active ? 'Деактивировать' : 'Активировать'}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}
      <Modal
        title={`${editing ? 'Редактировать' : 'Создать'}: ${meta?.label ?? ''}`}
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={() => void save()}
        okText="Сохранить"
        okButtonProps={{ loading: saving }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Название"
            rules={[{ required: true, whitespace: true, message: 'Укажите название' }]}
          >
            <Input />
          </Form.Item>
          {kind === 'directions' && (
            <Form.Item name="code" label="Код">
              <Input />
            </Form.Item>
          )}
          {kind === 'products' && (
            <>
              <Form.Item name="vendor_id" label="Вендор">
                <Select
                  allowClear
                  options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
                />
              </Form.Item>
              <Form.Item name="documentation_url" label="Ссылка на документацию">
                <Input />
              </Form.Item>
            </>
          )}
          <Form.Item name="description" label="Описание">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default CatalogsTab;
