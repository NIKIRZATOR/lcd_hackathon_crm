export type NbaItem = {
  id: string;
  rule_code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  organization_id: string;
  organization_name: string;
  product_name: string | null;
  reason: string;
  action: string;
  priority: string;
  action_target: string | null;
  due_at: string | null;
  program_instance_id: string | null;
};

export type HomeSummary = {
  role: string;
  cards: {
    nba_today: number;
    health_attention: number;
  };
};
