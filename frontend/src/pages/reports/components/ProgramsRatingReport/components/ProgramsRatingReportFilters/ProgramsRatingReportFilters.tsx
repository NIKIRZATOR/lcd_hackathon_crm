import type { SelectProps } from 'antd';

import Filters, { type FilterField } from '../../../../../../components/Filters/Filters';
import MobilePeriodPicker from '../../../../../../components/MobilePeriodPicker/MobilePeriodPicker';

import { ALL_TIME_START_DATE, MAX_PERIOD_DATE, REPORT_PERIOD_PRESETS } from '../../../../constants';
import type {
  ProgramsRatingReportFilterOption,
  ProgramsRatingReportFilterOptions,
  ProgramsRatingReportFiltersValues,
} from '../../types';

type ProgramsRatingReportFiltersProps = {
  options: ProgramsRatingReportFilterOptions;
  initialValues: ProgramsRatingReportFiltersValues;
  resetValues: ProgramsRatingReportFiltersValues;
  onApply: (values: ProgramsRatingReportFiltersValues) => void;
  onReset: () => void;
};

const getSelectOptions = (options: ProgramsRatingReportFilterOption[]): SelectProps['options'] =>
  options.map(({ id, name }) => ({
    value: id,
    label: name,
  }));

const ProgramsRatingReportFilters = ({
  options,
  initialValues,
  resetValues,
  onApply,
  onReset,
}: ProgramsRatingReportFiltersProps) => {
  const fields: FilterField<ProgramsRatingReportFiltersValues>[] = [
    {
      type: 'custom',
      name: 'period',
      label: 'Период',
      primary: true,
      render: () => (
        <MobilePeriodPicker
          minDate={ALL_TIME_START_DATE}
          maxDate={MAX_PERIOD_DATE}
          presets={REPORT_PERIOD_PRESETS}
        />
      ),
    },
    {
      type: 'select',
      name: 'universityIds',
      label: 'Организация',
      placeholder: 'Организации',
      options: getSelectOptions(options.universities),
    },
    {
      type: 'select',
      name: 'programIds',
      label: 'Программа',
      placeholder: 'Все программы',
      options: getSelectOptions(options.programs),
    },
    {
      type: 'select',
      name: 'productIds',
      label: 'ИТ-продукт',
      placeholder: 'Все продукты',
      options: getSelectOptions(options.products),
    },
    {
      type: 'select',
      name: 'responsibleIds',
      label: 'Ответственный',
      placeholder: 'Все сотрудники',
      options: getSelectOptions(options.responsibles),
    },
  ];

  return (
    <Filters<ProgramsRatingReportFiltersValues>
      fields={fields}
      initialValues={initialValues}
      resetValues={resetValues}
      onApply={onApply}
      onReset={onReset}
      applyButtonText="Сформировать отчёт"
      mobileModalTitle="Фильтры отчёта"
    />
  );
};

export default ProgramsRatingReportFilters;
