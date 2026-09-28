import { describe, expect, it } from 'vitest';

import { identifyCheckState, identifyClosePlan, parseIdentifyNote, serializeIdentifyNote } from './identifyNeed';

const note = {
  reason: 'Площадке нужен практикум по сетям, чтобы закрыть дефицит часов у старшекурсников.',
  format: 'discipline' as const,
  windowId: 'window-1',
  limits: '',
  order: [],
  custom: [],
};

describe('выявление потребности', () => {
  it('закрывается, когда заполнены обоснование, форма и период', () => {
    expect(identifyClosePlan(note)).toMatchObject({ enabled: true, button: 'Закрыть и перейти к пакету документов', hint: null });
    expect(identifyClosePlan({ ...note, format: null }).enabled).toBe(false);
    expect(identifyCheckState(note).limits).toBe(false);
  });

  it('старый текст причины читается как обоснование', () => {
    expect(parseIdentifyNote('Короткая причина').reason).toBe('Короткая причина');
    expect(parseIdentifyNote(serializeIdentifyNote(note)).format).toBe('discipline');
  });
});
