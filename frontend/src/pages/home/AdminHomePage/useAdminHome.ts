import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../../api/client';

import type { AdminHomeSummary } from './types';

export const useAdminHome = () => {
  const {
    data: summary,
    error: queryError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['nba', 'home', 'admin'],
    queryFn: ({ signal }) =>
      apiRequest<AdminHomeSummary>('/api/nba/home', {
        signal,
      }),
  });

  const refresh = async () => {
    await refetch();
  };

  return {
    summary,
    error: queryError ? 'Не удалось загрузить состояние платформы.' : undefined,
    refreshing: isFetching,
    refresh,
  };
};
