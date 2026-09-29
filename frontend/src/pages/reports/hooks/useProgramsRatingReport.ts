import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getProgramsRatingReport } from '../api/programsRatingReportsApi';
import type { ProgramsRatingReportFiltersValues } from '../components/ProgramsRatingReport/types';

export const useProgramsRatingReport = (filters: ProgramsRatingReportFiltersValues) => {
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        ...filters,
        period: filters.period
          ? [filters.period[0].format('YYYY-MM-DD'), filters.period[1].format('YYYY-MM-DD')]
          : null,
      }),
    [filters],
  );

  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: ['reports', 'programs-rating', 'report', requestKey],

    queryFn: ({ signal }) => getProgramsRatingReport(filters, signal),

    placeholderData: keepPreviousData,
  });

  return {
    data: error ? null : (data ?? null),
    loading: isLoading || isPlaceholderData,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Не удалось загрузить рейтинг программ'
      : null,
  };
};
