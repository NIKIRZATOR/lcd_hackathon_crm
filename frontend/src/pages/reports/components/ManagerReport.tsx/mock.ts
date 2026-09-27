import type { ManagerReportItem } from './types';

export const managerReportMock: ManagerReportItem[] = [
  {
    id: 1,
    kamId: 1,
    kam: 'Иванов И.И.',

    activePrograms: 6,

    greenHealth: 3,
    yellowHealth: 2,
    redHealth: 1,

    overdueTasks: 2,
    attentionTasks: 3,

    programItems: [
      {
        id: 1,
        university: 'МГУ им. М.В. Ломоносова',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 2,
        university: 'МГТУ им. Н.Э. Баумана',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'yellow',
      },
      {
        id: 3,
        university: 'НИУ ВШЭ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'red',
      },
      {
        id: 4,
        university: 'СПбГУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 5,
        university: 'ИТМО',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'green',
      },
      {
        id: 6,
        university: 'РАНХиГС',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
    ],

    overdueTaskItems: [
      {
        id: 1,
        university: 'МГТУ им. Н.Э. Баумана',
        program: 'Введение в информационную безопасность',
        reason: 'Не завершено согласование документов',
        overdueDays: 4,
      },
      {
        id: 2,
        university: 'НИУ ВШЭ',
        program: 'DevOps-инженер с нуля',
        reason: 'Просрочен этап внедрения продукта',
        overdueDays: 7,
      },
    ],

    attentionTaskItems: [
      {
        id: 1,
        university: 'МГТУ им. Н.Э. Баумана',
        program: 'Введение в информационную безопасность',
        reason: 'Нет активности более 5 дней',
      },
      {
        id: 2,
        university: 'НИУ ВШЭ',
        program: 'DevOps-инженер с нуля',
        reason: 'Требуется актуализировать статус внедрения',
      },
      {
        id: 3,
        university: 'РАНХиГС',
        program: 'Промпт-инжиниринг',
        reason: 'Не назначена дата следующей встречи',
      },
    ],
  },

  {
    id: 2,
    kamId: 2,
    kam: 'Петров П.П.',

    activePrograms: 5,

    greenHealth: 4,
    yellowHealth: 1,
    redHealth: 0,

    overdueTasks: 1,
    attentionTasks: 1,

    programItems: [
      {
        id: 7,
        university: 'КФУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 8,
        university: 'УрФУ',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
      {
        id: 9,
        university: 'РАНХиГС',
        name: 'Графический дизайн пользовательских интерфейсов',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 10,
        university: 'СПбПУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 11,
        university: 'ДВФУ',
        name: 'Специалист по анализу данных',
        product: 'Data Platform',
        health: 'green',
      },
    ],

    overdueTaskItems: [
      {
        id: 3,
        university: 'УрФУ',
        program: 'Промпт-инжиниринг',
        reason: 'Срок передачи материалов истёк',
        overdueDays: 3,
      },
    ],

    attentionTaskItems: [
      {
        id: 4,
        university: 'УрФУ',
        program: 'Промпт-инжиниринг',
        reason: 'Не подтверждена дата обучения преподавателей',
      },
    ],
  },

  {
    id: 3,
    kamId: 3,
    kam: 'Сидоров А.А.',

    activePrograms: 8,

    greenHealth: 3,
    yellowHealth: 3,
    redHealth: 2,

    overdueTasks: 4,
    attentionTasks: 5,

    programItems: [
      {
        id: 12,
        university: 'НГУ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'green',
      },
      {
        id: 13,
        university: 'ТПУ',
        name: 'Анализ данных без программирования',
        product: 'Data Platform',
        health: 'red',
      },
      {
        id: 14,
        university: 'ТГУ',
        name: 'Специалист по анализу данных',
        product: 'Data Platform',
        health: 'yellow',
      },
      {
        id: 15,
        university: 'МИФИ',
        name: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        product: 'Ростелеком ИТ',
        health: 'red',
      },
      {
        id: 16,
        university: 'СФУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 17,
        university: 'ЮФУ',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'yellow',
      },
      {
        id: 18,
        university: 'КубГУ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'yellow',
      },
      {
        id: 19,
        university: 'КФУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
    ],

    overdueTaskItems: [
      {
        id: 4,
        university: 'ТПУ',
        program: 'Анализ данных без программирования',
        reason: 'Документы не согласованы в установленный срок',
        overdueDays: 5,
      },
      {
        id: 5,
        university: 'ТГУ',
        program: 'Специалист по анализу данных',
        reason: 'Актуализация программы не завершена',
        overdueDays: 8,
      },
      {
        id: 6,
        university: 'МИФИ',
        program: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        reason: 'Не проведена запланированная встреча',
        overdueDays: 2,
      },
      {
        id: 7,
        university: 'КубГУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Просрочен этап внедрения',
        overdueDays: 4,
      },
    ],

    attentionTaskItems: [
      {
        id: 5,
        university: 'ТПУ',
        program: 'Анализ данных без программирования',
        reason: 'Документы ожидают согласования',
      },
      {
        id: 6,
        university: 'ТГУ',
        program: 'Специалист по анализу данных',
        reason: 'Нет обновления статуса более 7 дней',
      },
      {
        id: 7,
        university: 'МИФИ',
        program: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        reason: 'Не назначена новая дата встречи',
      },
      {
        id: 8,
        university: 'ЮФУ',
        program: 'Введение в информационную безопасность',
        reason: 'Требуется подтверждение со стороны вуза',
      },
      {
        id: 9,
        university: 'КубГУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Внедрение идёт дольше планового срока',
      },
    ],
  },

  {
    id: 4,
    kamId: 4,
    kam: 'Кузнецова Е.В.',

    activePrograms: 4,

    greenHealth: 3,
    yellowHealth: 1,
    redHealth: 0,

    overdueTasks: 0,
    attentionTasks: 1,

    programItems: [
      {
        id: 20,
        university: 'ИТМО',
        name: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
        product: 'Аврора',
        health: 'green',
      },
      {
        id: 21,
        university: 'СПбГУТ',
        name: 'Веб-разработка на платформе «Акола»',
        product: 'Акола',
        health: 'yellow',
      },
      {
        id: 22,
        university: 'СПбПУ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'green',
      },
      {
        id: 23,
        university: 'ЛЭТИ',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'green',
      },
    ],

    overdueTaskItems: [],

    attentionTaskItems: [
      {
        id: 10,
        university: 'СПбГУТ',
        program: 'Веб-разработка на платформе «Акола»',
        reason: 'Нет активности по программе в течение 5 дней',
      },
    ],
  },

  {
    id: 5,
    kamId: 5,
    kam: 'Смирнов Д.О.',

    activePrograms: 7,

    greenHealth: 2,
    yellowHealth: 3,
    redHealth: 2,

    overdueTasks: 3,
    attentionTasks: 4,

    programItems: [
      {
        id: 24,
        university: 'ПНИПУ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'red',
      },
      {
        id: 25,
        university: 'Самарский университет',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'yellow',
      },
      {
        id: 26,
        university: 'ОмГТУ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'red',
      },
      {
        id: 27,
        university: 'УрФУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 28,
        university: 'ПГНИУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 29,
        university: 'КНИТУ',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
      {
        id: 30,
        university: 'БашГУ',
        name: 'Анализ данных без программирования',
        product: 'Data Platform',
        health: 'yellow',
      },
    ],

    overdueTaskItems: [
      {
        id: 8,
        university: 'ПНИПУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Не завершено внедрение продукта',
        overdueDays: 6,
      },
      {
        id: 9,
        university: 'ОмГТУ',
        program: 'Инженер-тестировщик',
        reason: 'Не переданы учебные материалы',
        overdueDays: 4,
      },
      {
        id: 10,
        university: 'Самарский университет',
        program: 'Введение в информационную безопасность',
        reason: 'Просрочено подписание документов',
        overdueDays: 2,
      },
    ],

    attentionTaskItems: [
      {
        id: 11,
        university: 'ПНИПУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Внедрение продукта требует вмешательства KAM',
      },
      {
        id: 12,
        university: 'Самарский университет',
        program: 'Введение в информационную безопасность',
        reason: 'Ожидается подписание документов',
      },
      {
        id: 13,
        university: 'ОмГТУ',
        program: 'Инженер-тестировщик',
        reason: 'Материалы не переданы в срок',
      },
      {
        id: 14,
        university: 'БашГУ',
        program: 'Анализ данных без программирования',
        reason: 'Не подтверждён следующий этап',
      },
    ],
  },

  {
    id: 6,
    kamId: 6,
    kam: 'Попова М.С.',

    activePrograms: 5,

    greenHealth: 3,
    yellowHealth: 2,
    redHealth: 0,

    overdueTasks: 1,
    attentionTasks: 2,

    programItems: [
      {
        id: 31,
        university: 'КФУ',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
      {
        id: 32,
        university: 'БашГУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 33,
        university: 'УдГУ',
        name: 'Графический дизайн пользовательских интерфейсов',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 34,
        university: 'КНИТУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 35,
        university: 'УГНТУ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'yellow',
      },
    ],

    overdueTaskItems: [
      {
        id: 11,
        university: 'КФУ',
        program: 'Промпт-инжиниринг',
        reason: 'Не завершено обучение преподавателей',
        overdueDays: 2,
      },
    ],

    attentionTaskItems: [
      {
        id: 15,
        university: 'КФУ',
        program: 'Промпт-инжиниринг',
        reason: 'Требуется подтверждение завершения обучения',
      },
      {
        id: 16,
        university: 'УГНТУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Нет подтверждённого срока внедрения',
      },
    ],
  },

  {
    id: 7,
    kamId: 7,
    kam: 'Волков Р.Н.',

    activePrograms: 9,

    greenHealth: 3,
    yellowHealth: 3,
    redHealth: 3,

    overdueTasks: 5,
    attentionTasks: 6,

    programItems: [
      {
        id: 36,
        university: 'ДВФУ',
        name: 'Специалист по анализу данных',
        product: 'Data Platform',
        health: 'red',
      },
      {
        id: 37,
        university: 'СВФУ',
        name: 'Анализ данных без программирования',
        product: 'Data Platform',
        health: 'red',
      },
      {
        id: 38,
        university: 'ТГУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'yellow',
      },
      {
        id: 39,
        university: 'НГУ',
        name: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        product: 'Ростелеком ИТ',
        health: 'yellow',
      },
      {
        id: 40,
        university: 'СФУ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'green',
      },
      {
        id: 41,
        university: 'ДВГУПС',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'green',
      },
      {
        id: 42,
        university: 'ИрНИТУ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'green',
      },
      {
        id: 43,
        university: 'БГУ',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
      {
        id: 44,
        university: 'ТОГУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'red',
      },
    ],

    overdueTaskItems: [
      {
        id: 12,
        university: 'ДВФУ',
        program: 'Специалист по анализу данных',
        reason: 'Документы не согласованы',
        overdueDays: 9,
      },
      {
        id: 13,
        university: 'СВФУ',
        program: 'Анализ данных без программирования',
        reason: 'Не проведена запланированная встреча',
        overdueDays: 6,
      },
      {
        id: 14,
        university: 'ТГУ',
        program: 'Python-разработчик с использованием инструментов ИИ',
        reason: 'Актуализация программы не завершена',
        overdueDays: 4,
      },
      {
        id: 15,
        university: 'НГУ',
        program: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        reason: 'Документы ожидают подписания',
        overdueDays: 3,
      },
      {
        id: 16,
        university: 'ТОГУ',
        program: 'Основы UX/UI-дизайна',
        reason: 'Не переданы материалы',
        overdueDays: 7,
      },
    ],

    attentionTaskItems: [
      {
        id: 17,
        university: 'ДВФУ',
        program: 'Специалист по анализу данных',
        reason: 'Требуется срочное согласование документов',
      },
      {
        id: 18,
        university: 'СВФУ',
        program: 'Анализ данных без программирования',
        reason: 'Встреча не назначена',
      },
      {
        id: 19,
        university: 'ТГУ',
        program: 'Python-разработчик с использованием инструментов ИИ',
        reason: 'Актуализация программы задерживается',
      },
      {
        id: 20,
        university: 'НГУ',
        program: 'Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»',
        reason: 'Документы ожидают подписания',
      },
      {
        id: 21,
        university: 'БГУ',
        program: 'Промпт-инжиниринг',
        reason: 'Не определена дата обучения преподавателей',
      },
      {
        id: 22,
        university: 'ТОГУ',
        program: 'Основы UX/UI-дизайна',
        reason: 'Материалы не переданы в срок',
      },
    ],
  },

  {
    id: 8,
    kamId: 8,
    kam: 'Лебедев К.А.',

    activePrograms: 6,

    greenHealth: 3,
    yellowHealth: 2,
    redHealth: 1,

    overdueTasks: 2,
    attentionTasks: 3,

    programItems: [
      {
        id: 45,
        university: 'МИРЭА',
        name: 'Веб-разработка на платформе «Акола»',
        product: 'Акола',
        health: 'red',
      },
      {
        id: 46,
        university: 'МАИ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'yellow',
      },
      {
        id: 47,
        university: 'РТУ МИРЭА',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'green',
      },
      {
        id: 48,
        university: 'ГУУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 49,
        university: 'МЭИ',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'green',
      },
      {
        id: 50,
        university: 'МГТУ им. Н.Э. Баумана',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'yellow',
      },
    ],

    overdueTaskItems: [
      {
        id: 17,
        university: 'МИРЭА',
        program: 'Веб-разработка на платформе «Акола»',
        reason: 'Материалы не переданы в срок',
        overdueDays: 3,
      },
      {
        id: 18,
        university: 'МАИ',
        program: 'Инженер-тестировщик',
        reason: 'Обучение преподавателей не завершено',
        overdueDays: 2,
      },
    ],

    attentionTaskItems: [
      {
        id: 23,
        university: 'МИРЭА',
        program: 'Веб-разработка на платформе «Акола»',
        reason: 'Передача материалов требует контроля',
      },
      {
        id: 24,
        university: 'МАИ',
        program: 'Инженер-тестировщик',
        reason: 'Обучение преподавателей идёт дольше планового срока',
      },
      {
        id: 25,
        university: 'МГТУ им. Н.Э. Баумана',
        program: 'Python-разработчик с использованием инструментов ИИ',
        reason: 'Нет подтверждения следующего этапа',
      },
    ],
  },

  {
    id: 9,
    kamId: 9,
    kam: 'Новикова А.П.',

    activePrograms: 7,

    greenHealth: 5,
    yellowHealth: 2,
    redHealth: 0,

    overdueTasks: 1,
    attentionTasks: 2,

    programItems: [
      {
        id: 51,
        university: 'РАНХиГС',
        name: 'Графический дизайн пользовательских интерфейсов',
        product: 'Ростелеком Образование',
        health: 'green',
      },
      {
        id: 52,
        university: 'НИУ ВШЭ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'yellow',
      },
      {
        id: 53,
        university: 'МГИМО',
        name: 'Промпт-инжиниринг',
        product: 'GigaChat',
        health: 'yellow',
      },
      {
        id: 54,
        university: 'Финансовый университет',
        name: 'Анализ данных без программирования',
        product: 'Data Platform',
        health: 'green',
      },
      {
        id: 55,
        university: 'РЭУ им. Г.В. Плеханова',
        name: 'Специалист по анализу данных',
        product: 'Data Platform',
        health: 'green',
      },
      {
        id: 56,
        university: 'МГПУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 57,
        university: 'МГУ им. М.В. Ломоносова',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'green',
      },
    ],

    overdueTaskItems: [
      {
        id: 19,
        university: 'НИУ ВШЭ',
        program: 'Основы UX/UI-дизайна',
        reason: 'Согласование документов задерживается',
        overdueDays: 2,
      },
    ],

    attentionTaskItems: [
      {
        id: 26,
        university: 'НИУ ВШЭ',
        program: 'Основы UX/UI-дизайна',
        reason: 'Не завершено согласование документов',
      },
      {
        id: 27,
        university: 'МГИМО',
        program: 'Промпт-инжиниринг',
        reason: 'Нет подтверждённой даты встречи',
      },
    ],
  },

  {
    id: 10,
    kamId: 10,
    kam: 'Макаров В.С.',

    activePrograms: 8,

    greenHealth: 3,
    yellowHealth: 3,
    redHealth: 2,

    overdueTasks: 3,
    attentionTasks: 4,

    programItems: [
      {
        id: 58,
        university: 'ЮФУ',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'yellow',
      },
      {
        id: 59,
        university: 'КубГУ',
        name: 'DevOps-инженер с нуля',
        product: 'Cloud.ru',
        health: 'red',
      },
      {
        id: 60,
        university: 'СКФУ',
        name: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
        product: 'Аврора',
        health: 'yellow',
      },
      {
        id: 61,
        university: 'ВолГУ',
        name: 'Введение в информационную безопасность',
        product: 'Solar',
        health: 'red',
      },
      {
        id: 62,
        university: 'ДГТУ',
        name: 'Python-разработчик с использованием инструментов ИИ',
        product: 'Ростелеком Лицей',
        health: 'green',
      },
      {
        id: 63,
        university: 'КубГТУ',
        name: 'Анализ данных без программирования',
        product: 'Data Platform',
        health: 'green',
      },
      {
        id: 64,
        university: 'СГУ',
        name: 'Инженер-тестировщик',
        product: 'Ростелеком ИТ',
        health: 'green',
      },
      {
        id: 65,
        university: 'АГУ',
        name: 'Основы UX/UI-дизайна',
        product: 'Ростелеком Образование',
        health: 'yellow',
      },
    ],

    overdueTaskItems: [
      {
        id: 20,
        university: 'КубГУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Внедрение продукта не завершено в срок',
        overdueDays: 5,
      },
      {
        id: 21,
        university: 'ВолГУ',
        program: 'Введение в информационную безопасность',
        reason: 'Передача материалов задерживается',
        overdueDays: 3,
      },
      {
        id: 22,
        university: 'СКФУ',
        program: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
        reason: 'Просрочен контрольный срок обучения преподавателей',
        overdueDays: 2,
      },
    ],

    attentionTaskItems: [
      {
        id: 28,
        university: 'КубГУ',
        program: 'DevOps-инженер с нуля',
        reason: 'Внедрение продукта требует внимания',
      },
      {
        id: 29,
        university: 'СКФУ',
        program: 'Создание мобильных приложений для ОС «Аврора» в фреймворке Qt Quick',
        reason: 'Обучение преподавателей идёт дольше планового срока',
      },
      {
        id: 30,
        university: 'ВолГУ',
        program: 'Введение в информационную безопасность',
        reason: 'Передача материалов задерживается',
      },
      {
        id: 31,
        university: 'АГУ',
        program: 'Основы UX/UI-дизайна',
        reason: 'Не согласован следующий этап работы',
      },
    ],
  },
];
