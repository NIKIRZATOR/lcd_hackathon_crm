import type { SelectProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { PeriodPreset } from '../../../../components/MobilePeriodPicker/MobilePeriodPicker';

import {
  productOptionsMock,
  programOptionsMock,
  responsibleOptionsMock,
  universityOptionsMock,
} from './mocks';
import type { DashboardFiltersValues, SelectFilterName } from './types';

export const filtersInitialValues: DashboardFiltersValues = {
  period: null,
  universityIds: [],
  programIds: [],
  productIds: [],
  responsibleIds: [],
};

export const ALL_TIME_START_DATE = dayjs('2009-01-01');
export const MAX_PERIOD_DATE = dayjs().endOf('year');

export const periodPresets: PeriodPreset[] = [
  {
    label: 'За всё время',
    value: [ALL_TIME_START_DATE, dayjs()] as [Dayjs, Dayjs],
  },
  {
    label: 'Текущий месяц',
    value: [dayjs().startOf('month'), dayjs()] as [Dayjs, Dayjs],
  },
  {
    label: 'Последние полгода',
    value: [dayjs().subtract(6, 'month'), dayjs()] as [Dayjs, Dayjs],
  },
  {
    label: 'Текущий год',
    value: [dayjs().startOf('year'), dayjs()] as [Dayjs, Dayjs],
  },
];

export type SelectFilterConfig = {
  name: SelectFilterName;
  label: string;
  placeholder: string;
  options: SelectProps['options'];
};

export const selectFilters: SelectFilterConfig[] = [
  {
    name: 'universityIds',
    label: 'Организация',
    placeholder: 'Все вузы',
    options: universityOptionsMock,
  },
  {
    name: 'programIds',
    label: 'Программа',
    placeholder: 'Все программы',
    options: programOptionsMock,
  },
  {
    name: 'productIds',
    label: 'ИТ-продукт',
    placeholder: 'Все продукты',
    options: productOptionsMock,
  },
  {
    name: 'responsibleIds',
    label: 'Ответственный',
    placeholder: 'Все сотрудники',
    options: responsibleOptionsMock,
  },
];
