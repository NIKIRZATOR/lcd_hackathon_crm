import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../../../api/client';

import type { AdminHomeSummary } from './types';

export const useAdminHome = () => {
  const [summary, setSummary] = useState<AdminHomeSummary>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    apiRequest<AdminHomeSummary>('/api/nba/home')
      .then(setSummary)
      .catch(() => setError('Не удалось загрузить состояние платформы.'));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(undefined);
    try {
      setSummary(await apiRequest<AdminHomeSummary>('/api/nba/home'));
    } catch {
      setError('Не удалось загрузить состояние платформы.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { summary, error, refreshing, refresh };
};
