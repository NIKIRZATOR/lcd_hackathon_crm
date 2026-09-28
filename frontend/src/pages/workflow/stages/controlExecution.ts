export type ControlSignal = {
  id: string;
  level: 'warning' | 'critical';
  title: string;
  stage: string;
  at: string;
  action: string;
  stageId?: string;
};

export type ControlLevel = 'ok' | 'warning' | 'critical';

const controlProgressKey = (programId: string) => `rtk-eduflow:control-entered:${programId}`;

export const hasEnteredControl = (programId: string) => {
  try { return localStorage.getItem(controlProgressKey(programId)) === '1'; } catch { return false; }
};

export const rememberControlEntered = (programId: string) => {
  try { localStorage.setItem(controlProgressKey(programId), '1'); } catch { /* Контроль остаётся доступен в текущей вкладке. */ }
};

export const controlLevel = (signals: ControlSignal[]): ControlLevel => signals.some((item) => item.level === 'critical') ? 'critical' : signals.length ? 'warning' : 'ok';

export const controlStatusLabel = (level: ControlLevel) => level === 'ok' ? 'В норме' : level === 'warning' ? 'Требует внимания' : 'Критический';

export type ControlCategoryId = 'documents' | 'contract' | 'license' | 'access' | 'teacher' | 'qualification' | 'curriculum' | 'classes' | 'lms' | 'reporting';

export type ControlCategory = { id: ControlCategoryId; label: string; tone: ControlLevel; detail: string };

export type ControlRecommendation = { id: string; title: string; detail: string };

const doneStatus = (status: string) => status === 'COMPLETED' || status === 'completed' || status === 'SKIPPED' || status === 'skipped';

const stageOf = (stages: Array<{ code: string; status: string }>, code: string) => stages.find((stage) => stage.code === code);

export const buildControlSignals = (input: {
  today: string;
  stages: Array<{ id: string; name: string; code: string; status: string; dueAt: string | null }>;
  healthBand: string | null;
  healthScore: number | null;
  carrierStatus: string | null;
  licenseUntil: string | null;
  transferDone: boolean;
  accessReady: boolean;
  students: number | null;
  signalAt: string | null;
  windowEnd: string | null;
  windowStart?: string | null;
  qualificationUntil?: string | null;
  duplicate: boolean;
}): ControlSignal[] => {
  const signals: ControlSignal[] = [];
  const day = (value: string | null) => value ? Math.floor((Date.parse(input.today) - Date.parse(value.slice(0, 10))) / 86400000) : null;
  for (const stage of input.stages) {
    if (stage.status !== 'IN_PROGRESS' || !stage.dueAt) continue;
    const late = day(stage.dueAt);
    if (late === null || late < 1) continue;
    signals.push({
      id: `late-${stage.id}`,
      level: late >= 8 ? 'critical' : 'warning',
      title: late >= 8 ? `Просрочка ${late} дн.` : `Просрочка ${late} дн.`,
      stage: stage.name,
      at: stage.dueAt.slice(0, 10),
      action: 'Перейти к этапу',
      stageId: stage.id,
    });
  }
  if (input.healthBand === 'yellow' || input.healthBand === 'red') {
    signals.push({ id: 'health', level: input.healthBand === 'red' ? 'critical' : 'warning', title: `Здоровье ${input.healthScore ?? '—'}`, stage: 'Заход', at: input.today, action: 'Причина штрафа с сервера не приходит' });
  }
  if (input.carrierStatus === 'left') signals.push({ id: 'carrier', level: 'critical', title: 'Преподаватель ушёл', stage: 'Обучение преподавателя', at: input.today, action: 'Запустить замену' });
  const qualificationDays = input.qualificationUntil ? Math.floor((Date.parse(input.qualificationUntil.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  if (qualificationDays !== null && qualificationDays <= 30) {
    signals.push({
      id: 'qualification',
      level: qualificationDays < 0 ? 'critical' : 'warning',
      title: qualificationDays < 0 ? 'Квалификация преподавателя истекла' : `Квалификация: ${qualificationDays} дн.`,
      stage: 'Обучение преподавателя',
      at: input.qualificationUntil!.slice(0, 10),
      action: 'Запустить замену',
      stageId: input.stages.find((stage) => stage.code === 'train_teacher')?.id,
    });
  }
  const licenseDays = input.licenseUntil ? Math.floor((Date.parse(input.licenseUntil.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  if (licenseDays !== null && licenseDays <= 90) signals.push({ id: 'license', level: licenseDays < 0 ? 'critical' : 'warning', title: licenseDays < 0 ? 'Лицензия истекла' : `Лицензия: ${licenseDays} дн.`, stage: 'Подписание лицензии', at: input.licenseUntil!.slice(0, 10), action: 'Создать заход «Продление»' });
  if (input.transferDone && !input.accessReady) signals.push({ id: 'access', level: 'critical', title: 'Доступ невалиден', stage: 'Передача и доступ к продукту', at: input.today, action: 'Перейти к этапу', stageId: input.stages.find((stage) => stage.code === 'transfer_access')?.id });
  const running = input.stages.find((stage) => stage.code === 'classes_running' && stage.status === 'IN_PROGRESS');
  const silence = input.signalAt ? day(input.signalAt) : null;
  if (running && (silence === null || silence > 30)) signals.push({ id: 'lms-silence', level: 'critical', title: 'Тишина LMS больше 30 дней', stage: running.name, at: input.signalAt?.slice(0, 10) ?? input.today, action: 'Перейти к этапу', stageId: running.id });
  const results = input.stages.find((stage) => stage.code === 'period_results');
  const windowLate = input.windowEnd ? day(input.windowEnd) : null;
  if (results && !doneStatus(results.status) && windowLate !== null && windowLate > 0) signals.push({ id: 'window', level: 'critical', title: 'Окно закончилось, итоги не закрыты', stage: results.name, at: input.windowEnd!.slice(0, 10), action: 'Открыть итоги', stageId: results.id });
  const curriculum = input.stages.find((stage) => stage.code === 'curriculum');
  const windowSoon = input.windowStart ? Math.floor((Date.parse(input.windowStart.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  if (curriculum && !doneStatus(curriculum.status) && windowSoon !== null && windowSoon >= 0 && windowSoon <= 21) {
    signals.push({ id: 'plan-stale', level: 'warning', title: 'Приближается учебное окно, план не актуален', stage: curriculum.name, at: input.windowStart!.slice(0, 10), action: 'Открыть учебный план', stageId: curriculum.id });
  }
  const started = input.stages.find((stage) => stage.code === 'start_classes' && stage.status === 'COMPLETED');
  if (started && input.students === 0 && silence !== null && silence > 14) signals.push({ id: 'mismatch', level: 'warning', title: 'Старт подтверждён, студентов нет', stage: started.name, at: input.signalAt?.slice(0, 10) ?? input.today, action: 'Перейти к этапу', stageId: started.id });
  if (input.duplicate) signals.push({ id: 'duplicate', level: 'critical', title: 'Второй живой заход на ту же тройку', stage: 'Заход', at: input.today, action: 'Открыть площадку' });
  return signals.sort((left, right) => right.at.localeCompare(left.at));
};

const toneOf = (critical: boolean, warning: boolean, closed: boolean): ControlLevel => critical ? 'critical' : warning || !closed ? 'warning' : 'ok';

export const buildControlCategories = (input: {
  today: string;
  stages: Array<{ code: string; status: string }>;
  licenseUntil: string | null;
  qualificationUntil: string | null;
  transferDone: boolean;
  accessReady: boolean;
  carrierStatus: string | null;
  students: number | null;
  signalAt: string | null;
  windowEnd: string | null;
}): ControlCategory[] => {
  const day = (value: string | null) => value ? Math.floor((Date.parse(input.today) - Date.parse(value.slice(0, 10))) / 86400000) : null;
  const ahead = (value: string | null) => value ? Math.floor((Date.parse(value.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  const closed = (code: string) => {
    const stage = stageOf(input.stages, code);
    return Boolean(stage && doneStatus(stage.status));
  };
  const licenseDays = ahead(input.licenseUntil);
  const qualificationDays = ahead(input.qualificationUntil);
  const silence = input.signalAt ? day(input.signalAt) : null;
  const windowLate = input.windowEnd ? day(input.windowEnd) : null;
  const documentsClosed = closed('document_package');
  const contractClosed = closed('sign_contract');
  const licenseClosed = closed('sign_license');
  const teacherClosed = closed('train_teacher') || closed('confirm_teacher');
  const curriculumClosed = closed('curriculum');
  const classesClosed = closed('start_classes') || closed('classes_running');
  const reportingClosed = closed('period_results');
  const rows: ControlCategory[] = [
    { id: 'documents', label: 'Документы', tone: toneOf(false, false, documentsClosed), detail: documentsClosed ? 'Пакет закрыт' : 'Пакет ещё не закрыт' },
    { id: 'contract', label: 'Договор', tone: toneOf(false, false, contractClosed), detail: contractClosed ? 'Договор подписан' : 'Подписание не закрыто' },
    {
      id: 'license',
      label: 'Лицензия',
      tone: toneOf(licenseDays !== null && licenseDays < 0, licenseDays !== null && licenseDays <= 90, licenseClosed),
      detail: licenseDays === null ? 'Срок не пришёл' : licenseDays < 0 ? 'Срок истёк' : `Осталось ${licenseDays} дн.`,
    },
    {
      id: 'access',
      label: 'Доступ к продукту',
      tone: toneOf(input.transferDone && !input.accessReady, false, input.accessReady || !input.transferDone && closed('transfer_access')),
      detail: input.accessReady ? 'Доступ подтверждён' : input.transferDone ? 'Передача закрыта, доступ пуст' : 'Передача ещё не закрыта',
    },
    {
      id: 'teacher',
      label: 'Преподаватель',
      tone: toneOf(input.carrierStatus === 'left', input.carrierStatus === 'planned', input.carrierStatus === 'active' || input.carrierStatus === 'trained' || teacherClosed),
      detail: input.carrierStatus === 'left' ? 'Носитель ушёл' : input.carrierStatus === 'active' ? 'Ведёт занятия' : input.carrierStatus === 'trained' ? 'Обучен' : 'Носитель не подтверждён',
    },
    {
      id: 'qualification',
      label: 'Квалификация преподавателя',
      tone: toneOf(qualificationDays !== null && qualificationDays < 0, qualificationDays === null || qualificationDays <= 30, qualificationDays !== null && qualificationDays > 30),
      detail: qualificationDays === null ? 'Дата квалификации не пришла' : qualificationDays < 0 ? 'Срок истёк' : `До ${qualificationDays} дн.`,
    },
    { id: 'curriculum', label: 'Учебный план', tone: toneOf(false, false, curriculumClosed), detail: curriculumClosed ? 'План согласован' : 'План не закрыт' },
    {
      id: 'classes',
      label: 'Занятия',
      tone: toneOf(Boolean(input.students === 0 && silence !== null && silence > 14 && closed('start_classes')), false, classesClosed),
      detail: classesClosed ? 'Старт или ведение закрыты' : 'Занятия ещё не подтверждены',
    },
    {
      id: 'lms',
      label: 'LMS',
      tone: silence === null ? 'warning' : silence > 30 ? 'critical' : silence > 14 ? 'warning' : 'ok',
      detail: silence === null ? 'Сигнала нет' : `Последний сигнал ${silence} дн. назад`,
    },
    {
      id: 'reporting',
      label: 'Отчётность',
      tone: toneOf(Boolean(windowLate !== null && windowLate > 0 && !reportingClosed), false, reportingClosed),
      detail: reportingClosed ? 'Итоги закрыты' : windowLate !== null && windowLate > 0 ? 'Окно закончилось без итогов' : 'Итоги ещё открыты',
    },
  ];
  return rows;
};

export const buildControlRecommendations = (input: {
  students: number | null;
  signalAt: string | null;
  today: string;
  licenseUntil: string | null;
  level: ControlLevel;
}): ControlRecommendation[] => {
  const items: ControlRecommendation[] = [];
  const silence = input.signalAt ? Math.floor((Date.parse(input.today) - Date.parse(input.signalAt.slice(0, 10))) / 86400000) : null;
  const licenseDays = input.licenseUntil ? Math.floor((Date.parse(input.licenseUntil.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  if ((input.students ?? 0) >= 15 && silence !== null && silence <= 14) items.push({ id: 'expand', title: 'Рассмотреть расширение', detail: 'Студентов достаточно, сигнал LMS свежий' });
  if (licenseDays !== null && licenseDays > 90 && licenseDays <= 180) items.push({ id: 'plan-renewal', title: 'Запланировать продление', detail: `До конца лицензии ${licenseDays} дн.` });
  if (input.level === 'ok') items.push({ id: 'watch', title: 'Оставить заход на фоновом контроле', detail: 'Открытых предупреждений нет' });
  return items;
};

export const trackedStages = (stages: Array<{ id: string; name: string; code: string; status: string }>) => stages.filter((stage) => stage.code !== 'control');

export const completedTrackedCount = (stages: Array<{ code: string; status: string }>) => trackedStages(stages).filter((stage) => doneStatus(stage.status)).length;

export const activityFallback = (seed: string) => {
  const base = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [3, 2, 1, 0].map((shift) => 8 + ((base + shift * 17) % 24));
};
