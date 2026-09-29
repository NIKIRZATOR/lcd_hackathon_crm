import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getKamHomeSummary } from './api';
import { getNextBestAction } from './nba/getNextBestAction';
import { contextFromNbaItem } from './nba/loadNbaContext';
import type { NbaRecommendation } from './nba/nbaTypes';

const KAM_HOME_QUERY_KEY = ['nba', 'home', 'kam'] as const;

export const useKamHome = () => {
  const {
    data: summary,
    isPending: queueLoading,
    error: summaryError,
  } = useQuery({
    queryKey: KAM_HOME_QUERY_KEY,
    queryFn: () => getKamHomeSummary(),
  });

  const items = useMemo(() => summary?.items ?? [], [summary?.items]);
  const recommendations = useMemo(
    () =>
      items.reduce<Record<string, NbaRecommendation>>((result, item) => {
        if (item.program_instance_id && item.context) {
          result[item.id] = getNextBestAction(contextFromNbaItem(item));
        }
        return result;
      }, {}),
    [items],
  );

  return {
    summary,
    items,
    recommendations,
    queueLoading,
    error: summaryError ? 'Не удалось загрузить рабочий стол.' : undefined,
  };
};
