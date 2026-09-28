import type { KamSignal } from '../../types';

export const kamSignalsMock: KamSignal[] = [
  {
    id: 1,
    source: 'lms',
    type: 'students_update',
    organizationName: 'ЮФУ',
    productName: 'DevOps',
    programName: 'DevOps',
    programInstanceId: 101,
    value: 24,
  },
  {
    id: 2,
    source: 'website',
    type: 'applications_period',
    programName: 'Аналитика',
    programInstanceId: 102,
    value: 37,
  },
  {
    id: 3,
    source: 'lms',
    type: 'lms_silence',
    organizationName: 'СПбПУ',
    productName: 'QA',
    programName: 'QA',
    programInstanceId: 103,
    days: 34,
  },
];
