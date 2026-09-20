export type KpiTrendDirection = 'up' | 'down';
export type KpiTrendStatus = 'positive' | 'negative';

export interface DashboardKpiItem {
  id: string;
  label: string;
  value: number;
  changePercent: number;
  trendDirection: KpiTrendDirection;
  trendStatus: KpiTrendStatus;
}
