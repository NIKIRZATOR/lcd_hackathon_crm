import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';

import styles from './SystemStatusTab.module.scss';

type SystemStatus = {
  component: string;
  status: 'OK' | 'Warning' | 'Error' | 'Unknown';
  detail: string;
  checked_at: string;
};

const statusColor = { OK: 'green', Warning: 'gold', Error: 'red', Unknown: 'default' };
const relatedPath: Record<string, string> = {
  Keycloak: '/management?tab=users',
  MinIO: '/management?tab=imports',
  'Report queue': '/reports',
};
const imageNames: Record<string, string> = {
  Backend: 'backend.png',
  PostgreSQL: 'postgresql.png',
  Redis: 'Simpleicons-Team-Simple-Redis.512 (1).png',
  'Report queue': 'reports.png',
  'Backup scheduler': 'backup.png',
  MinIO: 'Minio_logo_light.png',
  Keycloak: 'keycloak-logo-png_seeklogo-505405.png',
};
const imageBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const formatStatusDetail = (detail: string) =>
  detail.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, (timestamp) => new Date(timestamp).toLocaleString('ru-RU'));

const SystemStatusTab = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<SystemStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await apiRequest<SystemStatus[]>('/api/system/status'));
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Не удалось проверить состояние платформы.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const summary = useMemo(
    () => ({
      errors: items.filter((item) => item.status === 'Error').length,
      warnings: items.filter((item) => item.status === 'Warning').length,
      unknown: items.filter((item) => item.status === 'Unknown').length,
    }),
    [items],
  );

  return (
    <>
      <Typography.Paragraph type="secondary">
        Техническая проверка компонентов платформы. Здесь не отображаются секреты, учётные данные
        или содержимое пользовательских файлов.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Space wrap style={{ marginBottom: 16 }}>
        <Button type="primary" loading={loading} onClick={() => void load()}>
          Обновить проверку
        </Button>
        {summary.errors > 0 && <Tag color="red">Ошибок: {summary.errors}</Tag>}
        {summary.warnings > 0 && <Tag color="gold">Предупреждений: {summary.warnings}</Tag>}
        {summary.unknown > 0 && <Tag>Неизвестно: {summary.unknown}</Tag>}
      </Space>
      <Row gutter={[16, 16]}>
        {items.map((item) => {
          const path = relatedPath[item.component];
          const imageName = imageNames[item.component];
          return (
            <Col xs={24} md={12} xl={8} key={item.component}>
              <Card
                className={styles.statusCard}
                size="small"
                title={
                  <span className={styles.cardTitle}>
                    <span className={styles.componentImage}>
                      {imageName && (
                        <img
                          src={`${imageBaseUrl}/images/${encodeURIComponent(imageName)}`}
                          alt=""
                        />
                      )}
                    </span>
                    <span>{item.component}</span>
                  </span>
                }
                extra={<Tag color={statusColor[item.status]}>{item.status.toUpperCase()}</Tag>}
              >
                <Typography.Paragraph style={{ minHeight: 44, marginBottom: 8 }}>
                  {formatStatusDetail(item.detail)}
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                  Проверено: {new Date(item.checked_at).toLocaleString('ru-RU')}
                </Typography.Text>
                {path && (
                  <Button
                    type="link"
                    style={{ paddingLeft: 0, display: 'block' }}
                    onClick={() => navigate(path)}
                  >
                    Открыть связанный раздел
                  </Button>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
      {!loading && !items.length && !error && (
        <Alert type="info" showIcon message="Компоненты для проверки пока не настроены." />
      )}
    </>
  );
};

export default SystemStatusTab;
