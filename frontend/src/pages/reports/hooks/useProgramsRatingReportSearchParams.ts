import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProgramsRatingReportFiltersValues } from '../components/ProgramsRatingReport/types';

import { PROGRAMS_RATING_QUERY_KEYS as QUERY_KEYS } from './reportQueryKeys';

const parseStringArray = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parsePeriod = (
  from: string | null,
  to: string | null,
): ProgramsRatingReportFiltersValues['period'] => {
  const fromDate = from ? dayjs(from) : null;
  const toDate = to ? dayjs(to) : null;

  if (!fromDate?.isValid() || !toDate?.isValid() || fromDate.isAfter(toDate)) {
    return null;
  }

  return [fromDate, toDate];
};

export const useProgramsRatingReportSearchParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ProgramsRatingReportFiltersValues>(
    () => ({
      period: parsePeriod(searchParams.get(QUERY_KEYS.from), searchParams.get(QUERY_KEYS.to)),

      universityIds: parseStringArray(searchParams.get(QUERY_KEYS.universities)),

      programIds: parseStringArray(searchParams.get(QUERY_KEYS.programs)),

      productIds: parseStringArray(searchParams.get(QUERY_KEYS.products)),

      responsibleIds: parseStringArray(searchParams.get(QUERY_KEYS.responsibles)),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (values: ProgramsRatingReportFiltersValues) => {
      setSearchParams(
        (currentParams) => {
          const params = new URLSearchParams(currentParams);

          Object.values(QUERY_KEYS).forEach((key) => {
            params.delete(key);
          });

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
        },
        {
          replace: true,
        },
      );
    },
    [setSearchParams],
  );

  return {
    filters,
    setFilters,
  };
};
