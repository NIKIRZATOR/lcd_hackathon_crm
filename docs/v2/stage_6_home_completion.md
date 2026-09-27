# Stage 6 — Home completion report

## Реализовано в этом инкременте

- `GET /api/nba/home` возвращает ролевой рабочий стол из operational данных, а не frontend mock-правил.
- KAM получает число активных ProgramInstance, распределение Health, B2C aggregates (applications, payment/order records, students, streams) и ближайшие academic windows.
- Manager получает те же team aggregates, счётчик bottlenecks, организаций без программ и grouped critical workload by KAM.
- ADMIN получает счётчики unmatched/error integrations, failed imports/reports и draft templates. Каждая карточка содержит переход в нужный раздел; список system events берётся из audit trail.
- P4 `demand_without_program` ведёт в Organization 360, а не требует несуществующий ProgramInstance.

## Manual verification

| Role | Page | Action | Expected result |
| --- | --- | --- | --- |
| KAM | `/home` | Open Home | NBA queue, real portfolio Health, B2C aggregates and academic windows are visible only for owned programs. |
| MANAGER | `/home` | Open Home | Critical-by-KAM, bottlenecks, workload, organizations without program and team B2C summary are visible. |
| ADMIN | `/home` | Click an integration/import/template card | Management opens on the matching tab. |
| ADMIN | `/home` | Click report-problem card | Reports page opens. |
| ADMIN | `/home` | Inspect system events | Recent audit actions appear without raw PII. |

## Deferred Stage 6 scope

- Journal visual filters still need ID-based API binding, UI pagination and server-side sort controls.
- Global search backend endpoint exists, but its header UI is deliberately disabled pending a final placement decision.
