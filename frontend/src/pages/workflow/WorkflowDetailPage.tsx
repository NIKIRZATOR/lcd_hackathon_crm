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
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getWorkflowDetailMock, getWorkflowStepConfigs } from './mocks';
import type { WorkflowChecklistItem, WorkflowComment } from './types';
import WorkflowSteps from './components/WorkflowSteps';

import styles from './WorkflowDetailPage.module.scss';

const getInitials = (value: string) => value.replaceAll('.', '').split(' ').map((part) => part[0]).join('').slice(0, 2);

const WorkflowDetailPage = () => {
  const { id } = useParams();
  const workflowId = Number(id);
  const detail = getWorkflowDetailMock(Number(id));
  const [selectedStageId, setSelectedStageId] = useState(detail?.currentStageId ?? 1);
  const [checklistByStage, setChecklistByStage] = useState<Record<number, WorkflowChecklistItem[]>>(() => (
    detail?.stepConfigs.reduce<Record<number, WorkflowChecklistItem[]>>((result, config) => {
      result[config.id] = config.checklistItems.map((label, index) => ({ id: index + 1, label, completed: false }));
      return result;
    }, {}) ?? {}
  ));
  const [files, setFiles] = useState(detail?.files ?? []);
  const [comments, setComments] = useState(detail?.comments ?? []);
  const [commentText, setCommentText] = useState('');

  const selectedStage = useMemo(
    () => detail?.stages.find((stage) => stage.id === selectedStageId) ?? detail?.stages[0],
    [detail, selectedStageId],
  );
  const stepConfigs = detail ? getWorkflowStepConfigs(workflowId) : [];
  const selectedConfig = stepConfigs.find((step) => step.id === selectedStageId);
  const checklist = checklistByStage[selectedStageId] ?? selectedConfig?.checklistItems.map((label, index) => ({ id: index + 1, label, completed: false })) ?? [];

  if (!detail || !selectedStage) {
    return <Empty description="Workflow не найден" />;
  }

  const updateChecklist = (item: WorkflowChecklistItem, completed: boolean) => {
    setChecklistByStage((current) => ({
      ...current,
      [selectedStageId]: checklist.map((entry) => entry.id === item.id ? { ...entry, completed } : entry),
    }));
    message.success(completed ? 'Задача отмечена выполненной' : 'Задача возвращена в работу');
  };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;

    const comment: WorkflowComment = {
      id: Date.now(),
      author: 'Иванов И.И.',
      text,
      createdAt: dayjs().format('D MMMM YYYY, HH:mm'),
    };
    setComments((current) => [comment, ...current]);
    setCommentText('');
    message.success('Комментарий добавлен');
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      setFiles((current) => [...current, {
        id: Date.now(),
        name: file.name,
        type: file.type.split('/').at(-1)?.toUpperCase() ?? 'FILE',
        size: `${(file.size / 1024 / 1024).toFixed(1)} МБ`,
        uploadedAt: dayjs().format('DD.MM.YYYY, HH:mm'),
      }]);
      message.success(`Файл ${file.name} добавлен`);
      return false;
    },
    showUploadList: false,
  };

  const handleDownloadHistory = () => {
    const history = comments.map((comment) => `${comment.createdAt} — ${comment.author}: ${comment.text}`).join('\n');
    const blob = new Blob([history], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-${detail.item.id}-history.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNextStage = () => {
    const nextStage = detail.stages.find((stage) => stage.id === selectedStageId + 1);
    if (!nextStage) {
      message.success('Workflow завершён');
      return;
    }
    setSelectedStageId(nextStage.id);
    message.success(`Переход на этап «${nextStage.name}» выполнен`);
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
              currentStep={selectedStageId - 1}
              onStepChange={(index) => setSelectedStageId(index + 1)}
            />
            <Link className={styles.editStagesButton} to={`/workflow/${detail.item.id}/edit`}>
              <Button block icon={<EditOutlined />}>Редактировать этапы</Button>
            </Link>
          </Card>

          <main className={styles.content}>
            <Card className={styles.stageOverview}>
              <div className={styles.stageHeading}>
                <div>
                  <h2>{String(selectedStage.id).padStart(2, '0')} · {selectedStage.name}</h2>
                </div>
                <Tag className={`${styles.stageStatus} ${styles[`stageStatus${selectedStage.state[0].toUpperCase()}${selectedStage.state.slice(1)}`]}`}>
                  {selectedStage.state === 'completed' ? 'Завершено' : selectedStage.state === 'current' ? 'Текущий этап' : 'Следующий этап'}
                </Tag>
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
              <Upload {...uploadProps}><Button className={styles.addFileButton} type="dashed" icon={<PlusOutlined />}>Добавить файл</Button></Upload>
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
    </div>
  );
};

export default WorkflowDetailPage;