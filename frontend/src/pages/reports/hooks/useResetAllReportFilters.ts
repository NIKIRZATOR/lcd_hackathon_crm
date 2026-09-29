import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ALL_REPORT_FILTER_QUERY_KEYS } from './reportQueryKeys';

export const useResetAllReportFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const hasActiveFilters = useMemo(
    () => ALL_REPORT_FILTER_QUERY_KEYS.some((key) => searchParams.has(key)),
    [searchParams],
  );

  const resetAllReportFilters = useCallback(() => {
    setSearchParams(
      (currentParams) => {
        const params = new URLSearchParams(currentParams);

        ALL_REPORT_FILTER_QUERY_KEYS.forEach((key) => {
          params.delete(key);
        });

        return params;
      },
      {
        replace: true,
      },
    );
  }, [setSearchParams]);

  return {
    hasActiveFilters,
    resetAllReportFilters,
  };
};
