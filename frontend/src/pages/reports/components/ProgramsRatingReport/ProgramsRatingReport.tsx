import { Flex } from 'antd';

import ProgramsRatingReportFilters from './components/ProgramsRatingReportFilters/ProgramsRatingReportFilters';
import ProgramsRatingReportTable from './components/ProgramsRatingReportTable/ProgramsRatingReportTable';
import { useProgramsRatingReportSearchParams } from '../../hooks/useProgramsRatingReportSearchParams';
import { programsRatingReportMock } from './mocks';
import type { ProgramsRatingReportFiltersValues } from './types';

const EMPTY_FILTERS: ProgramsRatingReportFiltersValues = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

const ProgramsRatingReport = () => {
  const { filters, setFilters } = useProgramsRatingReportSearchParams();

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Flex vertical gap={20}>
      <ProgramsRatingReportFilters
        options={programsRatingReportMock.filters}
        initialValues={filters}
        resetValues={EMPTY_FILTERS}
        onApply={setFilters}
        onReset={handleReset}
      />

      <ProgramsRatingReportTable items={programsRatingReportMock.items} />
    </Flex>
  );
};

export default ProgramsRatingReport;
