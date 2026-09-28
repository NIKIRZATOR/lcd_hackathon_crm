import { DeleteOutlined, DownloadOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { Avatar, Button, DatePicker, Input, List, Modal, Select, Upload, message } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { createStakeholder } from '../../organizations/api';
import { stakeholderRoles } from '../../organizations/screenModel';
import { apiDownload } from '../../../api/client';
import type { DeskChecklistItem, DeskFile } from '../api';
import { stageBlueprints, stageCodeOf } from '../shared/stageBlueprints';
import { isAllowedWorkflowFile, workflowFileRejectionMessage } from '../shared/workflowFiles';

import styles from '../WorkflowDetailPage.module.scss';

type Person = { id: string; name: string; role: string; roleCode: string };

type StageWorkspaceProps = {
  stageCode?: string;
  stageName: string;
  items: DeskChecklistItem[];
  files: DeskFile[];
  people: Person[];
  organizationId: string;
  students: number;
  license: string;
  readOnly: boolean;
  onChange: (item: DeskChecklistItem, patch: Record<string, unknown>) => void;
  onUpload: (file: File, kind: string | null) => Promise<DeskFile | void>;
  onDeleteFile: (file: DeskFile) => Promise<void>;
  onPersonAdded: (person: Person) => void;
};

const StageWorkspace = ({ stageCode, stageName, items, files, people, organizationId, students, license, readOnly, onChange, onUpload, onDeleteFile, onPersonAdded }: StageWorkspaceProps) => {
  const code = stageCodeOf(stageCode, stageName);
  const blueprint = stageBlueprints[code];
  const aside = blueprint?.aside ?? 'none';
  const [open, setOpen] = useState(false);
  const [roleCode, setRoleCode] = useState('other');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const addPerson = async () => {
    if (!name.trim()) return;
    if (organizationId.startsWith('gap-')) {
      onPersonAdded({ id: `gap-person-${Date.now()}`, name: name.trim(), role: roleCode, roleCode });
      setOpen(false);
      setName('');
      return;
    }
    const created = await createStakeholder(organizationId, { roleCode, name, position: '', email, phone, isPrimary: false }) as { id: string; full_name: string; role_code: string };
    onPersonAdded({ id: created.id, name: created.full_name || name.trim(), role: created.role_code || roleCode, roleCode: created.role_code || roleCode });
    message.success('Контакт добавлен');
    setOpen(false);
    setName('');
  };

  return (
    <div className={styles.facts}>
      {blueprint && <p className={styles.subtitle}>{blueprint.note}</p>}
      {items.map((item) => (
        <div key={item.id} className={styles.fact}>
          <span className={item.required && !item.done ? styles.requiredItem : undefined}>
            {item.label}
            {item.required && !item.done && <span className={styles.requiredMark}>обязательно</span>}
          </span>
          {item.itemType === 'date' && (
            <DatePicker
              disabled={readOnly}
              style={{ width: '100%' }}
              value={item.valueDate ? dayjs(item.valueDate) : null}
              onChange={(value) => onChange(item, { value_date: value?.format('YYYY-MM-DD') ?? null, is_done: Boolean(value) })}
            />
          )}
          {item.itemType === 'text' && (
            <Input.TextArea
              disabled={readOnly}
              value={item.valueText ?? ''}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder={item.code === 'meeting_protocol' ? 'Не короче 40 символов' : ''}
              onChange={(event) => onChange(item, { value_text: event.target.value, is_done: event.target.value.trim().length >= (item.code === 'meeting_protocol' ? 40 : 1), defer: true })}
              onBlur={(event) => onChange(item, { value_text: event.target.value, is_done: event.target.value.trim().length >= (item.code === 'meeting_protocol' ? 40 : 1) })}
            />
          )}
          {item.itemType === 'stakeholder_role' && (
            <div className={styles.factRow}>
              <Select
                disabled={readOnly}
                style={{ flex: 1 }}
                placeholder="Выберите человека площадки"
                value={item.stakeholderId}
                options={people.filter((person) => !item.role || item.role === 'other' || person.roleCode === item.role).map((person) => ({ value: person.id, label: `${person.name} · ${person.role}` }))}
                onChange={(value) => onChange(item, { stakeholder_id: value, is_done: true })}
              />
              <Button disabled={readOnly} onClick={() => { setRoleCode(item.role && item.role !== 'other' ? item.role : 'other'); setOpen(true); }}>Добавить контакт</Button>
            </div>
          )}
          {item.itemType === 'file' && (
            <div className={styles.fileSlot}>
              {files.some((file) => file.fileId === item.attachmentId || (item.attachmentKind && file.kind === item.attachmentKind)) && (
              <List
                dataSource={files.filter((file) => file.fileId === item.attachmentId || (item.attachmentKind && file.kind === item.attachmentKind))}
                renderItem={(file) => (
                  <List.Item
                    actions={[
                      <Button key="download" type="text" icon={<DownloadOutlined />} aria-label="Скачать" onClick={() => void apiDownload(`/api/workflows/attachments/${file.id}/download`).then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = file.name;
                        link.click();
                        URL.revokeObjectURL(url);
                      })} />,
                      !readOnly && <Button key="delete" type="text" danger icon={<DeleteOutlined />} aria-label="Удалить" onClick={() => void onDeleteFile(file)} />,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta avatar={<Avatar shape="square" className={styles.fileIcon} icon={<FilePdfOutlined />} />} title={file.name} description={[file.kind, file.sizeLabel].filter(Boolean).join(' · ')} />
                  </List.Item>
                )}
              />
              )}
              <Upload
                accept=".png,.jpeg,.jpg,.pdf,.zip,.gz,.gzip,.rar,.doc,.docx,.xls,.xlsx"
                showUploadList={false}
                disabled={readOnly}
                beforeUpload={(file) => {
                  if (!isAllowedWorkflowFile(file.name)) {
                    message.error(workflowFileRejectionMessage);
                    return false;
                  }
                  void (async () => {
                    try {
                      const uploaded = await onUpload(file, item.attachmentKind);
                      if (uploaded?.fileId) onChange(item, { attachment_id: uploaded.fileId, is_done: true });
                    } catch {
                      message.error('Не удалось приложить файл');
                    }
                  })();
                  return Upload.LIST_IGNORE;
                }}
              >
                <Button className={styles.addFileButton} type="dashed" icon={<PlusOutlined />} disabled={readOnly}>Добавить файл</Button>
              </Upload>
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && code === 'classes_running' && <p className={styles.subtitle}>Отдельного чеклиста нет: этап живёт, пока идёт учебное окно.</p>}
      {aside === 'people' && (
        <div className={styles.aside}>
          <strong>Люди площадки</strong>
          {people.length === 0 ? <span>Контактов пока нет</span> : people.map((person) => <span key={person.id}>{person.name} · {person.role}</span>)}
          {!organizationId.startsWith('gap-') && <Link to={`/organizations/${organizationId}?section=people`}>Открыть раздел вуза</Link>}
        </div>
      )}
      {aside === 'license' && (
        <div className={styles.aside}>
          <strong>Лицензия и договор</strong>
          <span>{license}</span>
          {!organizationId.startsWith('gap-') && <Link to={`/organizations/${organizationId}?section=contracts`}>Открыть раздел вуза</Link>}
        </div>
      )}
      {aside === 'lms' && (
        <div className={styles.aside}>
          <strong>Сигнал LMS</strong>
          <span>{students} студентов. Сигнал подсказывает, но этап сам не закрывает.</span>
        </div>
      )}
      <Modal open={open} title="Контакт площадки" okText="Добавить" cancelText="Отмена" onCancel={() => setOpen(false)} onOk={() => void addPerson()}>
        <div className={styles.facts}>
          <Select value={roleCode} options={stakeholderRoles.map((role) => ({ value: role.value, label: role.label }))} onChange={setRoleCode} />
          <Input placeholder="ФИО" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Input placeholder="Почта" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
      </Modal>
    </div>
  );
};

export default StageWorkspace;
