import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KamHomePage from './KamHomePage';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('../../../api/client', () => ({ apiRequest }));
vi.mock('../../../components/pageLayout/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./components/KamAcademicWindow/', () => ({ default: () => null }));
vi.mock('./components/KamActionQueue', () => ({ default: () => null }));
vi.mock('./components/KamPortfolioHealth', () => ({ default: () => null }));
vi.mock('./components/KamSignals/', () => ({ default: () => null }));
vi.mock('./components/SummaryCards', () => ({ default: () => null }));

describe('KamHomePage', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({
      role: 'KAM',
      cards: { nba_today: 0, health_attention: 0 },
      items: [],
    });
  });

  it('loads the dashboard once in StrictMode', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <KamHomePage />
        </QueryClientProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest.mock.calls[0]?.[0]).toBe('/api/nba/home');
  });
});
