import type { ProgramsRatingReportMock } from './types';

export const programsRatingReportMock: ProgramsRatingReportMock = {
  filters: {
    universities: [
      { id: 1, name: 'РЭУ' },
      { id: 2, name: 'РАНХиГС' },
      { id: 3, name: 'Станкин' },
      { id: 4, name: 'СГТУ' },
      { id: 5, name: 'Сеченовский университет' },
      { id: 6, name: 'Томский политех' },
      { id: 7, name: 'Чеченский государственный университет' },
      { id: 8, name: 'Тюменский университет' },
      { id: 9, name: 'Тульский ГУ' },
      { id: 10, name: 'ТГУ' },
      { id: 11, name: 'СКГА' },
      { id: 12, name: 'Самарский политех' },
      { id: 13, name: 'НВГУ' },
      { id: 14, name: 'МЭИ' },
      { id: 15, name: 'МФТИ' },
      { id: 16, name: 'КФУ' },
      { id: 17, name: 'КАИ' },
      { id: 18, name: 'ГУ' },
      {
        id: 19,
        name: 'Волгоградский государственный технический университет',
      },
      { id: 20, name: 'МГУ' },
      { id: 21, name: 'НИУ ВШЭ' },
      { id: 22, name: 'ИТМО' },
    ],

    programs: [
      { id: 1, name: 'Основы UX/UI-дизайна' },
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
        name: 'DevOps инженер (работа с технологической платформой «Базис»)',
      },
      {
        id: 14,
        name: 'Аналитика данных и методы искусственного интеллекта',
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
        name: 'SQL разработчик (вводный курс)',
      },
      {
        id: 21,
        name: 'Аналитика данных на Python',
      },
      {
        id: 22,
        name: 'Введение в аналитику данных',
      },
    ],

    products: [
      { id: 1, name: 'Базис' },
      { id: 2, name: 'TData' },
      { id: 3, name: 'Solar' },
      { id: 4, name: 'Ростелеком Ключ' },
      { id: 5, name: 'Акола' },
      { id: 6, name: 'Аврора' },
      { id: 7, name: 'ИИ-платформа' },
      { id: 8, name: 'Low-code платформа' },
      { id: 9, name: 'Платформа распределенного реестра' },
      { id: 10, name: 'Без привязки к ИТ-продукту' },
    ],

    responsibles: [
      { id: 1, name: 'Иван Иванов' },
      { id: 2, name: 'Мария Смирнова' },
      { id: 3, name: 'Анна Петрова' },
      { id: 4, name: 'Алексей Соколов' },
      { id: 5, name: 'Елена Кузнецова' },
      { id: 6, name: 'Дмитрий Волков' },
    ],
  },

  items: [
    {
      id: '1-10',
      programId: 1,
      program: 'Основы UX/UI-дизайна',
      productId: 10,
      product: 'Без привязки к ИТ-продукту',

      universities: 2,
      implementedUniversities: 1,
      implementationShare: 50,

      applications: 160,
      students: 81,
      streams: 4,

      rating: 72,

      universityItems: [
        {
          university: {
            id: 1,
            name: 'РЭУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 92,
          students: 47,
          streams: 2,
        },
        {
          university: {
            id: 8,
            name: 'Тюменский университет',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'inProgress',
          applications: 68,
          students: 34,
          streams: 2,
        },
      ],
    },

    {
      id: '2-7',
      programId: 2,
      program: 'Python-разработчик с использованием инструментов ИИ',
      productId: 7,
      product: 'ИИ-платформа',

      universities: 3,
      implementedUniversities: 3,
      implementationShare: 100,

      applications: 438,
      students: 238,
      streams: 11,

      rating: 96,

      universityItems: [
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 164,
          students: 89,
          streams: 4,
        },
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 148,
          students: 76,
          streams: 4,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 126,
          students: 73,
          streams: 3,
        },
      ],
    },

    {
      id: '3-10',
      programId: 3,
      program: 'Графический дизайн пользовательских интерфейсов',
      productId: 10,
      product: 'Без привязки к ИТ-продукту',

      universities: 2,
      implementedUniversities: 1,
      implementationShare: 50,

      applications: 134,
      students: 67,
      streams: 3,

      rating: 61,

      universityItems: [
        {
          university: {
            id: 4,
            name: 'СГТУ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'implemented',
          applications: 73,
          students: 38,
          streams: 2,
        },
        {
          university: {
            id: 12,
            name: 'Самарский политех',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'inProgress',
          applications: 61,
          students: 29,
          streams: 1,
        },
      ],
    },

    {
      id: '4-3',
      programId: 4,
      program: 'Введение в информационную безопасность',
      productId: 3,
      product: 'Solar',

      universities: 3,
      implementedUniversities: 3,
      implementationShare: 100,

      applications: 361,
      students: 194,
      streams: 9,

      rating: 91,

      universityItems: [
        {
          university: {
            id: 14,
            name: 'МЭИ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'implemented',
          applications: 134,
          students: 72,
          streams: 3,
        },
        {
          university: {
            id: 5,
            name: 'Сеченовский университет',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 105,
          students: 56,
          streams: 3,
        },
        {
          university: {
            id: 20,
            name: 'МГУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 122,
          students: 66,
          streams: 3,
        },
      ],
    },

    {
      id: '5-10',
      programId: 5,
      program: 'Инженер-тестировщик',
      productId: 10,
      product: 'Без привязки к ИТ-продукту',

      universities: 2,
      implementedUniversities: 1,
      implementationShare: 50,

      applications: 203,
      students: 105,
      streams: 5,

      rating: 70,

      universityItems: [
        {
          university: {
            id: 3,
            name: 'Станкин',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 116,
          students: 63,
          streams: 3,
        },
        {
          university: {
            id: 9,
            name: 'Тульский ГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'inProgress',
          applications: 87,
          students: 42,
          streams: 2,
        },
      ],
    },

    {
      id: '6-1',
      programId: 6,
      program: 'DevOps-инженер с нуля',
      productId: 1,
      product: 'Базис',

      universities: 4,
      implementedUniversities: 3,
      implementationShare: 75,

      applications: 605,
      students: 330,
      streams: 16,

      rating: 99,

      universityItems: [
        {
          university: {
            id: 6,
            name: 'Томский политех',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 183,
          students: 102,
          streams: 5,
        },
        {
          university: {
            id: 20,
            name: 'МГУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 151,
          students: 84,
          streams: 4,
        },
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 128,
          students: 69,
          streams: 3,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'inProgress',
          applications: 143,
          students: 75,
          streams: 4,
        },
      ],
    },

    {
      id: '7-2',
      programId: 7,
      program: 'Анализ данных без программирования',
      productId: 2,
      product: 'TData',

      universities: 4,
      implementedUniversities: 3,
      implementationShare: 75,

      applications: 412,
      students: 226,
      streams: 10,

      rating: 93,

      universityItems: [
        {
          university: {
            id: 2,
            name: 'РАНХиГС',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 122,
          students: 67,
          streams: 3,
        },
        {
          university: {
            id: 13,
            name: 'НВГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 94,
          students: 48,
          streams: 2,
        },
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 111,
          students: 64,
          streams: 3,
        },
        {
          university: {
            id: 10,
            name: 'ТГУ',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'inProgress',
          applications: 85,
          students: 47,
          streams: 2,
        },
      ],
    },

    {
      id: '8-5',
      programId: 8,
      program: 'Веб-разработка на платформе «Акола»',
      productId: 5,
      product: 'Акола',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 267,
      students: 141,
      streams: 7,

      rating: 78,

      universityItems: [
        {
          university: {
            id: 17,
            name: 'КАИ',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 78,
          students: 39,
          streams: 2,
        },
        {
          university: {
            id: 10,
            name: 'ТГУ',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'inProgress',
          applications: 103,
          students: 54,
          streams: 3,
        },
        {
          university: {
            id: 18,
            name: 'ГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 86,
          students: 48,
          streams: 2,
        },
      ],
    },

    {
      id: '9-7',
      programId: 9,
      program: 'Промпт-инжиниринг',
      productId: 7,
      product: 'ИИ-платформа',

      universities: 4,
      implementedUniversities: 4,
      implementationShare: 100,

      applications: 692,
      students: 394,
      streams: 17,

      rating: 100,

      universityItems: [
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 201,
          students: 118,
          streams: 5,
        },
        {
          university: {
            id: 1,
            name: 'РЭУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 176,
          students: 94,
          streams: 4,
        },
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 169,
          students: 97,
          streams: 4,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 146,
          students: 85,
          streams: 4,
        },
      ],
    },

    {
      id: '10-6',
      programId: 10,
      program: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
      productId: 6,
      product: 'Аврора',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 231,
      students: 118,
      streams: 6,

      rating: 69,

      universityItems: [
        {
          university: {
            id: 16,
            name: 'КФУ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'inProgress',
          applications: 69,
          students: 32,
          streams: 2,
        },
        {
          university: {
            id: 7,
            name: 'Чеченский государственный университет',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 81,
          students: 43,
          streams: 2,
        },
        {
          university: {
            id: 12,
            name: 'Самарский политех',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 81,
          students: 43,
          streams: 2,
        },
      ],
    },

    {
      id: '11-2',
      programId: 11,
      program: 'Специалист по анализу данных',
      productId: 2,
      product: 'TData',

      universities: 4,
      implementedUniversities: 4,
      implementationShare: 100,

      applications: 612,
      students: 339,
      streams: 16,

      rating: 97,

      universityItems: [
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 187,
          students: 101,
          streams: 5,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 169,
          students: 91,
          streams: 4,
        },
        {
          university: {
            id: 6,
            name: 'Томский политех',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 132,
          students: 74,
          streams: 3,
        },
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 124,
          students: 73,
          streams: 4,
        },
      ],
    },

    {
      id: '12-4',
      programId: 12,
      program: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
      productId: 4,
      product: 'Ростелеком Ключ',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 296,
      students: 156,
      streams: 8,

      rating: 76,

      universityItems: [
        {
          university: {
            id: 2,
            name: 'РАНХиГС',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 108,
          students: 59,
          streams: 3,
        },
        {
          university: {
            id: 14,
            name: 'МЭИ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'inProgress',
          applications: 91,
          students: 46,
          streams: 2,
        },
        {
          university: {
            id: 19,
            name: 'Волгоградский государственный технический университет',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 97,
          students: 51,
          streams: 3,
        },
      ],
    },

    {
      id: '13-1',
      programId: 13,
      program: 'DevOps инженер (работа с технологической платформой «Базис»)',
      productId: 1,
      product: 'Базис',

      universities: 4,
      implementedUniversities: 3,
      implementationShare: 75,

      applications: 524,
      students: 281,
      streams: 13,

      rating: 90,

      universityItems: [
        {
          university: {
            id: 3,
            name: 'Станкин',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 156,
          students: 85,
          streams: 4,
        },
        {
          university: {
            id: 12,
            name: 'Самарский политех',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 119,
          students: 62,
          streams: 3,
        },
        {
          university: {
            id: 17,
            name: 'КАИ',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'inProgress',
          applications: 127,
          students: 68,
          streams: 3,
        },
        {
          university: {
            id: 6,
            name: 'Томский политех',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 122,
          students: 66,
          streams: 3,
        },
      ],
    },

    {
      id: '14-7',
      programId: 14,
      program: 'Аналитика данных и методы искусственного интеллекта',
      productId: 7,
      product: 'ИИ-платформа',

      universities: 5,
      implementedUniversities: 5,
      implementationShare: 100,

      applications: 871,
      students: 500,
      streams: 23,

      rating: 100,

      universityItems: [
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 214,
          students: 126,
          streams: 6,
        },
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 198,
          students: 114,
          streams: 5,
        },
        {
          university: {
            id: 10,
            name: 'ТГУ',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 144,
          students: 79,
          streams: 4,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 171,
          students: 96,
          streams: 4,
        },
        {
          university: {
            id: 20,
            name: 'МГУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 144,
          students: 85,
          streams: 4,
        },
      ],
    },

    {
      id: '15-8',
      programId: 15,
      program: 'Анализ данных в Low-code платформах',
      productId: 8,
      product: 'Low-code платформа',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 247,
      students: 128,
      streams: 6,

      rating: 74,

      universityItems: [
        {
          university: {
            id: 8,
            name: 'Тюменский университет',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 86,
          students: 44,
          streams: 2,
        },
        {
          university: {
            id: 18,
            name: 'ГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'inProgress',
          applications: 75,
          students: 38,
          streams: 2,
        },
        {
          university: {
            id: 13,
            name: 'НВГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 86,
          students: 46,
          streams: 2,
        },
      ],
    },

    {
      id: '16-9',
      programId: 16,
      program: 'Технологии распределенного реестра (для преподавателей)',
      productId: 9,
      product: 'Платформа распределенного реестра',

      universities: 2,
      implementedUniversities: 2,
      implementationShare: 100,

      applications: 134,
      students: 86,
      streams: 4,

      rating: 68,

      universityItems: [
        {
          university: {
            id: 5,
            name: 'Сеченовский университет',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'implemented',
          applications: 63,
          students: 41,
          streams: 2,
        },
        {
          university: {
            id: 16,
            name: 'КФУ',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 71,
          students: 45,
          streams: 2,
        },
      ],
    },

    {
      id: '17-9',
      programId: 17,
      program:
        'Технологии распределенного реестра с использованием программных решений от компании Ростелеком',
      productId: 9,
      product: 'Платформа распределенного реестра',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 244,
      students: 135,
      streams: 6,

      rating: 73,

      universityItems: [
        {
          university: {
            id: 6,
            name: 'Томский политех',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 84,
          students: 49,
          streams: 2,
        },
        {
          university: {
            id: 14,
            name: 'МЭИ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'inProgress',
          applications: 77,
          students: 42,
          streams: 2,
        },
        {
          university: {
            id: 12,
            name: 'Самарский политех',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 83,
          students: 44,
          streams: 2,
        },
      ],
    },

    {
      id: '18-7',
      programId: 18,
      program: 'Искусственный Интеллект. Применение',
      productId: 7,
      product: 'ИИ-платформа',

      universities: 4,
      implementedUniversities: 4,
      implementationShare: 100,

      applications: 641,
      students: 356,
      streams: 16,

      rating: 95,

      universityItems: [
        {
          university: {
            id: 20,
            name: 'МГУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 172,
          students: 93,
          streams: 4,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 161,
          students: 88,
          streams: 4,
        },
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 173,
          students: 96,
          streams: 4,
        },
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 135,
          students: 79,
          streams: 4,
        },
      ],
    },

    {
      id: '19-7',
      programId: 19,
      program: 'Искусственный Интеллект. Базовые навыки',
      productId: 7,
      product: 'ИИ-платформа',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 372,
      students: 215,
      streams: 10,

      rating: 86,

      universityItems: [
        {
          university: {
            id: 7,
            name: 'Чеченский государственный университет',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 137,
          students: 81,
          streams: 4,
        },
        {
          university: {
            id: 9,
            name: 'Тульский ГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'inProgress',
          applications: 118,
          students: 67,
          streams: 3,
        },
        {
          university: {
            id: 4,
            name: 'СГТУ',
          },
          responsible: {
            id: 3,
            name: 'Анна Петрова',
          },
          implementationStatus: 'implemented',
          applications: 117,
          students: 67,
          streams: 3,
        },
      ],
    },

    {
      id: '20-2',
      programId: 20,
      program: 'SQL разработчик (вводный курс)',
      productId: 2,
      product: 'TData',

      universities: 3,
      implementedUniversities: 3,
      implementationShare: 100,

      applications: 378,
      students: 204,
      streams: 10,

      rating: 88,

      universityItems: [
        {
          university: {
            id: 3,
            name: 'Станкин',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 145,
          students: 79,
          streams: 4,
        },
        {
          university: {
            id: 13,
            name: 'НВГУ',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 121,
          students: 64,
          streams: 3,
        },
        {
          university: {
            id: 11,
            name: 'СКГА',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 112,
          students: 61,
          streams: 3,
        },
      ],
    },

    {
      id: '21-2',
      programId: 21,
      program: 'Аналитика данных на Python',
      productId: 2,
      product: 'TData',

      universities: 4,
      implementedUniversities: 3,
      implementationShare: 75,

      applications: 629,
      students: 352,
      streams: 16,

      rating: 94,

      universityItems: [
        {
          university: {
            id: 15,
            name: 'МФТИ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'implemented',
          applications: 191,
          students: 109,
          streams: 5,
        },
        {
          university: {
            id: 21,
            name: 'НИУ ВШЭ',
          },
          responsible: {
            id: 2,
            name: 'Мария Смирнова',
          },
          implementationStatus: 'implemented',
          applications: 173,
          students: 96,
          streams: 4,
        },
        {
          university: {
            id: 1,
            name: 'РЭУ',
          },
          responsible: {
            id: 1,
            name: 'Иван Иванов',
          },
          implementationStatus: 'inProgress',
          applications: 139,
          students: 76,
          streams: 3,
        },
        {
          university: {
            id: 22,
            name: 'ИТМО',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'implemented',
          applications: 126,
          students: 71,
          streams: 4,
        },
      ],
    },

    {
      id: '22-2',
      programId: 22,
      program: 'Введение в аналитику данных',
      productId: 2,
      product: 'TData',

      universities: 3,
      implementedUniversities: 2,
      implementationShare: 67,

      applications: 311,
      students: 170,
      streams: 8,

      rating: 80,

      universityItems: [
        {
          university: {
            id: 11,
            name: 'СКГА',
          },
          responsible: {
            id: 4,
            name: 'Алексей Соколов',
          },
          implementationStatus: 'implemented',
          applications: 111,
          students: 61,
          streams: 3,
        },
        {
          university: {
            id: 19,
            name: 'Волгоградский государственный технический университет',
          },
          responsible: {
            id: 6,
            name: 'Дмитрий Волков',
          },
          implementationStatus: 'implemented',
          applications: 96,
          students: 52,
          streams: 2,
        },
        {
          university: {
            id: 16,
            name: 'КФУ',
          },
          responsible: {
            id: 5,
            name: 'Елена Кузнецова',
          },
          implementationStatus: 'inProgress',
          applications: 104,
          students: 57,
          streams: 3,
        },
      ],
    },
  ],

  total: 22,
};
