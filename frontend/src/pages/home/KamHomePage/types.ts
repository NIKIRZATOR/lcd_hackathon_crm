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
  context?: {
    stage_code: string | null;
    stage_due_at: string | null;
    checklist: Array<{
      code: string;
      label: string;
      required: boolean;
      is_done: boolean;
      value_text?: string | null;
      value_date?: string | null;
    }>;
    attachment_kinds: string[];
  } | null;
};

export type HomeSummary = {
  role: string;
  items?: NbaItem[];

  cards: {
    nba_today: number;
    health_attention: number;
  };

  portfolio?: {
    active_programs: number;
    health?: {
      green: number;
      yellow: number;
      red: number;
    };
  };

  academic_windows?: AcademicWindow[];

  b2c?: {
    applications: number;
    payment_records: number;
    students: number;
    streams: number;
  };
};

export type AcademicWindow = {
  id: number;
  title: string;
  plan_cutoff_on: string;
  classes_start_on: string;
  classes_end_on: string;
  is_current: boolean;
};

export type KamSignalSource = 'website' | 'lms';

export type KamSignalType =
  | 'applications_period'
  | 'applications_unmatched'
  | 'students_update'
  | 'streams_update'
  | 'course_started'
  | 'teacher_activity'
  | 'lms_silence';

export type KamSignal = {
  id: number;
  source: KamSignalSource;
  type: KamSignalType;

  organizationName?: string;
  programName?: string;
  productName?: string;

  programInstanceId?: number | null;

  value?: number;
  days?: number;
  teacherName?: string;
};
