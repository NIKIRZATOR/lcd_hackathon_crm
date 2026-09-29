import { apiRequest } from '../../../api/client';

export type ManagerHomeResponse = {
  role: 'MANAGER';
  dashboard: {
    summary: {
      kam_count: number;
      organizations_count: number;
      active_programs_count: number;
      red_programs_count: number;
    };
    kams: Array<{ kam_id: string; kam_name: string }>;
    organizations: Array<{
      organization_id: string;
      organization_name: string;
      kam_id: string;
      kam_name: string;
      programs_count: number;
      health_score: number | null;
      health_band: 'green' | 'yellow' | 'red';
    }>;
    bottlenecks: Array<{ stage_id: string; stage_name: string; count: number }>;
  };
};

export type ReassignOrganizationsPayload = {
  organizationIds: string[];
  toKamId: string;
};

export const getManagerHome = (signal?: AbortSignal) =>
  apiRequest<ManagerHomeResponse>('/api/nba/home', { signal });

export const reassignOrganizations = ({ organizationIds, toKamId }: ReassignOrganizationsPayload) =>
  apiRequest('/api/organizations/reassign', {
    method: 'POST',
    body: JSON.stringify({
      organization_ids: organizationIds,
      kam_user_id: toKamId,
      reason: 'Переназначение с дашборда менеджера',
    }),
  });
