import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContactSearchStage from './ContactSearchStage';

vi.mock('../../../api/client', () => ({
  apiRequest: vi.fn(async () => []),
  ApiError: class ApiError extends Error {
    status = 500;
  },
}));

const contactItem = {
  id: 'local-stage-1-contact',
  code: 'contact',
  label: 'Контакт',
  required: true,
  done: false,
  itemType: 'stakeholder_role',
  role: 'other',
  attachmentKind: null,
  valueText: null,
  valueDate: null,
  stakeholderId: null,
  attachmentId: null,
};

describe('поиск контакта', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('показывает плитки, пустые предупреждения и системный чек-лист', async () => {
    const onBlockers = vi.fn();
    render(
      <ContactSearchStage
        stageId="stage-1"
        organizationId="org-1"
        dueAt="2026-09-30"
        ready
        contactItem={contactItem}
        fallbackPeople={[]}
        readOnly={false}
        onCommit={vi.fn()}
        onBlockers={onBlockers}
        onPeopleChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Срок')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ответственный/ })).toHaveTextContent('Контакт не найден');
    });
    expect(screen.getByRole('button', { name: /Телефон/ })).toHaveTextContent('Телефон не найден');
    expect(screen.getByRole('button', { name: /Почта/ })).toHaveTextContent('Почта не найдена');
    expect(screen.getByText('Ответственный найден')).toBeInTheDocument();
    expect(screen.getByText('Есть телефон или почта')).toBeInTheDocument();
    expect(screen.getByText('Роль указана')).toBeInTheDocument();
    expect(screen.getByText('Основной контакт выбран')).toBeInTheDocument();
    expect(screen.getByText('Источник контакта указан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить контакт' })).toBeInTheDocument();

    await waitFor(() => {
      expect(onBlockers).toHaveBeenCalledWith(['Ответственный найден', 'Есть телефон или почта']);
    });
  });

  it('в режиме правки даёт добавить свой пункт', async () => {
    render(
      <ContactSearchStage
        stageId="stage-2"
        organizationId="org-1"
        dueAt={null}
        ready
        contactItem={{ ...contactItem, id: 'local-stage-2-contact' }}
        fallbackPeople={[]}
        readOnly={false}
        onCommit={vi.fn()}
        onBlockers={vi.fn()}
        onPeopleChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Добавить задачу' }));
    fireEvent.change(screen.getByPlaceholderText('Своя задача'), { target: { value: 'Уточнить кабинет' } });
    fireEvent.click(screen.getByRole('button', { name: 'Добавить пункт' }));

    expect(screen.getByText('Уточнить кабинет')).toBeInTheDocument();
    expect(screen.getByText('Мои задачи')).toBeInTheDocument();
  });
});
