import { ClockCircleOutlined, SendOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { Avatar, Button, Input, List, Select, Space, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../../api/client';
import { filledCount } from '../backend/workflowBackendFieldGaps';
import {
  activityFallback,
  buildControlCategories,
  buildControlRecommendations,
  buildControlSignals,
  completedTrackedCount,
  controlLevel,
  controlStatusLabel,
  trackedStages,
  type ControlLevel,
  type ControlSignal,
} from '../stages/controlExecution';
import pageStyles from '../WorkflowDetailPage.module.scss';

import styles from './ControlExecutionStage.module.scss';
import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';

type StageRow = { id: string; name: string; code: string; status: string; dueAt: string | null };
type FeedItem = { id: string; text: string; at: string; user: string; signalId?: string };
type Stored = { comments: FeedItem[]; archive: ControlSignal[] | null; checkedAt: string | null };

const toneTag = (tone: ControlLevel) => tone === 'ok' ? 'OK' : tone === 'warning' ? 'Warning' : 'Critical';
const tileTone = (tone: ControlLevel) => tone === 'critical' ? tileStyles.tileLate : tone === 'warning' ? tileStyles.tileWarning : '';
const iconTone = (tone: ControlLevel) => tone === 'critical' ? tileStyles.iconDueLate : tone === 'warning' ? tileStyles.iconDueToday : tileStyles.iconDue;

const storageKey = (programId: string) => `rtk-eduflow:control:${programId}`;
const readStored = (programId: string): Stored => {
  try { return { comments: [], archive: null, checkedAt: null, ...JSON.parse(localStorage.getItem(storageKey(programId)) || '{}') }; } catch { return { comments: [], archive: null, checkedAt: null }; }
};

const ControlExecutionStage = ({ programId, organizationId, archived, stages, healthBand, healthScore, windowId, actorName, onOpenStage }: {
  programId: string; organizationId: string; archived: boolean; stages: StageRow[]; healthBand: string | null; healthScore: number | null; windowId: string | null; actorName: string; onOpenStage: (stageId: string) => void;
}) => {
  const navigate = useNavigate();
  const [stored, setStored] = useState<Stored>(() => readStored(programId));
  const [signals, setSignals] = useState<ControlSignal[]>(stored.archive ?? []);
  const [comment, setComment] = useState('');
  const [linkedSignal, setLinkedSignal] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [students, setStudents] = useState<number | null>(null);
  const [studentsLive, setStudentsLive] = useState(false);
  const [applications, setApplications] = useState<number | null>(null);
  const [applicationsLive, setApplicationsLive] = useState(false);
  const [streams, setStreams] = useState<number | null>(null);
  const [streamsLive, setStreamsLive] = useState(false);
  const [signalAt, setSignalAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<number[]>(() => activityFallback(programId));
  const [activityLive, setActivityLive] = useState(false);
  const [licenseUntil, setLicenseUntil] = useState<string | null>(null);
  const [qualificationUntil, setQualificationUntil] = useState<string | null>(null);
  const [transferDone, setTransferDone] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [carrierStatus, setCarrierStatus] = useState<string | null>(null);
  const [windowEnd, setWindowEnd] = useState<string | null>(null);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  useEffect(() => { localStorage.setItem(storageKey(programId), JSON.stringify(stored)); }, [programId, stored]);

  useEffect(() => {
    const stages = stagesRef.current;
    if (archived && stored.archive) { setSignals(stored.archive); return; }
    let cancelled = false;
    Promise.all([
      apiRequest<{ product_id?: string; direction_id?: string; academic_window_id?: string | null }>(`/api/program-instances/${programId}`),
      apiRequest<{ students_count?: number; applications_count?: number; active_streams?: number; activity?: number[]; last_lms_signal_at?: string | null; last_website_signal_at?: string | null } | null>(`/api/integrations/program-instances/${programId}/metrics`).catch(() => null),
      apiRequest<{ valid_until?: string | null; transfer_status?: string | null; product_access?: string | null } | null>(`/api/program-instances/${programId}/license`).catch(() => null),
      apiRequest<Array<{ id: string; classes_end_on: string; classes_start_on?: string | null }>>('/api/academic-windows').catch(() => []),
      apiRequest<{ items?: Array<{ id: string; product_id?: string; direction_id?: string; status?: string }> }>(`/api/organizations/${organizationId}/program-instances?limit=100`).catch(() => ({ items: [] })),
    ]).then(async ([program, metrics, license, windows, programs]) => {
      if (cancelled) return;
      const teachers = program.product_id ? await apiRequest<Array<{ product_id: string; program_instance_id?: string | null; status: string; qualification_until?: string | null }>>(`/api/organizations/${organizationId}/teachers`).catch(() => []) : [];
      const carrier = teachers.find((row) => row.product_id === program.product_id && row.program_instance_id === programId) ?? teachers.find((row) => row.product_id === program.product_id);
      const window = windows.find((item) => item.id === (program.academic_window_id ?? windowId));
      const end = window?.classes_end_on ?? null;
      const duplicate = (programs.items ?? []).some((item) => item.id !== programId && item.product_id === program.product_id && item.direction_id === program.direction_id && item.status !== 'completed' && item.status !== 'cancelled');
      const next = buildControlSignals({
        today: dayjs().format('YYYY-MM-DD'),
        stages,
        healthBand,
        healthScore,
        carrierStatus: carrier?.status ?? null,
        licenseUntil: license?.valid_until ?? null,
        transferDone: stages.some((stage) => stage.code === 'transfer_access' && stage.status === 'COMPLETED'),
        accessReady: license?.transfer_status === 'transferred' && Boolean(license.product_access?.trim()),
        students: metrics?.students_count ?? null,
        signalAt: metrics?.last_lms_signal_at ?? metrics?.last_website_signal_at ?? null,
        windowEnd: end,
        windowStart: window?.classes_start_on ?? null,
        qualificationUntil: carrier?.qualification_until ?? null,
        duplicate,
      });
      setStudents(typeof metrics?.students_count === 'number' ? metrics.students_count : filledCount(programId, null, 0));
      setStudentsLive(typeof metrics?.students_count === 'number');
      setApplications(typeof metrics?.applications_count === 'number' ? metrics.applications_count : filledCount(programId, null, 4));
      setApplicationsLive(typeof metrics?.applications_count === 'number');
      setStreams(typeof metrics?.active_streams === 'number' ? metrics.active_streams : 1 + (programId.length % 3));
      setStreamsLive(typeof metrics?.active_streams === 'number');
      setSignalAt(metrics?.last_lms_signal_at ?? metrics?.last_website_signal_at ?? null);
      setActivity(Array.isArray(metrics?.activity) && metrics.activity.length ? metrics.activity : activityFallback(programId));
      setActivityLive(Array.isArray(metrics?.activity) && metrics.activity.length > 0);
      setLicenseUntil(license?.valid_until ?? null);
      setQualificationUntil(carrier?.qualification_until ?? null);
      setTransferDone(stages.some((stage) => stage.code === 'transfer_access' && (stage.status === 'COMPLETED' || stage.status === 'completed')));
      setAccessReady(license?.transfer_status === 'transferred' && Boolean(license.product_access?.trim()));
      setCarrierStatus(carrier?.status ?? null);
      setWindowEnd(end);
      setStored((current) => ({ ...current, checkedAt: new Date().toISOString(), archive: archived ? next : current.archive }));
      setSignals(next);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [archived, programId, organizationId, healthBand, healthScore, windowId, stored.archive]);

  const today = dayjs().format('YYYY-MM-DD');
  const level = controlLevel(signals);
  const recommendations = buildControlRecommendations({ students, signalAt, today, licenseUntil, level });
  const categories = buildControlCategories({
    today, stages, licenseUntil, qualificationUntil, transferDone, accessReady, carrierStatus, students, signalAt, windowEnd,
  });
  const tracked = trackedStages(stages);
  const doneCount = completedTrackedCount(stages);
  const stale = signals.filter((signal) => signal.stageId && tracked.some((stage) => stage.id === signal.stageId && (stage.status === 'COMPLETED' || stage.status === 'completed')));
  const openRenewal = () => {
    sessionStorage.setItem('rtk-eduflow:next-program', JSON.stringify({ parentProgramId: programId, organizationId, playbook: 'license_renewal' }));
    navigate(`/universities/${organizationId}`);
  };
  const runSignal = (signal: ControlSignal) => {
    if (signal.id === 'license') { openRenewal(); return; }
    if (signal.id === 'duplicate') { navigate(`/universities/${organizationId}`); return; }
    const teacherStage = stages.find((stage) => stage.code === 'train_teacher')?.id;
    if ((signal.id === 'carrier' || signal.id === 'qualification') && teacherStage) { onOpenStage(teacherStage); return; }
    const classesStage = stages.find((stage) => stage.code === 'classes_running')?.id;
    if (signal.id === 'lms-silence' && classesStage) { onOpenStage(classesStage); return; }
    if (signal.stageId) onOpenStage(signal.stageId);
  };

  const criticalCount = signals.filter((signal) => signal.level === 'critical').length;
  const warningCount = signals.filter((signal) => signal.level === 'warning').length;
  const healthTone: ControlLevel = healthBand === 'red' || level === 'critical' ? 'critical' : healthBand === 'yellow' || level === 'warning' ? 'warning' : 'ok';
  const addComment = () => {
    if (!comment.trim()) return;
    setStored((current) => ({ ...current, comments: [{ id: `c-${Date.now()}`, text: comment.trim(), at: new Date().toISOString(), user: actorName, signalId: linkedSignal }, ...current.comments] }));
    setComment('');
    setLinkedSignal(undefined);
  };

  return (
    <div className={styles.root}>
      <div className={tileStyles.tiles}>
        <div className={`${tileStyles.tile} ${tileTone(level)}`}>
          <span className={`${tileStyles.tileIcon} ${iconTone(level)}`} aria-hidden="true"><WarningOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Статус контроля</span>
            <strong className={tileStyles.tileValue}>{controlStatusLabel(level)}</strong>
            <span className={tileStyles.tileHint}>{archived ? 'Архив' : 'Следит за заходом в фоне'}</span>
          </span>
        </div>
        <div className={`${tileStyles.tile} ${tileTone(healthTone)}`}>
          <span className={`${tileStyles.tileIcon} ${iconTone(healthTone)}`} aria-hidden="true"><TeamOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Здоровье захода</span>
            <strong className={tileStyles.tileValue}>{healthScore ?? '—'}</strong>
            <span className={tileStyles.tileHint}>{healthBand === 'red' ? 'Критическое' : healthBand === 'yellow' ? 'Требует внимания' : healthBand === 'green' ? 'В норме' : 'Нет оценки'}</span>
          </span>
        </div>
        <div className={`${tileStyles.tile} ${criticalCount ? tileStyles.tileLate : warningCount ? tileStyles.tileWarning : ''}`}>
          <span className={`${tileStyles.tileIcon} ${criticalCount ? tileStyles.iconDueLate : warningCount ? tileStyles.iconDueToday : tileStyles.iconDue}`} aria-hidden="true"><WarningOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Требует внимания</span>
            <strong className={tileStyles.tileValue}>{criticalCount} крит. · {warningCount} пред.</strong>
            <span className={tileStyles.tileHint}>{recommendations.length ? `${recommendations.length} рекоменд.` : 'Рекомендаций нет'}</span>
          </span>
        </div>
        <div className={tileStyles.tile}>
          <span className={`${tileStyles.tileIcon} ${tileStyles.iconDue}`} aria-hidden="true"><ClockCircleOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Последняя проверка</span>
            <strong className={tileStyles.tileValue}>{stored.checkedAt ? dayjs(stored.checkedAt).format('D MMMM, HH:mm') : 'Ещё нет'}</strong>
            <span className={tileStyles.tileHint}>Синхронизация контроля</span>
          </span>
        </div>
      </div>

      <div className={styles.block}>
      <h3>Состояние захода</h3>
      <div className={tileStyles.factGrid}>
        {categories.map((category) => (
          <div key={category.id} className={tileStyles.factCell}>
            <span>{category.label}</span>
            <b>{toneTag(category.tone)}</b>
            <small>{category.detail}</small>
          </div>
        ))}
      </div>
      </div>

      <div className={styles.block}>
      <h3>Результаты обучения</h3>
      <div className={tileStyles.tiles}>
        <div className={tileStyles.tile}>
          <span className={`${tileStyles.tileIcon} ${tileStyles.iconResponsible}`} aria-hidden="true"><TeamOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Студенты</span>
            <strong className={tileStyles.tileValue}>{students ?? '—'}</strong>
            {!studentsLive && <span className={tileStyles.tileHint}>Временное значение</span>}
          </span>
        </div>
        <div className={tileStyles.tile}>
          <span className={`${tileStyles.tileIcon} ${tileStyles.iconEmail}`} aria-hidden="true"><SendOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Заявки</span>
            <strong className={tileStyles.tileValue}>{applications ?? '—'}</strong>
            {!applicationsLive && <span className={tileStyles.tileHint}>Временное значение</span>}
          </span>
        </div>
        <div className={tileStyles.tile}>
          <span className={`${tileStyles.tileIcon} ${tileStyles.iconPhone}`} aria-hidden="true"><TeamOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Активные потоки</span>
            <strong className={tileStyles.tileValue}>{streams ?? '—'}</strong>
            <span className={tileStyles.tileHint}>{streamsLive ? 'Из метрик' : 'Временное значение'}</span>
          </span>
        </div>
        <div className={`${tileStyles.tile} ${!signalAt ? tileStyles.tileWarning : ''}`}>
          <span className={`${tileStyles.tileIcon} ${signalAt ? tileStyles.iconDue : tileStyles.iconWarning}`} aria-hidden="true"><ClockCircleOutlined /></span>
          <span className={tileStyles.tileBody}>
            <span className={tileStyles.tileLabel}>Последний сигнал LMS</span>
            <strong className={tileStyles.tileValue}>{signalAt ? dayjs(signalAt).format('D MMMM YYYY') : 'Нет сигнала'}</strong>
            <span className={tileStyles.tileHint}>{activityLive ? activity.join(' · ') : `Динамика: ${activity.join(' · ')}`}</span>
          </span>
        </div>
      </div>
      </div>

      <div className={styles.block}>
      <h3>Требует внимания</h3>
      {signals.length === 0 && <p className={formStyles.context}>Активных предупреждений нет.</p>}
      {signals.length > 0 && (
        <div className={formStyles.fileSlot}>
          {signals.map((signal) => (
            <div key={signal.id} className={formStyles.fileCard}>
              <div className={styles.signalText}>
                <span className={styles.signalTitle}>{signal.title}</span>
                <span className={styles.signalMeta}>{signal.stage} · {dayjs(signal.at).format('D MMMM YYYY')}</span>
              </div>
              <div className={styles.signalSide}>
                <Tag color={signal.level === 'critical' ? 'error' : 'warning'}>{signal.level === 'critical' ? 'Критично' : 'Предупреждение'}</Tag>
                {!archived && (signal.stageId || signal.id === 'license' || signal.id === 'duplicate' || signal.id === 'carrier' || signal.id === 'qualification') && <Button type="link" onClick={() => runSignal(signal)}>{signal.action}</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {recommendations.length > 0 && <p className={formStyles.context}>{recommendations.map((item) => item.title).join(' · ')}</p>}
      </div>

      <div className={styles.block}>
      <div className={styles.head}>
        <h3>Исполнение этапов</h3>
        <Button type="link" onClick={() => setHistoryOpen((open) => !open)}>{historyOpen ? 'Скрыть историю' : 'Открыть историю'}</Button>
      </div>
      <div className={tileStyles.vendorRow}>
        <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Выполнено</span> <strong className={tileStyles.tileValue}>{doneCount} из {tracked.length}</strong></div>
        <div className={tileStyles.vendorHalf}><span className={tileStyles.tileLabel}>Проблемы по закрытым</span> <strong className={tileStyles.tileValue}>{stale.length}</strong></div>
      </div>
      {historyOpen && (
        <div className={formStyles.fileSlot}>
          {tracked.map((stage) => (
            <div key={stage.id} className={formStyles.fileCard}>
              <div className={styles.signalText}>
                <span className={styles.signalTitle}>{stage.name}</span>
              </div>
              <div className={styles.signalSide}>
                <Tag>{stage.status === 'COMPLETED' || stage.status === 'completed' ? 'Выполнен' : stage.status === 'IN_PROGRESS' || stage.status === 'active' ? 'В работе' : 'Не закрыт'}</Tag>
                <Button type="link" onClick={() => onOpenStage(stage.id)}>Открыть</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      <div className={styles.block}>
      <h3>Комментарии</h3>
      <div className={pageStyles.commentComposer}>
        <Avatar>{(actorName || 'Я').slice(0, 1)}</Avatar>
        <Input
          disabled={archived}
          value={comment}
          placeholder="Добавить комментарий..."
          onChange={(event) => setComment(event.target.value)}
          onPressEnter={addComment}
        />
        <Tooltip title="Добавить комментарий">
          <Button className={pageStyles.commentSubmit} aria-label="Добавить комментарий" type="primary" icon={<SendOutlined />} disabled={archived || !comment.trim()} onClick={addComment} />
        </Tooltip>
      </div>
      {signals.length > 0 && (
        <Select
          allowClear
          disabled={archived}
          placeholder="Связать с проблемой"
          value={linkedSignal}
          options={signals.map((signal) => ({ value: signal.id, label: signal.title }))}
          onChange={(value) => setLinkedSignal(value)}
          className={formStyles.field}
        />
      )}
      {stored.comments.length > 0 && (
        <List
          dataSource={stored.comments}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar>{(item.user || actorName || 'Я').slice(0, 1)}</Avatar>}
                title={<Space>{item.user || actorName}<span className={pageStyles.commentDate}>{dayjs(item.at).format('D MMMM YYYY, HH:mm')}</span>{item.signalId && <Tag>{signals.find((signal) => signal.id === item.signalId)?.title ?? item.signalId}</Tag>}</Space>}
                description={item.text}
              />
            </List.Item>
          )}
        />
      )}
      </div>
    </div>
  );
};

export default ControlExecutionStage;
