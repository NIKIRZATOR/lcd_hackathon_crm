import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import PageLayout from '../../../components/pageLayout/PageLayout';
import { useManagerReport } from '../../reports/hooks/useManagerReport';
import { useProgramsRatingReport } from '../../reports/hooks/useProgramsRatingReport';

import ManagerBottlenecks from './components/ManagerBottlenecks';
import ManagerLoadTable from './components/ManagerLoadTable';
import ManagerOrganizationsHealth from './components/ManagerOrganizationsHealth/ManagerOrganizationsHealth';
import ManagerProgramsRating from './components/ManagerProgramsRating/ManagerProgramsRating';
import ManagerSummaryCards from './components/ManagerSummaryCards';
import type { ManagerLoadItem, ManagerProgramsRatingItem } from './types';
import { useManagerDashboard } from './useManagerDashboard';

import styles from './ManagerHomePage.module.scss';

const EMPTY_REPORT_FILTERS = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

const ManagerHomePage = () => {
  const navigate = useNavigate();

  const {
    data: managerReportItems,
    loading: managerReportLoading,
    error: managerReportError,
  } = useManagerReport();
  const managerDashboard = useManagerDashboard();

  const {
    data: programsRatingData,
    loading: programsRatingLoading,
    error: programsRatingError,
  } = useProgramsRatingReport(EMPTY_REPORT_FILTERS);

  const ratingItems = useMemo<ManagerProgramsRatingItem[]>(
    () =>
      (programsRatingData?.items ?? []).map((item) => ({
        program: item.program,
        applications: item.applications,
        students: item.students,
        streams: item.streams,
        demandIndex: item.rating,
      })),
    [programsRatingData?.items],
  );
  const loadItems = useMemo<ManagerLoadItem[]>(() => {
    const reportsByKam = new Map(managerReportItems.map((item) => [item.kamId, item]));
    return managerDashboard.kams.map(
      (kam) =>
        reportsByKam.get(kam.kamId) ?? {
          id: kam.kamId,
          kamId: kam.kamId,
          kam: kam.kamName,
          activePrograms: 0,
          redHealth: 0,
          overdueTasks: 0,
          attentionTasks: 0,
          programItems: [],
        },
    );
  }, [managerDashboard.kams, managerReportItems]);
  const organizationsWithHealth = useMemo(
    () =>
      managerDashboard.organizations
        .filter(
          (organization) => organization.programsCount > 0 && organization.healthScore !== null,
        )
        .slice(0, 6),
    [managerDashboard.organizations],
  );

  const handleShowInReports = () => {
    navigate('/reports?report=programs-rating');
  };

  return (
    <PageLayout
      title="Портфель команды"
      subtitle="Контролируйте нагрузку KAM, узкие места и здоровье программ по всему портфелю."
    >
      <div className={styles.dashboard}>
        <ManagerSummaryCards
          kamCount={managerDashboard.loading ? undefined : managerDashboard.summary.kamCount}
          organizationsCount={
            managerDashboard.loading ? undefined : managerDashboard.summary.organizationsCount
          }
          activeProgramsCount={
            managerDashboard.loading ? undefined : managerDashboard.summary.activeProgramsCount
          }
          redProgramsCount={
            managerDashboard.loading ? undefined : managerDashboard.summary.redProgramsCount
          }
        />

        <div className={styles.contentGrid}>
          <div className={styles.leftColumn}>
            <ManagerLoadTable
              items={loadItems}
              loading={managerReportLoading || managerDashboard.loading}
              error={managerReportError || managerDashboard.error}
              kams={managerDashboard.kams}
              organizations={managerDashboard.organizations}
              onReassign={({ organizationIds, toKamId }) =>
                managerDashboard.reassign({ organizationIds, toKamId })
              }
            />

            <ManagerBottlenecks items={managerDashboard.bottlenecks} />
          </div>

          <div className={styles.rightColumn}>
            <ManagerOrganizationsHealth
              items={organizationsWithHealth}
              onOrganizationClick={(organizationId) => navigate(`/organizations/${organizationId}`)}
            />

            <ManagerProgramsRating
              items={ratingItems}
              loading={programsRatingLoading}
              error={programsRatingError}
              onShowInReports={handleShowInReports}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ManagerHomePage;
