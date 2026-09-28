import { Alert, Flex, Spin } from 'antd';

import { useProgramsRatingFilterOptions } from '../../hooks/useProgramsRatingFilterOptions';
import { useProgramsRatingReport } from '../../hooks/useProgramsRatingReport';
import { useProgramsRatingReportSearchParams } from '../../hooks/useProgramsRatingReportSearchParams';

import ProgramsRatingReportFilters from './components/ProgramsRatingReportFilters/ProgramsRatingReportFilters';
import ProgramsRatingReportTable from './components/ProgramsRatingReportTable/ProgramsRatingReportTable';
import type { ProgramsRatingReportFiltersValues } from './types';

const EMPTY_FILTERS: ProgramsRatingReportFiltersValues = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

const ProgramsRatingReport = () => {
  const { options } = useProgramsRatingFilterOptions();

  const { filters, setFilters } = useProgramsRatingReportSearchParams();

  const { data, loading, error } = useProgramsRatingReport(filters);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Flex vertical gap={20}>
      {options && (
        <ProgramsRatingReportFilters
          options={options}
          initialValues={filters}
          resetValues={EMPTY_FILTERS}
          onApply={setFilters}
          onReset={handleReset}
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить рейтинг программ"
          description={error}
        />
      )}

      <Spin spinning={loading}>
        <ProgramsRatingReportTable items={data?.items ?? []} total={data?.total ?? 0} />
      </Spin>
    </Flex>
  );
};

export default ProgramsRatingReport;
