// Архив редактора этапов. Экран КАМа его не открывает: состав пути меняет руководитель в «Управлении».
import { PlusOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Card, Empty, Modal, Spin, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import WorkflowStepForm from './components/WorkflowStepForm';
import SortableWorkflowStepItem from './components/SortableWorkflowStepItem';
import type { WorkflowStepFormValues } from './components/WorkflowStepForm';
import {
  createWorkflowStepConfig,
  deleteWorkflowStepConfig,
  getWorkflowStepConfigs,
  loadWorkflowDetail,
  reorderWorkflowStepConfigs,
  updateWorkflowStepConfig,
} from './api';
import type { WorkflowStepConfig } from './types';

import styles from './WorkflowEditPage.module.scss';

const WorkflowEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const workflowId = Number(id);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadWorkflowDetail>>>();
  const [isLoading, setIsLoading] = useState(true);
  const [steps, setSteps] = useState<WorkflowStepConfig[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;

    loadWorkflowDetail(id)
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setDetail(loaded);
        setSteps(loaded.stepConfigs.length ? loaded.stepConfigs : getWorkflowStepConfigs(workflowId));
        setSelectedStepId(loaded.stepConfigs[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, workflowId]);
  const [mode, setMode] = useState<'create' | 'edit'>('edit');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedStep = useMemo(() => steps.find((step) => step.id === selectedStepId), [selectedStepId, steps]);
  const selectedStepNumber = Math.max(steps.findIndex((step) => step.id === selectedStepId) + 1, 1);

  if (isLoading) return <Spin size="large" />;
  if (!detail) return <Empty description="Workflow не найден" />;

  const confirmDiscard = (action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    Modal.confirm({
      title: 'Есть несохранённые изменения',
      content: 'Продолжить без сохранения изменений?',
      okText: 'Продолжить без сохранения',
      cancelText: 'Остаться',
      onOk: () => {
        setIsDirty(false);
        action();
      },
    });
  };

  const selectStep = (stepId: number) => {
    confirmDiscard(() => {
      setMode('edit');
      setSelectedStepId(stepId);
    });
  };

  const handleSave = (values: WorkflowStepFormValues) => {
    setIsSaving(true);
    window.setTimeout(() => {
      if (mode === 'create') {
        const created = createWorkflowStepConfig(workflowId, values);
        setSteps([...getWorkflowStepConfigs(workflowId)]);
        setSelectedStepId(created.id);
        setMode('edit');
        message.success('Этап создан');
      } else if (selectedStep) {
        updateWorkflowStepConfig(workflowId, { ...selectedStep, ...values });
        setSteps([...getWorkflowStepConfigs(workflowId)]);
        message.success('Изменения сохранены');
      }
      setIsDirty(false);
      setIsSaving(false);
      navigate(`/v2/workflows/${id}`);
    }, 300);
  };

  const handleDelete = () => {
    if (!selectedStep) return;
    Modal.confirm({
      title: `Удалить этап «${selectedStep.name}»?`,
      content: 'Этап будет удалён из конфигурации workflow.',
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => {
        deleteWorkflowStepConfig(workflowId, selectedStep.id);
        const nextSteps = [...getWorkflowStepConfigs(workflowId)];
        setSteps(nextSteps);
        setSelectedStepId(nextSteps[0]?.id ?? null);
        setIsDirty(false);
        message.success('Этап удалён');
      },
    });
  };

  const handleDragStart = ({ active }: DragStartEvent) => setActiveStepId(Number(active.id));

  const handleDragCancel = () => setActiveStepId(null);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveStepId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((step) => step.id === active.id);
    const newIndex = steps.findIndex((step) => step.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousSteps = [...steps];
    const reorderedSteps = [...steps];
    const [movedStep] = reorderedSteps.splice(oldIndex, 1);
    reorderedSteps.splice(newIndex, 0, movedStep);
    setSteps(reorderedSteps);

    try {
      reorderWorkflowStepConfigs(workflowId, reorderedSteps.map((step) => step.id));
      message.success('Порядок этапов сохранён');
    } catch {
      setSteps(previousSteps);
      message.error('Не удалось изменить порядок этапов');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link to="/v2/workflows">Воркфлоу</Link><span>›</span>
        <Link to={`/v2/workflows/${id}`}>{detail.item.universityShort}</Link><span>›</span>
        <span>Редактирование</span>
      </div>
      <header className={styles.header}>
        <div>
          <h1>Редактирование workflow</h1>
          <div className={styles.contextTags}>
            <Tag>Университет: <strong>{detail.item.universityShort}</strong></Tag>
            <Tag>ИТ-программа: <strong>{detail.item.program}</strong></Tag>
            <Tag>ИТ-продукт: <strong>{detail.item.product}</strong></Tag>
            <Tag>Период: <strong>{dayjs(detail.item.deadline).year()}</strong></Tag>
            <Tag>Ответственный: <strong>{detail.item.responsible}</strong></Tag>
          </div>
        </div>
      </header>
      <div className={styles.editorLayout}>
        <Card title="Этапы workflow" className={styles.stepListCard}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}>
            <SortableContext items={steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.stepList}>
                {steps.map((step, index) => (
                  <SortableWorkflowStepItem key={step.id} step={step} index={index} selected={mode === 'edit' && step.id === selectedStepId} onSelect={() => selectStep(step.id)} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeStepId !== null && (() => {
                const step = steps.find((entry) => entry.id === activeStepId);
                if (!step) return null;
                return <div className={styles.dragOverlay}><span className={styles.dragOverlayHandle}>⠿</span><span>{String(steps.findIndex((entry) => entry.id === step.id) + 1).padStart(2, '0')}</span><span>{step.name}</span></div>;
              })()}
            </DragOverlay>
          </DndContext>
          <Button block type="dashed" icon={<PlusOutlined />} onClick={() => confirmDiscard(() => { setMode('create'); setSelectedStepId(null); })}>Добавить этап</Button>
        </Card>
        <section className={styles.formPanel}>
          <div className={styles.formHeading}>
            <h2>{mode === 'create' ? 'Новый этап' : `${String(selectedStepNumber).padStart(2, '0')} · ${selectedStep?.name ?? ''}`}</h2>
            <span>{mode === 'create' ? 'Создание' : 'Редактирование'}</span>
          </div>
          <WorkflowStepForm mode={mode} step={selectedStep} onSave={handleSave} onCancel={() => confirmDiscard(() => navigate(`/v2/workflows/${id}`))} onDelete={mode === 'edit' ? handleDelete : undefined} isSaving={isSaving} onDirtyChange={setIsDirty} />
        </section>
      </div>
    </div>
  );
};

export default WorkflowEditPage;
