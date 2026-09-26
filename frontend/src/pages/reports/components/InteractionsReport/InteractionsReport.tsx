import { Flex } from 'antd';
import { useMemo } from 'react';

import { useReportsSearchParams } from '../../hooks/useReportsSearchParams';
import type { ReportsFiltersValues } from '../../types';
import { filterReportItems } from '../../utils';

import ReportsFilters from '../ReportsFilters/ReportsFilters';
import ReportsTable from '../ReportsTable/ReportsTable';

import {
  getAvailableInteractionReportColumns,
  getDefaultInteractionReportColumnKeys,
} from './columns';
import { interactionsReportMock } from './mock';
import type { ReportItem } from './types';

const EMPTY_FILTERS: ReportsFiltersValues = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

type InteractionsReportProps = {
  showResponsible: boolean;
};

const InteractionsReport = ({ showResponsible }: InteractionsReportProps) => {
  const { filters, setFilters } = useReportsSearchParams({
    allowResponsibleFilter: showResponsible,
  });

  const reportItems = useMemo(
    () => filterReportItems(interactionsReportMock.items, interactionsReportMock.filters, filters),
    [filters],
  );

  const columnDefinitions = useMemo(
    () => getAvailableInteractionReportColumns(showResponsible),
    [showResponsible],
  );

  const defaultColumnKeys = useMemo(
    () => getDefaultInteractionReportColumnKeys(showResponsible),
    [showResponsible],
  );

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Flex vertical gap={20}>
      <ReportsFilters
        options={interactionsReportMock.filters}
        initialValues={filters}
        resetValues={EMPTY_FILTERS}
        showResponsible={showResponsible}
        onApply={setFilters}
        onReset={handleReset}
      />

      <ReportsTable<ReportItem>
        key={showResponsible ? 'with-responsible' : 'without-responsible'}
        items={reportItems}
        columnDefinitions={columnDefinitions}
        defaultColumnKeys={defaultColumnKeys}
        subtitle={`Найдено взаимодействий: ${reportItems.length}`}
        exportConfig={{
          fileName: 'interactions-report',
          sheetName: 'Взаимодействия',
          pdfTitle: 'Отчёт по взаимодействиям',
        }}
      />
    </Flex>
  );
};

export default InteractionsReport;
