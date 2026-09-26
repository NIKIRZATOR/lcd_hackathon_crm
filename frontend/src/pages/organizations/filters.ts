import type { UniversityFilters, UniversityItem } from './types';

export const filterUniversities = (items: UniversityItem[], filters: UniversityFilters) => {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    const matchesSearch =
      !query ||
      [item.name, item.shortName, item.city, item.manager].some((value) => value.toLowerCase().includes(query));

    const inPeriod = !filters.period || (item.activityAt >= filters.period[0] && item.activityAt <= filters.period[1]);

    return (
      matchesSearch &&
      inPeriod &&
      (!filters.status || item.status === filters.status) &&
      (!filters.region || item.region === filters.region) &&
      (!filters.type || item.type === filters.type) &&
      (!filters.profile || item.profile === filters.profile) &&
      (!filters.product || item.product === filters.product) &&
      (!filters.manager || item.manager === filters.manager)
    );
  });
};

export const summarizeUniversities = (items: UniversityItem[]) => ({
  total: items.length,
  active: items.filter((item) => item.status === 'active').length,
  progress: items.filter((item) => item.status === 'progress').length,
  paused: items.filter((item) => item.status === 'paused').length,
  regions: new Set(items.map((item) => item.region)).size,
  federal: items.filter((item) => item.type === 'federal').length,
});

export const hasActiveUniversityFilters = (filters: UniversityFilters) =>
  Object.values(filters).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== '' && value != null;
  });

