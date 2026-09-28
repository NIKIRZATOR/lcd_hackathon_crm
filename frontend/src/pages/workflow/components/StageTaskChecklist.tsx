import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Checkbox, Input, Popconfirm } from 'antd';
import { useState } from 'react';

import type { CustomChecklistItem } from '../contactSearch';

import styles from './ContactSearchStage.module.scss';

export type StageSystemTask = {
  id: string;
  label: string;
  done: boolean;
  required?: boolean;
};

type StageTaskChecklistProps = {
  system: StageSystemTask[];
  custom: CustomChecklistItem[];
  readOnly?: boolean;
  onReorder: (order: string[]) => void;
  onAdd: (label: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
};

const TaskRow = ({
  id,
  label,
  done,
  required,
  system,
  reorder,
  readOnly,
  renaming,
  onStartRename,
  onRenameDraft,
  onRenameCommit,
  onToggle,
  onDelete,
}: {
  id: string;
  label: string;
  done: boolean;
  required?: boolean;
  system: boolean;
  reorder: boolean;
  readOnly?: boolean;
  renaming: string | null;
  onStartRename: () => void;
  onRenameDraft: (value: string) => void;
  onRenameCommit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !reorder });
  return (
    <div ref={setNodeRef} className={`${styles.row} ${isDragging ? styles.rowDragging : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      {reorder && (
        <button type="button" className={styles.handle} aria-label={`Переместить «${label}»`} {...attributes} {...listeners}>
          <HolderOutlined />
        </button>
      )}
      <Checkbox className={system ? styles.autoBox : undefined} checked={done} disabled={system || readOnly} onChange={onToggle} />
      {!system && renaming !== null ? (
        <Input className={styles.rowInput} value={renaming} maxLength={180} autoFocus onChange={(event) => onRenameDraft(event.target.value)} onBlur={onRenameCommit} onPressEnter={onRenameCommit} />
      ) : (
        <span className={styles.rowLabel} onClick={!system ? onStartRename : undefined}>{label}</span>
      )}
      {system && required && <span className={styles.requiredMark}>обязательно</span>}
      {!system && (
        <Popconfirm title="Удалить задачу?" okText="Удалить" cancelText="Оставить" onConfirm={onDelete}>
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Удалить «${label}»`} />
        </Popconfirm>
      )}
    </div>
  );
};

const StageTaskChecklist = ({ system, custom, readOnly, onReorder, onAdd, onToggle, onDelete, onRename }: StageTaskChecklistProps) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [rename, setRename] = useState<{ id: string; value: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedSystem = [...system.filter((item) => item.required), ...system.filter((item) => !item.required)];
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    onAdd(label);
    setDraft('');
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const order = custom.map((item) => item.id);
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(order, from, to));
  };

  return (
    <>
      <div className={styles.checklistHead}>
        <h3>Чек-лист</h3>
        {!readOnly && (
          <Button aria-pressed={adding} onClick={() => setAdding((current) => !current)}>
            {adding ? 'Готово' : 'Добавить задачу'}
          </Button>
        )}
      </div>
      <p className={styles.blockTitle}>Задачи текущего этапа</p>
      <DndContext>
        <SortableContext items={orderedSystem.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {orderedSystem.map((item) => (
              <TaskRow
                key={item.id}
                id={item.id}
                label={item.label}
                done={item.done}
                required={item.required}
                system
                reorder={false}
                renaming={null}
                onStartRename={() => undefined}
                onRenameDraft={() => undefined}
                onRenameCommit={() => undefined}
                onToggle={() => undefined}
                onDelete={() => undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {(custom.length > 0 || adding) && <p className={styles.blockTitle}>Мои задачи</p>}
      {(custom.length > 0 || adding) && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={custom.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className={`${styles.list} ${adding ? styles.listEditing : ''}`}>
            {custom.map((item) => (
              <TaskRow
                key={item.id}
                id={item.id}
                label={item.label}
                done={item.done}
                system={false}
                reorder={adding}
                readOnly={readOnly}
                renaming={rename?.id === item.id ? rename.value : null}
                onStartRename={() => setRename({ id: item.id, value: item.label })}
                onRenameDraft={(value) => setRename({ id: item.id, value })}
                onRenameCommit={() => {
                  if (rename?.id !== item.id) return;
                  const label = rename.value.trim();
                  setRename(null);
                  if (!label || label === item.label) return;
                  onRename(item.id, label);
                }}
                onToggle={() => onToggle(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            ))}
            {adding && (
              <div className={styles.addRow}>
                <Input value={draft} maxLength={180} placeholder="Своя задача" onChange={(event) => setDraft(event.target.value)} onPressEnter={add} />
                <Button type="primary" aria-label="Добавить пункт" icon={<PlusOutlined />} disabled={!draft.trim()} onClick={add}>Добавить</Button>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>}
    </>
  );
};

export default StageTaskChecklist;
