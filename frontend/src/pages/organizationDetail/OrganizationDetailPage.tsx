import { ArrowLeftOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Progress, Spin, Table, Tabs, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { apiRequest } from '../../api/client';

import styles from './OrganizationDetailPage.module.scss';

type Page<T> = { items: T[] };
type Organization = {
  id: string;
  name: string;
  short_name: string | null;
  region: string | null;
  city: string | null;
  status: string;
  comment: string | null;
};
type Summary = {
  type_name: string;
  kam_name: string | null;
  documents_count: number;
  feed_events_count: number;
};
type Health = {
  active_programs_count: number;
  worst_health_score: number | null;
  worst_health_band: 'green' | 'yellow' | 'red' | null;
};
type Program = {
  id: string;
  direction_name: string;
  product_name: string;
  status: string;
  kam_name: string | null;
  academic_window_title: string | null;
  health_score: number | null;
  health_band: 'green' | 'yellow' | 'red';
};
type Person = {
  id: string;
  full_name: string;
  role_code: string;
  position: string | null;
  email: string | null;
  is_primary: boolean;
};
type Document = {
  file_id: string;
  filename: string;
  kind: string | null;
  program_name: string | null;
  created_at: string;
};
type Feed = {
  id: string;
  title: string;
  description: string | null;
  actor_name: string | null;
  created_at: string;
};

const color = (band: Health['worst_health_band']) =>
  band === 'green' ? 'green' : band === 'yellow' ? 'gold' : band === 'red' ? 'red' : 'default';
const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const OrganizationDetailRedesign = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    organization: Organization;
    summary: Summary;
    health: Health;
    programs: Program[];
    people: Person[];
    documents: Document[];
    feed: Feed[];
  }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<Organization>(`/api/organizations/${id}`),
      apiRequest<Summary>(`/api/organizations/${id}/360`),
      apiRequest<Health>(`/api/organizations/${id}/health`),
      apiRequest<Page<Program>>(`/api/organizations/${id}/program-instances?limit=100`),
      apiRequest<Person[]>(`/api/organizations/${id}/stakeholders`),
      apiRequest<Document[]>(`/api/organizations/${id}/documents`),
      apiRequest<Feed[]>(`/api/organizations/${id}/feed`),
    ])
      .then(([organization, summary, health, programs, people, documents, feed]) =>
        setData({
          organization,
          summary,
          health,
          programs: programs.items,
          people,
          documents,
          feed,
        }),
      )
      .catch(() => setError('Не удалось загрузить карточку организации.'));
  }, [id]);

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!data)
    return (
      <div className={styles.loader}>
        <Spin size="large" />
      </div>
    );

  const { organization, summary, health, programs, people, documents, feed } = data;
  const score = health.worst_health_score;
  const band = health.worst_health_band;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/organizations')}
        >
          Организации
        </Button>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span className={styles.breadcrumbCurrent}>
          {organization.short_name || organization.name}
        </span>
      </div>
      <section className={styles.hero}>
        <div className={styles.identity}>
          <div className={styles.logo}>
            {initials(organization.short_name || organization.name)}
          </div>
          <div className={styles.identityBody}>
            <h1>{organization.short_name || organization.name}</h1>
            <p>
              {[summary.type_name, organization.region, organization.city]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {organization.comment && <p className={styles.comment}>{organization.comment}</p>}
            <div className={styles.tags}>
              <Tag>{summary.type_name}</Tag>
              <Tag>KAM: {summary.kam_name ?? 'не назначен'}</Tag>
              <Tag color={color(band)}>
                {score ?? '—'} · {band ?? 'нет оценки'}
              </Tag>
            </div>
            <div className={styles.owners}>
              <Button
                type="primary"
                onClick={() => navigate(`/organizations/${organization.id}`)}
              >
                Управление организацией
              </Button>
            </div>
          </div>
        </div>
        {score !== null && (
          <div className={styles.score}>
            <Progress
              type="circle"
              percent={score}
              strokeColor={band === 'green' ? '#16844f' : band === 'yellow' ? '#d48806' : '#dc3c48'}
            />
            <div className={styles.scoreText}>
              <strong>Health score</strong>
              <span>{health.active_programs_count} активных программ</span>
            </div>
          </div>
        )}
      </section>
      <Tabs
        items={[
          {
            key: 'programs',
            label: `Программы (${programs.length})`,
            children: (
              <Card>
                <Table<Program>
                  rowKey="id"
                  dataSource={programs}
                  pagination={false}
                  onRow={(row) => ({
                    onClick: () => navigate(`/programs/${row.id}`),
                    style: { cursor: 'pointer' },
                  })}
                  columns={[
                    { title: 'Направление', dataIndex: 'direction_name' },
                    { title: 'Продукт', dataIndex: 'product_name' },
                    {
                      title: 'Этап',
                      dataIndex: 'academic_window_title',
                      render: (value) => value ?? '—',
                    },
                    { title: 'KAM', dataIndex: 'kam_name', render: (value) => value ?? '—' },
                    {
                      title: 'Health',
                      render: (_, row) => (
                        <Tag color={color(row.health_band)}>
                          {row.health_score ?? '—'} · {row.health_band}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'people',
            label: `Люди (${people.length})`,
            children: (
              <Card>
                <Table<Person>
                  rowKey="id"
                  dataSource={people}
                  pagination={false}
                  columns={[
                    {
                      title: 'ФИО',
                      dataIndex: 'full_name',
                      render: (value, row) => (
                        <>
                          {value} {row.is_primary && <Tag color="blue">Основной</Tag>}
                        </>
                      ),
                    },
                    { title: 'Роль', dataIndex: 'role_code' },
                    { title: 'Должность', dataIndex: 'position', render: (value) => value ?? '—' },
                    { title: 'E-mail', dataIndex: 'email', render: (value) => value ?? '—' },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'documents',
            label: `Документы (${documents.length})`,
            children: (
              <Card>
                <Table<Document>
                  rowKey="file_id"
                  dataSource={documents}
                  pagination={false}
                  columns={[
                    { title: 'Файл', dataIndex: 'filename' },
                    { title: 'Тип', dataIndex: 'kind', render: (value) => value ?? '—' },
                    {
                      title: 'Программа',
                      dataIndex: 'program_name',
                      render: (value) => value ?? '—',
                    },
                    {
                      title: 'Дата',
                      dataIndex: 'created_at',
                      render: (value) => value.slice(0, 10),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'feed',
            label: `Лента (${feed.length})`,
            children: feed.length ? (
              <Card>
                <Table<Feed>
                  rowKey="id"
                  dataSource={feed}
                  pagination={false}
                  columns={[
                    { title: 'Событие', dataIndex: 'title' },
                    {
                      title: 'Описание',
                      dataIndex: 'description',
                      render: (value) => value ?? '—',
                    },
                    {
                      title: 'Автор',
                      dataIndex: 'actor_name',
                      render: (value) => value ?? 'Система',
                    },
                    {
                      title: 'Дата',
                      dataIndex: 'created_at',
                      render: (value) => value.slice(0, 16).replace('T', ' '),
                    },
                  ]}
                />
              </Card>
            ) : (
              <Empty description="Событий пока нет" />
            ),
          },
        ]}
      />
    </div>
  );
};

export default OrganizationDetailRedesign;
