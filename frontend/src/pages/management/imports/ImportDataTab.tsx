import { Alert, Button, Space, Table, Tag, Typography, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiDownload, apiRequest } from '../../../api/client';
import ImportWizardModal from './ImportWizardModal';
import type { ImportJob, Page } from './types';

const statusColor: Record<string, string> = {
  DONE: 'green',
  FAILED: 'red',
  VALIDATED: 'orange',
  READY: 'blue',
};

const download = async (job: ImportJob, artifactType: 'PROTOCOL' | 'ERROR_REPORT') => {
  const blob = await apiDownload(`/api/imports/${job.id}/artifacts/${artifactType}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${artifactType.toLowerCase()}-${job.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const ImportDataTab = () => {
  const [page, setPage] = useState<Page<ImportJob>>({ items: [], total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [selectedJobId, setSelectedJobId] = useState<string>();

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError(undefined);
    try {
      setPage(await apiRequest<Page<ImportJob>>(`/api/imports?limit=20&offset=${offset}`));
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось загрузить историю импортов.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.append('file', file);
      const job = await apiRequest<ImportJob>('/api/imports', { method: 'POST', body: data });
      await load();
      setSelectedJobId(job.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить файл.');
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <>
      <Typography.Paragraph type="secondary">
        Загружайте XLS/XLSX, настройте сопоставление колонок, проверьте изменения и подтвердите
        импорт. Данные не изменяются до подтверждения.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <Upload
          accept=".xls,.xlsx"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            void upload(file);
            return false;
          }}
        >
          <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
            Загрузить XLS/XLSX
          </Button>
        </Upload>
        <Button onClick={() => void load()}>Обновить</Button>
      </Space>
      <Table<ImportJob>
        rowKey="id"
        loading={loading}
        dataSource={page.items}
        locale={{ emptyText: 'Импортов пока нет' }}
        pagination={{
          current: page.offset / page.limit + 1,
          pageSize: page.limit,
          total: page.total,
          showSizeChanger: false,
          onChange: (nextPage) => void load((nextPage - 1) * page.limit),
        }}
        columns={[
          {
            title: 'Файл',
            dataIndex: 'source_file_name',
            render: (value: string | null) => value ?? '—',
          },
          {
            title: 'Автор',
            dataIndex: 'created_by_name',
            render: (value: string | null) => value ?? '—',
          },
          {
            title: 'Дата',
            dataIndex: 'created_at',
            render: (value: string) => new Date(value).toLocaleString('ru-RU'),
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (value: string) => <Tag color={statusColor[value] ?? 'default'}>{value}</Tag>,
          },
          { title: 'Строки', render: (_, job) => `${job.valid_rows}/${job.total_rows}` },
          {
            title: 'Ошибки',
            render: (_, job) =>
              job.invalid_rows ? <Tag color="red">{job.invalid_rows}</Tag> : '—',
          },
          {
            title: 'Изменения',
            render: (_, job) =>
              `${job.create_count} + / ${job.update_count} ~ / ${job.conflict_count} !`,
          },
          {
            title: 'Действие',
            render: (_, job) => (
              <Space size={0}>
                <Button type="link" onClick={() => setSelectedJobId(job.id)}>
                  Открыть
                </Button>
                {job.invalid_rows > 0 && (
                  <Button type="link" onClick={() => void download(job, 'ERROR_REPORT')}>
                    Ошибки
                  </Button>
                )}
                {job.status === 'DONE' && (
                  <Button type="link" onClick={() => void download(job, 'PROTOCOL')}>
                    Протокол
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <ImportWizardModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(undefined)}
        onUpdated={() => void load(page.offset)}
      />
    </>
  );
};

export default ImportDataTab;
