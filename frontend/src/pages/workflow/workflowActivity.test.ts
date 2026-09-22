import { describe, expect, it } from 'vitest';

import { addWorkflowStageComment, addWorkflowStageFile, getWorkflowDetailMock, getWorkflowStageActivity } from './mocks';

describe('активность этапа', () => {
  it('хранит комментарий и файл на своём этапе', () => {
    const detail = getWorkflowDetailMock(2);
    const currentStageId = detail?.currentStageId ?? 0;
    const otherStageId = detail?.stages.find((stage) => stage.id !== currentStageId)?.id ?? 0;

    addWorkflowStageComment(2, otherStageId, currentStageId, {
      author: 'Петров А.А.',
      text: 'Договорились о встрече',
      createdAt: '22 сентября 2026, 12:00',
    });
    addWorkflowStageFile(2, otherStageId, currentStageId, {
      name: 'протокол.pdf',
      type: 'PDF',
      size: '0.4 МБ',
      uploadedAt: '22.09.2026, 12:01',
    });

    const current = getWorkflowStageActivity(2, currentStageId, currentStageId);
    const other = getWorkflowStageActivity(2, otherStageId, currentStageId);
    const reloaded = getWorkflowStageActivity(2, otherStageId, currentStageId);

    expect(current.files.map((file) => file.name)).toEqual(['Договор.pdf']);
    expect(current.comments).toEqual([]);
    expect(other.comments.map((comment) => comment.text)).toEqual(['Договорились о встрече']);
    expect(other.files.map((file) => file.name)).toEqual(['протокол.pdf']);
    expect(reloaded.comments).toEqual(other.comments);
  });
});
