export const PROGRAMS_QUERY_KEYS = {
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

export const PROGRAMS_RATING_QUERY_KEYS = {
  from: 'r_from',
  to: 'r_to',
  universities: 'r_universities',
  programs: 'r_programs',
  products: 'r_products',
  responsibles: 'r_responsibles',
} as const;

export const MANAGER_QUERY_KEYS = {
  manager: 'm_manager',
} as const;

export const ALL_REPORT_FILTER_QUERY_KEYS = [
  ...Object.values(PROGRAMS_QUERY_KEYS),
  ...Object.values(PROGRAMS_RATING_QUERY_KEYS),
  ...Object.values(MANAGER_QUERY_KEYS),
];
