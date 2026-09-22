import { HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormListFieldData } from 'antd';
import type { ReactNode } from 'react';

import styles from './WorkflowStepForm.module.scss';

type SortableChecklistItemProps = {
  field: FormListFieldData;
  children: ReactNode;
  onRemove: () => void;
};

const SortableChecklistItem = ({ field, children, onRemove }: SortableChecklistItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.listRow} ${isDragging ? styles.listRowDragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className={styles.listDragHandle}
        aria-label="Переместить пункт чек-листа"
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
      <span className={styles.checklistMarker} aria-hidden="true">
        □
      </span>
      <div className={styles.listField}>{children}</div>
      <button type="button" className={styles.listRemoveButton} onClick={onRemove} aria-label="Удалить пункт чек-листа">
        ×
      </button>
    </div>
  );
};

export default SortableChecklistItem;
