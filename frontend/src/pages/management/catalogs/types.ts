export type CatalogKind = 'directions' | 'products' | 'vendors' | 'academic-windows';

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  code?: string | null;
  vendor_id?: string | null;
  documentation_url?: string | null;
};

export type VendorOption = { id: string; name: string };
export type AcademicWindow = {
  id: string;
  code: string;
  title: string;
  plan_cutoff_on: string;
  classes_start_on: string;
  classes_end_on: string;
  is_current: boolean;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };
