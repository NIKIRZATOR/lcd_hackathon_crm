import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getManagerHome, reassignOrganizations } from './api';
import type {
  ManagerBottleneckItem,
  ManagerDashboardSummary,
  ManagerKamItem,
  ManagerOrganizationHealthItem,
} from './types';

const EMPTY_SUMMARY: ManagerDashboardSummary = {
  kamCount: 0,
  organizationsCount: 0,
  activeProgramsCount: 0,
  redProgramsCount: 0,
};

export const useManagerDashboard = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['nba', 'home', 'manager'],
    queryFn: ({ signal }) => getManagerHome(signal),
  });
  const mutation = useMutation({
    mutationFn: reassignOrganizations,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['nba', 'home', 'manager'] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'managers', 'report'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow', 'journal'] }),
      ]);
    },
  });

  const dashboard = query.data?.dashboard;
  const summary: ManagerDashboardSummary = dashboard
    ? {
        kamCount: dashboard.summary.kam_count,
        organizationsCount: dashboard.summary.organizations_count,
        activeProgramsCount: dashboard.summary.active_programs_count,
        redProgramsCount: dashboard.summary.red_programs_count,
      }
    : EMPTY_SUMMARY;
  const kams: ManagerKamItem[] =
    dashboard?.kams.map((item) => ({ kamId: item.kam_id, kamName: item.kam_name })) ?? [];
  const organizations: ManagerOrganizationHealthItem[] =
    dashboard?.organizations.map((item) => ({
      organizationId: item.organization_id,
      organizationName: item.organization_name,
      kamId: item.kam_id,
      kamName: item.kam_name,
      programsCount: item.programs_count,
      healthScore: item.health_score,
      healthStatus:
        item.health_band === 'red'
          ? 'critical'
          : item.health_band === 'yellow'
            ? 'warning'
            : 'healthy',
    })) ?? [];
  const bottlenecks: ManagerBottleneckItem[] =
    dashboard?.bottlenecks.map((item) => ({
      stageId: item.stage_id,
      stageName: item.stage_name,
      count: item.count,
    })) ?? [];

  return {
    summary,
    kams,
    organizations,
    bottlenecks,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    reassign: mutation.mutateAsync,
    reassigning: mutation.isPending,
  };
};
