import { apiRequest } from '../../../api/client';

import type {
  ProgramsRatingReportFilterOptions,
  ProgramsRatingReportFiltersValues,
  ProgramsRatingReportResponse,
} from '../components/ProgramsRatingReport/types';

export const getProgramsRatingFilterOptions = (signal?: AbortSignal) =>
  apiRequest<ProgramsRatingReportFilterOptions>('/api/reports/programs-rating/filters', {
    signal,
  });

export const getProgramsRatingReport = (
  filters: ProgramsRatingReportFiltersValues,
  signal?: AbortSignal,
) => {
  const searchParams = new URLSearchParams();

  if (filters.period) {
    searchParams.set('from', filters.period[0].format('YYYY-MM-DD'));

    searchParams.set('to', filters.period[1].format('YYYY-MM-DD'));
  }

  filters.universityIds.forEach((id) => {
    searchParams.append('universityIds', id);
  });

  filters.programIds.forEach((id) => {
    searchParams.append('programIds', id);
  });

  filters.productIds.forEach((id) => {
    searchParams.append('productIds', id);
  });

  filters.responsibleIds.forEach((id) => {
    searchParams.append('responsibleIds', id);
  });

  const query = searchParams.toString();

  const url = query ? `/api/reports/programs-rating?${query}` : '/api/reports/programs-rating';

  return apiRequest<ProgramsRatingReportResponse>(url, {
    signal,
  });
};
