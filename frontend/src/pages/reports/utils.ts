import dayjs from 'dayjs';

import type { ReportItem } from './components/InteractionsReport/types';
import type { ReportFilterOption, ReportsFilterOptions, ReportsFiltersValues } from './types';

const matchesOption = (selectedIds: number[], options: ReportFilterOption[], value: string) => {
  if (!selectedIds.length) {
    return true;
  }

  return options.some((option) => selectedIds.includes(option.id) && option.name === value);
};

export const filterReportItems = (
  items: ReportItem[],
  options: ReportsFilterOptions,
  filters: ReportsFiltersValues,
) =>
  items.filter((item) => {
    const matchesUniversity = matchesOption(
      filters.universityIds,
      options.universities,
      item.university,
    );

    const matchesProgram = matchesOption(filters.programIds, options.programs, item.program);

    const matchesProduct = matchesOption(filters.productIds, options.products, item.product);

    const matchesResponsible = matchesOption(
      filters.responsibleIds,
      options.responsibles,
      item.responsible,
    );

    const matchesPeriod = (() => {
      if (!filters.period) {
        return true;
      }

      const [start, end] = filters.period;

      const [day, month, year] = item.startDate.split('.');
      const itemDate = dayjs(`${year}-${month}-${day}`);

      return !itemDate.isBefore(start, 'day') && !itemDate.isAfter(end, 'day');
    })();

    return (
      matchesPeriod && matchesUniversity && matchesProgram && matchesProduct && matchesResponsible
    );
  });
