import {
  Alert,
  Button,
  Descriptions,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../../api/client';
import type {
  ImportDiff,
  ImportError,
  ImportJob,
  ImportPreview,
  Mapping,
  MappingField,
  Page,
  TargetField,
} from './types';

type Props = { jobId: string | undefined; onUpdated: () => void; onClose: () => void };

const ImportWizardModal = ({ jobId, onUpdated, onClose }: Props) => {
  const [job, setJob] = useState<ImportJob>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [targets, setTargets] = useState<TargetField[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [diff, setDiff] = useState<ImportDiff>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(undefined);
    try {
      const [loadedJob, loadedPreview, loadedMappings, loadedTargets, loadedMapping, loadedErrors] =
        await Promise.all([
          apiRequest<ImportJob>(`/api/imports/${jobId}`),
          apiRequest<ImportPreview>(`/api/imports/${jobId}/preview`),
          apiRequest<Mapping[]>('/api/imports/mappings'),
          apiRequest<TargetField[]>('/api/imports/fields'),
          apiRequest<{ fields: MappingField[] }>(`/api/imports/${jobId}/mapping`),
          apiRequest<Page<ImportError>>(`/api/imports/${jobId}/errors?limit=100&offset=0`),
        ]);
      setJob(loadedJob);
      setPreview(loadedPreview);
      setMappings(loadedMappings);
      setTargets(loadedTargets);
      setMapping(
        Object.fromEntries(
          loadedMapping.fields.map((field) => [field.target_field, field.source_column]),
        ),
      );
      setErrors(loadedErrors.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить импорт.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateConfig = async (values: { sheet_name?: string; header_row?: number }) => {
    if (!jobId) return;
    try {
      await apiRequest(`/api/imports/${jobId}/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          sheet_name: values.sheet_name ?? preview?.sheet ?? null,
          header_row: values.header_row ?? job?.header_row ?? 1,
        }),
      });
      setDiff(undefined);
      await load();
      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось обновить настройки файла.',
      );
    }
  };

  const saveMapping = async (mappingId?: string) => {
    if (!jobId) return;
    try {
      const fields = targets.flatMap((target) =>
        mapping[target.key]
          ? [
              {
                source_column: mapping[target.key],
                target_field: target.key,
                required: target.required,
              },
            ]
          : [],
      );
      await apiRequest(`/api/imports/${jobId}/mapping`, {
        method: 'PUT',
        body: JSON.stringify(mappingId ? { mapping_id: mappingId } : { fields }),
      });
      setDiff(undefined);
      await load();
      onUpdated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить сопоставление.');
    }
  };

  const validate = async () => {
    if (!jobId) return;
    try {
      await apiRequest(`/api/imports/${jobId}/validate`, { method: 'POST' });
      await load();
      onUpdated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось проверить импорт.');
    }
  };

  const buildDiff = async () => {
    if (!jobId) return;
    try {
      setDiff(await apiRequest<ImportDiff>(`/api/imports/${jobId}/diff`));
      await load();
      onUpdated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сформировать diff.');
    }
  };

  const confirm = async () => {
    if (!jobId) return;
    try {
      await apiRequest(`/api/imports/${jobId}/confirm`, { method: 'POST' });
      setDiff(undefined);
      await load();
      onUpdated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Импорт не был применён.');
    }
  };

  const mappingOptions = useMemo(
    () =>
      mappings.map((item) => ({
        value: item.id,
        label: `${item.name}${item.is_system ? ' · системный' : ''}`,
      })),
    [mappings],
  );
  const canConfirm = Boolean(
    diff && !errors.length && diff.conflict_count === 0 && job?.status !== 'DONE',
  );

  return (
    <Modal
      title="Импорт данных"
      open={Boolean(jobId)}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Закрыть</Button>}
      width={1100}
      destroyOnClose
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {job && (
        <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Статус">
            <Tag
              color={
                job.status === 'DONE' ? 'green' : job.status === 'VALIDATED' ? 'orange' : 'blue'
              }
            >
              {job.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Строки">{job.total_rows}</Descriptions.Item>
          <Descriptions.Item label="Принято">{job.valid_rows}</Descriptions.Item>
          <Descriptions.Item label="Отклонено">{job.invalid_rows}</Descriptions.Item>
        </Descriptions>
      )}
      {preview && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Typography.Text strong>1. Файл и предпросмотр</Typography.Text>
          <Space wrap>
            <Select
              value={preview.sheet}
              onChange={(sheet_name) => void updateConfig({ sheet_name })}
              options={preview.sheetNames.map((name) => ({ value: name, label: name }))}
              style={{ width: 220 }}
            />
            <InputNumber
              min={1}
              value={job?.header_row}
              addonBefore="Строка заголовков"
              onChange={(value) => value && void updateConfig({ header_row: value })}
            />
            <Typography.Text type="secondary">Всего строк: {preview.totalRows}</Typography.Text>
          </Space>
          <Table
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={false}
            scroll={{ x: true }}
            dataSource={preview.rows.map((row, index) => ({
              key: index,
              ...Object.fromEntries(
                preview.headers.map((header, position) => [header, row[position] ?? '']),
              ),
            }))}
            columns={preview.headers.map((header) => ({
              title: header,
              dataIndex: header,
              key: header,
            }))}
          />
          <Typography.Text strong>2. Сопоставление колонок</Typography.Text>
          <Space wrap>
            <Select
              placeholder="Применить готовое сопоставление"
              options={mappingOptions}
              onChange={(value) => void saveMapping(value)}
              style={{ width: 320 }}
            />
            <Button onClick={() => void saveMapping()}>Сохранить ручное сопоставление</Button>
          </Space>
          <Table<TargetField>
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={targets}
            columns={[
              {
                title: 'Поле CRM',
                render: (_, target) => (
                  <>
                    {target.label}
                    {target.required && (
                      <Tag color="red" style={{ marginLeft: 8 }}>
                        обязательно
                      </Tag>
                    )}
                  </>
                ),
              },
              {
                title: 'Колонка файла',
                render: (_, target) => (
                  <Select
                    allowClear
                    value={mapping[target.key]}
                    onChange={(value) =>
                      setMapping((current) => ({ ...current, [target.key]: value ?? '' }))
                    }
                    options={preview.headers.map((header) => ({ value: header, label: header }))}
                    style={{ width: 280 }}
                  />
                ),
              },
            ]}
          />
          <Typography.Text strong>3. Проверка и diff</Typography.Text>
          <Space wrap>
            <Button onClick={() => void validate()}>Проверить</Button>
            <Button
              onClick={() => void buildDiff()}
              disabled={Boolean(errors.length) || !preview.totalRows}
            >
              Построить diff
            </Button>
            <Button type="primary" danger onClick={() => void confirm()} disabled={!canConfirm}>
              Подтвердить и применить
            </Button>
          </Space>
          {errors.length > 0 && (
            <>
              <Alert
                type="warning"
                showIcon
                message={`Найдено ошибок: ${errors.length}. Исправьте файл или mapping и повторите проверку.`}
              />
              <Table<ImportError>
                size="small"
                rowKey="id"
                pagination={{ pageSize: 10 }}
                dataSource={errors}
                columns={[
                  { title: 'Строка', dataIndex: 'row' },
                  { title: 'Колонка', dataIndex: 'column', render: (value) => value ?? '—' },
                  { title: 'Причина', dataIndex: 'message' },
                  { title: 'Код', dataIndex: 'code' },
                ]}
              />
            </>
          )}
          {diff && (
            <>
              <Descriptions size="small" column={4}>
                <Descriptions.Item label="Создать">{diff.create_count}</Descriptions.Item>
                <Descriptions.Item label="Обновить">{diff.update_count}</Descriptions.Item>
                <Descriptions.Item label="Пропустить">{diff.skip_count}</Descriptions.Item>
                <Descriptions.Item label="Конфликты">{diff.conflict_count}</Descriptions.Item>
              </Descriptions>
              <Table
                size="small"
                rowKey="row"
                pagination={{ pageSize: 10 }}
                dataSource={diff.items}
                columns={[
                  { title: 'Строка', dataIndex: 'row' },
                  { title: 'Действие', dataIndex: 'action' },
                  { title: 'Объект', dataIndex: 'entity' },
                  {
                    title: 'Причина',
                    dataIndex: 'reasons',
                    render: (value: string[]) => value.join('; '),
                  },
                ]}
              />
            </>
          )}
        </Space>
      )}
      {loading && <Typography.Text type="secondary">Загрузка…</Typography.Text>}
    </Modal>
  );
};

export default ImportWizardModal;
