export type ManagerProgramItem = {
  id: number;
  name: string;
  product: string;
};

export type ManagerInteractionItem = {
  id: number;
  university: string;
  program: string;
  stage: string;
};

export type ManagerOverdueItem = {
  id: number;
  university: string;
  program: string;
  stage: string;
  overdueDays: number;
};

export type ManagerAttentionItem = {
  id: number;
  university: string;
  program: string;
  reason: string;
};

export type ManagerReportItem = {
  id: number;
  kamId: number;
  kam: string;

  programs: number;
  activeInteractions: number;
  completedInteractions: number;
  overdueInteractions: number;
  attentionRequired: number;
  averageStageDuration: number;

  programItems: ManagerProgramItem[];
  activeInteractionItems: ManagerInteractionItem[];
  completedInteractionItems: ManagerInteractionItem[];
  overdueItems: ManagerOverdueItem[];
  attentionItems: ManagerAttentionItem[];
};
