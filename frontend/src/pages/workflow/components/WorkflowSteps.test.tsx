import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WorkflowSteps from './WorkflowSteps';

const steps = [
  { id: 30, title: 'Поиск контакта' },
  { id: 10, title: 'Коммуникация' },
  { id: 20, title: 'Встреча' },
];

describe('WorkflowSteps', () => {
  it('подсвечивает фактический текущий этап, а клик только выбирает просмотр', () => {
    const onStepChange = vi.fn();

    render(
      <WorkflowSteps steps={steps} currentStep={0} selectedStep={2} onStepChange={onStepChange} />,
    );

    const current = screen.getByText('Поиск контакта').closest('button');
    const viewed = screen.getByText('Встреча').closest('button');

    if (!current || !viewed) {
      throw new Error('Не найдены этапы');
    }

    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current.className).toMatch(/currentRow/);
    expect(viewed).not.toHaveAttribute('aria-current');
    expect(viewed).toHaveAttribute('aria-pressed', 'true');
    expect(viewed.className).toMatch(/selectedRow/);
    expect(viewed.className).not.toMatch(/currentRow/);

    fireEvent.click(viewed);

    expect(onStepChange).toHaveBeenCalledWith(2, steps[2]);
    expect(current).toHaveAttribute('aria-current', 'step');
  });

  it('после завершения цепочки отмечает все этапы пройденными', () => {
    render(<WorkflowSteps steps={steps} currentStep={steps.length} selectedStep={2} />);

    const renderedSteps = screen.getAllByRole('listitem');

    expect(renderedSteps.every((step) => step.getAttribute('aria-current') === null)).toBe(true);
    expect(renderedSteps.every((step) => step.querySelector('[class*="finishedMarker"]'))).toBe(true);
  });
});
