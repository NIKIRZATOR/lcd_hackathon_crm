export type AttentionItem = {
  priority: 'P1' | 'WARNING' | 'INFO';
  event: string;
  source: string;
  action: string;
  path: string;
  occurred_at: string | null;
};
export type IntegrationSummary = {
  source: string;
  records: number;
  mapped: number;
  unmatched: number;
  errors: number;
  last_package_at: string | null;
};
export type Activity = {
  id: string;
  title: string;
  details: string | null;
  result: string;
  occurred_at: string;
};
export type RecentJob = {
  id: string;
  kind: string;
  status: string;
  occurred_at: string;
  reason: string;
};
export type SystemStatus = {
  component: string;
  status: 'OK' | 'Warning' | 'Error' | 'Unknown';
  detail: string;
  checked_at: string;
};
export type QuickAction = { label: string; path: string };

export type AdminHomeSummary = {
  role: 'ADMIN';
  cards: {
    unmatched_integrations: number;
    integration_errors: number;
    import_jobs: number;
    report_jobs: number;
    running_reports: number;
    draft_playbooks: number;
    active_users: number;
  };
  attention_items: AttentionItem[];
  integration_summary: IntegrationSummary[];
  recent_activity: Activity[];
  recent_jobs: RecentJob[];
  system_status: SystemStatus[];
  quick_actions: QuickAction[];
};
