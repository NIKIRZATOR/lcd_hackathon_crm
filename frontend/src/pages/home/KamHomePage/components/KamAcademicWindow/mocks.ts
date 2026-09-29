import type { AcademicWindow } from '../../types';

type AcademicWindowMock = {
  academicWindow: AcademicWindow;
  atRiskProgramsCount: number;
};

export const academicWindowMock: AcademicWindowMock = {
  academicWindow: {
    id: 1,
    title: 'Осень 2026/27',
    plan_cutoff_on: '2026-10-15',
    classes_start_on: '2026-09-01',
    classes_end_on: '2027-01-31',
    is_current: true,
  },
  atRiskProgramsCount: 2,
};
