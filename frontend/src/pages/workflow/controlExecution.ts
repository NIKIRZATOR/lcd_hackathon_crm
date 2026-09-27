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

export const controlLevel = (signals: ControlSignal[]): ControlLevel => signals.some((item) => item.level === 'critical') ? 'critical' : signals.length ? 'warning' : 'ok';

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
  if (input.carrierStatus === 'left') signals.push({ id: 'carrier', level: 'critical', title: 'Носитель ушёл', stage: 'Обучение преподавателя', at: input.today, action: 'Запустить замену преподавателя' });
  const licenseDays = input.licenseUntil ? Math.floor((Date.parse(input.licenseUntil.slice(0, 10)) - Date.parse(input.today)) / 86400000) : null;
  if (licenseDays !== null && licenseDays <= 90) signals.push({ id: 'license', level: licenseDays < 0 ? 'critical' : 'warning', title: licenseDays < 0 ? 'Лицензия истекла' : `Лицензия: ${licenseDays} дн.`, stage: 'Подписание лицензии', at: input.licenseUntil!.slice(0, 10), action: 'Создать заход «Продление»' });
  if (input.transferDone && !input.accessReady) signals.push({ id: 'access', level: 'critical', title: 'Доступ невалиден', stage: 'Передача и доступ к продукту', at: input.today, action: 'Перейти к этапу', stageId: input.stages.find((stage) => stage.code === 'transfer_access')?.id });
  const running = input.stages.find((stage) => stage.code === 'classes_running' && stage.status === 'IN_PROGRESS');
  const silence = input.signalAt ? day(input.signalAt) : null;
  if (running && (silence === null || silence > 30)) signals.push({ id: 'lms-silence', level: 'critical', title: 'Тишина LMS больше 30 дней', stage: running.name, at: input.signalAt?.slice(0, 10) ?? input.today, action: 'Перейти к этапу', stageId: running.id });
  const results = input.stages.find((stage) => stage.code === 'period_results');
  const windowLate = input.windowEnd ? day(input.windowEnd) : null;
  if (results && results.status !== 'COMPLETED' && windowLate !== null && windowLate > 0) signals.push({ id: 'window', level: 'critical', title: 'Окно закончилось, итоги не закрыты', stage: results.name, at: input.windowEnd!.slice(0, 10), action: 'Перейти к этапу', stageId: results.id });
  const started = input.stages.find((stage) => stage.code === 'start_classes' && stage.status === 'COMPLETED');
  if (started && input.students === 0 && silence !== null && silence > 14) signals.push({ id: 'mismatch', level: 'warning', title: 'Старт подтверждён, студентов нет', stage: started.name, at: input.signalAt?.slice(0, 10) ?? input.today, action: 'Перейти к этапу', stageId: started.id });
  if (input.duplicate) signals.push({ id: 'duplicate', level: 'critical', title: 'Второй живой заход на ту же тройку', stage: 'Заход', at: input.today, action: 'Открыть площадку' });
  return signals.sort((left, right) => right.at.localeCompare(left.at));
};
