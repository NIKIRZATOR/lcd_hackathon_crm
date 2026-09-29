import type { ChecklistFact, ProgramNbaContext, StageCode } from './nbaTypes';

export const STAGE_BY_CODE: Record<string, StageCode> = {
  find_contact: 'find_contact',
  contact_search: 'find_contact',
  first_meeting: 'first_meeting',
  identify_need: 'identify_need',
  document_package: 'document_package',
  sign_contract: 'sign_contract',
  sign_license: 'sign_license',
  transfer_access: 'transfer_access',
  train_teacher: 'train_teacher',
  confirm_teacher: 'confirm_teacher',
  curriculum: 'curriculum',
  start_classes: 'start_classes',
  classes_running: 'classes_running',
  period_results: 'period_results',
  control: 'control',
};

const BY_CODE: Record<string, string> = {
  responsible: 'Выберите ответственного со стороны учебного заведения.',
  contact: 'Выберите ответственного со стороны учебного заведения.',
  channel: 'Добавьте телефон или email контакта.',
  role: 'Укажите роль контакта в учебном заведении.',
  primary: 'Назначьте основной контакт по взаимодействию.',
  meeting_date: 'Назначьте дату первой встречи.',
  slot: 'Назначьте дату первой встречи.',
  meeting_participant: 'Выберите представителя учебного заведения для встречи.',
  participant: 'Выберите представителя учебного заведения для встречи.',
  outcome: 'Зафиксируйте результат первой встречи.',
  meeting_protocol: 'Добавьте протокол встречи или содержательную заметку.',
  proof: 'Добавьте протокол встречи или содержательную заметку.',
  reason: 'Опишите, зачем площадке нужен этот продукт.',
  need_comment: 'Опишите, зачем площадке нужен этот продукт.',
  format: 'Укажите форму включения продукта в учебный процесс.',
  window: 'Выберите целевой учебный период.',
  contract_project: 'Добавьте проект договора.',
  direction_materials: 'Добавьте материалы по направлению.',
  product_description: 'Добавьте описание продукта.',
  received: 'Подтвердите получение подписанной лицензии.',
  contract_received: 'Подтвердите получение подписанного договора.',
  contract_number: 'Укажите номер подписанного договора.',
  contract_signed_on: 'Укажите дату подписания договора.',
  contract_attachment: 'Приложите подписанный договор.',
  number: 'Укажите номер лицензии.',
  license_number: 'Укажите номер лицензии.',
  signed: 'Укажите дату подписания лицензии.',
  term: 'Укажите срок действия лицензии.',
  license_valid_until: 'Укажите срок действия лицензии.',
  file: 'Приложите файл подписанной лицензии.',
  license_attachment: 'Приложите файл подписанной лицензии.',
  license: 'Сначала завершите оформление лицензии.',
  status: 'Подтвердите передачу продукта.',
  transfer_status: 'Подтвердите передачу продукта.',
  recipient: 'Укажите получателя доступа со стороны площадки.',
  access: 'Укажите ссылку, логин или другой способ доступа.',
  product_access: 'Укажите ссылку, логин или другой способ доступа.',
  date: 'Укажите дату передачи продукта.',
  transfer_attachment: 'Приложите подтверждение передачи доступа.',
  person: 'Выберите преподавателя для работы с продуктом.',
  teacher: 'Выберите преподавателя для работы с продуктом.',
  trained_on: 'Укажите дату обучения преподавателя.',
  teacher_ready: 'Подтвердите готовность преподавателя вести занятия.',
  carrier: 'Проверьте, что преподаватель продолжает работать с программой.',
  active: 'Подтвердите, что преподаватель ведёт программу.',
  qualification: 'Обновите данные о квалификации преподавателя.',
  ready: 'Подтвердите готовность преподавателя вести занятия.',
  plan: 'Добавьте учебный план или комментарий о его согласовании.',
  curriculum: 'Добавьте учебный план или комментарий о его согласовании.',
  classes_started_on: 'Укажите дату начала занятий.',
  confirmed: 'Подтвердите фактический старт занятий.',
  classes_started: 'Подтвердите фактический старт занятий.',
  period_result: 'Выберите итог взаимодействия за учебный период.',
};

const BY_LABEL: Array<[RegExp, string]> = [
  [/ответственн/i, BY_CODE.responsible],
  [/телефон или почт/i, BY_CODE.channel],
  [/^роль указана/i, BY_CODE.role],
  [/основной контакт/i, BY_CODE.primary],
  [/дата встречи|дата первой встречи/i, BY_CODE.slot],
  [/участник от вуза/i, BY_CODE.participant],
  [/итог встречи/i, BY_CODE.outcome],
  [/протокол или заметк/i, BY_CODE.proof],
  [/обоснование потребности/i, BY_CODE.reason],
  [/форма включения/i, BY_CODE.format],
  [/учебный период выбран/i, 'Выберите целевой учебный период.'],
  [/договор приложен/i, BY_CODE.contract_project],
  [/материалы приложен/i, BY_CODE.direction_materials],
  [/описание приложен/i, BY_CODE.product_description],
  [/статус «получен подписанный»/i, BY_CODE.contract_received],
  [/дата подписания указана/i, BY_CODE.contract_signed_on],
  [/подписанный договор приложен/i, BY_CODE.contract_attachment],
  [/статус «получена подписанная»/i, BY_CODE.received],
  [/номер указан/i, BY_CODE.number],
  [/дата указана/i, BY_CODE.signed],
  [/срок указан/i, BY_CODE.term],
  [/файл приложен/i, BY_CODE.file],
  [/лицензия захода/i, BY_CODE.license],
  [/статус «передана»/i, BY_CODE.transfer_status],
  [/получатель выбран/i, BY_CODE.recipient],
  [/сведения о доступе/i, BY_CODE.product_access],
  [/дата передачи/i, BY_CODE.date],
  [/преподаватель выбран/i, BY_CODE.person],
  [/статус «обучен»/i, 'Укажите статус подготовки преподавателя.'],
  [/дата обучения/i, BY_CODE.trained_on],
  [/есть сертификат/i, 'Добавьте сертификат или подтверждение обучения.'],
  [/носитель на месте/i, BY_CODE.carrier],
  [/статус «ведёт»/i, BY_CODE.active],
  [/квалификация не истекла/i, BY_CODE.qualification],
  [/готовность «да»/i, BY_CODE.ready],
  [/окно выбрано/i, 'Выберите учебное окно.'],
  [/носитель «ведёт»/i, 'Подтвердите актуального преподавателя.'],
  [/доступ передан/i, 'Подтвердите передачу доступа к продукту.'],
  [/есть план или комментарий/i, BY_CODE.plan],
  [/учебный план закрыт/i, 'Завершите подготовку учебного плана.'],
  [/дата старта/i, 'Укажите дату начала занятий.'],
  [/старт подтвержд/i, BY_CODE.confirmed],
  [/комментарий к сдвигу/i, 'Добавьте комментарий о расхождении даты старта, если он требуется.'],
  [/можно закрыть успешно/i, 'Подтвердите результат ведения занятий.'],
  [/вердикт выбран/i, 'Выберите итог взаимодействия за учебный период.'],
  [/комментарий написан/i, 'Добавьте итоговый комментарий.'],
];

export const missingFactText = (fact: ChecklistFact, stage?: StageCode) => {
  if (stage === 'sign_contract') {
    if (fact.code === 'received' || /статус «получен подписанный»/i.test(fact.label)) return BY_CODE.contract_received;
    if (fact.code === 'number' || /номер указан/i.test(fact.label)) return BY_CODE.contract_number;
    if (fact.code === 'date' || /дата подписания/i.test(fact.label)) return BY_CODE.contract_signed_on;
    if (fact.code === 'file' || /подписанный договор|файл приложен/i.test(fact.label)) return BY_CODE.contract_attachment;
  }
  if (stage === 'start_classes' && (fact.code === 'date' || /дата старта/i.test(fact.label))) {
    return 'Укажите дату начала занятий.';
  }
  if (stage === 'transfer_access' && (fact.code === 'date' || /дата передачи/i.test(fact.label))) {
    return BY_CODE.date;
  }
  if (BY_CODE[fact.code]) return BY_CODE[fact.code];
  const hit = BY_LABEL.find(([pattern]) => pattern.test(fact.label));
  if (hit) return hit[1];
  return `Выполните обязательный пункт: «${fact.label}».`;
};

export const firstMissing = (facts: ChecklistFact[]) =>
  facts.filter((item) => item.required).find((item) => item.completed !== true);

export const READY: Record<StageCode, string> = {
  find_contact: 'Контакт собран. Можно переходить к первой встрече.',
  first_meeting: 'Первая встреча зафиксирована. Можно переходить к выявлению потребности.',
  identify_need: 'Потребность сформирована. Можно переходить к подготовке документов.',
  document_package: 'Пакет документов собран. Можно переходить к подписанию договора.',
  sign_contract: 'Договор оформлен. Можно переходить к подписанию лицензии.',
  sign_license: 'Лицензия оформлена. Можно переходить к передаче продукта.',
  transfer_access: 'Доступ передан. Можно переходить к обучению преподавателя.',
  train_teacher: 'Преподаватель подготовлен. Можно переходить к подтверждению.',
  confirm_teacher: 'Преподаватель подтверждён. Можно переходить к учебному плану.',
  curriculum: 'Учебный план готов. Можно переходить к старту занятий.',
  start_classes: 'Старт занятий подтверждён. Можно переходить к ведению занятий.',
  classes_running: 'Занятия идут штатно. Следуйте процессу до окончания учебного периода.',
  period_results: 'Итоги зафиксированы. Можно переходить к контролю исполнения.',
  control: 'Контроль выполнен. Сейчас дополнительных действий не требуется.',
  unknown: 'Все обязательные пункты выполнены. Можно переходить на следующий этап.',
};

export const stageReadyText = (ctx: ProgramNbaContext) => {
  if (ctx.stageCode === 'classes_running') {
    return 'Учебный период завершён. Можно переходить к итогам.';
  }
  return READY[ctx.stageCode];
};
