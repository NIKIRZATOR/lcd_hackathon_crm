import { apiRequest } from '../../../api/client';

import type { HomeSummary, NbaItem } from './types';

export const getKamHomeSummary = (signal?: AbortSignal) =>
  apiRequest<HomeSummary>('/api/nba/home', {
    signal,
  });

export const getKamToday = (signal?: AbortSignal) =>
  apiRequest<NbaItem[]>('/api/nba/today', {
    signal,
  });