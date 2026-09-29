import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import PageLayout from '../../../components/pageLayout/PageLayout';
import { useManagerReport } from '../../reports/hooks/useManagerReport';
import { useProgramsRatingReport } from '../../reports/hooks/useProgramsRatingReport';

import ManagerBottlenecks from './components/ManagerBottlenecks';
import { managerBottlenecksMock } from './components/ManagerBottlenecks/mock';
import ManagerLoadTable from './components/ManagerLoadTable';
import ManagerOrganizationsHealth from './components/ManagerOrganizationsHealth/ManagerOrganizationsHealth';
import { managerOrganizationsHealthMock } from './components/ManagerOrganizationsHealth/mock';
import ManagerProgramsRating from './components/ManagerProgramsRating/ManagerProgramsRating';
import ManagerSummaryCards from './components/ManagerSummaryCards';
import type { ManagerProgramsRatingItem } from './types';

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
          kamCount={4}
          organizationsCount={11}
          activeProgramsCount={35}
          redProgramsCount={5}
        />

        <div className={styles.contentGrid}>
          <div className={styles.leftColumn}>
            <ManagerLoadTable
              items={managerReportItems}
              loading={managerReportLoading}
              error={managerReportError}
            />

            <ManagerBottlenecks items={managerBottlenecksMock} />
          </div>

          <div className={styles.rightColumn}>
            <ManagerOrganizationsHealth items={managerOrganizationsHealthMock} />

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
