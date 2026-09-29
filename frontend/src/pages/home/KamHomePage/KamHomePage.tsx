import PageLayout from '../../../components/pageLayout/PageLayout';

import KamAcademicWindow from './components/KamAcademicWindow/';
import { academicWindowMock } from './components/KamAcademicWindow/mocks';
import KamActionQueue from './components/KamActionQueue';
import KamPortfolioHealth from './components/KamPortfolioHealth';
import KamSignals from './components/KamSignals/';
import { kamSignalsMock } from './components/KamSignals/mocks';
import KamSummaryCards from './components/SummaryCards';
import { useKamHome } from './useKamHome';

import styles from './KamHomePage.module.scss';

const KamHomePage = () => {
  const { summary, items, recommendations, queueLoading, error } = useKamHome();

  return (
    <PageLayout
      title="Сегодня"
      subtitle="Критичные задачи, ближайшие сроки и новые сигналы по вашим программам."
    >
      {error && <div>{error}</div>}

      <div className={styles.dashboard}>
        <div className={styles.mainColumn}>
          <KamSummaryCards
            todayTasksCount={summary?.cards.nba_today}
            attentionCount={summary?.cards.health_attention}
            activeProgramsCount={summary?.portfolio?.active_programs}
            academicWindowsCount={1}
          />

          <KamActionQueue items={items} recommendations={recommendations} loading={queueLoading} />
        </div>

        <aside className={styles.sidebar}>
          <KamPortfolioHealth
            health={summary?.portfolio?.health}
            activePrograms={summary?.portfolio?.active_programs}
          />

          <KamAcademicWindow
            academicWindow={academicWindowMock.academicWindow}
            atRiskProgramsCount={academicWindowMock.atRiskProgramsCount}
          />

          <KamSignals signals={kamSignalsMock} />
        </aside>
      </div>
    </PageLayout>
  );
};

export default KamHomePage;
