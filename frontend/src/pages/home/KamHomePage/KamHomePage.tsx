import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../../../api/client';
import PageLayout from '../../../components/pageLayout/PageLayout';

import KamAcademicWindow from './components/KamAcademicWindow/';
import { academicWindowMock } from './components/KamAcademicWindow/mocks';
import KamActionQueue from './components/KamActionQueue';
import KamPortfolioHealth from './components/KamPortfolioHealth';
import KamSignals from './components/KamSignals/';
import { kamSignalsMock } from './components/KamSignals/mocks';
import KamSummaryCards from './components/SummaryCards';
import { getNextBestAction } from './nba/getNextBestAction';
import { loadNbaContext } from './nba/loadNbaContext';
import type { NbaRecommendation } from './nba/nbaTypes';
import type { HomeSummary, NbaItem } from './types';

import styles from './KamHomePage.module.scss';

const KamHomePage = () => {
  const [items, setItems] = useState<NbaItem[]>([]);
  const [summary, setSummary] = useState<HomeSummary>();
  const [recommendations, setRecommendations] = useState<Record<string, NbaRecommendation>>({});
  const [queueLoading, setQueueLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadDesk = useCallback(() => {
    setQueueLoading(true);

    void apiRequest<HomeSummary>('/api/nba/home')
      .then(setSummary)
      .catch(() => setError('Не удалось загрузить рабочий стол.'));

    void apiRequest<NbaItem[]>('/api/nba/today')
      .then(async (loadedItems) => {
        const next: Record<string, NbaRecommendation> = {};
        await Promise.all(
          loadedItems.map(async (item) => {
            if (!item.program_instance_id) return;
            try {
              next[item.id] = getNextBestAction(await loadNbaContext(item.program_instance_id));
            } catch {
              return;
            }
          }),
        );
        setRecommendations(next);
        setItems(loadedItems);
        setQueueLoading(false);
      })
      .catch(() => {
        setQueueLoading(false);
        setError('Не удалось загрузить рабочий стол.');
      });
  }, []);

  useEffect(() => {
    loadDesk();
  }, [loadDesk]);

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
