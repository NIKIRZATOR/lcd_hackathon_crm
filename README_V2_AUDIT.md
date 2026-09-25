# Аудит CRM V2 (`v2_new_way`)

Дата аудита: 25.09.2026  
Ветка: `v2_new_way` (`d97c6b7`)  
Объект анализа: текущее состояние рабочей копии, включая незакоммиченное изменение `backend/scripts/seed_demo_data.py`.

## 1. Резюме

Ветка содержит реальный вертикальный срез новой концепции: после авторизации пользователь попадает в отдельный V2-контур, организации и программы читаются из PostgreSQL через API, создание программы запускает runtime workflow, checklist и вложения участвуют в переходе, health и NBA рассчитываются на backend, JSON-фикстура обновляет метрики, а журнал workflow показывает `program_instance`.

Однако ветка **не соответствует заявлению о завершении этапов 0–14** и не готова считаться завершённым MVP 0–15. Фактическая оценка:

| Область | Оценка |
|---|---:|
| Новая центральная модель | частично реализована |
| Рабочий V2 vertical slice | реализован |
| Этапы 0–4 | в основном реализованы, есть критичные ограничения БД/UI |
| Этапы 5–7 | частично реализованы |
| Этапы 8–11 | частично или в основном реализованы |
| Этапы 12–14 | UI-прототип, но не полный требуемый состав |
| Этап 15 Reports MVP | не реализован |
| Соответствие полной карте S00–S18 | низкое/среднее; присутствуют основные S01, S02, S05–S09 |
| Соответствие ТЗ | частичное; отсутствует ключевая функция отчётов и ряд НФТ |
| Готовность к безопасному обновлению существующей БД | нет |
| Готовность к продолжению разработки | да, после устранения P0/P1 |

Ориентировочная полнота именно плана из `promt_v2.txt`: **около 60–65%**. Это не процент строк кода, а экспертная оценка выполнения проверяемых результатов этапов.

## 2. Источники и приоритет требований

Проверены:

1. `local_docs/promt_v2.txt` — этапный план 0–15 и правила миграции/проверки.
2. `local_docs/CRM_RTK_operacionnaya_sistema_partnerstv.pdf` — продуктовая логика, роли, сценарии, бизнес-правила.
3. `local_docs/CRM_RTK_model_dannyh_i_ekrany.pdf` — целевая модель, поля, связи, health/NBA, данные экранов.
4. `local_docs/CRM_RTK_karta_ekranov.pdf` — S00–S18, переходы и различия по ролям.
5. `local_docs/6_IT_Shkola_Rostelekoma.pdf` — исходное ТЗ.
6. Код backend/frontend, миграции, seed, тесты и история Git.

Для оценки применён следующий приоритет:

1. Явные уточнения `promt_v2.txt` (например, отсутствие ИИ и сохранение 14-го этапа `control`).
2. Три канонических CRM-документа.
3. Исходное ТЗ.

Есть осознанное противоречие: карта экранов описывает контроль скорее как статистику/NBA, а промт требует сохранить `control` как 14-й каталоговый этап. В коде сохранены и фаза `control`, и этап `control`; это соответствует более приоритетному промту.

## 3. Текущее устройство V2

### Backend

Новая модель добавлена рядом с legacy:

- `organizations`, `organization_types`, `org_assignments`, `stakeholders`;
- `program_instances`, `academic_windows`;
- `workflow_phases`, `workflow_stage_catalog`;
- связь runtime-этапов с `program_instance`;
- `playbook_checklist_items`, `program_checklist_values`;
- договоры, лицензии и преподаватели-носители;
- `program_metrics`, `integration_signals`;
- `nba_rules`, `nba_items`;
- `HealthService`, `NbaService`, mock integration service.

Legacy-сущности `universities` и `university_interactions` сохранены, что само по себе соответствует безопасной стратегии совместимости. Проблема в том, что миграционная история для перехода с уже развернутой legacy-БД не сохранена (раздел 8.1).

### Frontend

Создан изолированный `frontend/src/v2/` и маршруты:

- `/v2`;
- `/v2/organizations`;
- `/v2/organizations/:id`;
- `/v2/workflows`;
- `/v2/programs/:id`;
- `/v2/reports`;
- `/v2/management`.

Используются общий AuthProvider, Keycloak, API client и реальный backend API. Legacy-маршруты сохранены. После логина стартовый маршрут ведёт в V2.

## 4. Соответствие этапам промта

Обозначения: **DONE** — минимальные критерии этапа выполнены; **PARTIAL** — есть рабочая основа, но отсутствуют обязательные части; **NOT DONE** — целевой результат отсутствует.

### Stage 0 — V2 Foundation: DONE с оговорками

Реализовано:

- отдельный V2-контур и все требуемые маршруты;
- общая авторизация и API client;
- header/sidebar, пользователь и роли;
- мобильный Drawer;
- legacy UI не удалён.

Расхождения:

- в S01 нет глобального поиска, колокольчика NBA и встроенной справки;
- прямой переход KAM на `/v2/management` не запрещён маршрутизатором: пункт скрыт в меню, но route защищён только общим набором ролей;
- `/v2/reports` является заглушкой.

### Stage 1 — Organization Core: PARTIAL

Реализовано:

- модели `OrganizationType`, `Organization`, `OrgAssignment`, `Stakeholder`;
- история назначения KAM (`status`, `assigned_at`, `assigned_by`, `ended_at`);
- list/detail/stakeholders/assignment API;
- data scope организации для KAM, команды руководителя и администратора;
- типы `university`, `spo`, `school` создаются seed-скриптом.

Расхождения:

- таблица `/v2/organizations` не показывает обязательные `type` и `KAM`; вместо этого показывает `city` и запрещённый картой единый `organization.status`;
- нет числа программ, худшего health и ближайшего риска;
- в карточке нельзя добавить/редактировать stakeholder, выбрать primary или сделать soft delete;
- `stakeholders.program_instance_id` не имеет FK в модели/миграции;
- KAM может вызвать API создания организации, хотя канонический S05 запрещает ручное добавление организации KAM;
- фактический seed создаёт только организации типа `university`; записей СПО и школ нет.

### Stage 2 — Program Instance Core: PARTIAL, критичный DB-gap

Реализовано:

- центральная таблица `program_instances` со связями organization/direction/product/KAM/playbook/window/parent;
- legacy-ссылка `legacy_interaction_id` и backfill в seed;
- одна организация получает несколько программ;
- программы показаны в Organization Detail.

Критичные расхождения:

- нет требуемого частичного UNIQUE `(organization_id, direction_id, product_id) WHERE status IN ('draft','active','paused')`;
- уникальность проверяется только запросом сервиса, поэтому два конкурентных запроса могут создать дубликаты;
- отсутствуют целевые индексы `program_instance(kam_user_id,status,health_band)`;
- нет отдельной миграции/backfill существующей БД и зафиксированного mapping `university_interaction → program_instance`; backfill выполняет seed;
- `product` не проверяется на принадлежность выбранному `direction`: сервис проверяет лишь существование любого legacy `ITProgram` с таким direction;
- `template_snapshot` при обычном создании содержит только `playbook_code`, а не снимок этапов/checklist.

### Stage 3 — Academic Window: MOSTLY DONE

Реализовано:

- модель и связь с программой;
- два окна, одно текущее;
- выбор окна в мастере и показ на программе.

Расхождения:

- cutoff текущего окна захардкожен датой и быстро перестаёт воспроизводить semester risk;
- нет редактирования окна программы;
- БД не гарантирует единственность `is_current=true`.

### Stage 4 — Phase + Stage Catalog: MOSTLY DONE

Реализовано:

- 6 фаз, включая отдельную `control`;
- 14 каталоговых этапов;
- `workflow_stage.stage_catalog_id`;
- readonly-таблица этапов в Management.

Расхождения:

- каталог не хранит default SLA/semantic flags; они остаются только на конкретном `workflow_stage`;
- нет теста/DB-инварианта, гарантирующего полный набор 14 кодов после seed;
- порядок вызовов seed корректен, но код связывания этапов с каталогом зависит от строковых списков.

### Stage 5 — Playbook Catalog: PARTIAL

Реализовано:

- переиспользованы templates, versions, stages, transitions, governance и migration engine;
- добавлены metadata `code`, `applies_to_type`, `status`;
- seed создаёт семь кодов playbook;
- full_cycle содержит 14 этапов и линейные переходы.

Расхождения:

- только `full_cycle` имеет опубликованную версию, этапы, checklist и переходы;
- остальные шесть playbook создаются пустыми `draft`, поэтому фактически не являются готовыми плейбуками и недоступны в мастере;
- Management показывает только список, а не требуемый readonly detail структуры;
- `applies_to_type` не валидируется при старте программы;
- на модели нет constraint для status/applies_to_type;
- snapshot программы не фиксирует структуру playbook.

### Stage 6 — Start Program / Workflow Runtime: PARTIAL

Реализовано:

- четырёхшаговый мастер direction → product → playbook → window;
- создаются program и runtime stage instances;
- первый этап `IN_PROGRESS`, остальные `NOT_STARTED`;
- redirect в карточку программы;
- health/NBA рассчитываются после запуска.

Расхождения:

- нет выбора/переопределения KAM для MANAGER/ADMIN;
- сервис всегда записывает `kam_user_id=current_user.id`; при старте руководителем/админом в поле KAM попадёт пользователь не с ролью KAM;
- нет рекомендации playbook по типу организации/наличию договора;
- не проверяется `applies_to_type`;
- можно стартовать программу у archived organization;
- не создаётся пустая license со статусом `not_transferred`;
- seed создаёт большинство `program_instance` и runtime не через production service;
- нет безопасной обработки ошибок/валидации шагов мастера;
- программа не имеет операции завершения финального этапа: после `control` нет перехода, а `program.status` нигде не переводится в `completed`.

### Stage 7 — Checklist + Done Criteria: PARTIAL, есть RBAC-уязвимость

Реализовано:

- определения и runtime values checklist;
- item types перечислены в CHECK constraint;
- required checklist, `requires_comment` и `requires_attachment` проверяются backend-сервисом перехода;
- S09 показывает фазы/этапы, SLA, checklist, комментарии, файлы и переход;
- закрытые этапы доступны readonly.

Критичные расхождения:

- `GET /stage-instances/{id}/checklist` и `PATCH /stage-instances/checklist/{id}` не проверяют принадлежность этапа портфелю пользователя; любой KAM с известным UUID может прочитать/изменить чужой checklist;
- `ProgramChecklistValue` хранит только `is_done` и `value_text`; нет typed values для number/date/stakeholder/file;
- frontend умеет редактировать только checkbox, независимо от `item_type`;
- UI не передаёт transition comment;
- в V2 нет Skip для optional stage;
- в `execute_program_transition` флаг `skip_current` не проверяется против `stage.is_optional`, поэтому API может пропустить любой этап;
- frontend показывает общую причину блокировки, но не структурированные коды/конкретный недостающий артефакт;
- checklist API оформлен без единых schemas/service и не имеет тестов data scope.

### Stage 8 — Contract + License + Teacher Carrier: PARTIAL

Реализовано:

- модели и минимальный list/create/update API;
- contract привязан к organization, license — к program, teacher — к organization/product и optional program/stakeholder;
- Organization Detail показывает и создаёт записи;
- изменения license/teacher пересчитывают health и NBA;
- seed создаёт разные состояния.

Расхождения:

- `Contract.organization_id` и `License.program_instance_id` остаются nullable ради legacy, но нет новых target constraints;
- старые UNIQUE (`contract.interaction_id+number`, `license.contract_id+product_id`) плохо выражают новую модель и позволяют несколько неоднозначных target-записей;
- в Program Detail нет требуемых readonly mini-block license/teacher;
- UI не даёт редактировать существующие записи и не работает с файлами договора/лицензии;
- после изменения contract health/NBA не пересчитываются;
- в модели license используются смешанные пары полей `signed_at/signed_on`, а целевой UI/отчёт не унифицирован.

### Stage 9 — Health: PARTIAL

Реализовано:

- backend `HealthService` и сохранение score/band;
- учтены SLA, окно, license, teacher, LMS students и website applications;
- худший health организации;
- badges в программах/организации;
- пересчёт после перехода, license/teacher и sync.

Расхождения с канонической формулой:

- канон: green ≥70, yellow 40–69, red ≤39; код: green ≥90, yellow 60–89, red <60;
- SLA не имеет состояния «осталось <30%»;
- окно не имеет 45-дневной промежуточной зоны и не использует `semester_critical`;
- LMS-фактор не учитывает 1–9/≥10 студентов и 30 дней после передачи;
- website demand оценивается другой эвристикой;
- `teacher_activity_on` из mock metrics не переносится в `TeacherCarrier.last_lms_activity_on`, хотя health/NBA читают именно teacher carrier;
- `HealthService.recompute()` сам делает `commit`, поэтому сложная команда распадается на несколько транзакций вместо требуемого атомарного пересчёта после команды;
- нет проверки диапазона health_score 0–100 на уровне БД.

### Stage 10 — NBA: PARTIAL

Реализовано:

- `nba_rules`, `nba_items`;
- семь требуемых кодов объявлены;
- materialized items и backend recompute;
- список «Сегодня», severity, причина, срок и переход к программе;
- scope применяется при чтении очереди.

Расхождения:

- `demand_without_program` объявлен, но никогда не генерируется: recompute работает только внутри уже существующей программы;
- у `nba_rule` нет canonical priority/severity/templates, сортировка идёт по severity, а не `priority asc, due`;
- license rule только открывает программу, но не запускает связанный `license_renewal` с parent;
- нет dismiss/done сценариев и правил допустимости dismiss;
- отсутствуют дополнительные deterministic rules `sign_then_transfer`, `license_then_teacher`, `teacher_then_curriculum` из модели;
- `no_teacher` срабатывает с первого этапа, а канон требует поздний этап/operations;
- `lms_silence` основан на teacher carrier, а не на transferred license + program metrics;
- изменение checklist не вызывает recompute;
- unit-тест проверяет лишь наличие кодов, а не поведение правил и scope.

### Stage 11 — Program Metrics + Mock Integrations: MOSTLY DONE

Реализовано:

- `program_metrics`, `integration_signals`;
- JSON fixture с mapped/unmatched/error;
- sync обновляет applications/students/streams/teacher activity;
- UI показывает метрики и итоги sync;
- после sync вызываются health и NBA;
- seed вызывает тот же sync service.

Расхождения:

- одна общая fixture вместо раздельных website/LMS контрактов;
- сопоставление идёт по display-name организации и продукта, а не по стабильным direction/product codes;
- нет endpoint/экрана журнала signals и обработки unmatched;
- нет idempotency key/периода сигнала; каждый sync добавляет новые одинаковые строки истории;
- mock teacher activity не обновляет teacher carrier, поэтому часть health/NBA фактически не реагирует;
- sync делает несколько commit через metrics → health → NBA, а не одну атомарную команду;
- админский экран моков отсутствует.

### Stage 12 — Organization 360 MVP: PARTIAL

Реализовано:

- header: name/type/region/KAM/worst health;
- программы, люди, договоры, лицензии и преподаватели;
- New Program, Sync и переход в Reports;
- нет workflow status организации.

Расхождения:

- нет Reassign KAM в UI, хотя backend API существует;
- «Документы» и «Лента» представлены только двумя счётчиками, без содержимого;
- нет локальной навигации/разделов карточки;
- stakeholder нельзя добавить/изменить;
- программа не показывает current stage, playbook, students/applications и license в таблице S06;
- кнопка Sync вызывает `window.location.reload()`, нарушая НФТ «страница не должна обновляться/сбрасываться»;
- Report не передаёт предустановленный organization filter;
- внизу страницы остался ложный текст «Программы, договоры и лента будут подключены», хотя часть уже подключена;
- действия не скрыты по роли.

### Stage 13 — Workflow Journal: MOSTLY DONE

Реализовано:

- одна строка = program_instance;
- обязательные колонки prompt;
- presets all/overdue/semester/renewal/LMS silence;
- переход в Program Detail;
- data scope применяется.

Расхождения:

- нет streams (есть в канонической модели экрана, хотя не обязателен в минимуме prompt);
- нет обычных фильтров и пагинации;
- scope реализован N+1 вызовом `OrganizationService.get` для каждой строки, а не SQL-фильтром;
- health не пересчитывается перед выдачей журнала;
- renewal/LMS presets используют упрощённые правила, отличающиеся от NBA;
- пустое состояние не ведёт пользователя к организациям.

### Stage 14 — Role-Based Home: PARTIAL

Реализовано:

- единый `/v2`;
- backend возвращает разные карточки для KAM/MANAGER/ADMIN;
- KAM видит NBA table;
- ADMIN получает counters integrations/imports/reports/drafts.

Расхождения:

- один и тот же NBA table рисуется для всех ролей, хотя канон требует разную композицию S02/S03/S04;
- `MANAGER.kam_workload = len(NBA)`, а не нагрузка по каждому KAM;
- `ranking = len(NBA)`, а не рейтинг программ по applications/students/streams;
- red/yellow organizations вычисляются по severity NBA, а не по health;
- stage bottlenecks — только количество overdue NBA, без группировки по stage;
- KAM health summary — severity attention, а не распределение green/yellow/red;
- ADMIN не видит список ошибок, signals и report queue, только totals;
- нет S18 reassign action с Home Manager.

### Stage 15 — Reports MVP: NOT DONE

Фактическое состояние:

- `/v2/reports` — placeholder;
- в `app/api/router.py` reports router не импортирован и не подключён;
- target reports router отсутствует;
- `ReportQueryService` строит выборку из legacy `UniversityInteraction`, а не `ProgramInstance`;
- в фильтрах/колонках нет target health/program metrics;
- worker всегда завершает job ошибкой `REPORT_EXPORTER_NOT_IMPLEMENTED`;
- xls/xlsx/pdf exporters и download flow отсутствуют;
- нет V2 jobs queue UI, status polling и download;
- нет рейтинга/PNG;
- тест прямо закрепляет ожидаемое падение worker, а не успешную выгрузку.

## 5. Соответствие карте экранов S00–S18

| Экран | Состояние | Основные расхождения |
|---|---|---|
| S00 Вход | частично | Keycloak подключён; нет demo role switch, но реальный Keycloak приоритетнее мока |
| S01 Оболочка | частично | есть responsive menu/user/role; нет search, bell, help |
| S02 Главная KAM | частично | есть NBA table; нет health bands, window widget, signal feed, portfolio context |
| S03 Главная руководителя | прототип | counters не являются workload/bottlenecks/heat/ranking; нет reassign |
| S04 Главная администратора | прототип | только totals; нет diagnostics, errors, queues |
| S05 Организации | частично | нет type/KAM/program count/health/NBA/filter cache; есть запрещённый org status |
| S06 Organization 360 | частично | основные сущности есть; documents/feed только counters; нет reassign/stakeholder CRUD |
| S07 Новая программа | частично | 4 шага есть; нет рекомендаций, KAM override, summary и правил applicability |
| S08 Workflow journal | в основном | обязательный минимум prompt выполнен; не хватает расширенных фильтров/streams |
| S09 Program workspace | частично | runtime/checklist/comments/files работают; нет NBA banner, mini-blocks, transition draft/comment, Skip, history |
| S10 Reports | отсутствует | placeholder |
| S11–S12 Templates | частично | только readonly lists V2; legacy editor существует отдельно, не встроен в V2 Management |
| S13 Catalogs | отсутствует в V2 | backend каталоги частично есть |
| S14 Import | отсутствует в V2 | зрелый legacy backend/import pipeline существует |
| S15 Users | отсутствует в V2 | backend users/roles существует |
| S16 Mocks | отсутствует | есть fixture и sync API, нет admin UI |
| S17 Help | отсутствует | нет встроенной документации |
| S18 Reassign KAM | backend only | API есть, модалки и audit-oriented UX нет |

## 6. Соответствие исходному ТЗ

| Требование ТЗ | Статус | Комментарий |
|---|---|---|
| Каталоги вузов/направлений/продуктов/ответственных в БД | частично | данные в БД есть; target organization UI/management неполон |
| Импорт xls/xlsx с mapping | backend legacy реализован | в V2 Management не подключён |
| Визуализация 14-шагового пути | реализовано | сгруппировано по фазам, `control` сохранён |
| Изменение статуса и комментарий перехода | частично | переход есть; V2 не передаёт transition comment |
| Вложения png/jpeg/pdf/zip/gzip/rar/doc/docx/xls/xlsx | backend реализован | allowlist/signature checks есть; текст V2 ошибочно говорит только PDF/DOCX/XLSX |
| Отчёты xls/xlsx/pdf за период и по колонкам | не реализовано | Stage 15 отсутствует |
| Статистика/графики png/pdf | legacy/частично | target рейтинг отсутствует |
| Интеграция LMS и сайта JSON | mock реализован | реальная интеграция намеренно отложена промтом |
| Создание/изменение workflow | backend legacy реализован | V2 management только readonly; шесть target playbook пустые |
| Keycloak | реализовано | сохранён существующий контур |
| Три роли | реализовано частично | базовые роли/scope есть, но найдена checklist IDOR и неполный role UI |
| Кэш действий/фильтров/черновиков | не реализовано для V2 | нет `ui_state_cache` или local persistence |
| Отклик ≤1 секунды | не проверено | нет performance/load tests; journal имеет N+1 scope checks |
| Без reload при изменениях | нарушено | Organization Sync делает полный `window.location.reload()` |
| Стабильные коды ошибок | частично | общий envelope/workflow codes есть; V2 в основном заменяет их общими сообщениями |
| 50 параллельных пользователей | не проверено | нагрузочные тесты отсутствуют |
| 10 параллельных отчётов | не выполнено | worker не экспортирует |
| Встроенные user/admin docs со скриншотами | отсутствуют | S17 не реализован |
| Desktop/mobile | частично | responsive shell есть; S09 использует фиксированную двухколоночную grid без mobile-layout |
| Swagger/OpenAPI | реализовано для подключённых router | reports API отсутствует |
| Docker/Linux-ready | инфраструктура есть | runtime Docker в ходе аудита проверить не удалось из-за прав на Windows Docker pipe |
| 152-ФЗ/ФСТЭК №117 | нельзя подтвердить | auth/audit/file validation есть, но нет полноценной модели ПДн, retention/access review/security docs |

## 7. RBAC и data scope

Что сделано правильно:

- organization scope централизован в `OrganizationService`;
- KAM видит active assignments, MANAGER — subordinate KAM, ADMIN — всё;
- license/teacher/integration/program endpoints вызывают проверку организации;
- workflow comments/attachments используют `_ensure_can_access_stage_instance`;
- переназначение ограничено MANAGER/ADMIN и командой руководителя.

Проблемы:

1. **IDOR в checklist API** — отсутствует record-level access check и на чтение, и на изменение.
2. Прямой `/v2/management` доступен KAM; скрытие пункта меню не является RBAC.
3. Все роли `CRM_ROLES` могут вызвать ручное создание организации; целевой сценарий отдаёт каталог администратору/import.
4. В Start Program нет role-aware KAM override; manager/admin записываются как KAM программы.
5. Не проверяется тип организации против `playbook.applies_to_type`.
6. Нет отдельных интеграционных тестов KAM чужая organization/program/stage/checklist/license/teacher/sync.

## 8. Миграции и модель данных

### 8.1. Критический разрыв Alembic-истории

По сравнению с `main` удалены 11 существовавших migration-файлов и добавлена новая корневая `4e2cb764e196_baseline_schema.py` с `down_revision = None`. Текущая цепочка:

```text
<base> -> 4e2cb764e196 -> 6c1e8a4d9b20 -> 7d3f1a9c2e40 -> 8a5e2d7f3c10 -> 9b6f3a1e7d50
```

Это противоречит правилам промта «не редактировать/не удалять старые migrations» и «новая модель → backfill → переключение API → legacy/deprecation». База, уже находящаяся на revision из `main`, не имеет пути `alembic upgrade head` в новую цепочку. Подход работает только для чистой БД.

Следствие: ветку нельзя безопасно выкатывать поверх существующей среды без отдельной merge/bridge migration либо явно утверждённой destructive reinitialization.

### 8.2. Недостающие ограничения

- partial UNIQUE активной program triple;
- CHECK health_score 0–100;
- FK `stakeholder.program_instance_id`;
- unique active org assignment (частичный constraint);
- индексы program scope/health, stage runtime status/due, integration signal source/status/time;
- CHECK для playbook status/applies_to_type и license transfer status в ORM-модели;
- уникальность runtime checklist `(stage_instance_id, checklist_item_id)`.

### 8.3. Смешение target и legacy

Совместимость допустима, но сейчас она протекает в target-контур:

- reports полностью legacy;
- seed сначала создаёт legacy interactions, затем target programs;
- часть программ работает через legacy interaction runtime, часть через program-owned runtime;
- contracts/licenses сохраняют legacy constraints;
- два пути workflow в одном router существенно усложняют инварианты и тестирование.

Нужен явно ограниченный период compatibility и критерий удаления legacy-path после backfill/проверки.

## 9. Seed и демоданные

Положительное:

- один `seed_demo_data.py`;
- повторно используются helper-паттерны;
- есть KAM/MANAGER/ADMIN, направления, продукты, окна, 6 фаз, 14 этапов;
- есть несколько программ на одну организацию;
- создаются license/teacher состояния, health/NBA и mock signals/metrics.

Расхождения текущей рабочей копии:

- 10 организаций вместо канонических 12–16;
- нет ни одной реальной organization типа `spo` или `school`;
- нет school instance на `school_short`;
- фактически только `full_cycle` имеет runtime-ready структуру;
- большинство target program создаётся через legacy interaction/backfill, не production start service;
- второй program создаётся без runtime stages;
- cutoff текущего окна не рассчитывается относительно даты запуска;
- нет гарантированных demo-кейсов overdue stage и `demand_without_program` NBA;
- повторный sync копит одинаковые integration signals; для истории это допустимо, но seed перестаёт быть строго идемпотентным по количеству строк;
- seed содержит пользовательское незакоммиченное изменение каталогов/демоданных, поэтому точные counts не являются состоянием commit `d97c6b7`.

## 10. Тесты и проверка

В репозитории есть сильное legacy-покрытие workflow governance, transitions, files, imports, reports query schemas и auth. Для новой модели добавлены unit-тесты schemas, health и наличия NBA codes.

Недостаточно покрыты:

- start program happy path/validation/RBAC/invariant;
- DB uniqueness active program;
- target runtime initialization/transition/final completion;
- checklist data scope и typed checklist;
- health каноническая формула;
- поведение каждого NBA rule, priority и resolution;
- sync mapping/idempotency/error handling/recompute;
- Organization 360 и workflow journal API;
- role-based home aggregates;
- V2 React pages и end-to-end сценарии A–E;
- migrations from existing `main` revision;
- успешный report job/export/download.

Выполненные проверки в ходе аудита:

```text
pytest (targeted V2/backend subset): 23 passed in 3.16s
alembic history/heads: одна новая цепочка, head 9b6f3a1e7d50
frontend test/build: не запущены — node_modules отсутствует (vitest/vite not found)
docker compose ps: не выполнен — доступ к Windows Docker pipe запрещён текущему процессу
```

Важно: зелёные 23 unit-теста не подтверждают сквозную работоспособность PostgreSQL → API → frontend и не обнаруживают перечисленные DB/RBAC/runtime gaps.

## 11. Нарушение процесса этапов

Промт требовал после каждого Stage остановиться, провести проверки и выпустить completion report. В истории `v2_new_way` новая концепция внесена двумя крупными commit:

- `2d36fdf` — основа сразу нескольких этапов;
- `d97c6b7` — runtime ownership и этапы 8–14 одним большим commit.

Отдельных completion reports Stage 0–14 в `docs/` нет; находящиеся там документы относятся к прежним backend stages. Это нарушает не только формат работы, но и затрудняет доказательство migration/RBAC/tests/manual scenario для каждого шага.

## 12. Приоритеты исправления

### P0 — до любого утверждения MVP/деплоя

1. Восстановить непрерывную Alembic-историю от `main` или официально утвердить clean-reset; добавить реальный migration/backfill path.
2. Закрыть checklist IDOR: scope check на GET/PATCH и тесты KAM/MANAGER/ADMIN.
3. Добавить partial UNIQUE активной program triple и обработку `IntegrityError`/конкуренции.
4. Запретить skip не-optional stage в program-owned runtime.
5. Реализовать завершение final stage/program либо явно определить переход после `control`.
6. Реализовать Stage 15 target reports: router, program-based query, exporters, worker, artifact/download, V2 UI.

### P1 — чтобы честно завершить Stages 5–14

1. Наполнить и опубликовать необходимые короткие playbook либо зафиксировать, какие из них остаются draft; добавить структуру в Management.
2. Исправить Start Program: KAM inheritance/override, type applicability, direction-product compatibility, archived guard, empty license, полный snapshot.
3. Довести typed checklist, transition comment, optional Skip и structured errors.
4. Синхронизировать HealthService с канонической формулой и порогами; сделать команды транзакционными.
5. Реализовать `demand_without_program`, priority и реальные role-specific home aggregates.
6. Довести Organization 360: reassign, stakeholder CRUD, документы, лента, program fields; убрать reload.
7. Добавить target integration/API/smoke tests для сценариев A–D, затем E после Reports.

### P2 — полное соответствие каноническим экранам и ТЗ

1. S01 search/bell/help и ui state cache.
2. Полные S03/S04, S11–S17 и S18.
3. Filters/pagination/empty/error states и мобильный S09.
4. Performance/load tests на 50 пользователей и 10 report jobs.
5. Встроенная пользовательская/администраторская документация со скриншотами.
6. Документированный security/privacy review под 152-ФЗ и применимые требования ФСТЭК.

## 13. Рекомендуемая точка продолжения

Не следует начинать с косметической доработки экранов. Безопасный порядок:

1. migration bridge + DB constraints;
2. checklist/runtime RBAC и инварианты;
3. Stage 6–7 completion и сквозной Scenario A;
4. health/NBA/integration consistency и Scenarios B–C;
5. role/reassign и Scenario D;
6. Reports MVP и Scenario E;
7. только затем расширение S00–S18 и НФТ.

После выполнения P0 и P1 проект будет соответствовать заявленной цели промта: минимальная, но настоящая CRM V2, где данные проходят PostgreSQL → backend → API → frontend и обратно без опоры на параллельную legacy-сделку как источник истины.

## 14. Файлы-доказательства

Ключевые точки кода:

- `frontend/src/router/router.tsx` — маршруты V2 и placeholder Reports;
- `frontend/src/v2/app/V2Layout.tsx` — shell и role-filtered menu;
- `frontend/src/v2/pages/OrganizationDetailPage.tsx` — Organization 360/Master/Sync;
- `frontend/src/v2/pages/ProgramDetailPage.tsx` — runtime UI;
- `backend/app/modules/program_instances/` — target program API/service/model;
- `backend/app/modules/workflows/service.py` — runtime и transition invariants;
- `backend/app/modules/checklists/router.py` — checklist scope gap;
- `backend/app/modules/health/service.py` — фактическая health formula;
- `backend/app/modules/nba/service.py` — фактические NBA rules;
- `backend/app/modules/integrations/service.py` — fixture sync;
- `backend/app/modules/reports/query_service.py` — legacy report query;
- `backend/app/worker/reports.py` — незавершённый exporter;
- `backend/app/api/router.py` — reports router не подключён;
- `backend/migrations/versions/` — новая изолированная цепочка;
- `backend/scripts/seed_demo_data.py` — demo dataset и legacy→target backfill.
