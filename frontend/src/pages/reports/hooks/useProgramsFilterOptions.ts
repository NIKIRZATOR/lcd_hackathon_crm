import { useEffect, useState } from 'react';

import { getProgramsFilterOptions } from '../api/programsReportsApi';
import type { ProgramsFilterOptions } from '../components/ProgramsReport/types/programsFilters';

export const useProgramsFilterOptions = () => {
  const [options, setOptions] = useState<ProgramsFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getProgramsFilterOptions(controller.signal)
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

  return { options, loading, error };
};
