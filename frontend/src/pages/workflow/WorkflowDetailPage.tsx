import { DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Empty, Input, List, Popconfirm, Space, Spin, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import HealthMark from '../universities/components/HealthMark';
import {
  addStageComment,
  deleteStageComment,
  deleteStageFile,
  loadProgramDesk,
  loadStageFacts,
  moveProgram,
  saveChecklistItem,
  syncProgram,
  updateStageComment,
  uploadStageFile,
  type DeskChecklistItem,
  type DeskComment,
  type DeskFile,
  type ProgramDesk,
} from './api';
import StageWorkspace from './components/StageWorkspace';
import WorkflowSteps from './components/WorkflowSteps';
import { stageBlueprints, stageCodeOf } from './stageBlueprints';
import { emptyActionText } from './workflowBackendFieldGaps';


import styles from './WorkflowDetailPage.module.scss';

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

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const modal = document.querySelector('.ant-modal-wrap');
      if (modal instanceof HTMLElement && getComputedStyle(modal).display !== 'none') return;
      navigate('/v2/workflows');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    const stage = desk?.stages.find((item) => item.id === selectedId);
    if (!selectedId || selectedId.startsWith('gap-')) {
      const code = stageCodeOf(stage?.code, stage?.name);
      const blueprint = stageBlueprints[code];
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
      return;
    }
    loadStageFacts(selectedId).then((facts) => {
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
    }).catch(() => setError('Не удалось прочитать этап'));
  }, [desk?.stages, selectedId]);

  if (loading && !desk) return <PageLayout><div className={styles.loader}><Spin size="large" /></div></PageLayout>;
  if (!desk) return <PageLayout><Empty description={error || 'Программа не найдена'} /></PageLayout>;

  const currentIndex = Math.max(desk.stages.findIndex((stage) => stage.id === desk.currentStageId), 0);
  const selectedIndex = Math.max(desk.stages.findIndex((stage) => stage.id === selectedId), 0);
  const selected = desk.stages[selectedIndex];
  const next = desk.stages[selectedIndex + 1];
  const previous = desk.stages[selectedIndex - 1];
  const isCurrent = selected?.id === desk.currentStageId;
  const readOnly = false;
  const missing = checklist.filter((item) => item.required && !item.done).map((item) => item.label);
  const sameName = (left?: string, right?: string) => (left ?? '').trim().toLowerCase() === (right ?? '').trim().toLowerCase();
  const forward = desk.transitions.find((item) => sameName(item.toStageName, next?.name))
    ?? (!selected?.final && desk.transitions.length === 1 ? desk.transitions[0] : undefined);
  const backward = desk.transitions.find((item) => sameName(item.toStageName, previous?.name));
  const canClose = Boolean(isCurrent && missing.length === 0 && (selected?.final || forward));
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
      done: Boolean(patch.is_done),
      valueText: (patch.value_text as string | undefined) ?? entry.valueText,
      valueDate: (patch.value_date as string | null | undefined) ?? entry.valueDate,
      stakeholderId: (patch.stakeholder_id as string | undefined) ?? entry.stakeholderId,
      attachmentId: (patch.attachment_id as string | undefined) ?? entry.attachmentId,
    } : entry));
    const typedText = typeof patch.value_text === 'string' ? patch.value_text.trim() : null;
    const needsLongText = item.code === 'meeting_protocol' || item.label.includes('40');
    if (typedText !== null && needsLongText && typedText.length < 40) return;
    if (patch.defer || item.id.startsWith('local-') || item.id.startsWith('gap-')) return;
    try {
      await saveChecklistItem(item.id, patch);
    } catch (reason) {
      message.error(errorText(reason));
      if (item.itemType !== 'text') await refreshFacts();
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
          <Link to="/v2/workflows">Воркфлоу</Link>
          <span className={styles.breadcrumbSeparator}>›</span>
          <Link to={`/v2/organizations/${desk.organizationId}?section=programs`}>{desk.organization}</Link>
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
              onStepChange={(index) => setSelectedId(desk.stages[index].id)}
            />
          </Card>
          <div className={styles.content}>
            {desk.banner !== emptyActionText && <Alert type={desk.bannerTone === 'success' ? 'success' : desk.bannerTone === 'warning' ? 'warning' : 'info'} showIcon message={desk.banner} />}
            {selected && (
              <Card className={styles.sectionCard}>
                <div className={styles.stageHeading}>
                  <h2>{selected.name}</h2>
                  <Tag className={isCurrent ? styles.stageStatusCurrent : readOnly ? styles.stageStatusCompleted : styles.stageStatusUpcoming}>
                    {late > 0 ? `Просрочен на ${late} дн.` : isCurrent ? 'Текущий' : selected.status === 'completed' ? 'Пройден' : 'Впереди'}
                  </Tag>
                </div>
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
                {comments.length > 0 && (
                  <List
                    dataSource={comments}
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
                {missing.length > 0 && isCurrent && <p className={styles.blockReason}>Закрытие заблокировано: {missing.join(', ')}</p>}
                <div className={styles.footerActions}>
                  {backward && isCurrent && <Button disabled={!(drafts[selected.id] ?? '').trim()} loading={busy} onClick={() => void go(backward.id)}>Вернуть к «{previous?.name}»</Button>}
                  {selected.optional && isCurrent && <Button loading={busy} onClick={() => void go(forward?.id, true)}>Пропустить</Button>}
                  <Button type="primary" disabled={!canClose} loading={busy} onClick={() => void go(forward?.id)}>
                    {selected.final ? 'Завершить программу' : next ? `Закрыть и перейти к «${next.name}»` : 'Закрыть этап'}
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
