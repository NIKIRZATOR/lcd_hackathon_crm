import dayjs from 'dayjs';

import type {
  ProgramReportItem,
  ProgramReportMetricItem,
  ProgramReportUniversityItem,
  ProgramsReportFiltersValues,
} from './types';

type ProgramAccumulator = {
  id: string;

  programId: number;
  program: string;

  productId: number;
  product: string;

  applications: number;
  students: number;
  streams: number;

  universityItems: Map<number, ProgramReportUniversityItem>;
};

const matchesIds = (selectedIds: number[], value: number) =>
  !selectedIds.length || selectedIds.includes(value);

const matchesPeriod = (date: string, period: ProgramsReportFiltersValues['period']) => {
  if (!period) {
    return true;
  }

  const currentDate = dayjs(date);

  return !currentDate.isBefore(period[0], 'day') && !currentDate.isAfter(period[1], 'day');
};

export const buildProgramsReportItems = (
  metrics: ProgramReportMetricItem[],
  filters: ProgramsReportFiltersValues,
): ProgramReportItem[] => {
  const filteredMetrics = metrics.filter(
    (item) =>
      matchesPeriod(item.date, filters.period) &&
      matchesIds(filters.universityIds, item.university.id) &&
      matchesIds(filters.programIds, item.programId) &&
      matchesIds(filters.productIds, item.productId) &&
      matchesIds(filters.responsibleIds, item.responsible.id),
  );

  const groupedItems = new Map<string, ProgramAccumulator>();

  filteredMetrics.forEach((item) => {
    const key = `${item.programId}-${item.productId}`;

    const universityItem: ProgramReportUniversityItem = {
      university: item.university,
      responsible: item.responsible,
      implementationStatus: item.implementationStatus,
      applications: item.applications,
      students: item.students,
      streams: item.streams,
    };

    const current = groupedItems.get(key);

    if (current) {
      current.applications += item.applications;
      current.students += item.students;
      current.streams += item.streams;

      current.universityItems.set(item.university.id, universityItem);

      return;
    }

    groupedItems.set(key, {
      id: key,

      programId: item.programId,
      program: item.program,

      productId: item.productId,
      product: item.product,

      applications: item.applications,
      students: item.students,
      streams: item.streams,

      universityItems: new Map([[item.university.id, universityItem]]),
    });
  });

  return Array.from(groupedItems.values()).map((item) => {
    const universityItems = Array.from(item.universityItems.values());

    const responsibleIds = new Set(universityItems.map(({ responsible }) => responsible.id));

    const implementedUniversities = universityItems.filter(
      ({ implementationStatus }) => implementationStatus === 'implemented',
    ).length;

    const universities = universityItems.length;

    return {
      id: item.id,

      programId: item.programId,
      program: item.program,

      productId: item.productId,
      product: item.product,

      applications: item.applications,
      students: item.students,
      streams: item.streams,

      universities,
      responsibles: responsibleIds.size,

      implementedUniversities,

      implementationShare:
        universities > 0 ? Math.round((implementedUniversities / universities) * 100) : 0,

      universityItems,
    };
  });
};

