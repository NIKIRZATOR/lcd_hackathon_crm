export type AttentionStatusCode = 'critical' | 'high' | 'attention';

export type AttentionStatus = {
  code: AttentionStatusCode;
  label: string;
  priority: number;
};

export type DashboardAttentionItem = {
  id: number;
  university: string;
  program: string;
  stage: string;
  reason: string;
  days: number;
  status: AttentionStatus;
};

export type DashboardAttentionResponse = {
  attention: DashboardAttentionItem[];
};
