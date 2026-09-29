export type NbaPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'WAIT';

export type StageCode =
  | 'find_contact'
  | 'first_meeting'
  | 'identify_need'
  | 'document_package'
  | 'sign_contract'
  | 'sign_license'
  | 'transfer_access'
  | 'train_teacher'
  | 'confirm_teacher'
  | 'curriculum'
  | 'start_classes'
  | 'classes_running'
  | 'period_results'
  | 'control'
  | 'unknown';

export type ChecklistFact = {
  code: string;
  label: string;
  required: boolean;
  done: boolean;
  order: number;
};

export type ProgramNbaContext = {
  programId: string;
  live: boolean;
  stageCode: StageCode;
  overdueDays: number;
  facts: ChecklistFact[];
};

export type NbaRecommendation = {
  priority: NbaPriority;
  text: string;
  code: string;
};
