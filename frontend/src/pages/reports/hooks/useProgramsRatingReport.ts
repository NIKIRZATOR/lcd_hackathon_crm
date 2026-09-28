import { useEffect, useMemo, useState } from 'react';

import { getProgramsRatingReport } from '../api/programsRatingReportsApi';
import type {
  ProgramsRatingReportFiltersValues,
  ProgramsRatingReportResponse,
} from '../components/ProgramsRatingReport/types';

type ProgramsRatingReportState = {
  data: ProgramsRatingReportResponse | null;
  error: string | null;
  completedRequestKey: string | null;
};

export const useProgramsRatingReport = (filters: ProgramsRatingReportFiltersValues) => {
  const [state, setState] = useState<ProgramsRatingReportState>({
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

    getProgramsRatingReport(filters, controller.signal)
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
          error: cause instanceof Error ? cause.message : 'Не удалось загрузить рейтинг программ',
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
