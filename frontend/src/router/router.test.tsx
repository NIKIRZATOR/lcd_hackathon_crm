import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppRoutes from './router';

const authState = vi.hoisted(() => ({
  value: {
    authenticated: false,
    initialized: true,
    user: null as { roles: string[] } | null,
  },
}));

vi.mock('../auth', () => ({
  ProtectedRoute: ({
    children,
    allowedRoles,
  }: {
    children: React.ReactNode;
    allowedRoles?: string[];
  }) => {
    const roles = authState.value.user?.roles ?? [];
    if (allowedRoles && !roles.some((role) => allowedRoles.includes(role))) {
      return <div>Denied by route guard</div>;
    }
    return children;
  },
  useAuth: () => ({
    ...authState.value,
    login: vi.fn(),
    logout: vi.fn(),
    getToken: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../layout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    default: () => (
      <div data-testid="app-layout">
        <Outlet />
      </div>
    ),
  };
});

vi.mock('../pages/login/LoginPage', () => ({
  default: () => <div>Login page</div>,
}));

vi.mock('../v2/app/V2Layout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { default: () => <div data-testid="v2-layout"><Outlet /></div> };
});

vi.mock('../v2/pages/V2PlaceholderPage', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('../v2/pages/NbaTodayPage', () => ({
  default: () => <div>Главная</div>,
}));

vi.mock('../pages/analytics/AnalyticsPage', () => ({
  default: () => <div>Analytics page</div>,
}));

vi.mock('../pages/products/ProductsPage', () => ({
  default: () => <div>Products page</div>,
}));

vi.mock('../pages/programs/ProgramsPage', () => ({
  default: () => <div>Programs page</div>,
}));

vi.mock('../pages/rating/RatingPage', () => ({
  default: () => <div>Rating page</div>,
}));

vi.mock('../pages/reports/ReportsPage', () => ({
  default: () => <div>Reports page</div>,
}));

vi.mock('../pages/tasks/TasksPage', () => ({
  default: () => <div>Tasks page</div>,
}));

vi.mock('../pages/universities/UniversitiesPage', () => ({
  default: () => <div>Universities page</div>,
}));

const renderRoute = (path = '/') => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
};

describe('AppRoutes start route', () => {
  beforeEach(() => {
    authState.value = {
      authenticated: false,
      initialized: true,
      user: null,
    };
  });

  it('shows login page on root route for anonymous users', () => {
    renderRoute('/');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard home')).not.toBeInTheDocument();
  });

  it('redirects authenticated users with a working role to V2 home', async () => {
    authState.value = {
      authenticated: true,
      initialized: true,
      user: { roles: ['KAM'] },
    };

    renderRoute('/');

    expect(await screen.findByTestId('v2-layout')).toBeInTheDocument();
    expect(screen.getByText('Главная')).toBeInTheDocument();
  });

  it('shows 403 on root route for authenticated users without a working role', () => {
    authState.value = {
      authenticated: true,
      initialized: true,
      user: { roles: ['VIEWER'] },
    };

    renderRoute('/');

    expect(screen.getByText('Нет доступа')).toBeInTheDocument();
    expect(screen.queryByTestId('v2-layout')).not.toBeInTheDocument();
  });

  it('redirects unknown routes to the root start route', async () => {
    renderRoute('/unknown');

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('denies KAM direct access to the management route', async () => {
    authState.value = {
      authenticated: true,
      initialized: true,
      user: { roles: ['KAM'] },
    };

    renderRoute('/v2/management');

    expect(await screen.findByText('Denied by route guard')).toBeInTheDocument();
  });
});
