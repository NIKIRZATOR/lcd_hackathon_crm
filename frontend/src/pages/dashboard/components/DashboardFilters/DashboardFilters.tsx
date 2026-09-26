import Filters, { type FilterField } from '../../../../components/Filters/Filters';
import MobilePeriodPicker from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

import {
  ALL_TIME_START_DATE,
  filtersInitialValues,
  MAX_PERIOD_DATE,
  periodPresets,
  selectFilters,
} from './constants';

import type { DashboardFiltersValues } from './types';

type DashboardFiltersProps = {
  onApply: (values: DashboardFiltersValues) => void;
};

const DashboardFilters = ({ onApply }: DashboardFiltersProps) => {
  const fields: FilterField<DashboardFiltersValues>[] = [
    {
      type: 'custom',
      name: 'period',
      label: 'Период',
      primary: true,
      render: () => (
        <MobilePeriodPicker
          minDate={ALL_TIME_START_DATE}
          maxDate={MAX_PERIOD_DATE}
          presets={periodPresets}
        />
      ),
    },

    ...selectFilters.map(({ name, label, placeholder, options }) => ({
      type: 'select' as const,
      name,
      label,
      placeholder,
      options,
    })),
  ];

  return (
    <Filters<DashboardFiltersValues>
      fields={fields}
      initialValues={filtersInitialValues}
      onApply={onApply}
    />
  );
};

export default DashboardFilters;
