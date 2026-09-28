import { apiRequest } from '../../../api/client';

import type {
  ManagerReportFilterOptions,
  ManagerReportItem,
} from '../components/ManagerReport/types';

export const getManagerReportFilterOptions = (signal?: AbortSignal) =>
  apiRequest<ManagerReportFilterOptions>('/api/reports/managers/filters', {
    signal,
  });

export const getManagerReport = (signal?: AbortSignal) =>
  apiRequest<ManagerReportItem[]>('/api/reports/managers', {
    signal,
  });
