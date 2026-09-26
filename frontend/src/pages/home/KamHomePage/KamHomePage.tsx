import { useEffect, useState } from 'react';

import { apiRequest } from '../../../api/client';
import PageLayout from '../../../components/pageLayout/PageLayout';

import KamActionQueue from './components/KamActionQueue';
import KamPortfolioHealth from './components/KamPortfolioHealth';
import KamSummaryCards from './components/SummaryCards';
import type { HomeSummary, NbaItem } from './types';

import styles from './KamHomePage.module.scss';

const KamHomePage = () => {
  const [items, setItems] = useState<NbaItem[]>([]);
  const [summary, setSummary] = useState<HomeSummary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([apiRequest<NbaItem[]>('/api/nba/today'), apiRequest<HomeSummary>('/api/nba/home')])
      .then(([loadedItems, loadedSummary]) => {
        setItems(loadedItems);
        setSummary(loadedSummary);
      })
      .catch(() => {
        setError('Не удалось загрузить рабочий стол.');
      });
  }, []);

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
          />

          <KamActionQueue items={items} />
        </div>

        <aside className={styles.sidebar}>
          <KamPortfolioHealth />
          <KamPortfolioHealth />
          <KamPortfolioHealth />
        </aside>
      </div>
    </PageLayout>
  );
};

export default KamHomePage;
