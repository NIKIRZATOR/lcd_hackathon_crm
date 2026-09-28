import { useEffect, useState } from 'react';

import { getManagerReportFilterOptions } from '../api/managerReportsApi';
import type { ManagerReportFilterOptions } from '../components/ManagerReport/types';

export const useManagerReportFilterOptions = () => {
  const [options, setOptions] = useState<ManagerReportFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getManagerReportFilterOptions(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOptions(data);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Не удалось загрузить список KAM');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return {
    options,
    loading,
    error,
  };
};
