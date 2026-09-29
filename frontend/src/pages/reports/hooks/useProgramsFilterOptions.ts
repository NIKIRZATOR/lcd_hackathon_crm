import { useQuery } from '@tanstack/react-query';

import { getProgramsFilterOptions } from '../api/programsReportsApi';

export const useProgramsFilterOptions = () => {
  const {
    data: options,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', 'programs', 'filters'],
    queryFn: ({ signal }) => getProgramsFilterOptions(signal),
  });

  return {
    options: options ?? null,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Не удалось загрузить варианты фильтров'
      : null,
  };
};
