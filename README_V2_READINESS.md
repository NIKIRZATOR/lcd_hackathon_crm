# RTK EduFlow CRM V2 — срез готовности

Дата среза: 26 сентября 2026 г.  
Ветка: `v2_new_way`; проверена реализация на `e6bdf07` и незакоммиченные изменения не учитывались.

## Итог

Базовый V2-контур реализован: программа стала центральной сущностью, для неё создаётся runtime-workflow, доступны checklist, переходы, лицензии, преподаватели, Health/NBA, синхронизация метрик, Organization 360 и журнал workflow. Закрыты ключевые P0 из прежнего аудита: непрерывная Alembic-цепочка, DB-инварианты, checklist IDOR, RBAC создания организаций/Management, optional skip и корректное завершение финального этапа.

Это **не готовый к приёмке MVP** по `local_docs/promt_3`: обязательный Reports MVP отсутствует, а Stage 3–5 и Stage 7 закрыты частично. Сквозные E2E, нагрузочные и security-проверки не выполнены. Кроме того, текущая frontend-сборка не проходит.

Статусы: **готово** — реализовано в коде; **частично** — есть основной контур, но не все критерии промта; **не начато** — требуемого target-контура нет.

| Этап промта | Статус | Состояние |
| --- | --- | --- |
| 1. DB, RBAC, runtime hardening | готово* | Реализованы миграции/инварианты, scope checklist, RBAC и правила runtime. Нужна интеграционная проверка на PostgreSQL. |
| 2. Playbook, Start Program, checklist | готово* | Семь опубликованных playbook, applicability/recommendation, наследование KAM, guard архивной организации, immutable snapshot, типизированный checklist и transition validation. |
| 3. Organization 360, каталоги, seed | частично | Есть список/карточка организации, запуск программ и базовые contracts/licenses/teachers; не завершены полный S06, reassign KAM, полноценные документы/лента и требования к seed. |
| 4. Health, NBA, integrations | частично | Есть HealthService, NBA-каталог, метрики и mock sync; не подтверждены все канонические правила и идемпотентность, нет admin diagnostics. |
| 5. Workflow Journal и ролевые home | частично | Есть журнал программ и экран NBA/home; нет полного набора server-side фильтров, pagination/sorting и всех ролевых агрегатов. |
| 6. Reports MVP | не начато | Модели job/artifact и очередь есть, но отчёты всё ещё legacy, API/router/UI/exporters отсутствуют. |
| 7. Management, shell, UI state | частично | Route guard Management реализован; экран содержит только просмотр playbook и этапов. Search, bell, help, cache, imports/users/catalogs и error UX не закрыты. |
| 8. E2E, performance, security, delivery | не начато | Не найдены E2E/нагрузочные сценарии, security review и итоговая документация по критериям этапа. |

\* Статус отражает статическую проверку реализации и последние коммиты; миграции и runtime не были подтверждены запуском на PostgreSQL в этом окружении.

## Что готово

- Program-owned workflow: создание программы и переходы работают вокруг `ProgramInstance`, а не legacy interaction.
- Опубликованы `full_cycle`, `expansion`, `license_renewal`, `teacher_replace`, `materials_update`, `school_short`, `reactivation`; snapshot содержит фазы, этапы, SLA, checklist и transitions.
- Контроль доступа реализован в API: создание организации доступно только ADMIN, `/v2/management` защищён для MANAGER/ADMIN, checklist проверяет scope записи.
- В V2 присутствуют страницы организаций, программы/workflow, журнала, NBA и Management; Organization 360 уже показывает программы, stakeholders, health, contracts/licenses и teachers.
- Есть Health/NBA и синхронизация integration signals/program metrics; после событий предусмотрен пересчёт состояния.

## Главные незакрытые требования

1. **Reports MVP (P0).** `ReportQueryService` всё ещё строится на `UniversityInteraction`; router reports не подключён; `/v2/reports` — placeholder. Worker штатно переводит job в `FAILED` с `REPORT_EXPORTER_NOT_IMPLEMENTED`, поэтому нет XLS/XLSX/PDF/JSON, artifact/download, polling и role-scoped target reports.
2. **Organization 360 (P1).** На странице прямо заявлено, что программы/договоры/лента будут развиваться дальше; documents/feed показаны счётчиками, нет вкладок и полного CRUD stakeholder, нет reassign KAM и истории назначения. Кнопка «Отчёт» не передаёт preset организации.
3. **Синхронизация UI (P1).** В `OrganizationDetailPage.tsx` после sync используется `window.location.reload()`, что нарушает явное требование промта сохранять UI state.
4. **Health/NBA/integrations (P1).** Основной контур есть, но требуют проверки/доработки каноническая формула, полное поведение каждого NBA, `demand_without_program` с действием, продление лицензии, idempotency и admin diagnostics (S16).
5. **Журнал и home (P1).** Отсутствуют требуемые фильтрация, сортировка и pagination журнала, а также полный набор агрегатов S02–S04.
6. **Management и shell (P2).** Management пока read-only для двух сущностей; не реализованы templates CRUD/publish UI, каталоги, imports, users, search, NBA bell, help, cache состояния и унифицированный error UX.
7. **Доказательство готовности (P0/P1).** Нет сценариев E2E A–F/negative RBAC, теста 50 concurrent users, 10 параллельных reports, mobile review и `docs/v2/security_review.md`.

## Технические риски и проверки

- `npm run build` в `frontend` **не проходит**: Vite не находит `@dnd-kit/core` при импорте из legacy `WorkflowEditPage.tsx`. Пакет объявлен в `package.json`; установленный `node_modules` не соответствует lockfile/manifest и требует воспроизводимой установки зависимостей.
- Целевые backend unit-тесты не были запущены: pytest прекращает collection, потому что локальный Python не может загрузить `psycopg` (`libpq` / `psycopg_binary` отсутствуют). Это проблема окружения, а не результат тестов.
- `git diff --check` не нашёл ошибок пробелов. В рабочем дереве уже есть пользовательское изменение `backend/scripts/seed_demo_data.py`; оно не менялось в рамках среза и не включалось в оценку.

## Рекомендуемый порядок завершения

1. Восстановить воспроизводимую проверочную среду (frontend dependencies, PostgreSQL/libpq) и прогнать миграции + API smoke.
2. Реализовать target Reports MVP целиком: `ProgramInstance` query, API, exporters, worker/artifact/download и V2 UI.
3. Завершить P1: S06/reassign, rule consistency Health/NBA/sync, journal/home и тестовые сценарии A–D.
4. Выполнить E2E A–F, negative RBAC, нагрузочную/mobile/security проверку; только затем заявлять готовность к MVP.

## Основания для оценки

- Требования: `local_docs/promt_3`.
- Текущее состояние: коммиты `c25a1ac`, `e6bdf07` и исходный код V2/backend.
- Точки, подтверждающие незакрытые блоки: `backend/app/modules/reports/query_service.py`, `backend/app/worker/reports.py`, `backend/app/api/router.py`, `frontend/src/router/router.tsx`, `frontend/src/v2/pages/OrganizationDetailPage.tsx`, `frontend/src/v2/pages/ManagementPage.tsx`.
