import type { SelectProps } from 'antd';

import Filters, { type FilterField } from '../../../../../components/Filters/Filters';
import MobilePeriodPicker from '../../../../../components/MobilePeriodPicker/MobilePeriodPicker';

import { ALL_TIME_START_DATE, MAX_PERIOD_DATE, REPORT_PERIOD_PRESETS } from '../../../constants';

import type {
  ProgramFilterOption,
  ProgramsFilterOptions,
  ProgramsFilterValues,
} from '../types/programsFilters';

type ProgramsFilterProps = {
  options: ProgramsFilterOptions;
  initialValues: ProgramsFilterValues;
  resetValues: ProgramsFilterValues;
  showResponsible: boolean;
  onApply: (values: ProgramsFilterValues) => void;
  onReset: () => void;
};

const getSelectOptions = (options: ProgramFilterOption[]): SelectProps['options'] =>
  options.map(({ id, name }) => ({
    value: id,
    label: name,
  }));

const getStringOptions = (options: string[]): SelectProps['options'] =>
  options.map((value) => ({
    value,
    label: value,
  }));

const ProgramsFilter = ({
  options,
  initialValues,
  resetValues,
  showResponsible,
  onApply,
  onReset,
}: ProgramsFilterProps) => {
  const fields: FilterField<ProgramsFilterValues>[] = [
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
      name: 'organization_ids',
      label: 'Организация',
      placeholder: 'Все организации',
      options: getSelectOptions(options.organizations),
    },
    {
      type: 'select',
      name: 'direction_ids',
      label: 'Направление',
      placeholder: 'Все направления',
      options: getSelectOptions(options.directions),
    },
    {
      type: 'select',
      name: 'product_ids',
      label: 'ИТ-продукт',
      placeholder: 'Все продукты',
      options: getSelectOptions(options.products),
    },
    {
      type: 'select',
      name: 'playbook_ids',
      label: 'Плейбук',
      placeholder: 'Все playbook',
      options: getSelectOptions(options.playbooks),
    },
    {
      type: 'select',
      name: 'stage_ids',
      label: 'Этап',
      placeholder: 'Все этапы',
      options: getSelectOptions(options.stages),
    },
    {
      type: 'select',
      name: 'health_bands',
      label: 'Health',
      placeholder: 'Все уровни',
      options: getStringOptions(options.health_bands),
    },
    {
      type: 'select',
      name: 'statuses',
      label: 'Статус',
      placeholder: 'Все статусы',
      options: getStringOptions(options.statuses),
    },
  ];

  if (showResponsible) {
    fields.splice(4, 0, {
      type: 'select',
      name: 'responsible_user_ids',
      label: 'Ответственный',
      placeholder: 'Все сотрудники',
      options: getSelectOptions(options.responsibles),
    });
  }

  return (
    <Filters<ProgramsFilterValues>
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

export default ProgramsFilter;
