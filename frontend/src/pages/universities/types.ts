export type UniversityStatus = 'active' | 'progress' | 'paused';

export type UniversityType = 'federal' | 'research' | 'flagship' | 'regional';

export interface UniversityCatalog {
  vendor: string;
  software: string;
  contract: string;
  licenseSignedAt: string;
  licenseYear: string;
  transferStatus: string;
  responsibles: string;
  comment: string;
}

export interface UniversityResponsible {
  name: string;
  role: string;
}

export interface UniversityItem {
  id: number;
  name: string;
  shortName: string;
  city: string;
  region: string;
  type: UniversityType;
  profile: string;
  product: string;
  interactions: number;
  programs: number;
  streams: number;
  status: UniversityStatus;
  manager: string;
  responsibles?: UniversityResponsible[];
  catalog?: UniversityCatalog;
  activityAt: string;
  activityText: string;
}

export interface UniversityFilters {
  search: string;
  status: UniversityStatus | '';
  region: string;
  type: UniversityType | '';
  profile: string;
  product: string;
  manager: string;
  period: [string, string] | null;
}

export type UniversityDraft = Pick<
  UniversityItem,
  'name' | 'shortName' | 'city' | 'region' | 'type' | 'profile' | 'product' | 'manager' | 'status'
>;

export const universityStatusLabels: Record<UniversityStatus, string> = {
  active: 'Активное',
  progress: 'В процессе',
  paused: 'На паузе',
};

export const universityTypeLabels: Record<UniversityType, string> = {
  federal: 'Федеральный',
  research: 'Исследовательский',
  flagship: 'Опорный',
  regional: 'Региональный',
};

export const emptyUniversityFilters: UniversityFilters = {
  search: '',
  status: '',
  region: '',
  type: '',
  profile: '',
  product: '',
  manager: '',
  period: null,
};
