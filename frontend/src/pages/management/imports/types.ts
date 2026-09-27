export type ImportJob = {
  id: string;
  status: string;
  source_file_name: string | null;
  created_by_name: string | null;
  header_row: number;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  create_count: number;
  update_count: number;
  skip_count: number;
  conflict_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };
export type ImportPreview = {
  sheetNames: string[];
  sheet: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  totalRows: number;
};
export type Mapping = { id: string; name: string; is_system: boolean; fields: MappingField[] };
export type MappingField = { source_column: string; target_field: string; required: boolean };
export type TargetField = { key: string; label: string; required: boolean };
export type ImportError = {
  id: string;
  row: number;
  column: string | null;
  targetField: string | null;
  code: string;
  message: string;
};
export type ImportDiff = {
  create_count: number;
  update_count: number;
  skip_count: number;
  conflict_count: number;
  items: Array<{
    row: number;
    action: string;
    entity: string;
    businessKey: string;
    reasons: string[];
  }>;
};
