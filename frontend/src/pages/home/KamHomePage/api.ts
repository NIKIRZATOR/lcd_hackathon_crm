import { apiRequest } from '../../../api/client';

import type { HomeSummary } from './types';

export const getKamHomeSummary = (signal?: AbortSignal) =>
  apiRequest<HomeSummary>('/api/nba/home', {
    signal,
  });
