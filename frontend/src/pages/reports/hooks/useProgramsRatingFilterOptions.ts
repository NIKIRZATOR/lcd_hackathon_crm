import { useEffect, useState } from 'react';

import { getProgramsRatingFilterOptions } from '../api/programsRatingReportsApi';
import type { ProgramsRatingReportFilterOptions } from '../components/ProgramsRatingReport/types';

export const useProgramsRatingFilterOptions = () => {
  const [options, setOptions] = useState<ProgramsRatingReportFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getProgramsRatingFilterOptions(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOptions(data);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error ? cause.message : 'Не удалось загрузить варианты фильтров',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return {
    options,
    loading,
    error,
  };
};
