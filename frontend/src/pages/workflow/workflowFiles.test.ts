import { describe, expect, it } from 'vitest';

import { isAllowedWorkflowFile, workflowFileTypeLabel } from './workflowFiles';

describe('isAllowedWorkflowFile', () => {
  it('принимает форматы из ТЗ и отклоняет остальные', () => {
    expect(isAllowedWorkflowFile('скан.PNG')).toBe(true);
    expect(isAllowedWorkflowFile('фото.jpeg')).toBe(true);
    expect(isAllowedWorkflowFile('фото.jpg')).toBe(true);
    expect(isAllowedWorkflowFile('договор.pdf')).toBe(true);
    expect(isAllowedWorkflowFile('архив.zip')).toBe(true);
    expect(isAllowedWorkflowFile('архив.gz')).toBe(true);
    expect(isAllowedWorkflowFile('архив.gzip')).toBe(true);
    expect(isAllowedWorkflowFile('пакет.rar')).toBe(true);
    expect(isAllowedWorkflowFile('письмо.doc')).toBe(true);
    expect(isAllowedWorkflowFile('письмо.docx')).toBe(true);
    expect(isAllowedWorkflowFile('отчёт.xls')).toBe(true);
    expect(isAllowedWorkflowFile('отчёт.xlsx')).toBe(true);

    expect(isAllowedWorkflowFile('скрипт.exe')).toBe(false);
    expect(isAllowedWorkflowFile('заметка.txt')).toBe(false);
    expect(isAllowedWorkflowFile('без-расширения')).toBe(false);
  });

  it('показывает понятный тип файла', () => {
    expect(workflowFileTypeLabel('фото.jpg')).toBe('JPEG');
    expect(workflowFileTypeLabel('архив.gzip')).toBe('GZIP');
    expect(workflowFileTypeLabel('договор.pdf')).toBe('PDF');
  });
});
