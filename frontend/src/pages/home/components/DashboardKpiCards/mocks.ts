import type { DashboardKpiItem } from './types';

export const dashboardKpiMock: DashboardKpiItem[] = [
  {
    id: 'universities',
    label: 'Организации',
    value: 48,
    changePercent: 6,
    trendDirection: 'up',
    trendStatus: 'positive',
  },
  {
    id: 'interactions',
    label: 'Взаимодействия',
    value: 126,
    changePercent: 12,
    trendDirection: 'up',
    trendStatus: 'positive',
  },
  {
    id: 'streams',
    label: 'Потоки',
    value: 32,
    changePercent: 14,
    trendDirection: 'up',
    trendStatus: 'positive',
  },
  {
    id: 'students',
    label: 'Обучающиеся',
    value: 4580,
    changePercent: 18,
    trendDirection: 'up',
    trendStatus: 'positive',
  },
  {
    id: 'risks',
    label: 'Риски',
    value: 17,
    changePercent: 24,
    trendDirection: 'down',
    trendStatus: 'positive',
  },
];
