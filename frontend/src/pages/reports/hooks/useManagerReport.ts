import { useEffect, useState } from 'react';

import { getManagerReport } from '../api/managerReportsApi';
import type { ManagerReportItem } from '../components/ManagerReport/types';

export const useManagerReport = () => {
  const [data, setData] = useState<ManagerReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getManagerReport(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setData(response);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setData([]);
          setError(
            cause instanceof Error ? cause.message : 'Не удалось загрузить отчёт по менеджерам',
          );
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
    data,
    loading,
    error,
  };
};
