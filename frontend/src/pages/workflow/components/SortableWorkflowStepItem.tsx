import { HolderOutlined, EditOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { WorkflowStepConfig } from '../types';

import styles from '../WorkflowEditPage.module.scss';

type SortableWorkflowStepItemProps = {
  step: WorkflowStepConfig;
  index: number;
  selected: boolean;
  onSelect: () => void;
};

const SortableWorkflowStepItem = ({ step, index, selected, onSelect }: SortableWorkflowStepItemProps) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.stepRow} ${selected ? styles.stepRowSelected : ''} ${isDragging ? styles.stepRowDragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Переместить этап ${step.name}`}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
      <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
      <span className={styles.stepName}>{step.name}</span>
      <EditOutlined className={styles.stepAction} aria-hidden="true" />
    </div>
  );
};

export default SortableWorkflowStepItem;