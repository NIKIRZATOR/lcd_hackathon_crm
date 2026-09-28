import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  checklistRows,
  contactBlockerLabels,
  contactDeadline,
  deadlineCaption,
  daysWord,
  emptyContactNote,
  evaluateContactChecks,
  parseContactNote,
  pickResponsible,
  serializeContactNote,
  type SiteContact,
} from './contactSearch';

const person = (patch: Partial<SiteContact> = {}): SiteContact => ({
  id: 'person-1',
  name: 'Иванова Анна Сергеевна',
  roleCode: 'vice_rector',
  position: '',
  email: 'anna@university.ru',
  phone: '+7 900 000-00-00',
  primary: true,
  active: true,
  ...patch,
});

describe('срок поиска контакта', () => {
  const now = dayjs('2026-09-27T15:00:00');

  it('берёт дату, которую бэк уже поставил от старта этапа', () => {
    const deadline = contactDeadline('2026-09-30', now);
    expect(deadline.fromServer).toBe(true);
    expect(deadline.date.format('YYYY-MM-DD')).toBe('2026-09-30');
    expect(deadline.daysLeft).toBe(3);
    expect(deadline.caption).toBe('Осталось 3 дня');
    expect(deadline.origin).toBe('От старта этапа');
  });

  it('без due_at считает три дня от сегодня, как в сиде плейбука', () => {
    const deadline = contactDeadline(null, now);
    expect(deadline.fromServer).toBe(false);
    expect(deadline.date.format('YYYY-MM-DD')).toBe('2026-09-30');
    expect(deadline.origin).toBe('3 дня от сегодня');
  });

  it('склоняет оставшиеся и просроченные дни', () => {
    expect(daysWord(1)).toBe('день');
    expect(daysWord(2)).toBe('дня');
    expect(daysWord(5)).toBe('дней');
    expect(daysWord(11)).toBe('дней');
    expect(daysWord(21)).toBe('день');
    expect(deadlineCaption(1)).toBe('Остался 1 день');
    expect(deadlineCaption(0)).toBe('Последний день');
    expect(deadlineCaption(-1)).toBe('Просрочен на 1 день');
    expect(deadlineCaption(-4)).toBe('Просрочен на 4 дня');
  });
});

describe('состояние контакта', () => {
  it('обязательны только найденный ответственный и телефон или почта', () => {
    expect(contactBlockerLabels(evaluateContactChecks(null, null))).toEqual([
      'Ответственный найден',
      'Есть телефон или почта',
    ]);
    const named = person({ phone: '', email: '', primary: false, roleCode: '' });
    expect(contactBlockerLabels(evaluateContactChecks(named, null))).toEqual(['Есть телефон или почта']);
    const ready = evaluateContactChecks(person({ phone: '', primary: false, roleCode: '' }), null);
    expect(ready.channel).toBe(true);
    expect(ready.role).toBe(false);
    expect(ready.primary).toBe(false);
    expect(ready.source).toBe(false);
    expect(contactBlockerLabels(ready)).toEqual([]);
  });

  it('основным считает контакт карточки вуза, а не первого в списке', () => {
    const extra = person({ id: 'person-2', name: 'Петров Пётр', primary: false });
    const primary = person({ id: 'person-3', name: 'Сидорова Мария', primary: true });
    expect(pickResponsible([extra, primary], extra.id)?.id).toBe('person-3');
    expect(pickResponsible([extra], 'person-2')?.id).toBe('person-2');
    expect(pickResponsible([extra], null)).toBeNull();
  });
});

describe('заметка чек-листа', () => {
  it('сохраняет источник, порядок и свои пункты', () => {
    const note = {
      source: 'call',
      order: ['source', 'custom-1', 'responsible', 'channel', 'role', 'primary'],
      custom: [{ id: 'custom-1', label: 'Уточнить кабинет', done: false }],
    };
    const parsed = parseContactNote(serializeContactNote(note));
    expect(parsed).toEqual(note);
    const rows = checklistRows(parsed, evaluateContactChecks(person(), 'call'));
    expect(rows.map((row) => row.kind === 'system' ? row.code : row.id)).toEqual(note.order);
    expect(rows.find((row) => row.kind === 'system' && row.code === 'source')?.done).toBe(true);
    expect(rows.find((row) => row.kind === 'custom')?.done).toBe(false);
  });

  it('чужой текст не затирает системные пункты', () => {
    expect(parseContactNote('просто комментарий')).toEqual(emptyContactNote());
    expect(parseContactNote('{"v":1,"order":["channel","nope"],"custom":[{"id":"responsible","label":"x","done":true}]}').order[0]).toBe('channel');
  });
});
