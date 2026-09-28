import { apiRequest } from '../../api/client';
import {
  filledAttachmentName,
  filledCity,
  filledPlaybookName,
  filledRegion,
  filledRisk,
  filledStageName,
  filledStudents,
  isGapRecord,
  sampleContracts,
  sampleDocuments,
  sampleFeed,
  sampleLicenses,
  samplePeople,
  samplePortfolio,
  samplePrograms,
  sampleTeachers,
} from './backendFieldGaps';
import type {
  AcademicWindowOption,
  CatalogOption,
  OrganizationStatus,
  PortfolioOrganization,
  UniversityCard,
  UniversityContract,
  UniversityDocument,
  UniversityFeedEvent,
  UniversityLicense,
  UniversityPerson,
  UniversityProgramRow,
  UniversityTeacher,
} from './screenModel';
import { healthBandOf, roleLabel, transferLabel } from './screenModel';

type Page<T> = { items: T[]; total: number };

type OrganizationListItem = {
  id: string;
  logo_file_id?: string | null;
  name: string;
  short_name: string | null;
  region: string | null;
  city: string | null;
  status: string;
  type_name?: string;
  kam_name?: string | null;
  active_programs_count?: number;
  worst_health_score?: number | null;
  worst_health_band?: string | null;
  nearest_risk?: string | null;
  no_activity?: boolean;
  updated_at?: string;
  comment?: string | null;
};

type JournalRow = {
  id: string;
  organization_name: string;
  direction_name: string;
  product_name: string;
  playbook_name: string;
  current_stage_name: string | null;
  students_count: number | null;
};

type ProgramInstance = {
  id: string;
  direction_id: string;
  direction_name: string;
  product_id: string;
  product_name: string;
  playbook_name: string;
  status: string;
  health_score: number | null;
  health_band: string | null;
  current_stage_code: string | null;
};

type Stakeholder = {
  id: string;
  role_code: string;
  full_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  program_instance_id: string | null;
};

type Contract = {
  id: string;
  number: string;
  signed_on: string | null;
  valid_until: string | null;
  status: string | null;
  attachment_id: string | null;
};

type License = {
  id: string;
  program_instance_id: string;
  product_name: string;
  license_number: string | null;
  signed_at: string | null;
  valid_until: string | null;
  transfer_status: string;
  product_access: string | null;
  attachment_id: string | null;
};

type Teacher = {
  id: string;
  full_name: string;
  product_name: string;
  status: string;
  trained_on: string | null;
  qualification_until: string | null;
  last_lms_activity_on: string | null;
};

type DocumentRow = {
  file_id: string;
  attachment_id: string | null;
  filename: string;
  kind: string | null;
  program_name: string | null;
  stage_name: string | null;
  created_at: string;
  uploaded_by_name: string | null;
};

type FeedRow = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  created_at: string;
  actor_name: string | null;
};

const dateOnly = (value?: string | null) => value?.slice(0, 10) ?? '';

const text = (value?: string | null, fallback = '') => value?.trim() || fallback;

const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е');

const organizationStatus = (status: string): OrganizationStatus => (
  status === 'paused' || status === 'archived' ? status : 'active'
);

const loadPage = async <T,>(path: string) => {
  const separator = path.includes('?') ? '&' : '?';
  const first = await apiRequest<Page<T>>(`${path}${separator}limit=100&offset=0`);
  const items = [...first.items];
  let offset = first.items.length;

  while (items.length < first.total) {
    const next = await apiRequest<Page<T>>(`${path}${separator}limit=100&offset=${offset}`);
    if (next.items.length === 0) break;
    items.push(...next.items);
    offset += next.items.length;
  }

  return items;
};

const journalByOrganization = (rows: JournalRow[]) => {
  const grouped = new Map<string, JournalRow[]>();
  rows.forEach((row) => {
    const key = normalize(row.organization_name);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });
  return grouped;
};

export const loadPortfolio = async (): Promise<PortfolioOrganization[]> => {
  const [organizations, journal] = await Promise.all([
    loadPage<OrganizationListItem>('/api/organizations'),
    apiRequest<JournalRow[]>('/api/workflow-journal?preset=all').catch(() => []),
  ]);
  const grouped = journalByOrganization(journal);

  if (organizations.length === 0) return samplePortfolio().map((item) => ({ ...item, shortName: `${item.shortName} * Демо` }));

  return organizations.map((organization) => {
    const related = [
      ...(grouped.get(normalize(organization.name)) ?? []),
      ...(organization.short_name ? grouped.get(normalize(organization.short_name)) ?? [] : []),
    ];
    const unique = new Map(related.map((row) => [row.id, row]));
    const programs = [...unique.values()];
    const programCount = organization.active_programs_count ?? programs.length;
    const healthScore = organization.worst_health_score ?? null;

    return {
      id: organization.id,
      logoFileId: organization.logo_file_id ?? null,
      name: organization.name,
      shortName: text(organization.short_name, organization.name),
      city: filledCity(organization.city),
      region: filledRegion(organization.region),
      typeName: text(organization.type_name, 'Площадка'),
      kam: text(organization.kam_name, 'KAM не назначен'),
      status: organizationStatus(organization.status),
      programCount,
      healthScore: programCount > 0 ? healthScore : null,
      healthBand: programCount > 0 ? healthBandOf(healthScore, organization.worst_health_band) : null,
      nearestRisk: filledRisk(organization.nearest_risk, programCount > 0),
      noActivity: organization.no_activity ?? programCount === 0,
      updatedAt: dateOnly(organization.updated_at),
      directions: [...new Set(programs.map((row) => row.direction_name).filter(Boolean))],
      products: [...new Set(programs.map((row) => row.product_name).filter(Boolean))],
    };
  });
};

const programRow = (
  program: ProgramInstance,
  journal: JournalRow | undefined,
  metrics: { students_count: number } | null,
  license: License | undefined,
): UniversityProgramRow => {
  const studentsAreTemporary = metrics?.students_count == null && journal?.students_count == null;
  const liveStudents = metrics?.students_count ?? journal?.students_count;

  return {
    id: program.id,
    directionId: program.direction_id,
    productId: program.product_id,
    directionName: program.direction_name,
    productName: program.product_name,
    playbookName: filledPlaybookName(program.playbook_name),
    stageName: filledStageName(journal?.current_stage_name || program.current_stage_code),
    status: program.status,
    healthScore: program.health_score,
    healthBand: healthBandOf(program.health_score, program.health_band),
    students: filledStudents(program.id, liveStudents),
    studentsAreTemporary,
    license: license
      ? `${transferLabel(license.transfer_status)}${license.license_number ? ` · ${license.license_number}` : ''}`
      : 'Лицензия не заведена',
  };
};

const withSamples = (card: UniversityCard): UniversityCard => {
  const hasDemo = !card.programs.length || !card.people.length || !card.contracts.length || !card.licenses.length || !card.teachers.length || !card.documents.length || !card.feed.length;
  return {
    ...card,
    comment: hasDemo ? [card.comment, '* Демо: пустые разделы заполнены временными данными.'].filter(Boolean).join(' ') : card.comment,
    programs: card.programs.length > 0 ? card.programs : samplePrograms(),
    people: card.people.length > 0 ? card.people : samplePeople(),
    contracts: card.contracts.length > 0 ? card.contracts : sampleContracts(),
    licenses: card.licenses.length > 0 ? card.licenses : sampleLicenses(),
    teachers: card.teachers.length > 0 ? card.teachers : sampleTeachers(),
    documents: card.documents.length > 0 ? card.documents : sampleDocuments(),
    feed: card.feed.length > 0 ? card.feed : sampleFeed(),
  };
};

const gapCard = (organization: PortfolioOrganization): UniversityCard => withSamples({
  id: organization.id,
  logoFileId: organization.logoFileId,
  name: organization.name,
  shortName: organization.shortName,
  typeName: organization.typeName,
  city: organization.city,
  region: organization.region,
  status: organization.status,
  kamName: 'Анна Соколова',
  comment: 'Демо-карточка: сервер не вернул площадки, состав разделов лежит в backendFieldGaps.ts.',
  healthScore: organization.healthScore,
  healthBand: organization.healthBand,
  programCount: organization.programCount,
  programs: [],
  people: [],
  contracts: [],
  licenses: [],
  teachers: [],
  documents: [],
  feed: [],
});

export const loadUniversityCard = async (id: string): Promise<UniversityCard> => {
  if (isGapRecord(id)) {
    const organization = samplePortfolio().find((item) => item.id === id) ?? samplePortfolio()[0];
    const card = gapCard(organization);
    return organization.programCount === 0 ? { ...card, programs: [] } : card;
  }

  const [organization, summary, health, people, programsPage, documents, feed, teachers, contracts, licenses, journal] = await Promise.all([
    apiRequest<OrganizationListItem>(`/api/organizations/${id}`),
    apiRequest<{ type_name: string; kam_name: string | null }>(`/api/organizations/${id}/360`),
    apiRequest<{ worst_health_score: number | null; worst_health_band: string | null; active_programs_count: number }>(`/api/organizations/${id}/health`).catch(() => null),
    apiRequest<Stakeholder[]>(`/api/organizations/${id}/stakeholders`).catch(() => []),
    apiRequest<Page<ProgramInstance>>(`/api/organizations/${id}/program-instances?limit=100`).catch(() => ({ items: [], total: 0 })),
    apiRequest<DocumentRow[]>(`/api/organizations/${id}/documents`).catch(() => []),
    apiRequest<FeedRow[]>(`/api/organizations/${id}/feed`).catch(() => []),
    apiRequest<Teacher[]>(`/api/organizations/${id}/teachers`).catch(() => []),
    apiRequest<Contract[]>(`/api/organizations/${id}/contracts`).catch(() => []),
    apiRequest<License[]>(`/api/organizations/${id}/licenses`).catch(() => []),
    apiRequest<JournalRow[]>('/api/workflow-journal?preset=all').catch(() => []),
  ]);
  const journalById = new Map(journal.map((row) => [row.id, row]));
  const metrics = await Promise.all(programsPage.items.map(async (program) => {
    const metric = await apiRequest<{ students_count: number } | null>(`/api/integrations/program-instances/${program.id}/metrics`).catch(() => null);
    return [program.id, metric] as const;
  }));
  const metricsById = new Map(metrics);
  const licenseByProgram = new Map(licenses.map((license) => [license.program_instance_id, license]));
  const programCount = health?.active_programs_count ?? programsPage.items.filter((item) => item.status === 'active' || item.status === 'paused' || item.status === 'draft').length;
  const programs = programsPage.items.map((program) => programRow(
    program,
    journalById.get(program.id),
    metricsById.get(program.id) ?? null,
    licenseByProgram.get(program.id),
  ));
  const programLabels = new Map(programs.map((program) => [program.id, `${program.directionName} · ${program.productName}`]));

  return withSamples({
    id: organization.id,
    logoFileId: organization.logo_file_id ?? null,
    name: organization.name,
    shortName: text(organization.short_name, organization.name),
    typeName: text(summary.type_name, 'Площадка'),
    city: filledCity(organization.city),
    region: filledRegion(organization.region),
    status: organizationStatus(organization.status),
    kamName: text(summary.kam_name, 'KAM не назначен'),
    comment: text(organization.comment),
    healthScore: programCount > 0 ? health?.worst_health_score ?? null : null,
    healthBand: programCount > 0 ? healthBandOf(health?.worst_health_score ?? null, health?.worst_health_band) : null,
    programCount,
    programs,
    people: people.map((person): UniversityPerson => ({
      id: person.id,
      roleCode: person.role_code,
      roleLabel: roleLabel(person.role_code),
      name: person.full_name,
      position: text(person.position, 'Должность не указана'),
      email: text(person.email, 'Почта не указана'),
      phone: text(person.phone, 'Телефон не указан'),
      isPrimary: person.is_primary,
      isActive: person.is_active,
      programId: person.program_instance_id,
      programLabel: person.program_instance_id ? programLabels.get(person.program_instance_id) ?? 'Программа' : 'На всю площадку',
    })),
    contracts: contracts.map((contract): UniversityContract => ({
      id: contract.id,
      number: contract.number,
      signedOn: dateOnly(contract.signed_on) || 'Дата не указана',
      validUntil: dateOnly(contract.valid_until) || 'Срок не указан',
      status: text(contract.status, 'без статуса'),
      current: Boolean(contract.signed_on) && contract.status !== 'expired',
      fileName: filledAttachmentName('contract', contract.attachment_id),
      attachmentId: contract.attachment_id,
    })),
    licenses: licenses.map((license): UniversityLicense => ({
      id: license.id,
      programId: license.program_instance_id,
      productName: license.product_name,
      number: text(license.license_number, 'Номер не указан'),
      signedOn: dateOnly(license.signed_at) || 'Дата не указана',
      validUntil: dateOnly(license.valid_until) || 'Срок не указан',
      transferStatus: license.transfer_status,
      access: text(license.product_access, 'Доступ не описан'),
      fileName: filledAttachmentName('license', license.attachment_id),
      attachmentId: license.attachment_id,
    })),
    teachers: teachers.map((teacher): UniversityTeacher => ({
      id: teacher.id,
      name: teacher.full_name,
      productName: teacher.product_name,
      status: teacher.status,
      trainedOn: dateOnly(teacher.trained_on) || 'Дата не указана',
      qualificationUntil: dateOnly(teacher.qualification_until) || 'Срок не указан',
      lastLmsActivity: dateOnly(teacher.last_lms_activity_on) || 'Сигнала LMS нет',
    })),
    documents: documents.map((document): UniversityDocument => ({
      id: document.file_id,
      name: document.filename,
      kind: text(document.kind, 'без типа'),
      programName: text(document.program_name, 'Без программы'),
      stageName: text(document.stage_name, 'Без этапа'),
      uploadedBy: text(document.uploaded_by_name, 'Автор не указан'),
      createdAt: dateOnly(document.created_at),
      attachmentId: document.attachment_id,
    })),
    feed: feed.map((event): UniversityFeedEvent => ({
      id: event.id,
      title: event.title,
      description: text(event.description, 'Без описания'),
      actor: text(event.actor_name, 'Система'),
      createdAt: event.created_at,
      kind: event.kind,
    })),
  });
};

export type StakeholderDraft = {
  roleCode: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  programId?: string;
};

const stakeholderBody = (draft: StakeholderDraft) => ({
  role_code: draft.roleCode,
  full_name: draft.name.trim(),
  position: draft.position.trim() || null,
  email: draft.email.trim() || null,
  phone: draft.phone.trim() || null,
  is_primary: draft.isPrimary,
  program_instance_id: draft.programId || null,
});

export const catalogTargets = {
  name: 'university.name',
  vendor: 'vendor.name',
  software: 'product.name',
  contract: 'contract.number',
  licenseSignedAt: 'license.signed_at',
  licenseYear: 'license.valid_until',
  transferStatus: 'license.transfer_status',
  manager: 'manager.full_name',
  responsibles: 'university_contact.full_name',
  comment: 'interaction.comment',
} as const;

export const importUniversityCatalog = async (file: File, fields: Array<{ source_column: string; target_field: string; required: boolean }>) => {
  const body = new FormData();
  body.append('file', file);
  const job = await apiRequest<{ id: string }>('/api/imports', { method: 'POST', body });
  await apiRequest(`/api/imports/${job.id}/mapping`, { method: 'PUT', body: JSON.stringify({ fields }) });
  const validated = await apiRequest<{ invalid_rows: number }>('/api/imports/' + job.id + '/validate', { method: 'POST' });
  if (validated.invalid_rows > 0) {
    const errors = await apiRequest<{ items: Array<{ row_number?: number; row?: number; message: string }> }>(`/api/imports/${job.id}/errors?limit=20`);
    const text = errors.items.map((item) => `Строка ${item.row_number ?? item.row ?? ''}: ${item.message}`).join('\n');
    throw new Error(text || 'В файле есть строки с ошибками');
  }
  return apiRequest<{ create_count: number; update_count: number }>(`/api/imports/${job.id}/confirm`, { method: 'POST' });
};

export const listEligibleKams = (organizationId: string) => apiRequest<Array<{ id: string; full_name: string }>>(`/api/organizations/${organizationId}/eligible-kams`);

export const assignOrganizationKam = (organizationId: string, kamUserId: string) => apiRequest(`/api/organizations/${organizationId}/assignments`, {
  method: 'POST',
  body: JSON.stringify({ kam_user_id: kamUserId }),
});

export const createStakeholder = (organizationId: string, draft: StakeholderDraft) => apiRequest(`/api/organizations/${organizationId}/stakeholders`, {
  method: 'POST',
  body: JSON.stringify(stakeholderBody(draft)),
});

export const updateStakeholder = (stakeholderId: string, draft: StakeholderDraft) => apiRequest(`/api/organizations/stakeholders/${stakeholderId}`, {
  method: 'PATCH',
  body: JSON.stringify(stakeholderBody(draft)),
});

export const deactivateStakeholder = (stakeholderId: string) => apiRequest(`/api/organizations/stakeholders/${stakeholderId}`, {
  method: 'PATCH',
  body: JSON.stringify({ is_active: false }),
});

export const updateLicense = (licenseId: string, draft: { number: string; validUntil: string; transferStatus: string; access: string }) => apiRequest(`/api/licenses/${licenseId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    license_number: draft.number.trim() || null,
    valid_until: draft.validUntil ? `${draft.validUntil}T00:00:00` : null,
    transfer_status: draft.transferStatus,
    product_access: draft.access.trim() || null,
  }),
});

export const syncOrganizationPrograms = async (programIds: string[]) => {
  const results = await Promise.all(programIds.map(async (programId) => {
    try {
      const result = await apiRequest<{ mapped: number; unmatched: number }>(`/api/integrations/program-instances/${programId}/sync`, { method: 'POST' });
      return { ok: true as const, ...result };
    } catch {
      return { ok: false as const, mapped: 0, unmatched: 0 };
    }
  }));

  return {
    programs: programIds.length,
    failed: results.filter((result) => !result.ok).length,
    mapped: results.reduce((sum, result) => sum + result.mapped, 0),
    unmatched: results.reduce((sum, result) => sum + result.unmatched, 0),
  };
};

export const loadMasterOptions = async () => {
  const [directions, products, windows, programs, links] = await Promise.all([
    loadPage<CatalogOption & { is_active?: boolean }>('/api/it-directions'),
    loadPage<CatalogOption & { is_active?: boolean }>('/api/it-products'),
    apiRequest<Array<{ id: string; title: string; is_current: boolean }>>('/api/academic-windows').catch(() => []),
    loadPage<{ id: string; direction_id: string; is_active?: boolean }>('/api/it-programs').catch(() => []),
    loadPage<{ program_id: string; product_id: string }>('/api/program-products').catch(() => []),
  ]);
  const directionByProgram = new Map(programs.filter((item) => item.is_active !== false).map((item) => [item.id, item.direction_id]));

  return {
    directions: directions.filter((item) => item.is_active !== false).map((item) => ({ id: item.id, name: item.name })),
    products: products.filter((item) => item.is_active !== false).map((item) => ({ id: item.id, name: item.name })),
    windows: windows.map((item): AcademicWindowOption => ({ id: item.id, name: item.title, current: item.is_current })),
    pairs: links.flatMap((link) => {
      const directionId = directionByProgram.get(link.program_id);
      return directionId ? [{ directionId, productId: link.product_id }] : [];
    }),
  };
};

export type PlaybookChoice = {
  id: string;
  code: string;
  name: string;
  recommended: boolean;
  disabled: boolean;
  reason: string | null;
};

export const listPlaybookChoices = (organizationId: string, directionId: string, productId: string) => (
  apiRequest<PlaybookChoice[]>(`/api/organizations/${organizationId}/available-playbooks?direction_id=${directionId}&product_id=${productId}`)
);

export const startUniversityProgram = (organizationId: string, draft: { directionId: string; productId: string; playbookTemplateId: string; windowId?: string }) => apiRequest<{ id: string }>(`/api/organizations/${organizationId}/program-instances`, {
  method: 'POST',
  body: JSON.stringify({
    direction_id: draft.directionId,
    product_id: draft.productId,
    playbook_template_id: draft.playbookTemplateId,
    academic_window_id: draft.windowId || null,
  }),
});
