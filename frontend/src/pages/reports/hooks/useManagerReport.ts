import { useQuery } from '@tanstack/react-query';

import { getManagerReport } from '../api/managerReportsApi';

export const useManagerReport = () => {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', 'managers', 'report'],
    queryFn: ({ signal }) => getManagerReport(signal),
  });

  return {
    data,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Не удалось загрузить отчёт по менеджерам'
      : null,
  };
};
