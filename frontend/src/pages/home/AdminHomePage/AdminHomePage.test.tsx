import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../../api/client';

import AdminHomePage from './AdminHomePage';

vi.mock('../../../api/client', () => ({ apiRequest: vi.fn() }));

const navigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const summary = {
  role: 'ADMIN' as const,
  cards: {
    unmatched_integrations: 1,
    integration_errors: 0,
    import_jobs: 0,
    report_jobs: 0,
    running_reports: 0,
    draft_playbooks: 0,
    active_users: 1,
  },
  attention_items: [],
  integration_summary: [],
  recent_activity: [],
  recent_jobs: [],
  system_status: [],
  quick_actions: [],
};

describe('AdminHomePage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue(summary);
    navigate.mockReset();
  });

  it('shows the platform dashboard and refreshes it without a page reload', async () => {
    render(
      <MemoryRouter>
        <AdminHomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Платформа')).toBeInTheDocument();
    expect(screen.getByText('Требует внимания')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('opens integration diagnostics from the KPI card', async () => {
    render(
      <MemoryRouter>
        <AdminHomePage />
      </MemoryRouter>,
    );

    fireEvent.click((await screen.findAllByText('Интеграции'))[0]);

    expect(navigate).toHaveBeenCalledWith('/management?tab=integrations');
  });
});
