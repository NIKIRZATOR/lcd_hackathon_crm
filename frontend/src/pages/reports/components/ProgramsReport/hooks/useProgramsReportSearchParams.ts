import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProgramsReportFiltersValues } from '../types';

const QUERY_KEYS = {
  from: 'from',
  to: 'to',
  universities: 'universities',
  programs: 'programs',
  products: 'products',
  responsibles: 'responsibles',
} as const;

const parseIds = (value: string | null): number[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
};

const parsePeriod = (
  from: string | null,
  to: string | null,
): ProgramsReportFiltersValues['period'] => {
  const fromDate = from ? dayjs(from) : null;
  const toDate = to ? dayjs(to) : null;

  if (!fromDate?.isValid() || !toDate?.isValid() || fromDate.isAfter(toDate)) {
    return null;
  }

  return [fromDate, toDate];
};

export const useProgramsReportSearchParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ProgramsReportFiltersValues>(
    () => ({
      period: parsePeriod(searchParams.get(QUERY_KEYS.from), searchParams.get(QUERY_KEYS.to)),
      universityIds: parseIds(searchParams.get(QUERY_KEYS.universities)),
      programIds: parseIds(searchParams.get(QUERY_KEYS.programs)),
      productIds: parseIds(searchParams.get(QUERY_KEYS.products)),
      responsibleIds: parseIds(searchParams.get(QUERY_KEYS.responsibles)),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (values: ProgramsReportFiltersValues) => {
      setSearchParams((currentParams) => {
        const params = new URLSearchParams(currentParams);

        params.delete(QUERY_KEYS.from);
        params.delete(QUERY_KEYS.to);
        params.delete(QUERY_KEYS.universities);
        params.delete(QUERY_KEYS.programs);
        params.delete(QUERY_KEYS.products);
        params.delete(QUERY_KEYS.responsibles);

        if (values.period) {
          params.set(QUERY_KEYS.from, values.period[0].format('YYYY-MM-DD'));
          params.set(QUERY_KEYS.to, values.period[1].format('YYYY-MM-DD'));
        }

        if (values.universityIds.length) {
          params.set(QUERY_KEYS.universities, values.universityIds.join(','));
        }

        if (values.programIds.length) {
          params.set(QUERY_KEYS.programs, values.programIds.join(','));
        }

        if (values.productIds.length) {
          params.set(QUERY_KEYS.products, values.productIds.join(','));
        }

        if (values.responsibleIds.length) {
          params.set(QUERY_KEYS.responsibles, values.responsibleIds.join(','));
        }

        return params;
      });
    },
    [setSearchParams],
  );

  return {
    filters,
    setFilters,
  };
};
