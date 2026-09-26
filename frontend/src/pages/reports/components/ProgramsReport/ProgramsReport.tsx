import { Flex } from 'antd';
import { useMemo } from 'react';

import ProgramsReportFilters from './components/ProgramsReportFilters/ProgramsReportFilters';
import ProgramsReportTable from './components/ProgramsReportTable/ProgramsReportTable';
import { useProgramsReportSearchParams } from './hooks/useProgramsReportSearchParams';
import { programsReportMock } from './mocks';
import type { ProgramsReportFiltersValues } from './types';
import { buildProgramsReportItems } from './utils';

const EMPTY_FILTERS: ProgramsReportFiltersValues = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

const ProgramsReport = () => {
  const { filters, setFilters } = useProgramsReportSearchParams();

  const reportItems = useMemo(
    () => buildProgramsReportItems(programsReportMock.metrics, filters),
    [filters],
  );

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Flex vertical gap={20}>
      <ProgramsReportFilters
        options={programsReportMock.filters}
        initialValues={filters}
        resetValues={EMPTY_FILTERS}
        onApply={setFilters}
        onReset={handleReset}
      />

      <ProgramsReportTable items={reportItems} />
    </Flex>
  );
};

export default ProgramsReport;
