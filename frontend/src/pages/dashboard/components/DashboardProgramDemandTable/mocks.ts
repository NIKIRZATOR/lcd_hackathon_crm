import type {
  DashboardProgramDemandItem,
  DashboardProgramDemandParams,
  DashboardProgramDemandResponse,
} from './types';

const dashboardProgramDemandMock: DashboardProgramDemandItem[] = [
  {
    id: '1',
    program: 'DevOps инженер',
    product: 'ПО «Basis»',
    universities: 8,
    streams: 18,
    students: 760,
    applications: 1250,
    demandIndex: 96,
  },
  {
    id: '2',
    program: 'Анализ данных без программирования',
    product: 'Apache Superset',
    universities: 12,
    streams: 15,
    students: 980,
    applications: 1680,
    demandIndex: 88,
  },
  {
    id: '3',
    program: 'Веб-разработка на платформе',
    product: 'Платформа «Акола»',
    universities: 10,
    streams: 13,
    students: 1240,
    applications: 1020,
    demandIndex: 82,
  },
  {
    id: '4',
    program: 'Управление ИТ-проектами',
    product: 'Система управления проектами',
    universities: 7,
    streams: 11,
    students: 650,
    applications: 1400,
    demandIndex: 76,
  },
  {
    id: '5',
    program: 'Создание мобильных приложений',
    product: 'ОС «Аврора»',
    universities: 9,
    streams: 9,
    students: 1100,
    applications: 690,
    demandIndex: 71,
  },
];

export const getDashboardProgramDemandMock = async ({
  sortBy,
  order,
}: DashboardProgramDemandParams): Promise<DashboardProgramDemandResponse> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 300);
  });

  const items = [...dashboardProgramDemandMock].sort((a, b) => {
    if (order === 'desc') {
      return b[sortBy] - a[sortBy];
    }

    return 0;
  });

  return {
    sortBy,
    order,
    items,
  };
};
