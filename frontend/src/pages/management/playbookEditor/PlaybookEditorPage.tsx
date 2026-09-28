import { DeleteOutlined, EllipsisOutlined, HolderOutlined, MoreOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Alert, Button, Card, Checkbox, Dropdown, Input, InputNumber, Modal, Radio, Select, Space, Switch, Tag, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { apiRequest } from '../../../api/client';
import PageLayout from '../../../components/pageLayout/PageLayout';
import { BLOCK_LIBRARY, DOC_TYPES, FACT_CATALOG, cloneDraft, cloneStage, emptyDraft, flattenStages, newBlock, normalizeDraft, uid } from './catalog';
import { mapPlaybookTemplateToDraft } from './fromTemplate';
import { mapDraftToPayload } from './payload';
import { SAMPLE_KAMS, SAMPLE_PLAYBOOKS } from './mocks';
import styles from './PlaybookEditorPage.module.scss';
import StagePreview from './StagePreview';
import { readDraft, writeDraft } from './storage';
import type { BlockKind, EditorStage, PlaybookDraft, PublishedPlaybook, StageBlock } from './types';
import { validatePlaybookDraft } from './validation';

const SortableStage = ({ stage, index, selected, tone, issues, locked, onSelect }: { stage: EditorStage; index: number; selected: boolean; tone: 'ok' | 'error' | 'warning'; issues: string[]; locked: boolean; onSelect: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id, disabled: locked });
  const title = stage.name.trim() || 'Новый этап';
  return (
    <div
      ref={setNodeRef}
      className={`${styles.stepRow} ${selected ? styles.stepSelected : ''} ${isDragging ? styles.stepDragging : ''} ${tone === 'error' ? styles.stepError : ''} ${tone === 'warning' ? styles.stepWarn : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
    >
      <button type="button" className={styles.dragHandle} disabled={locked} aria-label={`Переместить ${title}`} {...attributes} {...listeners}><HolderOutlined /></button>
      <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
      <Tooltip title={title}><span className={styles.stepName}>{title}</span></Tooltip>
      {tone !== 'ok' ? <Tooltip title={issues.join('. ')}><WarningOutlined /></Tooltip> : <span />}
    </div>
  );
};

const BLOCK_HINT: Record<BlockKind, string> = {
  fields: 'Готовые факты этапа без технических ключей',
  checklist: 'Пункты закрытия этапа',
  comment: 'Текстовый комментарий менеджера',
  confirm: 'Ручное подтверждение факта',
  document: 'Один семантический слот файла',
  documents: 'Несколько слотов документов',
  contact: 'Контакт площадки',
  contract: 'Реквизиты договора',
  license: 'Лицензия',
  access: 'Передача и доступ к продукту',
  teacher: 'Преподаватель-носитель',
  curriculum: 'План или согласование',
  lms: 'Показатели LMS текущего захода',
  site: 'Сигналы сайта площадки',
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={styles.field}><span className={styles.fieldLabel}>{label}</span>{children}</div>
);

const SortableBlock = ({ block, locked, onChange, onRemove }: { block: StageBlock; locked: boolean; onChange: (next: StageBlock) => void; onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id, disabled: locked });
  const kindTitle = BLOCK_LIBRARY.find((item) => item.kind === block.kind)?.title ?? 'Блок';
  const flag = (key: string, label: string) => (
    <Checkbox disabled={locked} checked={Boolean(block.flags?.[key])} onChange={(event) => onChange({ ...block, flags: { ...block.flags, [key]: event.target.checked } })}>{label}</Checkbox>
  );
  const emptyFields = block.kind === 'fields' && !(block.fields ?? []).length;
  const emptyDoc = block.kind === 'document' && block.required !== false && !block.docType;
  const emptyChecklist = block.kind === 'checklist' && !(block.items ?? []).length;
  return (
    <div ref={setNodeRef} className={styles.blockCard} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className={styles.blockHead}>
        <button type="button" className={styles.dragHandle} disabled={locked} aria-label="Переместить блок" {...attributes} {...listeners}><HolderOutlined /></button>
        <div className={styles.blockTitle}>
          <strong>{kindTitle}</strong>
          <span>{BLOCK_HINT[block.kind]}</span>
        </div>
        {!locked && (
          <Dropdown menu={{ items: [{ key: 'del', danger: true, label: 'Удалить блок', onClick: () => Modal.confirm({ title: 'Удалить блок?', okText: 'Удалить', cancelText: 'Оставить', onOk: onRemove }) }] }}>
            <Button type="text" icon={<MoreOutlined />} aria-label="Действия блока" />
          </Dropdown>
        )}
      </div>
      <Field label="Заголовок блока"><Input disabled={locked} value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} /></Field>
      {block.kind === 'fields' && (
        <>
          <Field label="Поля">
            <Select
              mode="multiple"
              disabled={locked}
              placeholder="Выберите поля..."
              value={(block.fields ?? []).map((item) => item.factId)}
              options={FACT_CATALOG.map((fact) => ({ value: fact.id, label: `${fact.group}: ${fact.label}` }))}
              onChange={(ids) => onChange({ ...block, fields: ids.map((id) => ({ factId: id, required: block.fields?.find((item) => item.factId === id)?.required ?? true })) })}
            />
          </Field>
          {emptyFields && <p className={styles.issue}>Добавьте хотя бы одно поле</p>}
          {(block.fields ?? []).length > 0 && (
            <div className={styles.flags}>
              {(block.fields ?? []).map((field) => (
                <Checkbox key={field.factId} disabled={locked} checked={field.required} onChange={(event) => onChange({ ...block, fields: (block.fields ?? []).map((item) => item.factId === field.factId ? { ...item, required: event.target.checked } : item) })}>
                  {FACT_CATALOG.find((fact) => fact.id === field.factId)?.label} обязательно
                </Checkbox>
              ))}
            </div>
          )}
        </>
      )}
      {block.kind === 'checklist' && (
        <>
          {(block.items ?? []).map((item) => (
            <div key={item.id} className={styles.checkRow}>
              <Input disabled={locked} value={item.text} placeholder="Текст пункта" onChange={(event) => onChange({ ...block, items: (block.items ?? []).map((row) => row.id === item.id ? { ...row, text: event.target.value } : row) })} />
              <Select disabled={locked} value={item.mode} options={[{ value: 'manual', label: 'Ручной' }, { value: 'auto', label: 'Автоматический' }]} onChange={(mode) => onChange({ ...block, items: (block.items ?? []).map((row) => row.id === item.id ? { ...row, mode, factId: mode === 'auto' ? row.factId : undefined } : row) })} />
              {item.mode === 'auto' && (
                <Select
                  allowClear
                  disabled={locked}
                  placeholder="Факт"
                  value={item.factId}
                  options={FACT_CATALOG.map((fact) => ({ value: fact.id, label: fact.label }))}
                  onChange={(factId) => onChange({ ...block, items: (block.items ?? []).map((row) => row.id === item.id ? { ...row, factId } : row) })}
                />
              )}
              <Checkbox disabled={locked} checked={item.required} onChange={(event) => onChange({ ...block, items: (block.items ?? []).map((row) => row.id === item.id ? { ...row, required: event.target.checked } : row) })}>Обязательный</Checkbox>
              {!locked && <Tooltip title="Удалить пункт"><Button type="text" icon={<DeleteOutlined />} aria-label="Удалить пункт" onClick={() => onChange({ ...block, items: (block.items ?? []).filter((row) => row.id !== item.id) })} /></Tooltip>}
            </div>
          ))}
          {emptyChecklist && <p className={styles.issue}>Добавьте хотя бы один пункт</p>}
          <p className={styles.hint}>Автопункт закроется на живом заходе, когда заполнен выбранный факт. В конструкторе это только настройка.</p>
          {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange({ ...block, items: [...(block.items ?? []), { id: uid(), text: 'Пункт', required: false, mode: 'manual' }] })}>Добавить пункт</Button>}
        </>
      )}
      {block.kind === 'comment' && (
        <>
          <Field label="Подсказка"><Input disabled={locked} placeholder="Опишите результат..." value={block.hint ?? ''} onChange={(event) => onChange({ ...block, hint: event.target.value })} /></Field>
          <div className={styles.toggle}><span>Обязательный</span><Switch disabled={locked} checked={Boolean(block.required)} onChange={(required) => onChange({ ...block, required })} /></div>
          <Field label="Минимальная длина">
            <InputNumber disabled={locked || !block.required} min={0} addonAfter="символов" value={block.minLength ?? null} onChange={(value) => onChange({ ...block, minLength: value ?? undefined })} />
          </Field>
        </>
      )}
      {block.kind === 'confirm' && <div className={styles.toggle}><span>Обязательное подтверждение</span><Switch disabled={locked} checked={Boolean(block.required)} onChange={(required) => onChange({ ...block, required })} /></div>}
      {block.kind === 'document' && (
        <>
          <Field label="Описание"><Input.TextArea disabled={locked} autoSize={{ minRows: 2, maxRows: 4 }} value={block.description ?? ''} placeholder="Приложите документ" onChange={(event) => onChange({ ...block, description: event.target.value })} /></Field>
          <Field label="Тип документа">
            <Select allowClear disabled={locked} placeholder="Тип документа" value={block.docType || undefined} options={DOC_TYPES.map((item) => ({ value: item.id, label: item.label }))} onChange={(value) => onChange({ ...block, docType: value ?? '' })} />
          </Field>
          {emptyDoc && <p className={styles.issue}>Укажите тип документа</p>}
          <div className={styles.toggle}><span>Обязательный</span><Switch disabled={locked} checked={block.required !== false} onChange={(required) => onChange({ ...block, required })} /></div>
          <Field label="Разрешённые форматы">
            <Select mode="multiple" disabled={locked} value={block.formats ?? []} options={['pdf', 'docx', 'xlsx', 'png'].map((item) => ({ value: item, label: item }))} onChange={(formats) => onChange({ ...block, formats })} />
          </Field>
          <Field label="Шаблон документа">
            {block.template ? <span className={styles.hint}>{block.template}</span> : <span className={styles.hint}>Файл не выбран</span>}
            {!locked && (
              <>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.png"
                  style={{ display: 'none' }}
                  id={`tpl-${block.id}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    onChange({ ...block, template: file?.name ?? '' });
                    event.target.value = '';
                  }}
                />
                <Button onClick={() => document.getElementById(`tpl-${block.id}`)?.click()}>{block.template ? 'Заменить шаблон' : 'Приложить шаблон'}</Button>
                {block.template && <Button onClick={() => onChange({ ...block, template: '' })}>Убрать</Button>}
              </>
            )}
          </Field>
        </>
      )}
      {block.kind === 'documents' && (
        <>
          {(block.slots ?? []).map((slot) => (
            <div key={slot.id} className={styles.slotRow}>
              <Input disabled={locked} value={slot.title} placeholder="Название слота" onChange={(event) => onChange({ ...block, slots: (block.slots ?? []).map((row) => row.id === slot.id ? { ...row, title: event.target.value } : row) })} />
              <Select allowClear disabled={locked} placeholder="Тип" value={slot.docType || undefined} options={DOC_TYPES.map((item) => ({ value: item.id, label: item.label }))} onChange={(value) => onChange({ ...block, slots: (block.slots ?? []).map((row) => row.id === slot.id ? { ...row, docType: value ?? '' } : row) })} />
              <Checkbox disabled={locked} checked={slot.required} onChange={(event) => onChange({ ...block, slots: (block.slots ?? []).map((row) => row.id === slot.id ? { ...row, required: event.target.checked } : row) })}>Обязательный</Checkbox>
              {!locked && <Tooltip title="Удалить слот"><Button type="text" icon={<DeleteOutlined />} aria-label="Удалить слот" onClick={() => onChange({ ...block, slots: (block.slots ?? []).filter((row) => row.id !== slot.id) })} /></Tooltip>}
            </div>
          ))}
          {block.kind === 'documents' && (block.slots ?? []).some((slot) => slot.required && !slot.docType) && <p className={styles.issue}>У обязательного слота нет типа документа</p>}
          {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange({ ...block, slots: [...(block.slots ?? []), { id: uid(), title: 'Документ', docType: '', required: true }] })}>Добавить слот</Button>}
        </>
      )}
      {['contact', 'contract', 'license', 'access', 'teacher', 'curriculum'].includes(block.kind) && (
        <div className={styles.flags}>
          <span className={styles.fieldLabel}>Требования</span>
          {block.kind === 'contact' && <>{flag('person', 'Основной контакт')}{flag('phone', 'Телефон / почта')}{flag('role', 'Роль')}</>}
          {block.kind === 'contract' && <>{flag('number', 'Номер')}{flag('date', 'Дата')}{flag('file', 'Файл')}</>}
          {block.kind === 'license' && <>{flag('number', 'Номер')}{flag('until', 'Срок')}{flag('file', 'Файл')}</>}
          {block.kind === 'access' && <>{flag('transfer', 'Статус передачи')}{flag('access', 'Доступ')}{flag('file', 'Акт передачи')}</>}
          {block.kind === 'teacher' && <>{flag('person', 'Человек')}{flag('product', 'Продукт')}{flag('trainedOn', 'Дата обучения')}{flag('status', 'Статус')}{flag('certificate', 'Сертификат')}</>}
          {block.kind === 'curriculum' && <>{flag('file', 'Файл плана')}{flag('comment', 'Комментарий')}</>}
        </div>
      )}
      {block.kind === 'lms' && <div className={styles.flags}><span className={styles.fieldLabel}>Что показывать</span>{flag('students', 'Студенты')}{flag('applications', 'Заявки')}{flag('signal', 'Последний сигнал')}</div>}
      {block.kind === 'site' && <div className={styles.flags}><span className={styles.fieldLabel}>Что показывать</span>{flag('signal', 'Последний сигнал сайта')}</div>}
    </div>
  );
};

const PlaybookEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const creating = !id || id === 'new';
  const [choice, setChoice] = useState(creating);
  const [draft, setDraft] = useState<PlaybookDraft>(() => readDraft(id && id !== 'new' ? id : '') ?? emptyDraft(id && id !== 'new' ? id : uid()));
  const [selectedId, setSelectedId] = useState(flattenStages(draft)[0]?.stage.id);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(draft.savedAt);
  const [playbooks, setPlaybooks] = useState<PublishedPlaybook[]>(SAMPLE_PLAYBOOKS);
  const [kams, setKams] = useState(SAMPLE_KAMS);
  const [sourceId, setSourceId] = useState<string>();
  const [rename, setRename] = useState<{ kind: 'phase' | 'stage' | 'addPhase'; id?: string; value: string } | null>(null);
  const [ready, setReady] = useState(creating || flattenStages(draft).length > 0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const locked = draft.status === 'published';
  const visible = flattenStages(draft);
  const selected = visible.find((item) => item.stage.id === selectedId)?.stage ?? null;
  const selectedPhaseId = visible.find((item) => item.stage.id === selectedId)?.phase.id;
  const validation = validatePlaybookDraft(draft);
  const issues = [...validation.errors, ...validation.warnings];
  const errors = validation.errors;


  useEffect(() => {
    apiRequest<Array<{ id: string; name: string; status: string }>>('/api/management/playbooks').then((rows) => {
      const published = rows.filter((row) => String(row.status).toLowerCase() === 'published').map((row) => ({ id: row.id, name: row.name, status: row.status }));
      if (published.length) setPlaybooks([...SAMPLE_PLAYBOOKS, ...published.filter((row) => !SAMPLE_PLAYBOOKS.some((item) => item.id === row.id))]);
    }).catch(() => undefined);
    apiRequest<Array<{ id: string; full_name?: string; name?: string }>>('/api/users?role=KAM').then((rows) => {
      if (rows.length) setKams(rows.map((row) => ({ id: row.id, name: row.full_name || row.name || row.id })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (choice || !id || id === 'new') {
      setReady(true);
      return;
    }
    const stored = readDraft(id);
    if (stored && flattenStages(stored).length > 0) {
      setDraft(stored);
      setSelectedId(flattenStages(stored)[0]?.stage.id);
      setReady(true);
      return;
    }
    const source = playbooks.find((item) => item.id === id) ?? { id, name: '', status: 'published' };
    let cancelled = false;
    void mapPlaybookTemplateToDraft(source, 'open').then((loaded) => {
      if (cancelled) return;
      const next = { ...loaded, id };
      setDraft(next);
      setSelectedId(flattenStages(next)[0]?.stage.id);
      setSavedAt(next.savedAt);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [choice, id, playbooks]);

  useEffect(() => {
    if (choice || !ready) return;
    const handle = window.setTimeout(() => {
      const at = new Date().toISOString();
      writeDraft({ ...draft, savedAt: at });
      setSavedAt(at);
    }, 800);
    return () => window.clearTimeout(handle);
  }, [choice, draft, ready]);

  const startBlank = () => {
    const next = emptyDraft(uid());
    writeDraft(next);
    setDraft(next);
    setSelectedId(undefined);
    setSavedAt(null);
    setChoice(false);
    navigate(`/management/playbooks/${next.id}`, { replace: true });
  };

  const startFrom = (source: PublishedPlaybook) => {
    void mapPlaybookTemplateToDraft(source, 'copy').then((next) => {
      writeDraft(next);
      setDraft(next);
      setSelectedId(flattenStages(next)[0]?.stage.id);
      setSavedAt(null);
      setChoice(false);
      navigate(`/management/playbooks/${next.id}`, { replace: true });
    });
  };

  const updateStage = (stageId: string, updater: (stage: EditorStage) => EditorStage) => {
    if (locked) return;
    setDraft((current) => normalizeDraft({
      ...current,
      phases: current.phases.map((phase) => ({ ...phase, stages: phase.stages.map((stage) => stage.id === stageId ? updater(stage) : stage) })),
    }));
  };

  const addStage = (phaseId?: string) => {
    if (locked) return;
    const stage: EditorStage = { id: uid(), name: 'Новый этап', description: '', order: 0, slaDays: null, canSkip: false, blocks: [] };
    setDraft((current) => {
      const phases = current.phases.length ? current.phases : [{ id: uid(), name: 'Основной путь', order: 0, stages: [] }];
      const targetId = phaseId && phases.some((phase) => phase.id === phaseId) ? phaseId : phases[0].id;
      return normalizeDraft({
        ...current,
        phases: phases.map((phase) => phase.id === targetId ? { ...phase, stages: [...phase.stages, stage] } : phase),
      });
    });
    setSelectedId(stage.id);
    setMode('edit');
  };

  const addPhase = () => {
    if (locked) return;
    setRename({ kind: 'addPhase', value: '' });
  };

  const renamePhase = (phaseId: string, currentName: string) => {
    if (locked) return;
    setRename({ kind: 'phase', id: phaseId, value: currentName });
  };

  const removePhase = (phaseId: string) => {
    if (locked) return;
    setDraft((current) => {
      if (current.phases.length < 2) {
        message.warning('Нельзя удалить последнюю фазу');
        return current;
      }
      const leftover = current.phases.find((phase) => phase.id !== phaseId);
      if (!leftover) return current;
      const moving = current.phases.find((phase) => phase.id === phaseId)?.stages ?? [];
      return normalizeDraft({
        ...current,
        phases: current.phases.filter((phase) => phase.id !== phaseId).map((phase) => phase.id === leftover.id ? { ...phase, stages: [...phase.stages, ...moving] } : phase),
      });
    });
  };

  const onStageDrag = (event: DragEndEvent) => {
    if (!event.over || locked) return;
    setDraft((current) => {
      const list = flattenStages(current);
      const from = list.findIndex((item) => item.stage.id === event.active.id);
      const to = list.findIndex((item) => item.stage.id === event.over?.id);
      if (from < 0 || to < 0 || from === to) return current;
      const targetPhaseId = list[to].phase.id;
      const moved = arrayMove(list, from, to);
      return normalizeDraft({
        ...current,
        phases: current.phases.map((phase) => ({
          ...phase,
          stages: moved.filter((item) => (item.stage.id === event.active.id ? targetPhaseId : item.phase.id) === phase.id).map((item) => item.stage),
        })),
      });
    });
  };

  const onBlockDrag = (event: DragEndEvent) => {
    if (!selectedId || !event.over || locked) return;
    setDraft((current) => normalizeDraft({
      ...current,
      phases: current.phases.map((phase) => ({
        ...phase,
        stages: phase.stages.map((stage) => {
          if (stage.id !== selectedId) return stage;
          const from = stage.blocks.findIndex((block) => block.id === event.active.id);
          const to = stage.blocks.findIndex((block) => block.id === event.over?.id);
          if (from < 0 || to < 0 || from === to) return stage;
          return { ...stage, blocks: arrayMove(stage.blocks, from, to) };
        }),
      })),
    }));
  };

  const duplicateStage = (stage: EditorStage) => {
    if (locked) return;
    const copy = cloneStage(stage, `${stage.name} (копия)`);
    setDraft((current) => normalizeDraft({
      ...current,
      phases: current.phases.map((phase) => ({
        ...phase,
        stages: phase.stages.flatMap((item) => item.id === stage.id ? [item, copy] : [item]),
      })),
    }));
    setSelectedId(copy.id);
  };

  const removeStage = (stageId: string) => {
    setDraft((current) => {
      const list = flattenStages(current);
      const index = list.findIndex((item) => item.stage.id === stageId);
      const next = normalizeDraft({
        ...current,
        phases: current.phases.map((phase) => ({ ...phase, stages: phase.stages.filter((stage) => stage.id !== stageId) })),
      });
      const nextList = flattenStages(next);
      setSelectedId((nextList[index] ?? nextList[index - 1])?.stage.id);
      return next;
    });
  };

  const publish = () => {
    if (validatePlaybookDraft(draft).errors.length) return;
    const payload = mapDraftToPayload(draft);
    void (async () => {
      const at = new Date().toISOString();
      const next = { ...draft, status: 'published' as const, savedAt: at };
      try {
        await apiRequest(`/api/management/playbooks/${draft.id}/versions/current/publish`, { method: 'POST', body: JSON.stringify(payload) });
        writeDraft(next);
        setDraft(next);
        message.success('Плейбук опубликован. Живые заходы не изменены.');
      } catch {
        writeDraft(next);
        setDraft(next);
        message.success('Опубликовано локально. Сервер публикации пока не отвечает.');
      }
      setSavedAt(at);
      setPublishOpen(false);
    })();
  };

  const newVersion = () => {
    void (async () => {
      let serverId: string | undefined;
      try {
        const created = await apiRequest<{ id: string }>(`/api/management/playbooks/${draft.id}/versions/draft`, { method: 'POST' });
        if (created.id && created.id !== draft.id) serverId = created.id;
      } catch {
        serverId = undefined;
      }
      const next = cloneDraft({
        ...draft,
        status: 'draft',
        basedOn: draft.name || draft.basedOn,
        sourceTemplateId: draft.id,
        savedAt: null,
      });
      next.id = serverId ?? uid();
      writeDraft(next);
      setDraft(next);
      setSavedAt(null);
      navigate(`/management/playbooks/${next.id}`, { replace: true });
      message.success(serverId ? 'Создан черновик новой версии' : 'Локальный черновик новой версии. Сервер версий пока не отвечает.');
    })();
  };

  if (!choice && !ready) {
    return <PageLayout><div className={styles.page}>Загрузка плейбука…</div></PageLayout>;
  }

  if (choice) {
    return (
      <PageLayout>
        <div className={styles.page}>
          <div className={styles.breadcrumbs}><Link to="/management">Управление</Link><span>›</span><span>Новый плейбук</span></div>
          <h1>Создать плейбук</h1>
          <div className={styles.choice}>
            <Card className={styles.choiceCard} title="Создать с нуля">
              <p className={styles.choiceBody}>Пустой плейбук без этапов. Фазы можно добавить сразу в редакторе.</p>
              <div className={styles.choiceActions}><Button type="primary" onClick={startBlank}>Открыть</Button></div>
            </Card>
            <Card className={styles.choiceCard} title="На основе существующего">
              <p className={styles.choiceBody}>Копия создаётся в статусе draft. Исходный плейбук не меняется.</p>
              <Select
                style={{ width: '100%' }}
                placeholder="Опубликованный плейбук"
                value={sourceId}
                options={playbooks.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(value) => setSourceId(value)}
              />
              <div className={styles.choiceActions}>
                <Button type="primary" disabled={!sourceId} onClick={() => { const source = playbooks.find((item) => item.id === sourceId); if (source) startFrom(source); }}>Открыть</Button>
              </div>
            </Card>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className={styles.page}>
        <div className={styles.breadcrumbs}><Link to="/management">Управление</Link><span>›</span><span>{draft.name || 'Плейбук'}</span></div>
        <div className={styles.header}>
          <Input size="large" disabled={locked} placeholder="Название плейбука" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          {!draft.name.trim() && <p className={styles.issue}>Укажите название плейбука</p>}
          <div className={styles.toolbar}>
            <Radio.Group value={mode} onChange={(event) => setMode(event.target.value)}>
              <Radio.Button value="edit">Настройка</Radio.Button>
              <Radio.Button value="preview">Предпросмотр</Radio.Button>
            </Radio.Group>
            <div className={styles.actions}>
              <Button disabled={locked} onClick={() => { const at = new Date().toISOString(); writeDraft({ ...draft, savedAt: at }); setSavedAt(at); message.success('Черновик сохранён'); }}>Сохранить черновик</Button>
              {locked ? <Button type="primary" onClick={newVersion}>Создать новую версию</Button> : <Button type="primary" onClick={() => setPublishOpen(true)}>Опубликовать</Button>}
            </div>
          </div>
          <Field label="Описание"><Input.TextArea disabled={locked} autoSize={{ minRows: 2, maxRows: 3 }} placeholder="Краткое описание" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></Field>
          <div className={styles.meta}>
            <div>На основе: <b>{draft.basedOn ?? 'с нуля'}</b></div>
            <div>Статус: <Tag>{draft.status === 'draft' ? 'Черновик' : draft.status === 'published' ? 'Опубликован' : 'Архив'}</Tag></div>
            <div>Доступ: <b>{draft.visibility.mode === 'all' ? 'Всем KAM' : 'Выбранным KAM'}</b></div>
            <div>Сохранено: <b>{savedAt ? dayjs(savedAt).format('HH:mm') : 'ещё нет'}</b></div>
          </div>
          <div className={styles.access}>
            <span className={styles.fieldLabel}>Доступ</span>
            <Radio.Group disabled={locked} value={draft.visibility.mode} onChange={(event) => setDraft((current) => ({ ...current, visibility: { ...current.visibility, mode: event.target.value } }))}>
              <Radio value="all">Всем KAM</Radio>
              <Radio value="selected">Выбранным KAM</Radio>
            </Radio.Group>
            {draft.visibility.mode === 'selected' && (
              <Select
                className={styles.accessSelect}
                mode="multiple"
                maxTagCount="responsive"
                disabled={locked}
                placeholder="Найти KAM"
                value={draft.visibility.kamIds}
                options={kams.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(kamIds) => setDraft((current) => ({ ...current, visibility: { ...current.visibility, kamIds } }))}
              />
            )}
          </div>
        </div>
        <div className={styles.layout}>
          <Card className={styles.side} title="Путь">
            {visible.length === 0 && <p className={styles.emptyPhase}>Этапов пока нет</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStageDrag}>
              <SortableContext items={visible.map((item) => item.stage.id)} strategy={verticalListSortingStrategy}>
                <div className={styles.stepList}>
                  {[...draft.phases].sort((left, right) => left.order - right.order).map((phase) => {
                    const rows = [...phase.stages].sort((left, right) => left.order - right.order);
                    return (
                      <div key={phase.id}>
                        <div className={styles.phase}>
                          <Tooltip title={phase.name}><span className={styles.phaseName}>{phase.name || 'Без названия'}</span></Tooltip>
                          {!locked && (
                            <Dropdown menu={{ items: [
                              { key: 'rename', label: 'Переименовать', onClick: () => renamePhase(phase.id, phase.name) },
                              { key: 'del', danger: true, label: 'Удалить', onClick: () => Modal.confirm({ title: 'Удалить фазу?', content: 'Этапы перейдут в соседнюю фазу.', okText: 'Удалить', cancelText: 'Оставить', onOk: () => removePhase(phase.id) }) },
                            ] }}>
                              <Button type="text" size="small" icon={<EllipsisOutlined />} aria-label={`Действия фазы ${phase.name}`} />
                            </Dropdown>
                          )}
                        </div>
                        {rows.length === 0 && <p className={styles.emptyPhase}>Пустая фаза</p>}
                        {rows.map((stage) => {
                          const local = validation.stageErrors[stage.id] ?? [];
                          const tone = local.some((item) => item.level === 'error') ? 'error' : local.length ? 'warning' : 'ok';
                          return <SortableStage key={stage.id} stage={stage} index={visible.findIndex((item) => item.stage.id === stage.id)} selected={stage.id === selectedId} tone={tone} issues={local.map((item) => item.text)} locked={locked} onSelect={() => setSelectedId(stage.id)} />;
                        })}
                        {!locked && <Button type="link" size="small" className={styles.addStage} icon={<PlusOutlined />} onClick={() => addStage(phase.id)}>Добавить этап</Button>}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {!locked && (
              <div className={styles.addRow}>
                <Button icon={<PlusOutlined />} onClick={addPhase}>Добавить фазу</Button>
                <Button icon={<PlusOutlined />} onClick={() => addStage()}>Добавить этап</Button>
              </div>
            )}
          </Card>
          <Card>
            {!selected && <Alert type="info" showIcon message="Выберите этап слева или добавьте новый." />}
            {selected && (
              <>
                <div className={styles.formHeading}>
                  <h2>{selected.name || 'Этап'}</h2>
                  <Space>
                    {mode === 'edit' && !locked && (
                      <Dropdown menu={{ items: [
                        { key: 'rename', label: 'Переименовать', onClick: () => setRename({ kind: 'stage', id: selected.id, value: selected.name }) },
                        { key: 'dup', label: 'Дублировать', onClick: () => duplicateStage(selected) },
                        { key: 'del', danger: true, label: 'Удалить', onClick: () => Modal.confirm({ title: 'Удалить этап?', okText: 'Удалить', cancelText: 'Оставить', onOk: () => removeStage(selected.id) }) },
                      ] }}>
                        <Button type="text" icon={<MoreOutlined />} aria-label="Действия этапа" />
                      </Dropdown>
                    )}
                  </Space>
                </div>
                {mode === 'preview' ? (
                  <StagePreview stage={selected} />
                ) : (
                  <div className={styles.stack}>
                    <Field label="Название">
                      <Input disabled={locked} value={selected.name} onChange={(event) => updateStage(selected.id, (stage) => ({ ...stage, name: event.target.value }))} />
                      {!selected.name.trim() && <p className={styles.issue}>Укажите название этапа</p>}
                    </Field>
                    <div className={styles.pair}>
                      <Field label="Фаза">
                        <Select disabled={locked} value={selectedPhaseId} options={draft.phases.map((phase) => ({ value: phase.id, label: phase.name || 'Без названия' }))} onChange={(phaseId) => setDraft((current) => {
                        const row = flattenStages(current).find((item) => item.stage.id === selected.id);
                        if (!row) return current;
                        return normalizeDraft({
                          ...current,
                          phases: current.phases.map((phase) => ({
                            ...phase,
                            stages: phase.id === phaseId
                              ? [...phase.stages.filter((stage) => stage.id !== selected.id), row.stage]
                              : phase.stages.filter((stage) => stage.id !== selected.id),
                          })),
                        });
                      })} />
                      </Field>
                      {selected.catalogCode !== 'control' && (
                      <Field label="SLA">
                        <InputNumber disabled={locked} min={1} addonAfter="дней" value={selected.slaDays} onChange={(value) => updateStage(selected.id, (stage) => ({ ...stage, slaDays: value ?? null }))} />
                      </Field>
                      )}
                    </div>
                    {selected.catalogCode === 'control'
                      ? <p className={styles.hint}>Постоянный контроль: этап не закрывается и не пропускается.</p>
                      : <div className={styles.toggle}><span>Этап можно пропустить</span><Switch disabled={locked} checked={selected.canSkip} onChange={(canSkip) => updateStage(selected.id, (stage) => ({ ...stage, canSkip }))} /></div>}
                    <Field label="Описание"><Input.TextArea disabled={locked} autoSize={{ minRows: 2, maxRows: 4 }} value={selected.description} onChange={(event) => updateStage(selected.id, (stage) => ({ ...stage, description: event.target.value }))} /></Field>
                    <h3 className={styles.sectionTitle}>Содержимое этапа</h3>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDrag}>
                      <SortableContext items={selected.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                        {selected.blocks.map((block) => (
                          <SortableBlock
                            key={block.id}
                            block={block}
                            locked={locked}
                            onChange={(next) => updateStage(selected.id, (stage) => ({ ...stage, blocks: stage.blocks.map((item) => item.id === next.id ? next : item) }))}
                            onRemove={() => updateStage(selected.id, (stage) => ({ ...stage, blocks: stage.blocks.filter((item) => item.id !== block.id) }))}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    {selected.blocks.length === 0 && <p className={styles.hint}>Добавьте блок из библиотеки.</p>}
                    {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => setLibraryOpen(true)}>Добавить блок</Button>}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
      <Modal title="Библиотека блоков" open={libraryOpen} onCancel={() => setLibraryOpen(false)} footer={null}>
        {['Основные', 'Документы', 'Бизнес-блоки', 'Интеграции'].map((group) => (
          <div key={group} className={styles.addRow}>
            <b>{group}</b>
            {BLOCK_LIBRARY.filter((item) => item.group === group).map((item) => (
              <Button key={item.kind} onClick={() => {
                if (!selected) return;
                updateStage(selected.id, (stage) => ({ ...stage, blocks: [...stage.blocks, newBlock(item.kind as BlockKind)] }));
                setLibraryOpen(false);
              }}>{item.title}</Button>
            ))}
          </div>
        ))}
      </Modal>
      <Modal title="Готовность к публикации" open={publishOpen} onCancel={() => setPublishOpen(false)} onOk={publish} okButtonProps={{ disabled: errors.length > 0 }} okText="Опубликовать">
        {issues.length === 0 && <Alert type="success" showIcon message="Плейбук готов к публикации." />}
        {issues.map((item, index) => <p key={`${item.level}-${item.stageId ?? 'playbook'}-${index}`} className={item.level === 'error' ? styles.issue : styles.hint}>{item.level === 'error' ? 'Ошибка' : 'Предупреждение'}: {item.text}</p>)}
        <p className={styles.hint}>После публикации прямое изменение закроется. Живые заходы останутся на своей версии.</p>
      </Modal>
      <Modal
        title={rename?.kind === 'addPhase' ? 'Новая фаза' : 'Переименовать'}
        open={Boolean(rename)}
        onCancel={() => setRename(null)}
        okText="Сохранить"
        onOk={() => {
          if (!rename || !rename.value.trim()) return;
          const name = rename.value.trim();
          if (rename.kind === 'addPhase') setDraft((current) => normalizeDraft({ ...current, phases: [...current.phases, { id: uid(), name, order: current.phases.length, stages: [] }] }));
          if (rename.kind === 'phase' && rename.id) setDraft((current) => ({ ...current, phases: current.phases.map((phase) => phase.id === rename.id ? { ...phase, name } : phase) }));
          if (rename.kind === 'stage' && rename.id) updateStage(rename.id, (stage) => ({ ...stage, name }));
          setRename(null);
        }}
      >
        <Input value={rename?.value ?? ''} onChange={(event) => setRename((current) => current ? { ...current, value: event.target.value } : current)} placeholder="Название" />
      </Modal>
    </PageLayout>
  );
};

export default PlaybookEditorPage;