import type { SelectProps } from 'antd';

type OptionMock = {
  id: number;
  name: string;
};

const toSelectOptions = (items: OptionMock[]): SelectProps['options'] =>
  items.map(({ id, name }) => ({
    value: id,
    label: name,
  }));

export const universitiesMock: OptionMock[] = [
  {
    id: 1,
    name: 'РЭУ',
  },
  {
    id: 2,
    name: 'РАНХиГС',
  },
  {
    id: 3,
    name: 'Станкин',
  },
  {
    id: 4,
    name: 'СГТУ',
  },
  {
    id: 5,
    name: 'Сеченовский',
  },
  {
    id: 6,
    name: 'Томский политех',
  },
  {
    id: 7,
    name: 'Чеченский государственный университет',
  },
  {
    id: 8,
    name: 'Тюменский университет',
  },
  {
    id: 9,
    name: 'Тульский ГУ',
  },
  {
    id: 10,
    name: 'ТГУ',
  },
  {
    id: 11,
    name: 'СКГА',
  },
  {
    id: 12,
    name: 'Самарский политех',
  },
  {
    id: 13,
    name: 'НВГУ',
  },
  {
    id: 14,
    name: 'МЭИ',
  },
  {
    id: 15,
    name: 'МФТИ',
  },
  {
    id: 16,
    name: 'КФУ',
  },
  {
    id: 17,
    name: 'КАИ',
  },
  {
    id: 18,
    name: 'ГУ',
  },
  {
    id: 19,
    name: 'Волгоградский государственный технический университет',
  },
];

export const programsMock: OptionMock[] = [
  {
    id: 1,
    name: 'Основы UX/UI-дизайна',
  },
  {
    id: 2,
    name: 'Python-разработчик с использованием инструментов ИИ',
  },
  {
    id: 3,
    name: 'Графический дизайн пользовательских интерфейсов',
  },
  {
    id: 4,
    name: 'Введение в информационную безопасность',
  },
  {
    id: 5,
    name: 'Инженер-тестировщик',
  },
  {
    id: 6,
    name: 'DevOps-инженер с нуля',
  },
  {
    id: 7,
    name: 'Анализ данных без программирования',
  },
  {
    id: 8,
    name: 'Веб-разработка на платформе «Акола»',
  },
  {
    id: 9,
    name: 'Промпт-инжиниринг',
  },
  {
    id: 10,
    name: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
  },
  {
    id: 11,
    name: 'Специалист по анализу данных',
  },
  {
    id: 12,
    name: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
  },
  {
    id: 13,
    name: 'Devops инженер (работа с технологической платформой "Базис")',
  },
  {
    id: 14,
    name: 'Аналитика данных и методы искусственного интеллекта (работа с программными продуктами ПАО «Ростелеком» для аналитики данных)',
  },
  {
    id: 15,
    name: 'Анализ данных в Low-code платформах',
  },
  {
    id: 16,
    name: 'Технологии распределенного реестра (для преподавателей)',
  },
  {
    id: 17,
    name: 'Технологии распределенного реестра с использованием программных решений от компании Ростелеком',
  },
  {
    id: 18,
    name: 'Искусственный Интеллект. Применение',
  },
  {
    id: 19,
    name: 'Искусственный Интеллект. Базовые навыки',
  },
  {
    id: 20,
    name: 'Курс: SQL разработчик (вводный курс)',
  },
  {
    id: 21,
    name: 'Курс: Аналитика данных на Python',
  },
  {
    id: 22,
    name: 'Курс: Введение в аналитику данных',
  },
  {
    id: 23,
    name: 'Курс: DevOps-инженер с нуля',
  },
  {
    id: 24,
    name: 'Курс: Специалист по анализу данных',
  },
];

export const productsMock: OptionMock[] = [
  {
    id: 1,
    name: 'Apache Superset',
  },
  {
    id: 2,
    name: 'Платформа «Акола»',
  },
  {
    id: 3,
    name: 'ОС «Аврора»',
  },
  {
    id: 4,
    name: 'Система управления проектами «Яга»',
  },
  {
    id: 5,
    name: 'ПО «Basis»',
  },
  {
    id: 6,
    name: 'RT.Web3Gate',
  },
];

export const responsiblesMock: OptionMock[] = [
  {
    id: 1,
    name: 'Иванов Иван',
  },
  {
    id: 2,
    name: 'Петров Пётр',
  },
  {
    id: 3,
    name: 'Сидорова Анна',
  },
];

export const universityOptionsMock = toSelectOptions(universitiesMock);

export const programOptionsMock = toSelectOptions(programsMock);

export const productOptionsMock = toSelectOptions(productsMock);

export const responsibleOptionsMock = toSelectOptions(responsiblesMock);
