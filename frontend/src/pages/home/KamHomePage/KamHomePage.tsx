import { Card, Descriptions, List, Tag } from 'antd';
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
            activeProgramsCount={summary?.portfolio?.active_programs}
            academicWindowsCount={summary?.academic_windows?.length}
          />

          <KamActionQueue items={items} />
        </div>

        <aside className={styles.sidebar}>
          <KamPortfolioHealth health={summary?.portfolio?.health} activePrograms={summary?.portfolio?.active_programs} />
          <Card size="small" title="* B2C сигналы">
            <Descriptions size="small" column={2} items={[
              { key: 'applications', label: 'Заявки', children: summary?.b2c?.applications ?? '—' },
              { key: 'payments', label: 'Заказы', children: summary?.b2c?.payment_records ?? '—' },
              { key: 'students', label: 'Студенты', children: summary?.b2c?.students ?? '—' },
              { key: 'streams', label: 'Потоки', children: summary?.b2c?.streams ?? '—' },
            ]} />
          </Card>
          <Card size="small" title="* Учебные окна">
            <List size="small" dataSource={summary?.academic_windows ?? []} locale={{ emptyText: 'Актуальных окон нет' }} renderItem={(item) => <List.Item><Tag>{item.plan_cutoff_on}</Tag>{item.title}</List.Item>} />
          </Card>
        </aside>
      </div>
    </PageLayout>
  );
};

export default KamHomePage;
