import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { MANAGER_QUERY_KEYS as QUERY_KEYS } from './reportQueryKeys';

export const useManagerReportSearchParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedKamId = useMemo(() => searchParams.get(QUERY_KEYS.manager), [searchParams]);

  const setSelectedKamId = useCallback(
    (managerId: string | null) => {
      setSearchParams(
        (currentParams) => {
          const params = new URLSearchParams(currentParams);

          params.delete(QUERY_KEYS.manager);

          if (managerId) {
            params.set(QUERY_KEYS.manager, managerId);
          }

          return params;
        },
        {
          replace: true,
        },
      );
    },
    [setSearchParams],
  );

  return {
    selectedKamId,
    setSelectedKamId,
  };
};
