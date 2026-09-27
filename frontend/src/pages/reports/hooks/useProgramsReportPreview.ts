import { useEffect, useMemo, useState } from 'react';

import { getProgramsReportPreview } from '../api/programsReportsApi';
import type { ProgramsFilterValues } from '../components/ProgramsReport/types/programsFilters';
import type { ProgramsReportPreviewResponse } from '../components/ProgramsReport/types/types';

type ProgramsReportState = {
  data: ProgramsReportPreviewResponse | null;
  error: string | null;
  completedRequestKey: string | null;
};

export const useProgramsReportPreview = (filters: ProgramsFilterValues) => {
  const [state, setState] = useState<ProgramsReportState>({
    data: null,
    error: null,
    completedRequestKey: null,
  });

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

  useEffect(() => {
    const controller = new AbortController();

    getProgramsReportPreview(
      filters,
      {
        limit: 100,
        offset: 0,
      },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          data: response,
          error: null,
          completedRequestKey: requestKey,
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: null,
          error:
            cause instanceof Error ? cause.message : 'Не удалось загрузить отчёт по программам',
          completedRequestKey: requestKey,
        });
      });

    return () => {
      controller.abort();
    };
  }, [filters, requestKey]);

  const loading = state.completedRequestKey !== requestKey;

  return {
    data: state.data,
    loading,
    error: state.error,
  };
};
