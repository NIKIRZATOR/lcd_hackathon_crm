import { DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Empty, Input, List, Popconfirm, Space, Spin, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
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
  reopenProgramStage,
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
import SignContractStage from './components/SignContractStage';
import SignLicenseStage from './components/SignLicenseStage';
import TransferAccessStage from './components/TransferAccessStage';
import TrainTeacherStage from './components/TrainTeacherStage';
import ConfirmTeacherStage from './components/ConfirmTeacherStage';
import CurriculumStage from './components/CurriculumStage';
import StartClassesStage from './components/StartClassesStage';
import ClassesRunningStage from './components/ClassesRunningStage';
import PeriodResultsStage from './components/PeriodResultsStage';
import ControlExecutionStage from './components/ControlExecutionStage';
import IdentifyNeedStage from './components/IdentifyNeedStage';
import StageWorkspace from './components/StageWorkspace';
import WorkflowSteps from './components/WorkflowSteps';
import { findContactChecklistItem } from './stages/contactSearch';
import { hasEnteredControl, rememberControlEntered } from './stages/controlExecution';
import type { MeetingClosePlan } from './stages/firstMeeting';
import { documentClosePlan } from './stages/documentPackage';
import type { SignClosePlan } from './stages/signContract';
import type { SignLicensePlan } from './stages/signLicense';
import type { TransferClosePlan } from './stages/transferAccess';
import type { TrainClosePlan } from './stages/trainTeacher';
import type { ConfirmClosePlan } from './stages/confirmTeacher';
import type { CurriculumClosePlan } from './stages/curriculum';
import type { StartClosePlan } from './stages/startClasses';
import type { ClassesClosePlan } from './stages/classesRunning';
import type { PeriodClosePlan } from './stages/periodResults';
import { identifyClosePlan } from './stages/identifyNeed';
import { stageBlueprints, stageCodeOf } from './shared/stageBlueprints';
import { emptyActionText } from './backend/workflowBackendFieldGaps';


import styles from './WorkflowDetailPage.module.scss';

const seededStageComment = 'Текущий статус этапа подтверждён ответственным сотрудником';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const seesKam = user?.roles.some((role) => role === 'MANAGER' || role === 'ADMIN') ?? false;
  const [desk, setDesk] = useState<ProgramDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => searchParams.get('stage') === 'control' || hasEnteredControl(id) ? 'control' : '');
  const [controlEntered, setControlEntered] = useState(() => hasEnteredControl(id));
  const [checklist, setChecklist] = useState<DeskChecklistItem[]>([]);
  const [factsStageId, setFactsStageId] = useState('');
  const [stageBlockers, setStageBlockers] = useState<string[] | null>(null);
  const [closeHint, setCloseHint] = useState(false);
  const [meetingPlan, setMeetingPlan] = useState<MeetingClosePlan | null>(null);
  const [identifyPlan, setIdentifyPlan] = useState<ReturnType<typeof identifyClosePlan> | null>(null);
  const [packagePlan, setPackagePlan] = useState<ReturnType<typeof documentClosePlan> | null>(null);
  const [signPlan, setSignPlan] = useState<SignClosePlan | null>(null);
  const [licensePlan, setLicensePlan] = useState<SignLicensePlan | null>(null);
  const [transferPlan, setTransferPlan] = useState<TransferClosePlan | null>(null);
  const [trainPlan, setTrainPlan] = useState<TrainClosePlan | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<ConfirmClosePlan | null>(null);
  const [curriculumPlan, setCurriculumPlan] = useState<CurriculumClosePlan | null>(null);
  const [startPlan, setStartPlan] = useState<StartClosePlan | null>(null);
  const [runningPlan, setRunningPlan] = useState<ClassesClosePlan | null>(null);
  const [periodPlan, setPeriodPlan] = useState<(PeriodClosePlan & { early: boolean }) | null>(null);
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
    const entered = hasEnteredControl(id);
    const timer = window.setTimeout(() => {
      setControlEntered(entered);
      setSelectedId(entered || new URLSearchParams(window.location.search).get('stage') === 'control' ? 'control' : '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    const isControlSelected = selectedId === 'control';
    if (isControlSelected === (searchParams.get('stage') === 'control')) return;
    setSearchParams((current) => {
      if (isControlSelected) current.set('stage', 'control');
      else current.delete('stage');
      return current;
    }, { replace: true });
  }, [searchParams, selectedId, setSearchParams]);

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
    if (selectedId === 'control' || (stage && (
      stageCodeOf(stage.code, stage.name) === 'control'
      || stage.name.trim().toLowerCase() === 'контроль исполнения'
    ))) {
      const timer = window.setTimeout(() => {
        setChecklist([]);
        setComments([]);
        setFiles([]);
        setFactsStageId(selectedId);
      }, 0);
      return () => window.clearTimeout(timer);
    }
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
    const timer = window.setTimeout(() => {
      setStageBlockers(null);
      setCloseHint(false);
      setMeetingPlan(null);
      setIdentifyPlan(null);
      setPackagePlan(null);
      setSignPlan(null);
      setLicensePlan(null);
      setTransferPlan(null);
      setTrainPlan(null);
      setConfirmPlan(null);
      setCurriculumPlan(null);
      setStartPlan(null);
      setRunningPlan(null);
      setPeriodPlan(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  useEffect(() => {
    if (desk?.status === 'cancelled') rememberClosedProgram(desk.id);
  }, [desk?.id, desk?.status]);

  const publishBlockers = useCallback((labels: string[]) => {
    setStageBlockers((current) => (current?.join('\n') === labels.join('\n') ? current : labels));
  }, []);

  const publishPeriodPlan = useCallback((next: PeriodClosePlan & { early: boolean }) => {
    setPeriodPlan((current) => (current && current.enabled === next.enabled && current.early === next.early ? current : next));
  }, []);

  const publishRunningPlan = useCallback((next: ClassesClosePlan) => {
    setRunningPlan((current) => (current && current.enabled === next.enabled && current.mode === next.mode ? current : next));
  }, []);

  const publishStartPlan = useCallback((next: StartClosePlan) => {
    setStartPlan((current) => (current && current.enabled === next.enabled && current.button === next.button ? current : next));
  }, []);

  const publishCurriculumPlan = useCallback((next: CurriculumClosePlan) => {
    setCurriculumPlan((current) => (current && current.enabled === next.enabled && current.windowId === next.windowId ? current : next));
  }, []);

  const publishConfirmPlan = useCallback((next: ConfirmClosePlan) => {
    setConfirmPlan((current) => (current && current.enabled === next.enabled && current.windowId === next.windowId ? current : next));
  }, []);

  const publishTrainPlan = useCallback((next: TrainClosePlan) => {
    setTrainPlan((current) => (
      current && current.enabled === next.enabled && current.personId === next.personId && current.trainedOn === next.trainedOn && current.carrierId === next.carrierId && current.productId === next.productId
        ? current : next
    ));
  }, []);

  const publishTransferPlan = useCallback((next: TransferClosePlan) => {
    setTransferPlan((current) => (
      current && current.enabled === next.enabled && current.access === next.access && current.transferredOn === next.transferredOn && current.licenseId === next.licenseId && current.fileId === next.fileId
        ? current : next
    ));
  }, []);

  const publishLicensePlan = useCallback((next: SignLicensePlan) => {
    setLicensePlan((current) => (
      current && current.enabled === next.enabled && current.number === next.number && current.signedOn === next.signedOn && current.validUntil === next.validUntil && current.volume === next.volume && current.fileId === next.fileId
        ? current : next
    ));
  }, []);

  const publishSignPlan = useCallback((next: SignClosePlan) => {
    setSignPlan((current) => (
      current && current.enabled === next.enabled && current.button === next.button && current.number === next.number && current.signedOn === next.signedOn && current.validUntil === next.validUntil && current.signer === next.signer && current.fileId === next.fileId
        ? current
        : next
    ));
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

  const controlId = 'control';
  const isControlStage = (stage: ProgramDesk['stages'][number] | undefined) => Boolean(stage && (
    stageCodeOf(stage.code, stage.name) === 'control'
    || stage.name.trim().toLowerCase() === 'контроль исполнения'
  ));
  const serverControlStage = desk.stages.find(isControlStage);
  const controlStepIndex = desk.stages.filter((stage) => !isControlStage(stage)).length;
  const controlSelected = selectedId === controlId || selectedId === serverControlStage?.id;
  const onControl = controlEntered || desk.stageCode === 'control' || desk.currentStageId === serverControlStage?.id;
  const currentIndex = onControl ? controlStepIndex : Math.max(desk.stages.findIndex((stage) => stage.id === desk.currentStageId), 0);
  const selectedIndex = controlSelected ? controlStepIndex : Math.max(desk.stages.findIndex((stage) => stage.id === selectedId), 0);
  const selected = desk.stages[selectedIndex];
  const next = desk.stages[selectedIndex + 1];
  const previous = desk.stages[selectedIndex - 1];
  const isCurrent = !onControl && selected?.id === desk.currentStageId;
  const readOnly = false;
  const findContact = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'find_contact');
  const firstMeeting = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'first_meeting');
  const identifyNeed = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'identify_need');
  const documentPackage = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'document_package');
  const signContract = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'sign_contract');
  const signLicense = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'sign_license');
  const transferAccess = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'transfer_access');
  const trainTeacher = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'train_teacher');
  const confirmTeacher = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'confirm_teacher');
  const curriculum = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'curriculum');
  const startClasses = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'start_classes');
  const classesRunning = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'classes_running');
  const periodResults = Boolean(selected && stageCodeOf(selected.code, selected.name) === 'period_results');
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
  const closeReadyBanner = /можно закрыть|обязательные факты собраны/i.test(desk.banner);
  const showBanner = desk.banner !== emptyActionText
    && !licenseBanner
    && !closeReadyBanner
    && !(firstMeeting && factBanner)
    && !(identifyNeed && factBanner)
    && !(documentPackage && factBanner)
    && !(signContract && factBanner)
    && (!factBanner || showFactBanner);

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
      return true;
    } catch (reason) {
      message.error(errorText(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closeTraining = async () => {
    if (!trainPlan?.enabled || !trainPlan.personId || !trainPlan.productId || !trainPlan.trainedOn || !trainPlan.personName) return;
    const moved = await go(forward?.id);
    if (!moved || desk.id.startsWith('gap-')) return;
    const body = {
      product_id: trainPlan.productId,
      program_instance_id: desk.id,
      stakeholder_id: trainPlan.personId,
      full_name: trainPlan.personName,
      trained_on: trainPlan.trainedOn,
      qualification_until: trainPlan.qualificationUntil,
      status: trainPlan.status,
    };
    try {
      if (trainPlan.carrierId) await apiRequest(`/api/teachers/${trainPlan.carrierId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await apiRequest(`/api/organizations/${desk.organizationId}/teachers`, { method: 'POST', body: JSON.stringify(body) });
    } catch (reason) {
      message.error(errorText(reason));
    }
  };

  const closeTransfer = async () => {
    if (!transferPlan?.enabled || !transferPlan.licenseId || !transferPlan.transferredOn) return;
    const moved = await go(forward?.id);
    if (!moved || desk.id.startsWith('gap-')) return;
    try {
      await apiRequest(`/api/licenses/${transferPlan.licenseId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          transfer_status: 'transferred',
          product_access: transferPlan.access,
          transferred_on: transferPlan.transferredOn,
        }),
      });
    } catch (reason) {
      message.error(errorText(reason));
    }
  };

  const closeLicense = async () => {
    if (!licensePlan?.enabled || !licensePlan.fileId || !licensePlan.signedOn || !licensePlan.validUntil) return;
    const moved = await go(forward?.id);
    if (!moved || desk.id.startsWith('gap-')) return;
    try {
      await apiRequest(`/api/organizations/${desk.organizationId}/licenses`, {
        method: 'POST',
        body: JSON.stringify({
          program_instance_id: desk.id,
          license_number: licensePlan.number,
          signed_at: `${licensePlan.signedOn}T00:00:00Z`,
          valid_until: `${licensePlan.validUntil}T00:00:00Z`,
          attachment_id: licensePlan.fileId,
          comment: licensePlan.volume || null,
          transfer_status: 'not_transferred',
        }),
      });
    } catch (reason) {
      message.error(errorText(reason));
    }
  };

  const closeSignedContract = async () => {
    if (!signPlan?.enabled || !signPlan.fileId || !signPlan.signedOn) return;
    const moved = await go(forward?.id);
    if (!moved || desk.id.startsWith('gap-')) return;
    try {
      await apiRequest(`/api/organizations/${desk.organizationId}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          number: signPlan.number,
          signed_on: signPlan.signedOn,
          valid_until: signPlan.validUntil ? `${signPlan.validUntil}T00:00:00Z` : null,
          status: 'signed',
          attachment_id: signPlan.fileId,
          comment: signPlan.signer || null,
        }),
      });
    } catch (reason) {
      message.error(errorText(reason));
    }
  };

  const reopen = async () => {
    if (!selected || selected.id.startsWith('gap-') || desk.id.startsWith('gap-')) return;
    setBusy(true);
    try {
      await reopenProgramStage(desk.id, selected.id);
      await load();
      setSelectedId(selected.id);
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
      return true;
    } catch (reason) {
      message.error(errorText(reason));
      return false;
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
              steps={[
                ...desk.stages.filter((stage) => !isControlStage(stage)).map((stage) => ({ id: stage.id, title: stage.name, phase: stage.phase })),
                { id: controlId, title: 'Контроль исполнения', phase: serverControlStage?.phase ?? desk.stages.at(-1)?.phase },
              ]}
              currentStep={currentIndex}
              selectedStep={selectedIndex}
              mutedAfter={refusedAt >= 0 ? refusedAt : undefined}
              onStepChange={(index) => {
                const visibleStages = desk.stages.filter((stage) => !isControlStage(stage));
                setSelectedId(index >= visibleStages.length ? controlId : visibleStages[index].id);
              }}
            />
          </Card>
          <div className={styles.content}>
            {showBanner && <Alert type={desk.bannerTone === 'success' ? 'success' : desk.bannerTone === 'warning' ? 'warning' : 'info'} showIcon message={desk.banner} />}
            {controlSelected && (
              <Card className={styles.sectionCard}>
                <div className={styles.stageHeading}>
                  <h2>Контроль исполнения</h2>
                  <Tag className={desk.status === 'completed' ? styles.stageStatusCompleted : styles.stageStatusCurrent}>{desk.status === 'completed' ? 'Архив' : 'Активен'}</Tag>
                </div>
                <ControlExecutionStage
                  programId={desk.id}
                  organizationId={desk.organizationId}
                  archived={desk.status === 'completed'}
                  windowId={desk.windowId}
                  healthBand={desk.healthBand}
                  healthScore={desk.healthScore}
                  stages={desk.stages.map((stage) => ({ id: stage.id, name: stage.name, code: stage.code, status: stage.status, dueAt: stage.dueAt }))}
                  onOpenStage={(stageId) => { if (stageId) setSelectedId(stageId); }}
                />
              </Card>
            )}
            {selected && !controlSelected && (
              <Card className={styles.sectionCard}>
                <div className={styles.stageHeading}>
                  <h2>{selected.name}</h2>
                  <Tag className={refused ? styles.stageStatusUpcoming : isCurrent ? styles.stageStatusCurrent : selectedIndex < currentIndex || readOnly ? styles.stageStatusCompleted : styles.stageStatusUpcoming}>
                    {refused && selectedIndex === refusedAt ? 'Закрыт' : isCurrent && !refused ? 'Текущий' : selectedIndex < currentIndex || selected.status === 'completed' || (refused && selectedIndex < refusedAt) ? 'Пройден' : 'Впереди'}
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
                ) : periodResults ? (
                  <PeriodResultsStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly || desk.status === 'completed'}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishPeriodPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : classesRunning ? (
                  <ClassesRunningStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    windowTitle={desk.windowTitle}
                    healthLabel={`${desk.healthScore ?? '—'} · ${desk.healthBand}`}
                    dueAt={selected.dueAt}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onPlan={publishRunningPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : startClasses ? (
                  <StartClassesStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    programWindowId={desk.windowId}
                    planClosed={desk.stages.find((stage) => stageCodeOf(stage.code, stage.name) === 'curriculum')?.status === 'COMPLETED'}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishStartPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : curriculum ? (
                  <CurriculumStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    programWindowId={desk.windowId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishCurriculumPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : confirmTeacher ? (
                  <ConfirmTeacherStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    trainStageId={desk.stages.find((stage) => stageCodeOf(stage.code, stage.name) === 'train_teacher')?.id ?? null}
                    programWindowId={desk.windowId}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishConfirmPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : trainTeacher ? (
                  <TrainTeacherStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishTrainPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : transferAccess ? (
                  <TransferAccessStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishTransferPlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : signLicense ? (
                  <SignLicenseStage
                    key={selected.id}
                    stageId={selected.id}
                    programId={desk.id}
                    organizationId={desk.organizationId}
                    productName={desk.product}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishLicensePlan}
                    onUpload={async (file, kind) => {
                      const uploaded = await uploadStageFile(selected.id, file, kind);
                      const saved = { id: uploaded.id, fileId: uploaded.file_id, name: uploaded.original_name || file.name, kind: uploaded.attachment_kind ?? kind ?? null, sizeLabel: '' };
                      setFiles((current) => [...current.filter((entry) => entry.id !== saved.id), saved]);
                      return saved;
                    }}
                    onDeleteFile={async (file) => { await deleteStageFile(file.id); await refreshFacts(); }}
                  />
                ) : signContract ? (
                  <SignContractStage
                    key={selected.id}
                    stageId={selected.id}
                    organizationId={desk.organizationId}
                    packageStageId={desk.stages.find((stage) => stageCodeOf(stage.code, stage.name) === 'document_package')?.id ?? null}
                    dueAt={selected.dueAt}
                    ready={factsStageId === selected.id}
                    items={factsStageId === selected.id ? checklist : []}
                    files={files}
                    fallbackPeople={desk.people}
                    readOnly={readOnly}
                    onCommit={(item, patch) => { void changeItem(item, patch); }}
                    onPlan={publishSignPlan}
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
                    onUploadProject={async (file) => {
                      const packageStage = desk.stages.find((stage) => stageCodeOf(stage.code, stage.name) === 'document_package');
                      if (!packageStage) throw new Error('Этап пакета документов не найден');
                      await uploadStageFile(packageStage.id, file, 'project_contract');
                    }}
                    onDeleteFile={async (file) => {
                      await deleteStageFile(file.id);
                      await refreshFacts();
                    }}
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
                {missing.length > 0 && isCurrent && !firstMeeting && !identifyNeed && !documentPackage && !signContract && !signLicense && !transferAccess && !trainTeacher && !confirmTeacher && !curriculum && !startClasses && !classesRunning && !periodResults && (!findContact || closeHint) && <p className={styles.blockReason}>Закрытие заблокировано: {missing.join(', ')}</p>}
                <div className={styles.footerActions}>
                  {selectedIndex < currentIndex && !refused && desk.status !== 'completed' && <Button loading={busy} onClick={() => void reopen()}>Вернуться на этот этап</Button>}
                  {backward && isCurrent && <Button disabled={!(drafts[selected.id] ?? '').trim()} loading={busy} onClick={() => void go(backward.id)}>Вернуть к «{previous?.name}»</Button>}
                  {selected.optional && isCurrent && <Button loading={busy} onClick={() => void go(forward?.id, true)}>Пропустить</Button>}
                  <Button
                    type="primary"
                    style={periodResults && periodPlan?.early && periodPlan.enabled ? { background: '#f5c451', borderColor: '#f5c451', color: '#3d2e00' } : undefined}
                    disabled={periodResults ? false : refused || desk.status === 'completed' || (classesRunning ? !runningPlan?.enabled || !canMoveForward : startClasses ? !startPlan?.enabled || !canMoveForward : curriculum ? !curriculumPlan?.enabled || !canMoveForward : confirmTeacher ? !confirmPlan?.enabled || !canMoveForward : trainTeacher ? !trainPlan?.enabled || !canMoveForward : transferAccess ? !transferPlan?.enabled || !canMoveForward : signLicense ? !licensePlan?.enabled || !canMoveForward : signContract ? !signPlan?.enabled || !canMoveForward : documentPackage ? !packagePlan?.enabled || !canMoveForward : identifyNeed ? !identifyPlan?.enabled || !canMoveForward : firstMeeting ? !meetingPlan?.enabled || (meetingPlan.action === 'forward' && !canMoveForward) : findContact ? !canMoveForward || stageBlockers === null : !canClose)}
                    loading={periodResults ? false : busy}
                    onClick={() => {
                      if (firstMeeting && meetingPlan?.action === 'refuse') {
                        void refuse();
                        return;
                      }
                      if (periodResults) {
                        rememberControlEntered(desk.id);
                        setControlEntered(true);
                        setSelectedId(controlId);
                        return;
                      }
                      if (classesRunning || startClasses || curriculum) {
                        void go(forward?.id);
                        return;
                      }
                      if (confirmTeacher) {
                        void go(forward?.id);
                        return;
                      }
                      if (trainTeacher) {
                        void closeTraining();
                        return;
                      }
                      if (transferAccess) {
                        void closeTransfer();
                        return;
                      }
                      if (signLicense) {
                        void closeLicense();
                        return;
                      }
                      if (signContract) {
                        void closeSignedContract();
                        return;
                      }
                      if (!documentPackage && missing.length > 0) {
                        setCloseHint(true);
                        return;
                      }
                      void go(forward?.id);
                    }}
                  >
                    {refused ? 'Заход закрыт' : periodResults ? (periodPlan?.button ?? 'Перейти к контролю исполнения') : desk.status === 'completed' ? 'Заход завершён' : classesRunning ? (runningPlan?.button ?? 'Закрыть и перейти к итогам') : startClasses ? (startPlan?.button ?? 'Закрыть и перейти к ведению занятий') : curriculum ? (curriculumPlan?.button ?? 'Закрыть и перейти к старту занятий') : confirmTeacher ? (confirmPlan?.button ?? 'Закрыть и перейти к учебному плану') : trainTeacher ? (trainPlan?.button ?? 'Закрыть и перейти к подтверждению преподавателя') : transferAccess ? (transferPlan?.button ?? 'Закрыть и перейти к обучению преподавателя') : signLicense ? (licensePlan?.button ?? 'Закрыть и перейти к передаче и доступу') : signContract ? (signPlan?.button ?? 'Закрыть и перейти к подписанию лицензии') : documentPackage ? (packagePlan?.button ?? 'Закрыть и перейти к подписанию договора') : identifyNeed ? (identifyPlan?.button ?? 'Закрыть и перейти к пакету документов') : firstMeeting ? (meetingPlan?.button ?? 'Закрыть и перейти к выявлению потребности') : selected.final ? 'Завершить программу' : next ? `Закрыть и перейти к «${next.name}»` : 'Закрыть этап'}
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
