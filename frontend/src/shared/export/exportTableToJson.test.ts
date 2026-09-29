import { describe, expect, it } from 'vitest';

import { buildTableJson } from './exportTableToJson';

describe('buildTableJson', () => {
  it('exports selected columns with metadata', () => {
    const content = buildTableJson(
      [{ id: '1', organization: 'Test university', applications: 3 }],
      [
        { key: 'organization', title: 'University' },
        { key: 'applications', title: 'Applications' },
      ],
    );
    const payload = JSON.parse(content);

    expect(payload.schema_version).toBe('1.0');
    expect(payload.columns).toEqual([
      { key: 'organization', title: 'University' },
      { key: 'applications', title: 'Applications' },
    ]);
    expect(payload.row_count).toBe(1);
    expect(payload.items).toEqual([{ organization: 'Test university', applications: 3 }]);
  });
});
