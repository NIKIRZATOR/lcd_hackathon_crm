import { describe, expect, it } from 'vitest';

import { activeFramework, documentClosePlan } from './documentPackage';

describe('пакет документов', () => {
  it('закрывается только когда приложены все три файла', () => {
    expect(documentClosePlan({ project_contract: true, direction_materials: false, product_description: true }).enabled).toBe(false);
    expect(documentClosePlan({ project_contract: true, direction_materials: true, product_description: true })).toMatchObject({
      enabled: true,
      button: 'Закрыть и перейти к подписанию договора',
    });
  });

  it('берёт действующую рамку и пропускает закрытую', () => {
    const chosen = activeFramework([
      { id: 'old', number: '1', status: 'closed', validUntil: null, attachmentId: null },
      { id: 'live', number: '2', status: 'active', validUntil: '2099-01-01', attachmentId: 'file' },
    ]);
    expect(chosen?.id).toBe('live');
  });
});
