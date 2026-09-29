import dayjs from 'dayjs';

import { resolveStageCode } from './getNextBestAction';
import type { ChecklistFact, ProgramNbaContext, StageCode } from './nbaTypes';
import type { NbaItem } from '../types';

const VANILLA: Record<StageCode, Array<{ code: string; label: string }>> = {
  find_contact: [
    { code: 'responsible', label: 'Ответственный найден' },
    { code: 'channel', label: 'Есть телефон или почта' },
    { code: 'role', label: 'Роль указана' },
    { code: 'primary', label: 'Основной контакт выбран' },
  ],
  first_meeting: [
    { code: 'meeting_date', label: 'Дата встречи указана' },
    { code: 'meeting_participant', label: 'Участник от вуза выбран' },
    { code: 'outcome', label: 'Итог встречи указан' },
    { code: 'meeting_protocol', label: 'Есть протокол или заметка' },
  ],
  identify_need: [
    { code: 'reason', label: 'Обоснование потребности заполнено' },
    { code: 'format', label: 'Форма включения указана' },
    { code: 'window', label: 'Учебный период выбран' },
  ],
  document_package: [
    { code: 'contract_project', label: 'Договор приложен' },
    { code: 'direction_materials', label: 'Материалы приложены' },
    { code: 'product_description', label: 'Описание приложено' },
  ],
  sign_contract: [
    { code: 'received', label: 'Статус «получен подписанный»' },
    { code: 'number', label: 'Номер указан' },
    { code: 'date', label: 'Дата подписания указана' },
    { code: 'file', label: 'Подписанный договор приложен' },
  ],
  sign_license: [
    { code: 'received', label: 'Статус «получена подписанная»' },
    { code: 'number', label: 'Номер указан' },
    { code: 'signed', label: 'Дата указана' },
    { code: 'term', label: 'Срок указан' },
    { code: 'file', label: 'Файл приложен' },
  ],
  transfer_access: [
    { code: 'license', label: 'Лицензия захода есть' },
    { code: 'status', label: 'Статус «передана»' },
    { code: 'recipient', label: 'Получатель выбран' },
    { code: 'access', label: 'Сведения о доступе указаны' },
    { code: 'date', label: 'Дата передачи указана' },
    { code: 'file', label: 'Файл приложен' },
  ],
  train_teacher: [
    { code: 'person', label: 'Преподаватель выбран' },
    { code: 'status', label: 'Статус «обучен» или «ведёт»' },
    { code: 'trained_on', label: 'Дата обучения указана' },
    { code: 'proof', label: 'Есть сертификат' },
  ],
  confirm_teacher: [
    { code: 'carrier', label: 'Носитель на месте' },
    { code: 'active', label: 'Статус «ведёт»' },
    { code: 'qualification', label: 'Квалификация не истекла' },
    { code: 'ready', label: 'Готовность «да»' },
    { code: 'window', label: 'Окно выбрано' },
  ],
  curriculum: [
    { code: 'carrier', label: 'Носитель «ведёт»' },
    { code: 'access', label: 'Доступ передан' },
    { code: 'plan', label: 'Есть план или комментарий' },
    { code: 'window', label: 'Окно выбрано' },
  ],
  start_classes: [
    { code: 'carrier', label: 'Носитель «ведёт»' },
    { code: 'access', label: 'Доступ передан' },
    { code: 'plan', label: 'Учебный план закрыт' },
    { code: 'date', label: 'Дата старта указана' },
    { code: 'confirmed', label: 'Старт подтверждён' },
  ],
  classes_running: [
    { code: 'carrier', label: 'Носитель на месте' },
    { code: 'ready', label: 'Можно закрыть успешно' },
  ],
  period_results: [
    { code: 'period_result', label: 'Вердикт выбран' },
    { code: 'comment', label: 'Комментарий написан' },
  ],
  control: [{ code: 'control', label: 'Контроль выполнен' }],
  unknown: [],
};

const LABEL_STAGE: Array<[RegExp, StageCode]> = [
  [/встреч/i, 'first_meeting'],
  [/контакт|ответственн|телефон или почт/i, 'find_contact'],
  [/потребност|включен/i, 'identify_need'],
  [/проект договор|материалы по направлен|описание продукт/i, 'document_package'],
  [/подписанн(?:ый|ого) договор/i, 'sign_contract'],
  [/лиценз/i, 'sign_license'],
  [/передач|получател|доступ/i, 'transfer_access'],
  [/обучен|сертификат/i, 'train_teacher'],
  [/готовность|квалификац/i, 'confirm_teacher'],
  [/учебн(?:ый|ого) план/i, 'curriculum'],
  [/старт занят/i, 'start_classes'],
  [/веден/i, 'classes_running'],
  [/вердикт|итог периода/i, 'period_results'],
];

const extractFactLabel = (reason: string) => {
  const match = reason.match(/обязательн(?:ый факт|ое условие)[:\s]+[«"]?(.+?)[»"]?\s*$/i);
  return match ? match[1].replace(/\.$/, '').trim() : null;
};

const FACT_ALIASES: Array<[RegExp, string]> = [
  [/дата первой встречи|дата встречи/i, 'meeting_date'],
  [/участник/i, 'meeting_participant'],
  [/протокол|заметк/i, 'meeting_protocol'],
  [/номер лицензии/i, 'number'],
  [/срок действия лицензии|срок указан/i, 'term'],
  [/дата подписания лицензии|дата указана/i, 'signed'],
];

const matchesFact = (item: { code: string; label: string }, needle: string) => {
  const n = needle.toLowerCase();
  const label = item.label.toLowerCase();
  if (label.includes(n) || n.includes(label) || item.code === n) return true;
  return FACT_ALIASES.some(([pattern, code]) => pattern.test(needle) && item.code === code);
};

const inferStage = (item: NbaItem, factLabel: string | null): StageCode => {
  if (item.action_target && resolveStageCode(item.action_target) !== 'unknown') {
    return resolveStageCode(item.action_target);
  }
  const source = factLabel || item.reason;
  const hit = LABEL_STAGE.find(([pattern]) => pattern.test(source));
  return hit?.[1] ?? 'unknown';
};

export const overdueDaysFromDue = (dueAt: string | null) => {
  if (!dueAt || !dayjs(dueAt).isValid()) return 0;
  const diff = dayjs().startOf('day').diff(dayjs(dueAt).startOf('day'), 'day');
  return diff > 0 ? diff : 0;
};

export const dueCaption = (dueAt: string | null) => {
  if (!dueAt || !dayjs(dueAt).isValid()) return null;
  const diff = dayjs(dueAt).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (diff < 0) return `Просрочено на ${Math.abs(diff)} дн.`;
  if (diff === 0) return 'Сегодня';
  return `Осталось ${diff} дн.`;
};

export const contextFromQueueItem = (item: NbaItem): ProgramNbaContext => {
  const factLabel = extractFactLabel(item.reason);
  const ready = item.action_target === 'close_stage' || /все обязательн|этап можно закрыть/i.test(item.reason);
  const stageCode = inferStage(item, factLabel);
  const template = VANILLA[stageCode];

  const facts: ChecklistFact[] = template.map((row, order) => ({
    code: row.code,
    label: row.label,
    required: true,
    done: ready ? true : factLabel ? !matchesFact(row, factLabel) : true,
    order,
  }));

  return {
    programId: item.program_instance_id ?? item.id,
    live: true,
    stageCode,
    overdueDays: overdueDaysFromDue(item.due_at),
    facts,
  };
};
