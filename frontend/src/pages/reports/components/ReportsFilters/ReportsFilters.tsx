import type { SelectProps } from 'antd';

import Filters, { type FilterField } from '../../../../components/Filters/Filters';
import MobilePeriodPicker from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

import { ALL_TIME_START_DATE, MAX_PERIOD_DATE, REPORT_PERIOD_PRESETS } from '../../constants';
import type { ReportFilterOption, ReportsFilterOptions, ReportsFiltersValues } from '../../types';

type ReportsFiltersProps = {
  options: ReportsFilterOptions;
  initialValues: ReportsFiltersValues;
  resetValues: ReportsFiltersValues;
  showResponsible: boolean;
  onApply: (values: ReportsFiltersValues) => void;
  onReset: () => void;
};

const getSelectOptions = (options: ReportFilterOption[]): SelectProps['options'] =>
  options.map(({ id, name }) => ({
    value: id,
    label: name,
  }));

const ReportsFilters = ({
  options,
  initialValues,
  resetValues,
  showResponsible,
  onApply,
  onReset,
}: ReportsFiltersProps) => {
  const fields: FilterField<ReportsFiltersValues>[] = [
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
      label: 'Вуз',
      placeholder: 'Все вузы',
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
  ];

  if (showResponsible) {
    fields.push({
      type: 'select',
      name: 'responsibleIds',
      label: 'Ответственный',
      placeholder: 'Все сотрудники',
      options: getSelectOptions(options.responsibles),
    });
  }

  return (
    <Filters<ReportsFiltersValues>
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

export default ReportsFilters;
