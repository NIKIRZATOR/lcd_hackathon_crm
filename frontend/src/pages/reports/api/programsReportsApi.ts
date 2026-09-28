import { apiRequest } from '../../../api/client';

import type {
  ProgramsFilterOptions,
  ProgramsFilterValues,
} from '../components/ProgramsReport/types/programsFilters';
import type { ProgramsReportPreviewResponse } from '../components/ProgramsReport/types/types';

type ProgramsReportSortOrder = 'asc' | 'desc';

type ProgramsReportPreviewParams = {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: ProgramsReportSortOrder;
};

export const getProgramsFilterOptions = (signal?: AbortSignal) =>
  apiRequest<ProgramsFilterOptions>('/api/reports/filter-options', {
    signal,
  });

export const toProgramsReportFilter = ({ period, ...filters }: ProgramsFilterValues) => ({
  ...filters,
  date_from: period ? period[0].startOf('day').toISOString() : null,
  date_to: period ? period[1].endOf('day').toISOString() : null,
});

export const getProgramsReportPreview = (
  filters: ProgramsFilterValues,
  params: ProgramsReportPreviewParams = {},
  signal?: AbortSignal,
) => {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.offset !== undefined) {
    searchParams.set('offset', String(params.offset));
  }

  if (params.sort_by) {
    searchParams.set('sort_by', params.sort_by);
  }

  if (params.sort_order) {
    searchParams.set('sort_order', params.sort_order);
  }

  const query = searchParams.toString();

  const url = query ? `/api/reports/programs/preview?${query}` : '/api/reports/programs/preview';

  return apiRequest<ProgramsReportPreviewResponse>(url, {
    method: 'POST',
    signal,
    body: JSON.stringify(toProgramsReportFilter(filters)),
  });
};
