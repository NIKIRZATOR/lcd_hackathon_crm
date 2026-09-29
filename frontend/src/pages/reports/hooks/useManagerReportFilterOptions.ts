import { useQuery } from '@tanstack/react-query';

import { getManagerReportFilterOptions } from '../api/managerReportsApi';

export const useManagerReportFilterOptions = () => {
  const {
    data: options,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', 'managers', 'filters'],
    queryFn: ({ signal }) => getManagerReportFilterOptions(signal),
  });

  return {
    options: options ?? null,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Не удалось загрузить список KAM'
      : null,
  };
};
