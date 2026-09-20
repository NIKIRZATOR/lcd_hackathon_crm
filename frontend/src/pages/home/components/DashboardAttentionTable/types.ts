export type AttentionStatus = 'critical' | 'high' | 'attention';

export type DashboardAttentionItem = {
  id: number;
  university: string;
  program: string;
  stage: string;
  reason: string;
  days: number;
  status: AttentionStatus;
};
