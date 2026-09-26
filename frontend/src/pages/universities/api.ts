import { apiRequest } from '../../api/client';
import { findUniversity as findMockUniversity, rememberUniversity as rememberMockUniversity, universityManagers, universityProfiles } from './mocks';
import { setLiveUniversitySections } from './sectionData';
import type { UniversityItem, UniversityResponsible, UniversityStatus } from './types';
import type { Readiness, SectionDocument, SectionHistory, SectionLicense, SectionProgram, SectionTeacher, TrainingStatus, UniversitySections } from './sectionData';
import { setUniversityWorkflowRows, workflowRowFromProgram } from '../workflow/api';
import { listUniversityWorkflows } from './workflowLink';

export { listUniversityWorkflows };

const dash = '—';
const liveItems: UniversityItem[] = [];
let listLoaded = false;

type Page<T> = { items: T[]; total: number };

type OrganizationListItem = {
  id: string;
  name: string;
  short_name: string | null;
  region: string | null;
  city: string | null;
  status: string;
  type_name: string;
  kam_name: string | null;
  active_programs_count: number;
  worst_health_score: number | null;
  nearest_risk: string | null;
  no_activity: boolean;
  updated_at?: string;
  comment?: string | null;
};

type Stakeholder = {
  full_name: string;
  role_code: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
};

type ProgramInstance = {
  id: string;
  direction_name: string;
  product_name: string;
  status: string;
  kam_name: string | null;
  health_band: string | null;
  health_score: number | null;
  started_at?: string | null;
  current_stage_code?: string | null;
};

type WorkflowSnapshot = {
  stages: Array<{ id: string; name: string; due_at: string | null }>;
  current_stage_instance_id: string | null;
};

const roleLabels: Record<string, string> = {
  vice_rector: 'Проректор',
  dean: 'Декан',
  methodist: 'Методист',
  lawyer: 'Юрист',
  chair: 'Заведующий кафедрой',
  teacher: 'Преподаватель',
  director: 'Директор',
  school_teacher: 'Учитель',
  other: 'Контакт',
};

const text = (value?: string | null) => value?.trim() || dash;

const organizationStatus = (status: string): UniversityStatus => {
  if (status === 'paused' || status === 'archived') return 'paused';
  return 'active';
};

const mapOrganization = (organization: OrganizationListItem): UniversityItem => ({
  id: organization.id,
  healthScore: organization.worst_health_score,
  name: text(organization.name),
  shortName: text(organization.short_name || organization.name),
  city: text(organization.city),
  region: text(organization.region),
  type: text(organization.type_name),
  profile: dash,
  product: dash,
  interactions: organization.active_programs_count ?? 0,
  programs: organization.active_programs_count ?? 0,
  streams: -1,
  status: organizationStatus(organization.status),
  manager: text(organization.kam_name),
  activityAt: organization.updated_at?.slice(0, 10) ?? '',
  activityText: organization.nearest_risk
    || (organization.no_activity ? 'без заходов' : organization.status === 'archived' ? 'архив' : dash),
  catalog: organization.comment ? {
    vendor: dash,
    software: dash,
    contract: dash,
    licenseSignedAt: dash,
    licenseYear: dash,
    transferStatus: dash,
    responsibles: dash,
    comment: organization.comment,
  } : undefined,
});

const loadPage = async <T,>(path: string) => {
  const first = await apiRequest<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=0`);
  const items = [...first.items];
  let offset = first.items.length;

  while (items.length < first.total) {
    const next = await apiRequest<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`);
    if (next.items.length === 0) break;
    items.push(...next.items);
    offset += next.items.length;
  }

  return items;
};

export const loadUniversities = async () => {
  const organizations = await loadPage<OrganizationListItem>('/api/organizations');
  liveItems.splice(0, liveItems.length, ...organizations.map(mapOrganization));
  listLoaded = true;
  return liveItems;
};

export const listUniversities = () => (listLoaded ? liveItems : []);

export const listUniversityManagers = () => (
  listLoaded ? [...new Set(liveItems.map((item) => item.manager).filter((value) => value && value !== dash))] : universityManagers
);

export const listUniversityProfiles = () => (
  listLoaded ? [...new Set(liveItems.map((item) => item.profile).filter((value) => value && value !== dash))] : universityProfiles
);

export const findUniversity = (id: string | number) => (
  liveItems.find((item) => String(item.id) === String(id)) ?? findMockUniversity(Number(id))
);

export const rememberUniversity = (item: UniversityItem) => {
  const index = liveItems.findIndex((entry) => String(entry.id) === String(item.id));
  if (index >= 0) {
    liveItems[index] = item;
    return;
  }

  if (typeof item.id === 'number') {
    rememberMockUniversity(item);
    return;
  }

  liveItems.unshift(item);
};

const teacherTraining = (status: string): TrainingStatus => {
  if (status === 'trained' || status === 'active') return 'done';
  if (status === 'expired') return 'progress';
  return 'notStarted';
};

const teacherReadiness = (status: string): Readiness => {
  if (status === 'active') return 'ready';
  if (status === 'trained') return 'training';
  if (status === 'expired' || status === 'left') return 'needs';
  return 'interested';
};

export const loadUniversity = async (id: string) => {
  if (!id.includes('-')) return findUniversity(id);

  const [organization, summary, stakeholders, programsPage, documents, feed, teachers, contracts, licenses] = await Promise.all([
    apiRequest<OrganizationListItem>(`/api/organizations/${id}`),
    apiRequest<{ type_name: string; kam_name: string | null }>(`/api/organizations/${id}/360`),
    apiRequest<Stakeholder[]>(`/api/organizations/${id}/stakeholders`).catch(() => []),
    apiRequest<Page<ProgramInstance>>(`/api/organizations/${id}/program-instances?limit=100`).catch(() => ({ items: [], total: 0 })),
    apiRequest<Array<{ filename: string; kind: string | null; program_name: string | null; stage_name: string | null; created_at: string; uploaded_by_name: string | null }>>(`/api/organizations/${id}/documents`).catch(() => []),
    apiRequest<Array<{ id: string; title: string; description: string | null; created_at: string; actor_name: string | null }>>(`/api/organizations/${id}/feed`).catch(() => []),
    apiRequest<Array<{ id: string; full_name: string; product_name: string; status: string; qualification_until: string | null }>>(`/api/organizations/${id}/teachers`).catch(() => []),
    apiRequest<Array<{ id: string; number: string; signed_on: string | null; valid_until: string | null; status: string | null }>>(`/api/organizations/${id}/contracts`).catch(() => []),
    apiRequest<Array<{ id: string; product_name: string; license_number: string | null; signed_at: string | null; valid_until: string | null; transfer_status: string }>>(`/api/organizations/${id}/licenses`).catch(() => []),
  ]);
  const health = await apiRequest<{ worst_health_score: number | null; active_programs_count: number }>(`/api/organizations/${id}/health`).catch(() => null);
  const workflows = await Promise.all(programsPage.items.map(async (program) => {
    const workflow = await apiRequest<WorkflowSnapshot>(`/api/program-instances/${program.id}/workflow`).catch(() => null);
    const metrics = await apiRequest<{ students_count: number; streams_count: number } | null>(`/api/integrations/program-instances/${program.id}/metrics`).catch(() => null);
    const current = workflow?.stages.find((stage) => stage.id === workflow.current_stage_instance_id);
    return { program, stageName: current?.name, dueAt: current?.due_at, metrics };
  }));

  const people: UniversityResponsible[] = stakeholders
    .filter((person) => person.is_active !== false)
    .map((person) => ({
      name: text(person.full_name),
      role: person.position || roleLabels[person.role_code] || text(person.role_code),
      phone: person.phone || dash,
      email: person.email || dash,
    }));
  const programs: SectionProgram[] = workflows.map(({ program, metrics }) => ({
    id: program.id,
    name: text(program.direction_name),
    direction: text(program.direction_name),
    product: text(program.product_name),
    vendor: dash,
    streams: metrics?.streams_count ?? -1,
    students: metrics?.students_count ?? -1,
    status: 'active',
  }));
  const sectionTeachers: SectionTeacher[] = teachers.map((teacher) => ({
    id: teacher.id,
    name: text(teacher.full_name),
    department: dash,
    program: text(teacher.product_name),
    training: teacherTraining(teacher.status),
    qualification: teacher.qualification_until?.slice(0, 10) || dash,
    readiness: teacherReadiness(teacher.status),
  }));
  const sectionDocuments: SectionDocument[] = documents.map((document) => ({
    id: `${document.filename}-${document.created_at}`,
    name: text(document.filename),
    linked: text(document.program_name),
    version: dash,
    status: 'actual',
    updated: document.created_at?.slice(0, 10) || dash,
    owner: text(document.uploaded_by_name),
    type: text(document.kind),
    interaction: text(document.stage_name),
    at: document.created_at?.slice(0, 10),
  }));
  const history: SectionHistory[] = feed.map((event) => ({
    id: event.id,
    when: event.created_at?.slice(0, 10) || dash,
    title: text(event.title),
    text: text(event.description),
    area: 'documents',
    interaction: dash,
    actor: text(event.actor_name),
    at: event.created_at?.slice(0, 10),
  }));
  const sectionLicenses: SectionLicense[] = [
    ...contracts.map((contract) => ({
      product: dash,
      contract: text(contract.number),
      signedAt: contract.signed_on?.slice(0, 10) || dash,
      due: contract.valid_until?.slice(0, 10) || dash,
      transfer: 'done' as const,
    })),
    ...licenses.map((license) => ({
      product: text(license.product_name),
      contract: text(license.license_number),
      signedAt: license.signed_at?.slice(0, 10) || dash,
      due: license.valid_until?.slice(0, 10) || dash,
      transfer: license.transfer_status === 'transferred' ? 'done' as const : 'expiring' as const,
    })),
  ];
  const ready = sectionTeachers.filter((teacher) => teacher.readiness === 'ready').length;
  const training = sectionTeachers.filter((teacher) => teacher.training === 'progress' || teacher.readiness === 'training').length;
  const sections: UniversitySections = {
    programs,
    licenses: sectionLicenses,
    directions: [...new Set(programs.map((program) => program.direction).filter((value) => value !== dash))],
    teachers: sectionTeachers,
    teacherSummary: {
      total: sectionTeachers.length,
      ready,
      training,
      notStarted: sectionTeachers.filter((teacher) => teacher.training === 'notStarted').length,
      expiring: sectionTeachers.filter((teacher) => teacher.readiness === 'needs').length,
      programs: programs.length,
    },
    documents: sectionDocuments,
    docAlerts: [],
    tasks: [],
    history,
    streams: [],
  };

  const item = mapOrganization({
    ...organization,
    type_name: summary.type_name || organization.type_name,
    kam_name: summary.kam_name,
    active_programs_count: health?.active_programs_count ?? programs.length,
    worst_health_score: health?.worst_health_score ?? null,
    nearest_risk: null,
    no_activity: programs.length === 0,
  });
  const previous = findUniversity(id);
  if (previous?.activityText && previous.activityText !== dash) item.activityText = previous.activityText;
  item.responsibles = people;
  item.studentsCount = workflows.some((entry) => entry.metrics) ? workflows.reduce((sum, entry) => sum + (entry.metrics?.students_count ?? 0), 0) : undefined;
  item.teachersCount = teachers.length;
  item.productsCount = new Set(programs.map((program) => program.product).filter((value) => value !== dash)).size;
  item.programs = programs.length;
  item.interactions = programs.length;
  if (organization.comment) {
    item.catalog = {
      vendor: dash,
      software: dash,
      contract: dash,
      licenseSignedAt: dash,
      licenseYear: dash,
      transferStatus: dash,
      responsibles: people.map((person) => person.name).join(', ') || dash,
      comment: organization.comment,
    };
  }

  setLiveUniversitySections(id, sections);
  setUniversityWorkflowRows(id, workflows.map(({ program, stageName, dueAt }) => workflowRowFromProgram(program, stageName, dueAt)));
  rememberUniversity(item);
  return item;
};
