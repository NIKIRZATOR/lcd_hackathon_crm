import type { TableExportColumn } from '../../../../shared/export/types';

import type { DashboardProgramDemandItem } from './types';

export const programDemandExportColumns: TableExportColumn<DashboardProgramDemandItem>[] = [
  {
    key: 'program',
    title: 'Программа',
  },
  {
    key: 'product',
    title: 'ИТ-продукт',
  },
  {
    key: 'universities',
    title: 'Вузов',
  },
  {
    key: 'streams',
    title: 'Потоков',
  },
  {
    key: 'students',
    title: 'Обучающихся',
  },
  {
    key: 'applications',
    title: 'Заявок',
  },
  {
    key: 'demandIndex',
    title: 'Индекс востребованности',
  },
];
