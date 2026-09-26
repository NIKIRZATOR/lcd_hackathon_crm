import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ReportsFiltersValues } from '../types';

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

type UseReportsSearchParamsParams = {
  allowResponsibleFilter: boolean;
};

export const useReportsSearchParams = ({
  allowResponsibleFilter,
}: UseReportsSearchParamsParams) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ReportsFiltersValues>(() => {
    const from = searchParams.get(QUERY_KEYS.from);
    const to = searchParams.get(QUERY_KEYS.to);

    const fromDate = from ? dayjs(from) : null;
    const toDate = to ? dayjs(to) : null;

    const period =
      fromDate?.isValid() && toDate?.isValid() && !fromDate.isAfter(toDate)
        ? ([fromDate, toDate] as ReportsFiltersValues['period'])
        : null;

    return {
      period,
      universityIds: parseIds(searchParams.get(QUERY_KEYS.universities)),
      programIds: parseIds(searchParams.get(QUERY_KEYS.programs)),
      productIds: parseIds(searchParams.get(QUERY_KEYS.products)),
      responsibleIds: allowResponsibleFilter
        ? parseIds(searchParams.get(QUERY_KEYS.responsibles))
        : [],
    };
  }, [allowResponsibleFilter, searchParams]);

  const setFilters = useCallback(
    (values: ReportsFiltersValues) => {
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

        if (allowResponsibleFilter && values.responsibleIds.length) {
          params.set(QUERY_KEYS.responsibles, values.responsibleIds.join(','));
        }

        return params;
      });
    },
    [allowResponsibleFilter, setSearchParams],
  );

  return {
    filters,
    setFilters,
  };
};
