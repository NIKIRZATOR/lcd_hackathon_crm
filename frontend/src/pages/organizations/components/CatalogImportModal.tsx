import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Select, Table, Upload, message } from 'antd';
import { useState } from 'react';

import { catalogTargets, importUniversityCatalog } from '../api';
import { catalogFields, downloadCatalogTemplate, previewCatalog, readCatalogRows, suggestCatalogMapping } from '../catalogImport';
import type { CatalogField, CatalogMapping, CatalogPreviewRow } from '../catalogImport';

type CatalogImportModalProps = {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

const CatalogImportModal = ({ open, onClose, onApplied }: CatalogImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CatalogMapping | null>(null);
  const [preview, setPreview] = useState<CatalogPreviewRow[]>([]);

  const reset = () => {
    setFile(null);
    setHeader([]);
    setRows([]);
    setMapping(null);
    setPreview([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const loadFile = async (file: File) => {
    const table = await readCatalogRows(await file.arrayBuffer());
    const nextHeader = (table[0] ?? []).map((cell) => String(cell ?? ''));
    const nextMapping = suggestCatalogMapping(nextHeader);
    setFile(file);
    setHeader(nextHeader);
    setRows(table);
    setMapping(nextMapping);
    setPreview(previewCatalog(table, nextMapping));
    return false;
  };

  const updateMapping = (field: CatalogField, index: number | null) => {
    if (!mapping) return;
    const next = { ...mapping, [field]: index };
    setMapping(next);
    setPreview(previewCatalog(rows, next));
  };

  const apply = async () => {
    if (!file || !mapping || mapping.name == null) {
      message.error('Укажите колонку «Название ВУЗа»');
      return;
    }
    const fields = catalogFields.flatMap((field) => {
      const index = mapping[field.key];
      if (index == null || !header[index]) return [];
      return [{ source_column: header[index], target_field: catalogTargets[field.key], required: field.required }];
    });
    try {
      const result = await importUniversityCatalog(file, fields);
      message.success(`Каталог обновлён: ${result.update_count} изменено, ${result.create_count} добавлено`);
      onApplied();
      close();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : 'Не удалось загрузить каталог');
    }
  };

  return (
    <Modal
      open={open}
      title="Загрузить каталог"
      width={760}
      okText="Обновить каталог"
      cancelText="Отмена"
      okButtonProps={{ disabled: mapping?.name == null || preview.length === 0 }}
      onOk={apply}
      onCancel={close}
    >
      <p>Файл xls или xlsx. Колонки можно сопоставить с полями каталога, если заголовки отличаются от шаблона.</p>
      <Button icon={<DownloadOutlined />} onClick={downloadCatalogTemplate}>Скачать шаблон</Button>
      <Upload.Dragger accept=".xls,.xlsx" maxCount={1} beforeUpload={loadFile} showUploadList={false} style={{ marginTop: 12 }}>
        <p><InboxOutlined /></p>
        <p>Перетащите файл или нажмите, чтобы выбрать</p>
      </Upload.Dragger>
      {mapping && (
        <>
          <Table
            style={{ marginTop: 16 }}
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={[...catalogFields]}
            columns={[
              { title: 'Поле карточки', dataIndex: 'title', width: 240, render: (title: string, field) => `${title}${field.required ? ' *' : ''}` },
              {
                title: 'Колонка в файле',
                render: (_value, field) => (
                  <Select
                    style={{ width: '100%' }}
                    allowClear={!field.required}
                    placeholder="Не выбрана"
                    value={mapping[field.key] ?? undefined}
                    options={header.map((title, index) => ({ value: index, label: title || `Колонка ${index + 1}` }))}
                    onChange={(value) => updateMapping(field.key, value ?? null)}
                  />
                ),
              },
              {
                title: 'Пример из файла',
                render: (_value, field) => {
                  const index = mapping[field.key];
                  const example = index == null ? '' : String(rows[1]?.[index] ?? '').trim();
                  return example || '—';
                },
              },
            ]}
          />
          {mapping.name == null && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Без колонки «Название ВУЗа» каталог не загрузится" />}
          <Table
            style={{ marginTop: 16 }}
            size="small"
            rowKey="name"
            pagination={false}
            dataSource={preview.slice(0, 6)}
            columns={[
              { title: 'Вуз', dataIndex: 'name' },
              { title: 'Действие', dataIndex: 'action', render: (value: CatalogPreviewRow['action']) => value === 'update' ? 'Обновить' : 'Добавить' },
              { title: 'Менеджер', dataIndex: 'manager' },
              { title: 'ПО', dataIndex: 'software' },
            ]}
          />
        </>
      )}
    </Modal>
  );
};

export default CatalogImportModal;

