import { theme } from 'antd';
import type { CSSProperties } from 'react';

import styles from './WorkflowSteps.module.scss';

export type WorkflowStep = {
  id: string | number;
  title: string;
  disabled?: boolean;
};

type WorkflowStepsProps = {
  steps: WorkflowStep[];
  currentStep: number;
  onStepChange?: (index: number, step: WorkflowStep) => void;
};

type StepMarkerStatus = 'finish' | 'process' | 'wait' | 'error';

type StepMarkerProps = {
  status: StepMarkerStatus;
};

const StepMarker = ({ status }: StepMarkerProps) => {
  if (status === 'finish') {
    return <span className={styles.finishedMarker} aria-hidden="true">✓</span>;
  }

  if (status === 'process') {
    return (
      <span className={styles.currentMarker} aria-hidden="true">
        <span className={styles.currentMarkerDot} />
      </span>
    );
  }

  return <span className={styles.waitingMarker} aria-hidden="true" />;
};

const getStepStatus = (index: number, currentStep: number): StepMarkerStatus => {
  if (index < currentStep) return 'finish';
  if (index === currentStep) return 'process';
  return 'wait';
};

const WorkflowSteps = ({ steps, currentStep, onStepChange }: WorkflowStepsProps) => {
  const { token } = theme.useToken();

  return (
    <div
      className={styles.workflowSteps}
      style={{
        '--steps-primary': token.colorPrimary,
        '--steps-text': token.colorText,
        '--steps-secondary': token.colorTextSecondary,
        '--steps-border': token.colorBorderSecondary,
        '--steps-current-bg': token.colorPrimaryBg,
      } as CSSProperties}
      role="list"
      aria-label="Этапы workflow"
    >
      {steps.map((step, index) => {
        const status = getStepStatus(index, currentStep);
        const isClickable = Boolean(onStepChange) && !step.disabled;

        return (
          <button
            key={String(step.id)}
            type="button"
            className={`${styles.stepRow} ${status === 'process' ? styles.currentRow : ''}`}
            disabled={!isClickable}
            onClick={() => onStepChange?.(index, step)}
            role="listitem"
            aria-current={status === 'process' ? 'step' : undefined}
          >
            <span className={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.markerColumn}>
              <StepMarker status={status} />
              {index < steps.length - 1 && (
                <span className={`${styles.connector} ${index < currentStep ? styles.connectorFinished : ''}`} aria-hidden="true" />
              )}
            </span>
            <span className={`${styles.stepTitle} ${status === 'process' ? styles.currentTitle : ''}`}>
              {step.title}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default WorkflowSteps;
