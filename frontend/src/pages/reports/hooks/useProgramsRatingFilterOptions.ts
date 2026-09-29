import { useQuery } from '@tanstack/react-query';

import { getProgramsRatingFilterOptions } from '../api/programsRatingReportsApi';

export const useProgramsRatingFilterOptions = () => {
  const {
    data: options,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports', 'programs-rating', 'filters'],
    queryFn: ({ signal }) => getProgramsRatingFilterOptions(signal),
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
