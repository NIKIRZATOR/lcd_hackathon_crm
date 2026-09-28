import { Alert, Flex, Spin } from 'antd';
import { useMemo } from 'react';

import { useProgramsFilterOptions } from '../../hooks/useProgramsFilterOptions';
import { useProgramsReportPreview } from '../../hooks/useProgramsReportPreview';
import { useProgramsSearchParams } from '../../hooks/useProgramsSearchParams';

import ReportsTable from '../ReportsTable/ReportsTable';

import { getAvailableProgramReportColumns, getDefaultProgramReportColumnKeys } from './columns';
import ProgramsFilter from './components/ProgramsFilter';
import { createEmptyProgramsFilters } from './types/programsFilters';
import type { ReportItem } from './types/types';

type ProgramsReportProps = {
  showResponsible: boolean;
};

const EMPTY_FILTERS = createEmptyProgramsFilters();

const ProgramsReport = ({ showResponsible }: ProgramsReportProps) => {
  const { options } = useProgramsFilterOptions();

  const { filters, setFilters } = useProgramsSearchParams({
    allowResponsibleFilter: showResponsible,
  });

  const { data, loading, error } = useProgramsReportPreview(filters);

  const columnDefinitions = useMemo(
    () => getAvailableProgramReportColumns(showResponsible),
    [showResponsible],
  );

  const defaultColumnKeys = useMemo(
    () => getDefaultProgramReportColumnKeys(showResponsible),
    [showResponsible],
  );

  const subtitle = useMemo(() => {
    const total = data?.total ?? 0;
    const aggregates = data?.aggregates;

    return [
      `Найдено программ: ${total}`,
      `Заявок: ${aggregates?.applications ?? 0}`,
      `Потоков: ${aggregates?.streams ?? 0}`,
      `Студентов: ${aggregates?.students ?? 0}`,
    ].join(' · ');
  }, [data]);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Flex vertical gap={20}>
      {options && (
        <ProgramsFilter
          options={options}
          initialValues={filters}
          resetValues={EMPTY_FILTERS}
          showResponsible={showResponsible}
          onApply={setFilters}
          onReset={handleReset}
        />
      )}

      {error && (
        <Alert type="error" showIcon message="Не удалось загрузить отчёт" description={error} />
      )}

      <Spin spinning={loading}>
        <ReportsTable<ReportItem>
          key={showResponsible ? 'with-responsible' : 'without-responsible'}
          items={data?.items ?? []}
          columnDefinitions={columnDefinitions}
          defaultColumnKeys={defaultColumnKeys}
          subtitle={subtitle}
          exportConfig={{
            fileName: 'programs-report',
            sheetName: 'Программы',
            pdfTitle: 'Отчёт по программам',
          }}
        />
      </Spin>
    </Flex>
  );
};

export default ProgramsReport;
