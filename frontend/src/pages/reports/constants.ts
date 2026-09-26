import dayjs from 'dayjs';

import type { PeriodPreset } from '../../components/MobilePeriodPicker/MobilePeriodPicker';

export const ALL_TIME_START_DATE = dayjs('2009-01-01');

export const MAX_PERIOD_DATE = dayjs();

export const REPORT_PERIOD_PRESETS: PeriodPreset[] = [
  {
    label: 'За всё время',
    value: [ALL_TIME_START_DATE, MAX_PERIOD_DATE],
  },
  {
    label: 'Текущий месяц',
    value: [MAX_PERIOD_DATE.startOf('month'), MAX_PERIOD_DATE],
  },
  {
    label: 'Последние полгода',
    value: [MAX_PERIOD_DATE.subtract(6, 'month'), MAX_PERIOD_DATE],
  },
  {
    label: 'Текущий год',
    value: [MAX_PERIOD_DATE.startOf('year'), MAX_PERIOD_DATE],
  },
];
