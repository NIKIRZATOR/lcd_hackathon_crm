export type PlaybookStatus = 'draft' | 'published' | 'archived';
export type AccessMode = 'all' | 'selected';
export type ChecklistMode = 'auto' | 'manual';

export type BlockKind =
  | 'fields'
  | 'checklist'
  | 'comment'
  | 'confirm'
  | 'document'
  | 'documents'
  | 'contact'
  | 'contract'
  | 'license'
  | 'access'
  | 'teacher'
  | 'curriculum'
  | 'lms'
  | 'site';

export type FactOption = { id: string; label: string; group: string };
export type FieldItem = { factId: string; required: boolean };
export type ChecklistItem = { id: string; text: string; required: boolean; mode: ChecklistMode; factId?: string };
export type DocumentSlot = { id: string; title: string; docType: string; required: boolean };

export type StageBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  order: number;
  hint?: string;
  required?: boolean;
  minLength?: number;
  fields?: FieldItem[];
  items?: ChecklistItem[];
  docType?: string;
  formats?: string[];
  template?: string;
  description?: string;
  slots?: DocumentSlot[];
  flags?: Record<string, boolean>;
};

export type EditorStage = {
  id: string;
  name: string;
  description: string;
  order: number;
  slaDays: number | null;
  canSkip: boolean;
  catalogCode?: string;
  blocks: StageBlock[];
};

export type EditorPhase = {
  id: string;
  name: string;
  order: number;
  stages: EditorStage[];
};

export type PlaybookVisibility = { mode: AccessMode; kamIds: string[] };

export type PlaybookDraft = {
  id: string;
  name: string;
  description: string;
  status: PlaybookStatus;
  basedOn: string | null;
  sourceTemplateId?: string;
  visibility: PlaybookVisibility;
  phases: EditorPhase[];
  savedAt: string | null;
};

export type PublishedPlaybook = { id: string; name: string; status: string };
export type KamUser = { id: string; name: string };

export type DraftIssue = { level: 'error' | 'warning'; stageId?: string; text: string };
export type DraftValidation = { errors: DraftIssue[]; warnings: DraftIssue[]; stageErrors: Record<string, DraftIssue[]> };