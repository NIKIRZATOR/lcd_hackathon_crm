export const nbaBackendGaps = [
  {
    field: 'current_stage + checklist в очереди',
    endpoint: 'GET /api/nba/today',
    missing: 'Нет current_stage_code и обязательных checklist items. Конкурсный adapter собирает их из reason/action_target и ванильных шаблонов этапов, due_at — срок текущего этапа.',
  },
];
