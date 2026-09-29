import { Alert, Button, Empty, Grid, Modal, Progress, Select, Spin, Tag, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import { assignOrganizationKam, listEligibleKams, loadUniversityCard, syncOrganizationPrograms } from './api';
import HealthMark from './components/HealthMark';
import OrganizationLogo from './components/OrganizationLogo';
import ProgramMasterModal from './components/ProgramMasterModal';
import UniversityTabBar from './components/UniversityTabBar';
import UniversityWorkspace from './components/UniversityWorkspace';
import type { UniversityCard } from './screenModel';
import { healthBandOf } from './screenModel';

import styles from './UniversityDetailPage.module.scss';

const sections = [
  { key: 'programs', label: 'Программы' },
  { key: 'people', label: 'Люди' },
  { key: 'contracts', label: 'Договоры и лицензии' },
  { key: 'teachers', label: 'Преподаватели' },
  { key: 'documents', label: 'Документы' },
  { key: 'feed', label: 'Лента' },
];

const initials = (value: string) => value.split(' ').map((part) => part[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

const healthNote = (score: number | null) => {
  if (score == null) return { label: 'Нет программ', note: 'Здоровье появится после первого захода' };
  if (score >= 75) return { label: 'Высокий уровень', note: 'Худшая живая программа в зелёной зоне' };
  if (score >= 50) return { label: 'Нужно внимание', note: 'Худшая живая программа желтеет' };
  return { label: 'Критично', note: 'Худшая живая программа красная' };
};

const UniversityDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const compactScore = !Grid.useBreakpoint().lg;
  const seesKam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;
  const [params, setParams] = useSearchParams();
  const section = sections.some((item) => item.key === params.get('section')) ? params.get('section') ?? 'programs' : 'programs';
  const [card, setCard] = useState<UniversityCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [masterOpen, setMasterOpen] = useState(false);
  const [kamOpen, setKamOpen] = useState(false);
  const [kams, setKams] = useState<Array<{ id: string; full_name: string }>>([]);
  const [kamUserId, setKamUserId] = useState<string>();
  const [assigning, setAssigning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    loadUniversityCard(id)
      .then((loaded) => { setCard(loaded); setError(''); })
      .catch(() => setError('Не удалось открыть вуз'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || masterOpen) return;
      const modal = document.querySelector('.ant-modal-wrap');
      if (modal instanceof HTMLElement && getComputedStyle(modal).display !== 'none') return;
      if (section !== 'programs') {
        setParams({ section: 'programs' }, { replace: true });
        return;
      }
      navigate('/organizations');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [masterOpen, navigate, section, setParams]);

  const sync = async () => {
    if (!card) return;
    const programIds = card.programs.filter((program) => program.status === 'active' || program.status === 'paused' || program.status === 'draft').map((program) => program.id);
    if (programIds.length === 0) {
      message.info('Синхронизировать нечего: на площадке нет живых программ');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncOrganizationPrograms(programIds);
      message.success(`Сигналы: сопоставлено ${result.mapped}, без площадки ${result.unmatched}`);
      reload();
    } catch {
      message.error('Синхронизация не прошла');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !card) {
    return <PageLayout><div className={styles.loader}><Spin size="large" /></div></PageLayout>;
  }

  if (!card) {
    return <PageLayout><Empty description={error || 'Организация не найдена'} /></PageLayout>;
  }

  const note = healthNote(card.healthScore);
  const band = card.healthBand ?? healthBandOf(card.healthScore, null);
  const scoreColor = band === 'green' ? '#16844f' : band === 'yellow' ? '#d48806' : band === 'red' ? '#dc3c48' : '#8c8c8c';
  const archived = card.status === 'archived';

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.breadcrumbs}>
          <Link to="/organizations">Организации</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          {section === 'programs' ? <span className={styles.breadcrumbCurrent}>{card.shortName}</span> : (
            <>
              <button type="button" className={styles.breadcrumbLink} onClick={() => setParams({ section: 'programs' }, { replace: true })}>{card.shortName}</button>
              <span className={styles.breadcrumbSeparator}>›</span>
              <span className={styles.breadcrumbCurrent}>{sections.find((item) => item.key === section)?.label}</span>
            </>
          )}
        </div>
        {error && <Alert type="error" showIcon message={error} />}
        <section className={styles.hero}>
          <div className={styles.identity}>
            <OrganizationLogo
              organizationId={card.id}
              logoFileId={card.logoFileId}
              fallback={initials(card.shortName)}
              className={styles.logo}
            />
            <div className={styles.identityBody}>
              <h1>{card.shortName}</h1>
              <p>{[card.typeName, card.region, card.city].filter(Boolean).join(' · ')}</p>
              {card.comment && <p className={styles.comment}>{card.comment}</p>}
              <div className={styles.tags}>
                <Tag>{card.typeName}</Tag>
                {seesKam && <Tag>KAM: {card.kamName}</Tag>}
                <HealthMark score={card.healthScore} band={card.healthBand} />
                {archived && <Tag>Архив</Tag>}
              </div>
              <div className={styles.owners}>
                <Button type="primary" disabled={archived} onClick={() => setMasterOpen(true)}>+ программа</Button>
                {seesKam && <Button onClick={() => {
                  setKamOpen(true);
                  listEligibleKams(card.id).then(setKams).catch(() => message.error('Не удалось загрузить менеджеров команды'));
                }}>Сменить KAM</Button>}
                <Button loading={syncing} onClick={() => void sync()}>Синхронизировать</Button>
                <Button onClick={() => navigate(`/reports?organization=${card.id}`)}>Отчёт по вузу</Button>
              </div>
            </div>
          </div>
          {(card.healthScore != null || !compactScore) && <div className={`${styles.score} ${compactScore ? styles.scoreCompact : ''}`}>
            {card.healthScore == null ? null : (
              <Progress type="circle" percent={card.healthScore} size={compactScore ? 64 : 84} strokeColor={scoreColor} format={(value) => value} />
            )}
            {!compactScore && (
              <div className={styles.scoreText}>
                <strong>{note.label}</strong>
                <span>{note.note}</span>
              </div>
            )}
          </div>}
        </section>
        <UniversityTabBar items={sections} activeKey={section} onChange={(key) => setParams({ section: key }, { replace: true })} />
        <UniversityWorkspace card={card} section={section} onChanged={reload} />
        <Modal
          open={kamOpen}
          title="Ответственный KAM"
          okText="Назначить"
          cancelText="Отмена"
          confirmLoading={assigning}
          okButtonProps={{ disabled: !kamUserId }}
          onCancel={() => setKamOpen(false)}
          onOk={() => {
            if (!kamUserId) return;
            setAssigning(true);
            assignOrganizationKam(card.id, kamUserId)
              .then(() => {
                message.success('KAM назначен. Живые программы площадки перешли к нему, этапы не сброшены.');
                setKamOpen(false);
                reload();
              })
              .catch(() => message.error('Не удалось назначить KAM'))
              .finally(() => setAssigning(false));
          }}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Менеджер команды"
            style={{ width: '100%' }}
            value={kamUserId}
            options={kams.map((item) => ({ value: item.id, label: item.full_name }))}
            onChange={setKamUserId}
            notFoundContent="В команде нет доступных KAM"
          />
        </Modal>
        <ProgramMasterModal
          open={masterOpen}
          organizationId={card.id}
          programs={card.programs}
          onClose={() => setMasterOpen(false)}
          onCreated={(programId) => navigate(`/workflows/${programId}`)}
        />
      </div>
    </PageLayout>
  );
};

export default UniversityDetailPage;
