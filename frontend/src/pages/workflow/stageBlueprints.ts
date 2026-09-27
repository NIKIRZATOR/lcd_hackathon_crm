export type StageFact = {
  code: string;
  label: string;
  itemType: 'text' | 'date' | 'file' | 'stakeholder_role' | 'checkbox' | 'number';
  role?: string;
  attachmentKind?: string;
  hint?: string;
};

export const stageBlueprints: Record<string, { title: string; note: string; facts: StageFact[]; aside: 'people' | 'license' | 'lms' | 'none' }> = {
  find_contact: {
    title: 'Поиск контакта',
    note: 'Без человека площадки этап не закрывается. Контакт можно завести здесь, не уходя в карточку вуза.',
    aside: 'people',
    facts: [{ code: 'contact', label: 'Контакт площадки: ФИО и телефон или почта', itemType: 'stakeholder_role', role: 'other' }],
  },
  first_meeting: {
    title: 'Первая встреча',
    note: 'Нужны дата, участник и протокол или заметка не короче 40 символов.',
    aside: 'none',
    facts: [
      { code: 'meeting_date', label: 'Дата первой встречи', itemType: 'date' },
      { code: 'meeting_participant', label: 'Участник встречи со стороны площадки', itemType: 'stakeholder_role', role: 'other' },
      { code: 'meeting_protocol', label: 'Протокол встречи или комментарий', itemType: 'text', hint: 'Не короче 40 символов' },
    ],
  },
  identify_need: {
    title: 'Потребность',
    note: 'Фиксируем, зачем площадке этот продукт. Отдельный договор здесь не нужен.',
    aside: 'none',
    facts: [{ code: 'need_comment', label: 'Причина потребности', itemType: 'text' }],
  },
  document_package: {
    title: 'Пакет документов',
    note: 'Три слота. Новая версия файла не стирает старую.',
    aside: 'none',
    facts: [
      { code: 'contract_project', label: 'Проект договора', itemType: 'file', attachmentKind: 'project_contract' },
      { code: 'direction_materials', label: 'Материалы направления', itemType: 'file', attachmentKind: 'direction_materials' },
      { code: 'product_description', label: 'Описание продукта', itemType: 'file', attachmentKind: 'product_description' },
    ],
  },
  sign_contract: {
    title: 'Подписание договора',
    note: 'Номер, дата и файл подписанного договора.',
    aside: 'license',
    facts: [
      { code: 'contract_number', label: 'Номер договора', itemType: 'text' },
      { code: 'contract_signed_on', label: 'Дата подписания', itemType: 'date' },
      { code: 'contract_attachment', label: 'Подписанный договор', itemType: 'file', attachmentKind: 'signed_contract' },
    ],
  },
  sign_license: {
    title: 'Подписание лицензии',
    note: 'Номер, срок и файл. Срок нужен датой, иначе напоминание за 90 дней не посчитается.',
    aside: 'license',
    facts: [
      { code: 'license_number', label: 'Номер лицензии', itemType: 'text' },
      { code: 'license_valid_until', label: 'Срок действия', itemType: 'date' },
      { code: 'license_attachment', label: 'Подписанная лицензия', itemType: 'file', attachmentKind: 'license' },
    ],
  },
  transfer_access: {
    title: 'Передача и доступ',
    note: 'Статус передачи, непустое поле доступа и файл. Сопровождение внедрения живёт здесь, отдельной клетки нет.',
    aside: 'license',
    facts: [
      { code: 'transfer_status', label: 'Подтверждение передачи', itemType: 'text' },
      { code: 'product_access', label: 'Доступ к продукту', itemType: 'text' },
      { code: 'transfer_attachment', label: 'Акт или подтверждение передачи', itemType: 'file', attachmentKind: 'transfer' },
    ],
  },
  train_teacher: {
    title: 'Обучение преподавателя',
    note: 'Носитель именно этого продукта на этой площадке, плюс дата обучения.',
    aside: 'people',
    facts: [
      { code: 'teacher', label: 'Преподаватель-носитель', itemType: 'stakeholder_role', role: 'teacher' },
      { code: 'trained_on', label: 'Дата обучения', itemType: 'date' },
    ],
  },
  confirm_teacher: {
    title: 'Подтверждение преподавателя',
    note: 'Человек обучен или уже ведёт. Пока этого нет, старт занятий не открываем.',
    aside: 'people',
    facts: [{ code: 'teacher_ready', label: 'Подтверждение готовности', itemType: 'text' }],
  },
  curriculum: {
    title: 'Учебный план',
    note: 'Файл плана или комментарий согласования.',
    aside: 'none',
    facts: [{ code: 'curriculum', label: 'Учебный план или комментарий согласования', itemType: 'text' }],
  },
  start_classes: {
    title: 'Старт занятий',
    note: 'Дата и ручное подтверждение. Сигнал LMS только подсказывает и сам этап не закрывает.',
    aside: 'lms',
    facts: [
      { code: 'classes_started_on', label: 'Дата старта занятий', itemType: 'date' },
      { code: 'classes_started', label: 'Подтверждение старта', itemType: 'text' },
    ],
  },
  classes_running: {
    title: 'Ведение занятий',
    note: 'Пока учебное окно живо, этап не торопится закрываться. LMS показывает студентов, но решение за менеджером.',
    aside: 'lms',
    facts: [],
  },
  period_results: {
    title: 'Итоги периода',
    note: 'Файл или комментарий итога. Это не отдельный вечный этап актуализации документации.',
    aside: 'lms',
    facts: [{ code: 'period_result', label: 'Итог периода', itemType: 'text' }],
  },
};

const nameToCode: Record<string, string> = {
  'Поиск контакта': 'find_contact',
  'Первая встреча': 'first_meeting',
  'Потребность': 'identify_need',
  'Выявление потребности': 'identify_need',
  'Пакет документов': 'document_package',
  'Подписание договора': 'sign_contract',
  'Подписание лицензии': 'sign_license',
  'Передача и доступ': 'transfer_access',
  'Обучение преподавателя': 'train_teacher',
  'Подтверждение преподавателя': 'confirm_teacher',
  'Учебный план': 'curriculum',
  'Старт занятий': 'start_classes',
  'Ведение занятий': 'classes_running',
  'Итоги периода': 'period_results',
};

export const stageCodeOf = (code?: string | null, name?: string | null) => code && stageBlueprints[code] ? code : nameToCode[name ?? ''] ?? code ?? 'find_contact';
