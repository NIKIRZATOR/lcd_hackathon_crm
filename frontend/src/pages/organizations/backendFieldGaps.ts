/**
 * Временные значения для вкладки «Вузы».
 *
 * Сюда попадает только то, чего текущий API не отдаёт текстом или числом,
 * а экран без этого поля пустеет. Если значение пришло с сервера, экран
 * показывает его и этот файл не используется.
 *
 * Файл можно отдать бэкенду как список недостающих полей.
 */

export type BackendFieldGap = {
  screen: string;
  field: string;
  endpoint: string;
  missing: string;
  temporary: string;
};

export const universityBackendFieldGaps: BackendFieldGap[] = [
  {
    screen: 'Карточка вуза · договоры',
    field: 'Имя файла рамочного договора',
    endpoint: 'GET /api/organizations/{id}/contracts',
    missing: 'В ответе есть attachment_id, нет original_name.',
    temporary: 'Если вложение есть — «Рамочный договор.pdf». Если вложения нет — «Файл не приложен».',
  },
  {
    screen: 'Карточка вуза · лицензии',
    field: 'Имя файла лицензии',
    endpoint: 'GET /api/organizations/{id}/licenses',
    missing: 'В ответе есть attachment_id, нет original_name.',
    temporary: 'Если вложение есть — «Лицензия.pdf». Если вложения нет — «Файл не приложен».',
  },
  {
    screen: 'Карточка вуза · программы',
    field: 'Число обучающихся',
    endpoint: 'GET /api/integrations/program-instances/{id}/metrics',
    missing: 'Метрика часто null, отдельного students_count в строке программы нет.',
    temporary: 'Стабильное число 18–57 от идентификатора программы, пока метрика пустая.',
  },
  {
    screen: 'Карточка вуза · программы',
    field: 'Название текущего этапа',
    endpoint: 'GET /api/program-instances/{id} и GET /api/workflow-journal',
    missing: 'У экземпляра есть current_stage_code, у журнала current_stage_name бывает пустым.',
    temporary: '«Этап не передан», если оба источника пустые.',
  },
  {
    screen: 'Карточка вуза · программы',
    field: 'Название плейбука',
    endpoint: 'GET /api/program-instances/{id}',
    missing: 'playbook_name может быть пустым.',
    temporary: '«Плейбук не передан». Выбор плейбука в мастере пока заглушка.',
  },
  {
    screen: 'Список и шапка',
    field: 'Город, регион, риск',
    endpoint: 'GET /api/organizations',
    missing: 'Поля есть, но иногда null.',
    temporary: '«Город не указан», «Регион не указан», «Нет открытого риска», «KAM не назначен». Это пустые состояния, не выдуманные люди.',
  },
];

const hash = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const filledCity = (value?: string | null) => value?.trim() || 'Город не указан * Демо';

export const filledRegion = (value?: string |null) => value?.trim() || 'Регион не указан * Демо';

export const filledRisk = (value?: string | null, hasPrograms = false) => {
  if (value?.trim()) return value.trim();
  return hasPrograms ? 'Нет открытого риска' : 'Заходов нет';
};

export const filledStageName = (value?: string | null) => value?.trim() || 'Этап не передан';

export const filledPlaybookName = (value?: string | null) => value?.trim() || 'Плейбук не передан';

export const filledStudents = (programId: string, live: number | null | undefined) => (
  typeof live === 'number' ? live : 18 + (hash(programId) % 40)
);

export const filledAttachmentName = (kind: 'contract' | 'license', attachmentId?: string | null) => {
  if (!attachmentId) return 'Файл не приложен';
  return kind === 'contract' ? 'Рамочный договор.pdf' : 'Лицензия.pdf';
};

universityBackendFieldGaps.push(
  {
    screen: 'Карточка вуза · пустые разделы',
    field: 'Демо-строки программ, людей, договора, лицензий, преподавателей, документов и ленты',
    endpoint: 'Коллекции карточки, когда массив пустой',
    missing: 'У части площадок разделы приходят пустыми, экран не на чем смотреть.',
    temporary: 'Ниже sample*(). Идентификаторы начинаются с gap-. На живые записи не подмешиваются.',
  },
  {
    screen: 'Список вузов',
    field: 'Демо-портфель',
    endpoint: 'GET /api/organizations',
    missing: 'Пустой список у КАМа.',
    temporary: 'samplePortfolio(): ЮФУ, СПбПУ и школа №15, только если сервер не вернул ни одной площадки.',
  },
);

export const isGapRecord = (id: string) => id.startsWith('gap-');

export const samplePrograms = () => [
  {
    id: 'gap-program-devops',
    directionId: 'gap-direction-devops',
    productId: 'gap-product-basis',
    directionName: 'DevOps',
    productName: 'Базис',
    playbookName: 'Полный цикл',
    stageName: 'Первая встреча',
    status: 'active',
    healthScore: 62,
    healthBand: 'yellow' as const,
    students: 36,
    studentsAreTemporary: true,
    license: 'Не передана · ЛЦ-1042',
  },
  {
    id: 'gap-program-web',
    directionId: 'gap-direction-web',
    productId: 'gap-product-yaga',
    directionName: 'Веб-разработка',
    productName: 'Яга',
    playbookName: 'Расширение',
    stageName: 'Ведение занятий',
    status: 'active',
    healthScore: 81,
    healthBand: 'green' as const,
    students: 54,
    studentsAreTemporary: true,
    license: 'Передана · ЛЦ-980',
  },
];

export const samplePeople = () => [
  {
    id: 'gap-person-1',
    roleCode: 'vice_rector',
    roleLabel: 'Проректор',
    name: 'Иван Петров',
    position: 'Проректор по учебной работе',
    email: 'petrov@university.ru',
    phone: '+7 900 111-22-33',
    isPrimary: true,
    isActive: true,
    programId: 'gap-program-devops',
    programLabel: 'DevOps · Базис',
  },
  {
    id: 'gap-person-2',
    roleCode: 'methodist',
    roleLabel: 'Методист',
    name: 'Анна Смирнова',
    position: 'Начальник учебно-методического отдела',
    email: 'smirnova@university.ru',
    phone: '+7 900 444-55-66',
    isPrimary: false,
    isActive: true,
    programId: null,
    programLabel: 'На всю площадку',
  },
  {
    id: 'gap-person-3',
    roleCode: 'teacher',
    roleLabel: 'Преподаватель',
    name: 'Павел Орлов',
    position: 'Доцент кафедры программной инженерии',
    email: 'orlov@university.ru',
    phone: '+7 900 777-88-99',
    isPrimary: false,
    isActive: true,
    programId: 'gap-program-web',
    programLabel: 'Веб-разработка · Яга',
  },
];

export const sampleContracts = () => [
  {
    id: 'gap-contract-1',
    number: 'РТК-2026/14',
    signedOn: '2026-02-12',
    validUntil: '2028-02-12',
    status: 'подписан',
    current: true,
    fileName: 'Рамочный договор.pdf',
    attachmentId: null,
  },
];

export const sampleLicenses = () => [
  {
    id: 'gap-license-1',
    programId: 'gap-program-devops',
    productName: 'Базис',
    number: 'ЛЦ-1042',
    signedOn: '2026-03-02',
    validUntil: '2027-03-02',
    transferStatus: 'in_progress',
    access: 'Доступ выдан на кафедру ПИ',
    fileName: 'Лицензия.pdf',
    attachmentId: null,
  },
  {
    id: 'gap-license-2',
    programId: 'gap-program-web',
    productName: 'Яга',
    number: 'ЛЦ-980',
    signedOn: '2025-09-01',
    validUntil: '2026-09-01',
    transferStatus: 'transferred',
    access: 'Доступ у методиста',
    fileName: 'Лицензия.pdf',
    attachmentId: null,
  },
];

export const sampleTeachers = () => [
  {
    id: 'gap-teacher-1',
    name: 'Павел Орлов',
    productName: 'Базис',
    status: 'trained',
    trainedOn: '2026-04-18',
    qualificationUntil: '2027-04-18',
    lastLmsActivity: '2026-09-12',
  },
  {
    id: 'gap-teacher-2',
    name: 'Мария Козлова',
    productName: 'Яга',
    status: 'active',
    trainedOn: '2025-10-03',
    qualificationUntil: '2026-10-03',
    lastLmsActivity: '2026-09-20',
  },
];

export const sampleDocuments = () => [
  {
    id: 'gap-document-1',
    name: 'Протокол первой встречи.pdf',
    kind: 'протокол',
    programName: 'DevOps · Базис',
    stageName: 'Первая встреча',
    uploadedBy: 'Анна Соколова',
    createdAt: '2026-03-04',
    attachmentId: null,
  },
  {
    id: 'gap-document-2',
    name: 'Учебный план.docx',
    kind: 'план',
    programName: 'Веб-разработка · Яга',
    stageName: 'Учебный план',
    uploadedBy: 'Анна Смирнова',
    createdAt: '2026-08-21',
    attachmentId: null,
  },
];

export const sampleFeed = () => [
  {
    id: 'gap-feed-1',
    title: 'Назначен KAM',
    description: 'Площадка закреплена за менеджером',
    actor: 'Виктор Орлов',
    createdAt: '2026-02-02T10:15:00',
    kind: 'audit',
  },
  {
    id: 'gap-feed-2',
    title: 'Сигнал учебной платформы',
    description: 'На Базисе 36 студентов, последняя активность 12 сентября',
    actor: 'Система',
    createdAt: '2026-09-12T08:40:00',
    kind: 'lms',
  },
  {
    id: 'gap-feed-3',
    title: 'Лицензия передаётся',
    description: 'ЛЦ-1042 ещё не в статусе «передана»',
    actor: 'Анна Соколова',
    createdAt: '2026-09-18T16:05:00',
    kind: 'license',
  },
];

export const samplePortfolio = () => [
  {
    id: 'gap-org-sfu',
    name: 'Южный федеральный университет',
    kam: 'Анна Соколова',
    shortName: 'ЮФУ',
    city: 'Ростов-на-Дону',
    region: 'Ростовская область',
    typeName: 'Вуз',
    status: 'active' as const,
    programCount: 2,
    healthScore: 62,
    healthBand: 'yellow' as const,
    nearestRisk: 'Первая встреча просрочена на 6 дней',
    noActivity: false,
    updatedAt: '2026-09-18',
    directions: ['DevOps', 'Веб-разработка'],
    products: ['Базис', 'Яга'],
  },
  {
    id: 'gap-org-spbpu',
    name: 'Санкт-Петербургский политехнический университет',
    kam: 'Анна Соколова',
    shortName: 'СПбПУ',
    city: 'Санкт-Петербург',
    region: 'Санкт-Петербург',
    typeName: 'Вуз',
    status: 'active' as const,
    programCount: 1,
    healthScore: 48,
    healthBand: 'red' as const,
    nearestRisk: 'Тишина учебной платформы больше 30 дней',
    noActivity: false,
    updatedAt: '2026-09-01',
    directions: ['Программная инженерия'],
    products: ['Акола'],
  },
  {
    id: 'gap-org-school',
    name: 'Школа №15',
    kam: 'KAM не назначен',
    shortName: 'Школа №15',
    city: 'Казань',
    region: 'Татарстан',
    typeName: 'Школа',
    status: 'active' as const,
    programCount: 0,
    healthScore: null,
    healthBand: null,
    nearestRisk: 'Заходов нет',
    noActivity: true,
    updatedAt: '2026-08-14',
    directions: [],
    products: [],
  },
];
