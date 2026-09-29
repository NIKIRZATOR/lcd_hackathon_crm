import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getProgramsReportPreview } from '../api/programsReportsApi';
import type { ProgramsFilterValues } from '../components/ProgramsReport/types/programsFilters';

export const useProgramsReportPreview = (filters: ProgramsFilterValues) => {
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
    queryKey: ['reports', 'programs', 'preview', requestKey],

    queryFn: ({ signal }) =>
      getProgramsReportPreview(
        filters,
        {
          limit: 100,
          offset: 0,
        },
        signal,
      ),

    placeholderData: keepPreviousData,
  });

  return {
    data: error ? null : (data ?? null),
    loading: isLoading || isPlaceholderData,
    error: error
      ? error instanceof Error
        ? error.message
        : 'Не удалось загрузить отчёт по программам'
      : null,
  };
};
