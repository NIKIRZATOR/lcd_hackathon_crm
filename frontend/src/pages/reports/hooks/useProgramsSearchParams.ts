import dayjs from 'dayjs';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProgramsFilterValues } from '../components/ProgramsReport/types/programsFilters';

const QUERY_KEYS = {
  from: 'p_from',
  to: 'p_to',
  organizations: 'p_organizations',
  directions: 'p_directions',
  products: 'p_products',
  responsibles: 'p_responsibles',
  playbooks: 'p_playbooks',
  stages: 'p_stages',
  healthBands: 'p_health_bands',
  statuses: 'p_statuses',
} as const;

const parseStringArray = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

type UseProgramsSearchParamsParams = {
  allowResponsibleFilter: boolean;
};

export const useProgramsSearchParams = ({
  allowResponsibleFilter,
}: UseProgramsSearchParamsParams) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ProgramsFilterValues>(() => {
    const from = searchParams.get(QUERY_KEYS.from);
    const to = searchParams.get(QUERY_KEYS.to);

    const fromDate = from ? dayjs(from) : null;
    const toDate = to ? dayjs(to) : null;

    const period =
      fromDate?.isValid() && toDate?.isValid() && !fromDate.isAfter(toDate)
        ? ([fromDate, toDate] as ProgramsFilterValues['period'])
        : null;

    return {
      period,

      organization_ids: parseStringArray(searchParams.get(QUERY_KEYS.organizations)),

      direction_ids: parseStringArray(searchParams.get(QUERY_KEYS.directions)),

      product_ids: parseStringArray(searchParams.get(QUERY_KEYS.products)),

      responsible_user_ids: allowResponsibleFilter
        ? parseStringArray(searchParams.get(QUERY_KEYS.responsibles))
        : [],

      playbook_ids: parseStringArray(searchParams.get(QUERY_KEYS.playbooks)),

      stage_ids: parseStringArray(searchParams.get(QUERY_KEYS.stages)),

      health_bands: parseStringArray(searchParams.get(QUERY_KEYS.healthBands)),

      statuses: parseStringArray(searchParams.get(QUERY_KEYS.statuses)),
    };
  }, [allowResponsibleFilter, searchParams]);

  const setFilters = useCallback(
    (values: ProgramsFilterValues) => {
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

          if (values.organization_ids.length) {
            params.set(QUERY_KEYS.organizations, values.organization_ids.join(','));
          }

          if (values.direction_ids.length) {
            params.set(QUERY_KEYS.directions, values.direction_ids.join(','));
          }

          if (values.product_ids.length) {
            params.set(QUERY_KEYS.products, values.product_ids.join(','));
          }

          if (allowResponsibleFilter && values.responsible_user_ids.length) {
            params.set(QUERY_KEYS.responsibles, values.responsible_user_ids.join(','));
          }

          if (values.playbook_ids.length) {
            params.set(QUERY_KEYS.playbooks, values.playbook_ids.join(','));
          }

          if (values.stage_ids.length) {
            params.set(QUERY_KEYS.stages, values.stage_ids.join(','));
          }

          if (values.health_bands.length) {
            params.set(QUERY_KEYS.healthBands, values.health_bands.join(','));
          }

          if (values.statuses.length) {
            params.set(QUERY_KEYS.statuses, values.statuses.join(','));
          }

          return params;
        },
        {
          replace: true,
        },
      );
    },
    [allowResponsibleFilter, setSearchParams],
  );

  return {
    filters,
    setFilters,
  };
};
