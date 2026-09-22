import { EditOutlined } from '@ant-design/icons';
import { Button, DatePicker, Empty, Form, Grid, InputNumber, Modal, Progress, Tabs, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageLayout from '../../components/pageLayout/PageLayout';
import { DocumentsPanel, HistoryPanel, InteractionsPanel, ProgramsPanel, StreamsPanel, TasksPanel, TeachersPanel } from './components/UniversityPanels';
import UniversityOverview from './components/UniversityOverview';
import UniversityPeopleModal from './components/UniversityPeopleModal';
import UniversityTabBar from './components/UniversityTabBar';
import { findUniversity, listUniversityWorkflows, rememberUniversity } from './api';
import { PeriodContext } from './period';
import type { Period } from './period';
import { buildUniversitySections } from './sectionData';

import { universityTypeLabels } from './types';
import { buildUniversityCard, getUniversityScore, levelByScore, saveUniversityScore } from './universityCard';

import styles from './UniversityDetailPage.module.scss';

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

const { useBreakpoint } = Grid;

const UniversityDetailPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const compactScore = screens.md === false;
  const { id } = useParams();
  const [revision, setRevision] = useState(0);
  const university = useMemo(() => findUniversity(Number(id)), [id, revision]);
  const card = useMemo(() => (university ? buildUniversityCard(university) : undefined), [university]);
  const sections = useMemo(() => (university ? buildUniversitySections(university) : undefined), [university]);
  const interactions = useMemo(() => (university ? listUniversityWorkflows(university.id).map((row) => ({
    id: String(row.id),
    program: row.program,
    product: row.product,
    stage: row.stage,
    tone: row.tone,
    nextStep: row.nextStep,
    due: row.due,
    owner: row.owner,
    at: row.at,
  })) : []), [university, revision]);
  const [score, setScore] = useState(() => (university && card ? getUniversityScore(university.id, card.score) : 0));
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState<Period>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [form] = Form.useForm<{ score: number }>();

  if (!university || !card || !sections) {
    return (
      <PageLayout>
        <Empty description="Вуз не найден" />
      </PageLayout>
    );
  }

  const level = levelByScore(score);
  const scoreColor = score >= 75 ? '#16844f' : score >= 50 ? '#d48806' : '#dc3c48';
  const tabs = [
    { key: 'overview', label: 'Обзор' },
    { key: 'interactions', label: 'Взаимодействия' },
    { key: 'programs', label: 'Программы и продукты' },
    { key: 'teachers', label: 'Преподаватели' },
    { key: 'streams', label: 'Потоки' },
    { key: 'documents', label: 'Документы' },
    { key: 'tasks', label: 'Задачи и встречи' },
    { key: 'history', label: 'История' },
  ];

  const openScore = () => {
    form.setFieldsValue({ score });
    setScoreOpen(true);
  };

  const savePeople = (manager: string, responsibles: { name: string; role: string }[]) => {
    if (!university) return;
    rememberUniversity({ ...university, manager: manager || 'Не назначен', responsibles });
    setRevision((value) => value + 1);
    setPeopleOpen(false);
    message.success('Ответственные обновлены');
  };

  const saveScore = ({ score: nextScore }: { score: number }) => {
    saveUniversityScore(university.id, nextScore);
    setScore(nextScore);
    setScoreOpen(false);
  };

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.breadcrumbs}>
          <Link to="/universities">Вузы</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span className={styles.breadcrumbCurrent}>{university.shortName}</span>
        </div>

        <section className={styles.hero}>
          <div className={styles.identity}>
            <span className={styles.logo}>{initials(university.shortName)}</span>
            <div className={styles.identityBody}>
              <h1>{university.shortName}</h1>
              <p>
                {[
                  university.type ? `${universityTypeLabels[university.type]} университет` : '',
                  university.profile,
                  university.city || 'Город не указан',
                  card.site,
                ].filter(Boolean).join(' · ')}
              </p>
              {university.catalog?.comment && <p className={styles.comment}>{university.catalog.comment}</p>}
              <div className={styles.tags}>
                {university.type && <Tag>{universityTypeLabels[university.type]}</Tag>}
                {university.profile && <Tag>{university.profile}</Tag>}
                {university.product && <Tag>{university.product}</Tag>}
                <Tag>{card.partnership}</Tag>
              </div>
              <div className={styles.owners}>
                <span className={styles.owner}>
                  <span className={styles.avatar}>{initials(card.rtkManager.name)}</span>
                  <span><small>{card.rtkManager.role}</small><strong>{card.rtkManager.name}</strong></span>
                </span>
                {card.universityOwners.map((person) => (
                  <span key={person.name} className={styles.owner}>
                    <span className={styles.avatar}>{initials(person.name)}</span>
                    <span><small>{person.role}</small><strong>{person.name}</strong></span>
                  </span>
                ))}
                <Button type="link" className={styles.peopleButton} onClick={() => setPeopleOpen(true)}>Изменить</Button>
              </div>
            </div>
          </div>

          <div className={styles.score}>
            {compactScore ? (
              <button type="button" className={styles.scoreButton} aria-label="Изменить уровень сотрудничества" onClick={openScore}>
                <Progress type="circle" percent={score} size={64} strokeColor={scoreColor} format={(value) => value} />
              </button>
            ) : (
              <>
                <Progress type="circle" percent={score} size={84} strokeColor={scoreColor} format={(value) => value} />
                <div className={styles.scoreText}>
                  <strong>{level.label}</strong>
                  <span>{level.note}</span>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={openScore}>Изменить</Button>
                </div>
              </>
            )}
          </div>
        </section>

        <div className={styles.periodRow}>
          <DatePicker.RangePicker
            placeholder={['Период с', 'Период по']}
            format="DD.MM.YYYY"
            value={period ? [dayjs(period[0]), dayjs(period[1])] : null}
            onChange={(values) => {
              if (!values?.[0] || !values[1]) {
                setPeriod(null);
                return;
              }
              setPeriod([values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD')]);
            }}
          />
        </div>

        <PeriodContext.Provider value={period}>
        <Tabs
          className={styles.tabs}
          activeKey={tab}
          onChange={setTab}
          renderTabBar={() => <UniversityTabBar items={tabs} activeKey={tab} onChange={setTab} />}
          items={[
            { key: 'overview', label: 'Обзор', children: <UniversityOverview card={card} interactions={interactions} programs={university.programs} streams={university.streams} onOpenTab={setTab} onOpenInteraction={(interactionId) => navigate(`/workflow/${interactionId}`)} /> },
            { key: 'interactions', label: 'Взаимодействия', children: <InteractionsPanel university={university} /> },
            { key: 'programs', label: 'Программы и продукты', children: <ProgramsPanel sections={sections} /> },
            { key: 'teachers', label: 'Преподаватели', children: <TeachersPanel sections={sections} /> },
            { key: 'streams', label: 'Потоки', children: <StreamsPanel sections={sections} /> },
            { key: 'documents', label: 'Документы', children: <DocumentsPanel sections={sections} /> },
            { key: 'tasks', label: 'Задачи и встречи', children: <TasksPanel sections={sections} /> },
            { key: 'history', label: 'История', children: <HistoryPanel sections={sections} /> },
          ]}
        />
        </PeriodContext.Provider>
      </div>

      <UniversityPeopleModal
        open={peopleOpen}
        manager={university.manager === 'Не назначен' ? '' : university.manager}
        responsibles={university.responsibles ?? card.universityOwners.map((person) => ({ name: person.name, role: 'Ответственный от вуза' }))}
        onClose={() => setPeopleOpen(false)}
        onSave={savePeople}
      />
      <Modal
        open={scoreOpen}
        title="Уровень сотрудничества"
        okText="Сохранить"
        cancelText="Отмена"
        onCancel={() => setScoreOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={saveScore}>
          <Form.Item name="score" label="Оценка, 0–100" rules={[{ required: true, message: 'Укажите оценку' }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  );
};

export default UniversityDetailPage;
