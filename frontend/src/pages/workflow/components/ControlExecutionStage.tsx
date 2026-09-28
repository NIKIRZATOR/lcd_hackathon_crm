import { Button, Input, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../../../api/client';
import { buildControlSignals, controlLevel, type ControlSignal } from '../controlExecution';

import formStyles from './FirstMeetingStage.module.scss';
import tileStyles from './ContactSearchStage.module.scss';

type StageRow = { id: string; name: string; code: string; status: string; dueAt: string | null };
type Stored = { acks: Record<string, 'accepted' | 'working'>; comments: Array<{ id: string; text: string; at: string }>; archive: ControlSignal[] | null };

const storageKey = (programId: string) => `rtk-eduflow:control:${programId}`;
const readStored = (programId: string): Stored => {
  try { return { acks: {}, comments: [], archive: null, ...JSON.parse(localStorage.getItem(storageKey(programId)) || '{}') }; } catch { return { acks: {}, comments: [], archive: null }; }
};

const ControlExecutionStage = ({ programId, organizationId, archived, stages, healthBand, healthScore, windowId, onOpenStage }: {
  programId: string; organizationId: string; archived: boolean; stages: StageRow[]; healthBand: string | null; healthScore: number | null; windowId: string | null; onOpenStage: (stageId: string) => void;
}) => {
  const navigate = useNavigate();
  const [stored, setStored] = useState<Stored>(() => readStored(programId));
  const [signals, setSignals] = useState<ControlSignal[]>(stored.archive ?? []);
  const [comment, setComment] = useState('');
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  useEffect(() => { localStorage.setItem(storageKey(programId), JSON.stringify(stored)); }, [programId, stored]);

  useEffect(() => {
    const stages = stagesRef.current;
    if (archived && stored.archive) { setSignals(stored.archive); return; }
    let cancelled = false;
    Promise.all([
      apiRequest<{ product_id?: string; direction_id?: string; academic_window_id?: string | null }>(`/api/program-instances/${programId}`),
      apiRequest<{ students_count?: number; last_lms_signal_at?: string | null; last_website_signal_at?: string | null } | null>(`/api/integrations/program-instances/${programId}/metrics`).catch(() => null),
      apiRequest<{ valid_until?: string | null; transfer_status?: string | null; product_access?: string | null } | null>(`/api/program-instances/${programId}/license`).catch(() => null),
      apiRequest<Array<{ id: string; classes_end_on: string }>>('/api/academic-windows').catch(() => []),
      apiRequest<{ items?: Array<{ id: string; product_id?: string; direction_id?: string; status?: string }> }>(`/api/organizations/${organizationId}/program-instances?limit=100`).catch(() => ({ items: [] })),
    ]).then(async ([program, metrics, license, windows, programs]) => {
      if (cancelled) return;
      const teachers = program.product_id ? await apiRequest<Array<{ product_id: string; program_instance_id?: string | null; status: string }>>(`/api/organizations/${organizationId}/teachers`).catch(() => []) : [];
      const carrier = teachers.find((row) => row.product_id === program.product_id && row.program_instance_id === programId) ?? teachers.find((row) => row.product_id === program.product_id);
      const end = windows.find((item) => item.id === (program.academic_window_id ?? windowId))?.classes_end_on ?? null;
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
        duplicate,
      });
      if (archived) setStored((current) => ({ ...current, archive: next }));
      setSignals(next);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [archived, programId, organizationId, healthBand, healthScore, windowId, stored.archive]);

  const level = controlLevel(signals);
  const openRenewal = () => {
    sessionStorage.setItem('rtk-eduflow:next-program', JSON.stringify({ parentProgramId: programId, organizationId, playbook: 'license_renewal' }));
    navigate(`/universities/${organizationId}`);
  };

  return (
    <div className={tileStyles.root}>
      <div className={tileStyles.factGrid}>
        <div className={tileStyles.factCell}><span>Статус контроля</span><b>{level === 'ok' ? 'Всё в порядке' : level === 'warning' ? 'Есть предупреждения' : 'Критические отклонения'}</b></div>
        <div className={tileStyles.factCell}><span>Режим</span><b>{archived ? 'Архив' : 'Активен'}</b><small>{archived ? 'Новые сигналы не создаются' : 'Следит за заходом в фоне'}</small></div>
      </div>
      <div className={formStyles.fields}>
        {signals.length === 0 && <p>Сигналов нет.</p>}
        {signals.map((signal) => (
          <div key={signal.id} className={formStyles.fileCard}>
            <span className={formStyles.fileName}>{signal.title}</span>
            <span className={formStyles.fileMeta}>{signal.stage} · {dayjs(signal.at).format('D MMMM YYYY')}</span>
            <Tag>{signal.level === 'critical' ? 'Критично' : 'Предупреждение'}</Tag>
            <span className={formStyles.fileMeta}>{signal.action}</span>
            {!archived && (
              <span className={formStyles.fileActions}>
                {signal.stageId && <Button type="link" onClick={() => onOpenStage(signal.stageId!)}>К этапу</Button>}
                {signal.id === 'carrier' && <Button type="link" onClick={() => onOpenStage(stages.find((stage) => stage.code === 'train_teacher')?.id ?? '')}>Замена преподавателя</Button>}
                {signal.id === 'license' && <Button type="link" onClick={openRenewal}>Продление</Button>}
                <Select
                  size="small"
                  placeholder="Отметить"
                  value={stored.acks[signal.id]}
                  options={[{ value: 'accepted', label: 'Принято' }, { value: 'working', label: 'В работе' }]}
                  onChange={(value) => setStored((current) => ({ ...current, acks: { ...current.acks, [signal.id]: value } }))}
                />
              </span>
            )}
          </div>
        ))}
        <label className={formStyles.field}>
          <span>Комментарий в ленту</span>
          <div className={formStyles.participantRow}>
            <Input disabled={archived} value={comment} onChange={(event) => setComment(event.target.value)} />
            <Button disabled={archived || !comment.trim()} onClick={() => { setStored((current) => ({ ...current, comments: [{ id: `c-${Date.now()}`, text: comment.trim(), at: new Date().toISOString() }, ...current.comments] })); setComment(''); }}>Добавить</Button>
          </div>
        </label>
        {stored.comments.map((item) => <p key={item.id}>{dayjs(item.at).format('D MMMM YYYY, HH:mm')} · {item.text}</p>)}
      </div>
    </div>
  );
};

export default ControlExecutionStage;
