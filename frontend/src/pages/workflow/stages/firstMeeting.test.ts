import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { meetingCheckState, meetingClosePlan, parseMeetingNote, protocolFileText, serializeMeetingNote } from './firstMeeting';

const base = {
  when: dayjs('2026-10-01T15:00:00'),
  participantId: 'person-1',
  outcome: 'go_product' as const,
  note: '',
  hasProtocolFile: false,
};

describe('первая встреча', () => {
  it('идём в продукт только с датой, участником, итогом и протоколом или заметкой', () => {
    expect(meetingClosePlan(base).enabled).toBe(false);
    expect(meetingClosePlan(base).button).toBe('Закрыть и перейти к выявлению потребности');
    expect(meetingClosePlan({ ...base, hasProtocolFile: true })).toMatchObject({ action: 'forward', enabled: true, hint: null });
  });

  it('нужна ещё встреча не закрывает этап', () => {
    expect(meetingClosePlan({ ...base, outcome: 'another_meeting', hasProtocolFile: true })).toMatchObject({
      action: 'stay',
      enabled: false,
      hint: 'Назначьте новую дату встречи.',
    });
  });

  it('не актуально закрывает заход только с причиной в заметке', () => {
    expect(meetingClosePlan({ ...base, outcome: 'not_relevant' })).toMatchObject({
      action: 'refuse',
      button: 'Закрыть заход',
      enabled: false,
    });
    expect(meetingClosePlan({ ...base, outcome: 'not_relevant', note: 'Вузу это сейчас не нужно.' })).toMatchObject({
      action: 'refuse',
      enabled: true,
      hint: null,
    });
  });

  it('хранит время, итог, заметку и свои задачи', () => {
    const note = {
      time: '15:00',
      outcome: 'another_meeting' as const,
      note: 'Коротко',
      source: null,
      order: ['custom-1'],
      custom: [{ id: 'custom-1', label: 'Прислать повестку', done: false }],
    };
    expect(parseMeetingNote(serializeMeetingNote(note))).toEqual(note);
    expect(meetingCheckState({ ...base, when: null }).slot).toBe(false);
  });

  it('текст для файла протокола не короче лимита сервера', () => {
    expect(protocolFileText('протокол.pdf').length).toBeGreaterThanOrEqual(40);
  });
});
