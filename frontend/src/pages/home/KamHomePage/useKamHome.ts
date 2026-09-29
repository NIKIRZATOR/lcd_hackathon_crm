import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { getKamHomeSummary, getKamToday } from './api';
import { getNextBestAction } from './nba/getNextBestAction';
import { loadNbaContext } from './nba/loadNbaContext';
import type { NbaRecommendation } from './nba/nbaTypes';

const KAM_HOME_QUERY_KEYS = {
  summary: ['nba', 'home', 'kam'] as const,
  today: ['nba', 'today', 'kam'] as const,
  context: (programId: string) => ['nba', 'context', programId] as const,
};

export const useKamHome = () => {
  const { data: summary, error: summaryError } = useQuery({
    queryKey: KAM_HOME_QUERY_KEYS.summary,
    queryFn: ({ signal }) => getKamHomeSummary(signal),
  });

  const {
    data: items = [],
    isPending: queueLoading,
    error: itemsError,
  } = useQuery({
    queryKey: KAM_HOME_QUERY_KEYS.today,
    queryFn: ({ signal }) => getKamToday(signal),
  });

  const programIds = useMemo(
    () => [
      ...new Set(
        items.map((item) => item.program_instance_id).filter((id): id is string => Boolean(id)),
      ),
    ],
    [items],
  );

  const contextQueries = useQueries({
    queries: programIds.map((programId) => ({
      queryKey: KAM_HOME_QUERY_KEYS.context(programId),
      queryFn: ({ signal }) => loadNbaContext(programId, signal),
    })),
  });

  const recommendations = useMemo(() => {
    const byProgramId = new Map<string, NbaRecommendation>();

    programIds.forEach((programId, index) => {
      const context = contextQueries[index]?.data;

      if (!context) {
        return;
      }

      byProgramId.set(programId, getNextBestAction(context));
    });

    return items.reduce<Record<string, NbaRecommendation>>((result, item) => {
      if (!item.program_instance_id) {
        return result;
      }

      const recommendation = byProgramId.get(item.program_instance_id);

      if (recommendation) {
        result[item.id] = recommendation;
      }

      return result;
    }, {});
  }, [contextQueries, items, programIds]);

  const error = summaryError || itemsError ? 'Не удалось загрузить рабочий стол.' : undefined;

  return {
    summary,
    items,
    recommendations,
    queueLoading,
    error,
  };
};
