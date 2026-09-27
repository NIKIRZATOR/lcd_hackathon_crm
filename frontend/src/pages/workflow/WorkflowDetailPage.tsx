import { DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Empty, Input, List, Popconfirm, Space, Spin, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import HealthMark from '../organizations/components/HealthMark';
import {
  addStageComment,
  deleteStageComment,
  deleteStageFile,
  loadProgramDesk,
  loadStageFacts,
  moveProgram,
  refuseProgram,
  rememberClosedProgram,
  saveChecklistItem,
  syncProgram,
  updateStageComment,
  uploadStageFile,
  type DeskChecklistItem,
  type DeskComment,
  type DeskFile,
  type ProgramDesk,
} from './api';
import ContactSearchStage from './components/ContactSearchStage';
import FirstMeetingStage from './components/FirstMeetingStage';
import DocumentPackageStage from './components/DocumentPackageStage';
import IdentifyNeedStage from './components/IdentifyNeedStage';
import StageWorkspace from './components/StageWorkspace';
import WorkflowSteps from './components/WorkflowSteps';
import { findContactChecklistItem } from './contactSearch';
import type { MeetingClosePlan } from './firstMeeting';
import { documentClosePlan } from './documentPackage';
import { identifyClosePlan } from './identifyNeed';
import { stageBlueprints, stageCodeOf } from './stageBlueprints';
import { emptyActionText } from './workflowBackendFieldGaps';


import styles from './WorkflowDetailPage.module.scss';

const seededStageComment = 'Текущий статус этапа подтверждён ответственным сотрудником';

const overdueDays = (due: string | null) => {
  if (!due || !dayjs(due).isValid()) return 0;
  return Math.max(dayjs().startOf('day').diff(dayjs(due), 'day'), 0);
};

const errorText = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Не удалось сохранить';
  const payload = error.payload as { message?: string; detail?: string | { message?: string } } | undefined;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (payload?.detail && typeof payload.detail === 'object' && payload.detail.message) return payload.detail.message;
  return payload?.message || error.message;
};

const WorkflowDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const seesKam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;
  const [desk, setDesk] = useState<ProgramDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [checklist, setChecklist] = useState<DeskChecklistItem[]>([]);
  const [factsStageId, setFactsStageId] = useState('');
  const [stageBlockers, setStageBlockers] = useState<string[] | null>(null);
  const [closeHint, setCloseHint] = useState(false);
  const [meetingPlan, setMeetingPlan] = useState<MeetingClosePlan | null>(null);
  const [identifyPlan, setIdentifyPlan] = useState<ReturnType<typeof identifyClosePlan> | null>(null);
  const [packagePlan, setPackagePlan] = useState<ReturnType<typeof documentClosePlan> | null>(null);
  const [comments, setComments] = useState<DeskComment[]>([]);
  const [files, setFiles] = useState<DeskFile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    loadProgramDesk(id)
      .then((loaded) => {
        setDesk(loaded);
        setSelectedId((current) => current || loaded.currentStageId || loaded.stages[0]?.id || '');
        setError('');
      })
      .catch(() => setError('Не удалось открыть программу'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const modal = document.querySelector('.ant-modal-wrap');
      if (modal instanceof HTMLElement && getComputedStyle(modal).display !== 'none') return;
      navigate('/workflows');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    const stage = desk?.stages.find((item) => item.id === selectedId);
    if (!selectedId || selectedId.startsWith('gap-')) {
      const code = stageCodeOf(stage?.code, stage?.name);
      const blueprint = stageBlueprints[code];
      const timer = window.setTimeout(() => {
        setChecklist((blueprint?.facts ?? []).map((fact) => ({
          id: `local-${selectedId}-${fact.code}`,
          code: fact.code,
          label: fact.label,
          required: true,
          done: false,
          itemType: fact.itemType,
          role: fact.role ?? null,
          attachmentKind: fact.attachmentKind ?? null,
          valueText: null,
          valueDate: null,
          stakeholderId: null,
          attachmentId: null,
        })));
        setComments([]);
        setFiles([]);
        setFactsStageId(selectedId);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    loadStageFacts(selectedId).then((facts) => {
      if (cancelled) return;
      const code = stageCodeOf(stage?.code, stage?.name);
      const blueprint = stageBlueprints[code];
      const visible = facts.checklist.length > 0 || !blueprint ? facts.checklist : blueprint.facts.map((fact) => ({
        id: `local-${selectedId}-${fact.code}`,
        code: fact.code,
        label: fact.label,
        required: true,
        done: false,
        itemType: fact.itemType,
        role: fact.role ?? null,
        attachmentKind: fact.attachmentKind ?? null,
        valueText: null,
        valueDate: null,
        stakeholderId: null,
        attachmentId: null,
      }));
      setChecklist(visible);
      setComments(facts.comments);
      setFiles(facts.files);
      setFactsStageId(selectedId);
    }).catch(() => { if (!cancelled) setError('Не удалось прочитать этап'); });
    return () => { cancelled = true; };
  }, [desk?.stages, selectedId]);

  useEffect(() => {
    setStageBlockers(null);
    setCloseHint(false);
    setMeetingPlan(null);
    setIdentifyPlan(null);
    setPackagePlan(null);
  }, [selectedId]);

  useEffect(() => {
    if (desk?.status === 'cancelled') rememberClosedProgram(desk.id);
  }, [desk?.id, desk?.status]);

  const publishBlockers = useCallback((labels: string[]) => {
    setStageBlockers((current) => (current?.join('\n') === labels.join('\n') ? current : labels));
  }, []);

  const publishPackagePlan = useCallback((next: ReturnType<typeof documentClosePlan>) => {
    setPackagePlan((current) => (current && current.enabled === next.enabled && current.hint === next.hint && current.button === next.button ? current : next));
  }, []);

  const publishIdentifyPlan = useCallback((next: ReturnType<typeof identifyClosePlan>) => {
    setIdentifyPlan((current) => (
      current && current.enabled === next.enabled && current.button === next.button && current.hint === next.hint ? current : next
    ));
  }, []);

  const publishMeetingPlan = useCallback((next: MeetingClosePlan) => {
    setMeetingPlan((current) => (
      current
      && current.action === next.action
      && current.enabled === next.enabled
      && current.button === next.button
      && current.hint === next.hint
      && current.note === next.note
        ? current
        : next
    ));
  }, []);

  if (loading && !desk) return <PageLayout><div className={styles.loader}><Spin size="large" /></div></PageLayout>;
  if (!desk) return <PageLayout><Empty description={error || 'Программа не найдена'} /></PageLayout>;

  const currentIndex = Math.max(desk.stages.findIndex((stage) => stage.id === desk.currentStageId), 0);
  const selectedIndex = Math.max(desk.stages.findIndex((stage) => stage.id === selectedId), 0);
  const selected = desk.stages[selectedIndex];
  const next = desk.stages[selectedIndex + 1];
  const previous = desk.stages[selectedIndex - 1];
  const isCurrent = selected?.id === desk.currentStageId;
  const readOnly = false;
  const findContact = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'find_contact');
  const firstMeeting = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'first_meeting');
  const identifyNeed = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'identify_need');
  const documentPackage = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'document_package');
  const refused = desk.status === 'cancelled';
  const refusedAt = refused ? desk.stages.findIndex((stage) => stageCodeOf(stage.code, stage.name) === 'first_meeting') : -1;
  const checklistMissing = checklist.filter((item) => item.required && !item.done).map((item) => item.label);
  const missing = firstMeeting
    ? (stageBlockers ?? ['Дата встречи указана', 'Участник от вуза выбран', 'Есть протокол или заметка'])
    : findContact
      ? (stageBlockers ?? ['Ответственный найден', 'Есть телефон или почта'])
      : checklistMissing;
  const sameName = (left?: string, right?: string) => (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
  const forward = desk.transitions.find((item) => sameName(item.toStageName, next?.name))
    ?? (!selected?.final && desk.transitions.length === 1 ? desk.transitions[0] : undefined);
  const backward = desk.transitions.find((item) => sameName(item.toStageName, previous?.name));
  const canMoveForward = Boolean(isCurrent && (selected?.final || forward));
  const canClose = Boolean(canMoveForward && missing.length === 0);
  const factBanner = desk.banner.startsWith('Заполните обязательный факт');
  const showFactBanner = factBanner && closeHint && missing.length > 0;
  const licenseBanner = /лиценз/i.test(desk.banner);
  const showBanner = desk.banner !== emptyActionText
    && !(firstMeeting && factBanner)
    && !(identifyNeed && (factBanner || licenseBanner))
    && !(documentPackage && (factBanner || licenseBanner))
    && (!factBanner || showFactBanner);
  const late = overdueDays(selected?.dueAt ?? null);

  const refreshFacts = async () => {
    if (!selected || selected.id.startsWith('gap-')) return;
    const facts = await loadStageFacts(selected.id);
    setChecklist(facts.checklist);
    setComments(facts.comments);
    setFiles(facts.files);
  };

  const changeItem = async (item: DeskChecklistItem, patch: Record<string, unknown>) => {
    if (readOnly) return;
    setChecklist((items) => items.map((entry) => entry.id === item.id ? {
      ...entry,
      done: 'is_done' in patch ? Boolean(patch.is_done) : entry.done,
      valueText: 'value_text' in patch ? (patch.value_text as string | null) : entry.valueText,
      valueDate: 'value_date' in patch ? (patch.value_date as string | null) : entry.valueDate,
      stakeholderId: 'stakeholder_id' in patch ? (patch.stakeholder_id as string | null) : entry.stakeholderId,
      attachmentId: 'attachment_id' in patch ? (patch.attachment_id as string | null) : entry.attachmentId,
    } : entry));
    const typedText = typeof patch.value_text === 'string' ? patch.value_text.trim() : null;
    const needsLongText = item.code === 'meeting_protocol' || item.label.includes('40');
    if (typedText !== null && needsLongText && typedText.length < 40) return;
    if (patch.defer || item.id.startsWith('local-') || item.id.startsWith('gap-')) return;
    const body = { ...patch };
    delete body.keepLocal;
    try {
      await saveChecklistItem(item.id, body);
    } catch (reason) {
      message.error(errorText(reason));
      if (!patch.keepLocal && item.itemType !== 'text') await refreshFacts();
    }
  };

  const sendComment = async () => {
    const textValue = (drafts[selected.id] ?? '').trim();
    if (!textValue || readOnly) return;
    setBusy(true);
    try {
      await addStageComment(selected.id, textValue);
      setDrafts((currentDrafts) => ({ ...currentDrafts, [selected.id]: '' }));
      await refreshFacts();
    } catch (reason) {
      message.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const refuse = async () => {
    if (!meetingPlan?.note) return;
    if (desk.id.startsWith('gap-')) {
      message.info('Это демо-программа из файла для бэкенда');
      return;
    }
    setBusy(true);
    try {
      await refuseProgram(desk.id, { stageId: desk.currentStageId || selected.id, comment: meetingPlan.note });
      rememberClosedProgram(desk.id);
      const reloaded = await loadProgramDesk(desk.id);
      setDesk(reloaded);
    } catch (reason) {
      message.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const go = async (transitionId: string | undefined, skip = false) => {
    if (desk.id.startsWith('gap-')) {
      message.info('Это демо-программа из файла для бэкенда');
      return;
    }
    setBusy(true);
    try {
      await moveProgram(desk.id, { transitionId, comment: drafts[selected.id], stageId: desk.currentStageId ?? undefined, skip });
      setDrafts((currentDrafts) => ({ ...currentDrafts, [selected.id]: '' }));
      const reloaded = await loadProgramDesk(desk.id);
      setDesk(reloaded);
      setSelectedId(reloaded.currentStageId || reloaded.stages[0]?.id || '');
    } catch (reason) {
      message.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.breadcrumbs}>
          <Link to="/workflows">Воркфлоу</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <Link to={`/organizations/${desk.organizationId}?section=programs`}>{desk.organization}</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <span className={styles.breadcrumbCurrent}>{desk.direction} · {desk.product}</span>
        </div>
        <div className={styles.programHeading}>
          <h1>{desk.direction} · {desk.product}</h1>
          <p>{desk.organization} · {desk.playbook}</p>
        </div>
        {error && <Alert type="error" showIcon message={error} />}
        <div className={styles.contextTags}>
          <Tag>Окно: {desk.windowTitle}</Tag>
          <HealthMark score={desk.healthScore} band={desk.healthBand} empty="Нет оценки" />
          {seesKam && <Tag>KAM: {desk.kam}</Tag>}
          <Button onClick={() => void syncProgram(desk.id).then(() => load()).catch((reason) => message.error(errorText(reason)))}>Синхронизировать</Button>
        </div>
        <div className={styles.layout}>
          <Card className={styles.stageCard} title="Путь">
            <WorkflowSteps
              steps={desk.stages.map((stage) => ({ id: stage.id, title: stage.name, phase: stage.phase }))}
              currentStep={currentIndex}
              selectedStep={selectedIndex}
              mutedAfter={refusedAt >= 0 ? refusedAt : undefined}
              onStepChange={(index) => setSelectedId(desk.stages[index].id)}
            />
          </Card>
          <div className={styles.content}>
            {showBanner && <Alert type={desk.bannerTone === 'success' ? 'success' : desk.bannerTone === 'warning' ? 'warning' : 'info'} showIcon message={desk.banner} />}
            {selected && (
              <Card className={styles.sectionCard}>
                <div className={styles.stageHeading}>
                  <h2>{selected.name}</h2>
                  <Tag className={refused ? styles.stageStatusUpcoming : isCurrent ? styles.stageStatusCurrent : readOnly ? styles.stageStatusCompleted : styles.stageStatusUpcoming}>
                    {refused && selectedIndex === refusedAt ? 'Закрыт' : late > 0 ? `Просрочен на ${late} дн.` : isCurrent && !refused ? 'Текущий' : selected.status === 'completed' || (refused && selectedIndex < refusedAt) ? 'Пройден' : 'Впереди'}
                  </Tag>
                </div>
                {findContact ? (
                  <ContactSearchStage
                    key={selected.id}
                    stageId={selected.id}
                    organizationId={desk.organizationId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    contactItem={factsStageId === selected.id ? findContactChecklistItem(checklist) : null}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onBlockers={publishBlockers}
                    onPeopleChange={(people) => setDesk((current) => current ? { ...current, people } : current)}
                  />
                ) : firstMeeting ? (
                  <FirstMeetingStage
                    key={selected.id}
                    stageId={selected.id}
                    organizationId={desk.organizationId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onBlockers={publishBlockers}
                    onPlan={publishMeetingPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = {
                        id: uploaded.id,
                        fileId: uploaded.file_id,
                        name: uploaded.original_name || file.name,
                        kind: uploaded.attachment_kind ?? kind ?? null,
                        sizeLabel: '',
                      };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => {
                      await deleteStageFile(file.id);
                      await refreshFacts();
                    }}
                    onPeopleChange={(people) => setDesk((current) => current ? { ...current, people } : current)}
                  />
                ) : documentPackage ? (
                  <DocumentPackageStage
                    key={selected.id}
                    stageId={selected.id}
                    organizationId={desk.organizationId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onBlockers={publishBlockers}
                    onPlan={publishPackagePlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = {
                        id: uploaded.id,
                        fileId: uploaded.file_id,
                        name: uploaded.original_name || file.name,
                        kind: uploaded.attachment_kind ?? kind ?? null,
                        sizeLabel: '',
                      };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => {
                      await deleteStageFile(file.id);
                      await refreshFacts();
                    }}
                  />
                ) : identifyNeed ? (
                  <IdentifyNeedStage
                    key={selected.id}
                    stageId={selected.id}
                    organizationId={desk.organizationId}
                    meetingStageId={desk.stages.find((stage) => stageCodeOf(stage.code, stage.name) === 'first_meeting')?.id ?? null}
                    dueAt={selected.dueAt}
                    programWindowId={desk.windowId}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onBlockers={publishBlockers}
                    onPlan={publishIdentifyPlan}
                  />
                ) : (
                  <>
                    <p className={styles.subtitle}>Срок: {selected.dueAt && dayjs(selected.dueAt).isValid() ? dayjs(selected.dueAt).format('D MMMM YYYY') : 'не задан'}</p>
                    <StageWorkspace
                      stageCode={selected.code}
                      stageName={selected.name}
                      items={checklist}
                      files={files}
                      people={desk.people}
                      organizationId={desk.organizationId}
                      students={desk.students}
                      license={desk.license}
                      readOnly={readOnly}
                      onChange={(item, patch) => void changeItem(item, patch)}
                      onUpload={async (file, kind) => {
                        const uploaded = await uploadStageFile(selected.id, file, kind);
                        const saved = {
                          id: uploaded.id,
                          fileId: uploaded.file_id,
                          name: uploaded.original_name || file.name,
                          kind: uploaded.attachment_kind ?? kind ?? null,
                          sizeLabel: '',
                        };
                        setFiles((current) => [...current.filter((item) => item.id !== saved.id), saved]);
                        return saved;
                      }}
                      onDeleteFile={async (file) => {
                        await deleteStageFile(file.id);
                        await refreshFacts();
                      }}
                      onPersonAdded={(person) => setDesk((current) => current ? { ...current, people: [...current.people, person] } : current)}
                    />
                  </>
                )}
                <div className={styles.commentComposer}>
                  <Avatar>{(user?.full_name || 'Я').slice(0, 1)}</Avatar>
                  <Input
                    value={drafts[selected.id] ?? ''}
                    disabled={readOnly}
                    placeholder="Добавить комментарий..."
                    onChange={(event) => setDrafts((currentDrafts) => ({ ...currentDrafts, [selected.id]: event.target.value }))}
                    onPressEnter={() => void sendComment()}
                  />
                  <Tooltip title="Добавить комментарий">
                    <Button className={styles.commentSubmit} aria-label="Добавить комментарий" type="primary" icon={<SendOutlined />} disabled={readOnly || !(drafts[selected.id] ?? '').trim()} loading={busy} onClick={() => void sendComment()} />
                  </Tooltip>
                </div>
                {comments.some((comment) => comment.text.trim().replace(/\.$/, '') !== seededStageComment) && (
                  <List
                    dataSource={comments.filter((comment) => comment.text.trim().replace(/\.$/, '') !== seededStageComment)}
                    renderItem={(comment) => {
                      const mine = comment.authorId === user?.id;
                      const editing = editingCommentId === comment.id;
                      return (
                        <List.Item
                          actions={mine && !editing ? [
                            <Button key="edit" type="text" icon={<EditOutlined />} aria-label="Изменить" onClick={() => { setEditingCommentId(comment.id); setEditingText(comment.text); }} />,
                            <Popconfirm key="delete" title="Удалить комментарий?" okText="Удалить" cancelText="Оставить" onConfirm={() => void deleteStageComment(selected.id, comment.id).then(refreshFacts)}>
                              <Button type="text" danger icon={<DeleteOutlined />} aria-label="Удалить" />
                            </Popconfirm>,
                          ] : undefined}
                        >
                          <List.Item.Meta
                            avatar={<Avatar>{mine ? (user?.full_name || 'Я').slice(0, 1) : 'К'}</Avatar>}
                            title={<Space>{mine ? 'Вы' : 'Коллега'}<span className={styles.commentDate}>{dayjs(comment.createdAt).isValid() ? dayjs(comment.createdAt).format('D MMMM YYYY, HH:mm') : comment.createdAt}</span></Space>}
                            description={editing ? (
                              <Input
                                value={editingText}
                                autoFocus
                                onChange={(event) => setEditingText(event.target.value)}
                                onPressEnter={() => void updateStageComment(selected.id, comment.id, editingText.trim()).then(() => { setEditingCommentId(null); return refreshFacts(); })}
                              />
                            ) : comment.text}
                          />
                        </List.Item>
                      );
                    }}
                  />
                )}
                {firstMeeting && !refused && meetingPlan?.hint && <p className={styles.blockReason}>{meetingPlan.hint}</p>}
                {firstMeeting && refused && <p className={styles.blockReason}>Заход закрыт. Следующие этапы не открываются.</p>}
                {missing.length > 0 && isCurrent && !firstMeeting && !identifyNeed && !documentPackage && (!findContact || closeHint) && <p className={styles.blockReason}>Закрытие заблокировано: {missing.join(', ')}</p>}
                <div className={styles.footerActions}>
                  {backward && isCurrent && <Button disabled={!(drafts[selected.id] ?? '').trim()} loading={busy} onClick={() => void go(backward.id)}>Вернуть к «{previous?.name}»</Button>}
                  {selected.optional && isCurrent && <Button loading={busy} onClick={() => void go(forward?.id, true)}>Пропустить</Button>}
                  <Button
                    type="primary"
                    disabled={refused || (documentPackage ? !packagePlan?.enabled || !canMoveForward : identifyNeed ? !identifyPlan?.enabled || !canMoveForward : firstMeeting ? !meetingPlan?.enabled || (meetingPlan.action === 'forward' && !canMoveForward) : findContact ? !canMoveForward || stageBlockers === null : !canClose)}
                    loading={busy}
                    onClick={() => {
                      if (firstMeeting && meetingPlan?.action === 'refuse') {
                        void refuse();
                        return;
                      }
                      if (!documentPackage && missing.length > 0) {
                        setCloseHint(true);
                        return;
                      }
                      void go(forward?.id);
                    }}
                  >
                    {refused ? 'Заход закрыт' : documentPackage ? (packagePlan?.button ?? 'Закрыть и перейти к подписанию договора') : identifyNeed ? (identifyPlan?.button ?? 'Закрыть и перейти к пакету документов') : firstMeeting ? (meetingPlan?.button ?? 'Закрыть и перейти к выявлению потребности') : selected.final ? 'Завершить программу' : next ? `Закрыть и перейти к «${next.name}»` : 'Закрыть этап'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default WorkflowDetailPage;
