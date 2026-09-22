import {
  ArrowRightOutlined,
  CalendarOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  MoreOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { advanceWorkflowStage, addWorkflowStageComment, addWorkflowStageFile, getWorkflow, getWorkflowStageActivity, getWorkflowStepConfigs, moveWorkflowToStage } from './api';
import { transitionToNextStage, transitionToStage, type StageTransition } from './stageTransition';
import type { WorkflowChecklistItem } from './types';
import { isAllowedWorkflowFile, workflowFileRejectionMessage, workflowFileTypeLabel } from './workflowFiles';
import WorkflowSteps from './components/WorkflowSteps';

import styles from './WorkflowDetailPage.module.scss';

const getInitials = (value: string) => value.replaceAll('.', '').split(' ').map((part) => part[0]).join('').slice(0, 2);

const WorkflowDetailPage = () => {
  const { id } = useParams();
  const workflowId = Number(id);
  const detail = getWorkflow(Number(id));
  const [viewedStageId, setViewedStageId] = useState<number | null>(null);
  // Мок меняется вне React. Счётчик перечитывает карточку, когда id этапа тот же
  // или когда добавились комментарий и файл.
  const [, setStageRevision] = useState(0);
  const [checklistByStage, setChecklistByStage] = useState<Record<number, WorkflowChecklistItem[]>>(() => (
    detail?.stepConfigs.reduce<Record<number, WorkflowChecklistItem[]>>((result, config) => {
      result[config.id] = config.checklistItems.map((label, index) => ({ id: index + 1, label, completed: false }));
      return result;
    }, {}) ?? {}
  ));
  const [commentText, setCommentText] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [pendingTransition, setPendingTransition] = useState<(StageTransition & { mode: 'next' | 'set' }) | null>(null);

  const viewedStage = detail?.stages.find((stage) => stage.id === viewedStageId)
    ?? detail?.stages.find((stage) => stage.state === 'current')
    ?? detail?.stages.at(-1);
  const viewedStageIndex = detail && viewedStage ? detail.stages.findIndex((stage) => stage.id === viewedStage.id) : -1;
  const currentStageIndex = detail?.stages.findIndex((stage) => stage.state === 'current') ?? -1;
  const stepConfigs = detail ? getWorkflowStepConfigs(workflowId) : [];
  const selectedConfig = stepConfigs.find((step) => step.id === viewedStage?.id);
  const checklist = viewedStage
    ? checklistByStage[viewedStage.id] ?? selectedConfig?.checklistItems.map((label, index) => ({ id: index + 1, label, completed: false })) ?? []
    : [];
  const stageActivity = detail && viewedStage
    ? getWorkflowStageActivity(workflowId, viewedStage.id, detail.currentStageId)
    : { files: [], comments: [] };
  const { files, comments } = stageActivity;

  if (!detail || !viewedStage || viewedStageIndex < 0) {
    return <Empty description="Workflow не найден" />;
  }

  const updateChecklist = (item: WorkflowChecklistItem, completed: boolean) => {
    setChecklistByStage((current) => ({
      ...current,
      [viewedStage.id]: checklist.map((entry) => entry.id === item.id ? { ...entry, completed } : entry),
    }));
    message.success(completed ? 'Задача отмечена выполненной' : 'Задача возвращена в работу');
  };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;

    addWorkflowStageComment(workflowId, viewedStage.id, detail.currentStageId, {
      author: detail.item.responsible,
      text,
      createdAt: dayjs().format('D MMMM YYYY, HH:mm'),
    });
    setCommentText('');
    setStageRevision((revision) => revision + 1);
    message.success('Комментарий добавлен');
  };

  const handleBeforeUpload = (file: File) => {
    if (!isAllowedWorkflowFile(file.name)) {
      message.error(workflowFileRejectionMessage);
      return Upload.LIST_IGNORE;
    }

    addWorkflowStageFile(workflowId, viewedStage.id, detail.currentStageId, {
      name: file.name,
      type: workflowFileTypeLabel(file.name),
      size: `${(file.size / 1024 / 1024).toFixed(1)} МБ`,
      uploadedAt: dayjs().format('DD.MM.YYYY, HH:mm'),
    });
    setStageRevision((revision) => revision + 1);
    message.success(`Файл ${file.name} добавлен`);
    return false;
  };

  const handleDownloadHistory = () => {
    const history = detail.stages.flatMap((stage) => (
      getWorkflowStageActivity(workflowId, stage.id, detail.currentStageId).comments.map(
        (comment) => `${stage.name} — ${comment.createdAt} — ${comment.author}: ${comment.text}`,
      )
    )).join('\n');
    const blob = new Blob([history], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-${detail.item.id}-history.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNextStage = () => {
    const preview = transitionToNextStage(stepConfigs, detail.item.stage, detail.item.status, detail.item.progress);

    if (!preview) {
      message.error('Не удалось перейти на следующий этап');
      return;
    }

    if (!preview.changed) {
      message.success('Workflow уже завершён');
      return;
    }

    setTransitionComment('');
    setPendingTransition({ ...preview, mode: 'next' });
  };

  const handleMakeCurrent = () => {
    const preview = transitionToStage(stepConfigs, detail.item.stage, detail.item.status, detail.item.progress, viewedStage.id);

    if (!preview) {
      message.error('Не удалось сменить этап');
      return;
    }

    if (!preview.changed) {
      message.info('Этот этап уже текущий');
      return;
    }

    setTransitionComment('');
    setPendingTransition({ ...preview, mode: 'set' });
  };

  const closeTransition = () => {
    setPendingTransition(null);
    setTransitionComment('');
  };

  const confirmTransition = () => {
    if (!pendingTransition) return;

    const transition = pendingTransition.mode === 'set'
      ? moveWorkflowToStage(workflowId, pendingTransition.stageId)
      : advanceWorkflowStage(workflowId);

    if (!transition?.changed) {
      message.error(pendingTransition.mode === 'set' ? 'Не удалось сменить этап' : 'Не удалось перейти на следующий этап');
      closeTransition();
      return;
    }

    const text = transitionComment.trim();
    if (text) {
      addWorkflowStageComment(workflowId, transition.stageId, transition.stageId, {
        author: detail.item.responsible,
        text,
        createdAt: dayjs().format('D MMMM YYYY, HH:mm'),
      });
    }

    const mode = pendingTransition.mode;
    closeTransition();
    setViewedStageId(transition.stageId);
    setStageRevision((revision) => revision + 1);
    message.success(
      transition.completed
        ? 'Workflow завершён'
        : mode === 'set'
          ? `Текущий этап — «${transition.stageName}»`
          : `Переход на этап «${transition.stageName}» выполнен`,
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link to="/workflow">Workflow</Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span className={styles.breadcrumbCurrent}>
          {detail.item.universityShort} {detail.item.program}
        </span>
      </div>

      <header className={styles.heading}>
        <div className={styles.contextTags}>
          <Tag icon={<UserOutlined />}>
            Университет: <strong>{detail.item.universityShort}</strong>
          </Tag>
          <Tag>
            ИТ-программа: <strong>{detail.item.program}</strong>
          </Tag>
          <Tag>
            ИТ-продукт: <strong>{detail.item.product}</strong>
          </Tag>
          <Tag icon={<CalendarOutlined />}>
            Период: <strong>{dayjs(detail.item.deadline).year()}</strong>
          </Tag>
          <Tag>
            Ответственный: <strong>{detail.item.responsible}</strong>
          </Tag>
        </div>
      </header>

        <div className={styles.layout}>
          <Card className={styles.stageCard} title="Этапы">
            <WorkflowSteps
              steps={detail.stages.map((stage) => ({ id: stage.id, title: stage.name }))}
              currentStep={currentStageIndex === -1 ? detail.stages.length : currentStageIndex}
              selectedStep={viewedStageIndex}
              onStepChange={(_index, step) => {
                setViewedStageId(Number(step.id));
                setCommentText('');
              }}
            />
            <Link className={styles.editStagesButton} to={`/workflow/${detail.item.id}/edit`}>
              <Button block icon={<EditOutlined />}>Редактировать этапы</Button>
            </Link>
          </Card>

          <main className={styles.content}>
            <Card className={styles.stageOverview}>
              <div className={styles.stageHeading}>
                <div>
                  <h2>{String(viewedStageIndex + 1).padStart(2, '0')} · {viewedStage.name}</h2>
                </div>
                <div className={styles.stageActions}>
                  <Tag className={`${styles.stageStatus} ${styles[`stageStatus${viewedStage.state[0].toUpperCase()}${viewedStage.state.slice(1)}`]}`}>
                    {viewedStage.state === 'completed' ? 'Завершено' : viewedStage.state === 'current' ? 'Текущий этап' : 'Следующий этап'}
                  </Tag>
                  {viewedStage.state !== 'current' && (
                    <Button onClick={handleMakeCurrent}>Сделать текущим</Button>
                  )}
                </div>
              </div>
              <div className={styles.metaGrid}>
                <div className={styles.metaTile}>
                  <span className={styles.metaLabel}>Ответственный</span>
                  <Space><Avatar size="small">{getInitials(detail.item.responsible)}</Avatar><strong>{detail.item.responsible}</strong></Space>
                </div>
                <div className={styles.metaTile}>
                  <span className={styles.metaLabel}>Срок</span>
                  <strong><CalendarOutlined /> {dayjs(detail.item.deadline).format('D MMMM YYYY')}</strong>
                </div>
              </div>
              {selectedConfig?.description && (
                <div className={styles.stageDescription}>
                  <p>{selectedConfig.description}</p>
                </div>
              )}
            </Card>

            <Card className={styles.sectionCard} title="Чек-лист" extra={<span>{checklist.filter((item) => item.completed).length} / {checklist.length}</span>}>
              <List
                dataSource={checklist}
                renderItem={(item) => (
                  <List.Item>
                    <Checkbox checked={item.completed} onChange={(event) => updateChecklist(item, event.target.checked)}>{item.label}</Checkbox>
                    <span className={styles.itemDate}>{item.date ?? '—'}</span>
                  </List.Item>
                )}
              />
            </Card>

            <Card className={styles.sectionCard} title="Файлы" extra={<span>{files.length} {files.length === 1 ? 'файл' : 'файла'}</span>}>
              <List
                dataSource={files}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Файлов пока нет" /> }}
                renderItem={(file) => (
                  <List.Item actions={[<Button key="download" type="text" icon={<DownloadOutlined />} onClick={() => message.info(`Скачивание ${file.name}`)} />, <Button key="more" type="text" icon={<MoreOutlined />} />]}>
                    <List.Item.Meta avatar={<Avatar shape="square" className={styles.fileIcon} icon={<FilePdfOutlined />} />} title={file.name} description={`${file.type} · ${file.size} · ${file.uploadedAt}`} />
                  </List.Item>
                )}
              />
              <Upload accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx" beforeUpload={handleBeforeUpload} showUploadList={false}>
                <Button className={styles.addFileButton} type="dashed" icon={<PlusOutlined />}>Добавить файл</Button>
              </Upload>
            </Card>

            <Card className={styles.sectionCard} title="Комментарии">
              <div className={styles.commentComposer}>
                <Avatar>{getInitials(detail.item.responsible)}</Avatar>
                <Input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Добавить комментарий..." onPressEnter={handleAddComment} />
                <Tooltip title="Добавить комментарий">
                  <Button className={styles.commentSubmit} aria-label="Добавить комментарий" type="primary" icon={<SendOutlined />} onClick={handleAddComment} disabled={!commentText.trim()} />
                </Tooltip>
              </div>
              {comments.length > 0 && (
                <List
                  dataSource={comments}
                  renderItem={(comment) => <List.Item><List.Item.Meta avatar={<Avatar>{getInitials(comment.author)}</Avatar>} title={<Space>{comment.author}<span className={styles.commentDate}>{comment.createdAt}</span></Space>} description={comment.text} /></List.Item>}
                />
              )}
            </Card>

            <div className={styles.footerActions}>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadHistory}><span className={styles.actionLabelLong}>Скачать историю взаимодействий</span><span className={styles.actionLabelShort}>Скачать</span></Button>
              <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" onClick={handleNextStage}><span className={styles.actionLabelLong}>Перейти к следующему этапу</span><span className={styles.actionLabelShort}>Следующий этап</span></Button>
            </div>
          </main>
        </div>
      <Modal
        open={pendingTransition !== null}
        title={pendingTransition?.mode === 'set' ? `Текущий этап — «${pendingTransition.stageName}»` : pendingTransition?.completed ? 'Завершение workflow' : `Переход на этап «${pendingTransition?.stageName ?? ''}»`}
        okText={pendingTransition?.mode === 'set' ? 'Сделать текущим' : pendingTransition?.completed ? 'Завершить' : 'Перейти'}
        cancelText="Отмена"
        onOk={confirmTransition}
        onCancel={closeTransition}
      >
        <Input.TextArea
          value={transitionComment}
          onChange={(event) => setTransitionComment(event.target.value)}
          placeholder="Комментарий к переходу"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={1000}
        />
      </Modal>
    </div>
  );
};

export default WorkflowDetailPage;