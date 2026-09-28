export type HealthBand = 'green' | 'yellow' | 'red';

export type OrganizationStatus = 'active' | 'paused' | 'archived';

export type PortfolioFilters = {
  search: string;
  region: string;
  type: string;
  direction: string;
  product: string;
  kam: string;
  unassigned: boolean;
  periodFrom: string;
  periodTo: string;
};

export const emptyPortfolioFilters: PortfolioFilters = {
  search: '',
  region: '',
  type: '',
  direction: '',
  product: '',
  kam: '',
  unassigned: false,
  periodFrom: '',
  periodTo: '',
};

export type PortfolioOrganization = {
  id: string;
  logoFileId: string | null;
  name: string;
  shortName: string;
  city: string;
  region: string;
  typeName: string;
  kam: string;
  status: OrganizationStatus;
  programCount: number;
  healthScore: number | null;
  healthBand: HealthBand | null;
  nearestRisk: string;
  noActivity: boolean;
  updatedAt: string;
  directions: string[];
  products: string[];
};

export type UniversityProgramRow = {
  id: string;
  directionId: string;
  productId: string;
  directionName: string;
  productName: string;
  playbookName: string;
  stageName: string;
  status: string;
  healthScore: number | null;
  healthBand: HealthBand | null;
  students: number;
  studentsAreTemporary: boolean;
  license: string;
};

export type UniversityPerson = {
  id: string;
  roleCode: string;
  roleLabel: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  isActive: boolean;
  programId: string | null;
  programLabel: string;
};

export type UniversityContract = {
  id: string;
  number: string;
  signedOn: string;
  validUntil: string;
  status: string;
  current: boolean;
  fileName: string;
  attachmentId: string | null;
};

export type UniversityLicense = {
  id: string;
  programId: string;
  productName: string;
  number: string;
  signedOn: string;
  validUntil: string;
  transferStatus: string;
  access: string;
  fileName: string;
  attachmentId: string | null;
};

export type UniversityTeacher = {
  id: string;
  name: string;
  productName: string;
  status: string;
  trainedOn: string;
  qualificationUntil: string;
  lastLmsActivity: string;
};

export type UniversityDocument = {
  id: string;
  name: string;
  kind: string;
  programName: string;
  stageName: string;
  uploadedBy: string;
  createdAt: string;
  attachmentId: string | null;
};

export type UniversityFeedEvent = {
  id: string;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
  kind: string;
};

export type UniversityCard = {
  id: string;
  logoFileId: string | null;
  name: string;
  shortName: string;
  typeName: string;
  city: string;
  region: string;
  status: OrganizationStatus;
  kamName: string;
  comment: string;
  healthScore: number | null;
  healthBand: HealthBand | null;
  programCount: number;
  programs: UniversityProgramRow[];
  people: UniversityPerson[];
  contracts: UniversityContract[];
  licenses: UniversityLicense[];
  teachers: UniversityTeacher[];
  documents: UniversityDocument[];
  feed: UniversityFeedEvent[];
};

export type CatalogOption = { id: string; name: string };

export type AcademicWindowOption = CatalogOption & { current: boolean };

export const stakeholderRoles = [
  { value: 'vice_rector', label: 'Проректор' },
  { value: 'dean', label: 'Декан' },
  { value: 'methodist', label: 'Методист' },
  { value: 'director', label: 'Директор' },
  { value: 'chair', label: 'Заведующий кафедрой' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'school_teacher', label: 'Учитель' },
  { value: 'lawyer', label: 'Юрист' },
  { value: 'other', label: 'Другое' },
] as const;

export const transferStatusOptions = [
  { value: 'not_transferred', label: 'Не передана' },
  { value: 'in_progress', label: 'Передаётся' },
  { value: 'transferred', label: 'Передана' },
  { value: 'revoked', label: 'Отозвана' },
] as const;

export const teacherStatusLabels: Record<string, string> = {
  planned: 'Запланировано',
  trained: 'Обучен',
  active: 'Ведёт',
  expired: 'Квалификация истекла',
  left: 'Ушёл',
};

export const programStatusLabels: Record<string, string> = {
  draft: 'Черновик',
  active: 'Идёт',
  paused: 'Пауза',
  completed: 'Завершена',
  cancelled: 'Отказ',
};

export const healthBandOf = (score: number | null, band?: string | null): HealthBand | null => {
  if (band === 'green' || band === 'yellow' || band === 'red') return band;
  if (score == null) return null;
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
};

export const roleLabel = (code: string) => stakeholderRoles.find((role) => role.value === code)?.label ?? code;

export const transferLabel = (status: string) => transferStatusOptions.find((item) => item.value === status)?.label ?? status;

