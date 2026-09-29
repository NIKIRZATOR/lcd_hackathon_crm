import { describe, expect, it } from 'vitest';

import type { NbaItem } from '../types';
import { contextFromNbaItem } from './loadNbaContext';

const item = (context: NbaItem['context']): NbaItem => ({
  id: 'nba-1',
  rule_code: 'missing_stage_fact',
  severity: 'high',
  organization_id: 'org-1',
  organization_name: 'Организация',
  product_name: 'Продукт',
  reason: 'Причина',
  action: 'Открыть',
  priority: 'P1',
  action_target: 'checklist',
  due_at: null,
  program_instance_id: 'program-1',
  context,
});

describe('contextFromNbaItem', () => {
  it('maps embedded checklist without loading workflow details', () => {
    const context = contextFromNbaItem(
      item({
        stage_code: 'first_meeting',
        stage_due_at: null,
        checklist: [
          {
            code: 'meeting_date',
            label: 'Дата встречи',
            required: true,
            is_done: false,
          },
        ],
        attachment_kinds: [],
      }),
    );

    expect(context.stageCode).toBe('first_meeting');
    expect(context.facts).toEqual([
      {
        code: 'meeting_date',
        label: 'Дата встречи',
        required: true,
        completed: false,
        order: 0,
      },
    ]);
  });

  it('derives license attachment fact from embedded attachment kinds', () => {
    const context = contextFromNbaItem(
      item({
        stage_code: 'sign_license',
        stage_due_at: null,
        checklist: [],
        attachment_kinds: ['license'],
      }),
    );

    expect(context.facts.find((fact) => fact.code === 'file')?.completed).toBe(true);
  });
});
