export type ReportItem = {
  id: string;

  organization_id: string;
  organization: string;

  direction_id: string;
  direction: string;

  product_id: string;
  product: string;

  playbook_id: string;
  playbook: string;

  status: string;

  health_band: string;
  health_score: number;

  responsible_id: string | null;
  responsible: string | null;

  stage_id: string | null;
  stage: string | null;

  license_number: string | null;

  applications: number;
  payment_records: number;
  students: number;
  streams: number;

  b2c_rank: number;
};

export type ProgramsReportAggregates = {
  applications: number;
  payment_records: number;
  students: number;
  streams: number;
};

export type ProgramsReportB2CConversion = {
  payment_records_per_application: number | null;
  students_per_payment_record: number | null;
};

export type ProgramsReportPreviewResponse = {
  items: ReportItem[];
  total: number;
  limit: number;
  offset: number;
  aggregates: ProgramsReportAggregates;
  demo_b2c_conversion: ProgramsReportB2CConversion;
};
