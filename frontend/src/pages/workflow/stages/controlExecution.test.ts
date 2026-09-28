import { describe, expect, it } from 'vitest';
import { buildControlSignals, controlLevel, hasEnteredControl, rememberControlEntered } from './controlExecution';

const base = { today: '2026-09-28', stages: [], healthBand: 'green', healthScore: 80, carrierStatus: 'active', licenseUntil: '2027-09-01', transferDone: false, accessReady: true, students: 10, signalAt: '2026-09-20', windowEnd: '2026-12-01', duplicate: false };

describe('контроль исполнения', () => {
  it('сохраняет переход в контроль для конкретного захода после повторного чтения', () => {
    localStorage.removeItem('rtk-eduflow:control-entered:control-a');
    localStorage.removeItem('rtk-eduflow:control-entered:control-b');
    expect(hasEnteredControl('control-a')).toBe(false);
    rememberControlEntered('control-a');
    expect(hasEnteredControl('control-a')).toBe(true);
    expect(hasEnteredControl('control-b')).toBe(false);
    localStorage.removeItem('rtk-eduflow:control-entered:control-a');
  });

  it('отличает короткую просрочку от долгой и не закрывается сам', () => {
    const signals = buildControlSignals({
      ...base,
      stages: [{ id: 'a', name: 'Пакет документов', code: 'document_package', status: 'IN_PROGRESS', dueAt: '2026-09-20' }],
    });
    expect(signals[0]?.level).toBe('critical');
    expect(controlLevel(buildControlSignals({ ...base, stages: [{ id: 'b', name: 'Встреча', code: 'first_meeting', status: 'IN_PROGRESS', dueAt: '2026-09-25' }] }))).toBe('warning');
    expect(controlLevel(buildControlSignals(base))).toBe('ok');
  });
});
