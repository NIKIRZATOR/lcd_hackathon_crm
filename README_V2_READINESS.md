# RTK EduFlow CRM V2 — readiness

Дата обновления: 26 сентября 2026.

## Итог

Реализован рабочий V2-контур вокруг `ProgramInstance`: запуск программ по эталонам, runtime-workflow, facts/checklist, лицензии, преподаватели, Organization 360, Health и NBA. Миграции и идемпотентный demo seed проверены в Docker PostgreSQL.

V2 пока не является финально принятым MVP: следующие этапы — Website/LMS mocks, журнал, отчёты, shell и E2E/security — ещё требуют работы.

## Готово

### Stage 2R — canonical realignment

- Канонический `full_cycle` из 13 этапов и короткие playbook: `expansion`, `license_renewal`, `teacher_replace`, `school_short`.
- Архивация устаревших `materials_update` и `reactivation`.
- Запуск program instance с проверкой применимости playbook, организации, KAM и активных дублей.
- Дочерние программы для renewal/teacher replacement через `parent_program_id`.
- Runtime facts/checklist, обязательные значения, минимальная длина протокола встречи и переходы, блокируемые незаполненными условиями.
- Канонические проверки договора, лицензии, передачи, доступа к продукту и преподавателя при закрытии этапов.
- Поле `product_access` у лицензии.
- Виды вложений (`attachment_kind`) и проверка соответствия file-fact.
- Редактор эталонов: черновики, этапы, SLA, facts, публикация; facts копируются при создании черновика.

### Stage 3 — Organization 360 + data + seed

- Реестр организаций: тип, регион, KAM, активные программы, Health, реальный NBA-риск и признак отсутствия активности.
- Scope на уровне backend query: KAM — свой портфель, MANAGER — команда, ADMIN — все площадки.
- Organization 360: программы, люди, договоры/лицензии, преподаватели, документы и лента событий.
- Stakeholders: создание, редактирование, основной контакт, деактивация и привязка к программе.
- Переназначение KAM с причиной, историей assignment и audit event.
- Список stage-файлов с авторизованным скачиванием; лента transition/comment/file/integration/audit событий.
- Канонические поля UI для договоров, лицензий и преподавателей.
- Идемпотентный `backend/scripts/seed_demo_data.py` с площадками ЮФУ, СПбПУ, МГТУ, УрФУ, ИТМО, РАНХиГС, школами и ТГУ.
- Demo-сценарии: ЮФУ — просроченная первая встреча; СПбПУ — LMS unmatched; УрФУ — curriculum; Школа № 15 — transfer_access.

### Stage 4 — Health + NBA

- Penalty-based Health: обычная и крупная просрочка, семестровое окно, лицензия, преподаватель, LMS и метрики; нижняя граница — `0`.
- Исправлена обработка статуса `teacher left`.
- Пересчёт Health/NBA после старта/перехода программы, изменения лицензии, преподавателя и integration sync в рамках внешней транзакции.
- NBA-риски: `teacher_left`, `license_expired`, `stage_overdue_8_plus`, `stage_overdue`, `semester_window`, `license_expiring`, `lms_silence`, `demand_without_program`, `organization_without_program`, `integration_unmatched`.
- NBA по текущему этапу: P1 для первого обязательного незаполненного fact и P2 «Закрыть этап» при готовом checklist.
- У NBA есть `priority` (`P0`–`P4`) и `action_target`; главная страница показывает первые 10 действий и счётчик остальных.
- Переход из NBA прокручивает карточку программы к checklist или вложениям.

## Миграции этого прохода

- `c1e2f3a4b5d6_allow_child_program_instances.py`
- `d2e3f4a5b6c7_stage2r_fact_attachment_metadata.py`
- `e3f4a5b6c7d8_stage3_organization_stakeholders.py`
- `f4a5b6c7d8e9_stage4_nba_priority.py`

## Проверено

```powershell
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python scripts/seed_demo_data.py
docker compose run --rm backend pytest -q tests/unit/test_program_health_service.py tests/unit/test_nba_rules.py tests/unit/test_stage2_program_start.py tests/unit/test_workflow_seed.py
```

Целевой набор тестов: `12 passed`. Также проверены `compileall` затронутых backend-модулей, адресный TypeScript-check изменённых страниц и `git diff --check`.

## Следующая работа

1. Stage 5 — Website/LMS mock-интеграции и UI синхронизации.
2. Stage 6 — журнал и поиск.
3. Stage 7 — отчёты и экспорт.
4. Stage 8–9 — application shell, E2E и security/load-проверки.

## Известные ограничения

- `alembic check` сообщает о старом schema drift, не относящемся к миграциям V2 этого прохода.
- Полная frontend-сборка зависит от состояния локальных `node_modules`; адресная проверка изменённых страниц проходит.
- Полноценные E2E, нагрузочные и security-проверки ещё не выполнялись.
