# RTK EduFlow CRM — срез проекта

Дата среза: 28 сентября 2026.  
Основания: код ветки `main`, локальная PostgreSQL, Alembic `b3c4d5e6f7a8`.

## 1. Назначение и состав системы

RTK EduFlow CRM ведёт организации и образовательные продукты, назначает KAM, создаёт заходы программ и сопровождает их по настраиваемому workflow: от поиска контакта до контроля исполнения. Система также принимает интеграционные данные, хранит документы, формирует отчёты и ведёт аудит.

| Слой | Технология и роль |
|---|---|
| Frontend | React + TypeScript + Vite + Ant Design; SPA на `localhost:5173` |
| Backend | FastAPI + SQLAlchemy + Alembic; REST API и бизнес-правила на `localhost:8000/api` |
| БД | PostgreSQL 16 |
| Авторизация | Keycloak, роли и server-side RBAC |
| Файлы | MinIO/S3: workflow-файлы, импорты, отчёты, документация, логотипы организаций |
| Очередь | Redis + отдельный worker отчётов |
| Контейнеры | Docker Compose: postgres, backend, worker, redis, minio, keycloak, frontend |

Backend публикует Swagger на `/docs`, состояние — `/api/health` и `/api/ready`. Статические системные изображения доступны через `/images`.

## 2. Что реализовано

### Пользователи и доступ

- Keycloak-аутентификация, локальная проекция пользователей и ролей.
- Роли пользователей, назначения руководитель ↔ KAM, ограничения доступа к организациям и взаимодействиям.
- Защита каталогов, плейбуков, workflow-операций, файлов и администрирования на API-уровне.

### Организации и каталоги

- Каталог организаций: тип, регион, город, статус, комментарий, KAM, связанные программы.
- Загрузка, замена, удаление и выдача логотипов организаций через MinIO; отображение круглых логотипов в UI.
- Каталоги типов организаций, направлений, продуктов, вендоров, учебных окон, этапов и плейбуков.
- Контакты/stakeholders организаций, привязка к программе, основной контакт и роли.
- Импорт каталога из файлов с маппингом колонок, валидацией, предпросмотром ошибок и артефактами.

### Заходы программ и workflow

- Создание и ведение `program_instance` для связки «организация + направление + продукт».
- Версионные плейбуки: draft, published, archived; защита опубликованной версии от прямого редактирования.
- Экземпляр каждого этапа создаётся для конкретного захода; поддержаны сроки, переходы, обязательные чек-листы, комментарии, файлы и возврат этапа.
- Основные runtime-этапы: поиск контакта, встреча, потребность, пакет документов, договор, лицензия, передача доступа, преподаватель, учебный план, старт/ведение занятий, итоги периода, контроль исполнения.
- Специализированные формы этапов используют реальные API для чек-листов, комментариев, файлов, лицензий, преподавателей, учебного окна и метрик.
- `ClassesRunning` сохраняет статус/комментарий в `workflow_stage_data`, дополнительные задачи — в `workflow_checklist_extras`.
- `ControlExecution` сохраняет комментарии и snapshot контроля в `program_workflow_controls`.

### Редактор плейбуков

- UI создания с нуля и копирования существующего опубликованного плейбука.
- Фазы, этапы, SLA, возможность пропуска, сортировка drag-and-drop, описание и preview.
- Блоки: поля, чек-лист, комментарий, подтверждение, один/несколько документов, контакт, договор, лицензия, доступ, преподаватель, учебный план, LMS и сайт.
- Draft сохраняется на сервере; публикация материализует этапы, линейные переходы и базовые чек-листы.
- API редактора: `GET/POST /management/playbooks`, `GET/PUT .../{id}/editor`, `POST .../{id}/versions/draft`, `POST .../{id}/publish`, `GET /management/kams`.
- Полный исходный payload конструктора хранится в `workflow_versions.editor_content`.

### Мониторинг, отчёты и сервисные разделы

- Журнал workflow с фильтрами и health-оценкой.
- Admin home: состояние платформы, требующие внимания события, активность, фоновые задачи, быстрые действия.
- NBA: правила и рекомендации к действию.
- Интеграционные сигналы, маппинги внешних курсов/потоков, диагностика интеграций.
- Очередь отчётов с worker, экспортами и хранением артефактов.
- Аудит бизнес-действий; документация и обращения по документации.

## 3. Модель workflow и источник правды

### Цепочка данных

```text
workflow_template
  → workflow_version (PUBLISHED)
  → workflow_stages + workflow_transitions + playbook_checklist_items
  → program_instance
  → workflow_stage_instances + program_checklist_values
  → comments / attachments / stage_data / checklist_extras
```

Для каждого захода `program_instances.workflow_version_id` должен ссылаться на опубликованную версию. Для каждого активного этапа существует `workflow_stage_instances`; текущий экземпляр хранится в `program_instances.current_stage_instance_id`.

### Допустимое состояние активного захода

```text
COMPLETED / SKIPPED → IN_PROGRESS → NOT_STARTED
```

- До текущего этапа — `COMPLETED` либо `SKIPPED`.
- Ровно один обычный экземпляр этапа — `IN_PROGRESS`.
- После него — `NOT_STARTED`.
- `current_stage_instance_id` должен ссылаться именно на этот `IN_PROGRESS`.
- `current_stage_code` — код из `workflow_stage_catalog.code`, а не отображаемое имя.

Поддерживаемые рабочие статусы экземпляра: `NOT_STARTED`, `IN_PROGRESS`, `WAITING`, `BLOCKED`, `COMPLETED`, `SKIPPED`. Для seed-данных следует использовать именно `COMPLETED` и `SKIPPED` для закрытых этапов; не использовать устаревший `DONE`.

### Контроль исполнения

`control` — мониторинговое состояние после `period_results`, а не просто страница по URL.

Фактическое состояние контроля:

```text
program_instances.status = 'active'
program_instances.current_stage_code = 'control'
program_instances.current_stage_instance_id = NULL
все реальные этапы = COMPLETED или SKIPPED
```

`program_workflow_controls` хранит UI-состояние контроля и комментарии. Наличие этой строки не означает, что заход перешёл в control.

## 4. Health и отображение контроля

Backend `HealthService` начинает расчёт со 100 и записывает результат в `program_instances.health_score` и `health_band`.

| Условие | Вычет |
|---|---:|
| Текущий этап просрочен 1–7 дней | 15 |
| Текущий этап просрочен 8+ дней | 30 |
| Близкая отсечка учебного плана на этапе curriculum | 10 |
| Лицензия истекла | 25 |
| Лицензия истекает в пределах 90 дней | 10 |
| На поздних этапах нет преподавателя | 15 |
| Преподаватель ушёл во время занятий | 25 |
| Нет LMS-активности более 30 дней во время занятий | 15 |
| На занятиях ноль студентов | 15 |
| Есть заявки, но ноль студентов | 10 |

Диапазоны: `green` — 75–100, `yellow` — 50–74, `red` — 0–49.

Поэтому `90 · зелёное` при лицензии, истекающей через 30 дней, корректно: health снижено на 10, но осталось в green. Экран контроля дополнительно показывает warning по лицензии ≤90 дней. Это два разных представления одного захода, а не изменение записи при открытии страницы.

После обновления лицензии, преподавателя, метрик, срока или текущего этапа seed/сервис должен вызывать пересчёт health. Нельзя оставлять вручную заданные `health_score`/`health_band` после изменения связанных данных.

## 5. Состояние реализации и ограничения

| Область | Статус | Примечание |
|---|---|---|
| CRUD организаций, контактов, продуктов, учебных окон | Готово | API и UI используются |
| Логотипы организаций | Готово | MinIO, ручные API видны в Swagger |
| Базовый workflow и переходы | Готово | Требует корректных данных версий и экземпляров |
| Чек-листы, комментарии, вложения | Готово | Хранятся серверно |
| Ведение занятий и custom tasks | Готово | stage data + checklist extras |
| Контроль: snapshot и комментарии | Готово | Состояние хранится серверно |
| Конструктор плейбуков | Готово с ограничениями | Фазы/блоки целиком лежат в JSON `editor_content`; runtime материализует линейный граф и базовые checklist/file/text элементы |
| Видимость плейбука выбранным KAM | Хранится в payload | Полное enforcement при выборе плейбука нужно отдельно подтвердить тестом |
| Шаблоны файлов в блоках редактора | Частично | Пока хранится имя шаблона; отдельная серверная связь `template_attachment_id` не реализована |
| Автоматические checklist-пункты по `factId` | Частично | Конфигурация хранится, но полноценное серверное правило автозакрытия требует развития |
| История контроля/причины health | Частично | Есть snapshot и комментарии; нет отдельной нормализованной ленты control-feed и детальной истории штрафов |
| Динамика LMS по неделям, потоки | Частично | Существуют агрегированные метрики; временной ряд отсутствует |
| Отчёт итогов периода как неизменяемый snapshot | Не реализовано отдельной сущностью | Используются текущие метрики и данные этапов |

### Известная UX-несостыковка

Контроль можно открыть URL-параметром `?stage=control`. В ранней логике наличие `program_workflow_controls` ошибочно трактовалось как факт перехода в контроль: путь мог показать галочки, хотя реальные `workflow_stage_instances` ещё `NOT_STARTED`. Корректный источник для прогресса — статусы экземпляров этапов; seed-скрипт не должен создавать control-запись для захода, который не дошёл до control.

## 6. PostgreSQL: общие правила атрибутов

Почти все прикладные таблицы имеют `id: uuid`, `created_at: timestamptz`, `updated_at: timestamptz`. Ниже эти три поля не повторяются, если они типовые. Все `*_id` — UUID-внешние ключи на одноимённую сущность. JSONB хранит структурированные snapshots/payload.

### Справочники и организации

| Таблица | Атрибуты помимо типовых |
|---|---|
| `organization_types` | `code`, `name`, `is_active` |
| `organizations` | `type_id`, `name`, `short_name`, `region`, `city`, `status`, `comment`, `logo_file_id` |
| `org_assignments` | `organization_id`, `user_id`, `status`, `assigned_at`, `assigned_by`, `ended_at` |
| `stakeholders` | `organization_id`, `role_code`, `full_name`, `position`, `email`, `phone`, `contact_source`, `is_primary`, `is_active`, `program_instance_id`, `comment` |
| `it_directions` | `name`, `code`, `description`, `is_active` |
| `it_products` | `vendor_id`, `name`, `description`, `documentation_url`, `is_active`, `business_key` |
| `vendors` | `name`, `description`, `is_active`, `business_key` |
| `vendor_contacts` | `vendor_id`, `product_id`, `business_key`, `full_name`, `phone`, `email`, `preferred_channel` |
| `academic_windows` | `code`, `title`, `plan_cutoff_on`, `classes_start_on`, `classes_end_on`, `is_current` |
| `it_programs` | `direction_id`, `name`, `description`, `version`, `is_active` |
| `program_products` | `program_id`, `product_id`, `is_required` |

### Пользователи, роли и доступ

| Таблица | Атрибуты |
|---|---|
| `users` | `keycloak_user_id`, `full_name`, `email`, `role`, `is_active`, `username` |
| `roles` | `name`, `description` |
| `user_roles` | `user_id`, `role_id` |
| `manager_memberships` | `manager_user_id`, `kam_user_id`, `valid_from`, `valid_to`, `is_active` |
| `data_access_scopes` | `subject_user_id`, `university_id`, `interaction_id`, `access_level`, `granted_by_user_id`, `valid_from`, `valid_to`, `is_active` |
| `responsible_assignment_history` | `interaction_id`, `old_manager_user_id`, `new_manager_user_id`, `changed_by_user_id`, `reason`, `changed_at` |

### Плейбуки и граф workflow

| Таблица | Атрибуты |
|---|---|
| `workflow_templates` | `name`, `description`, `version`, `is_active`, `is_default`, `created_by`, `code`, `applies_to_type`, `status` |
| `workflow_versions` | `workflow_template_id`, `version`, `status`, `supersedes_version_id`, `created_by`, `published_at`, `archived_at`, `editor_content: jsonb` |
| `workflow_phases` | `code`, `name`, `sort_order`, `is_active` |
| `workflow_stage_catalog` | `code`, `name`, `description`, `default_phase_id`, `is_active` |
| `workflow_stages` | `workflow_template_id`, `workflow_version_id`, `stage_catalog_id`, `name`, `description`, `order_index`, `is_initial`, `is_final`, `is_optional`, `semester_critical`, `default_duration_days`, `requires_comment`, `requires_attachment`, `is_active` |
| `workflow_transitions` | `workflow_template_id`, `workflow_version_id`, `from_stage_id`, `to_stage_id`, `name`, `is_default`, `condition_code` |
| `playbook_checklist_items` | `workflow_stage_id`, `code`, `label`, `item_type`, `required`, `required_stakeholder_role`, `required_attachment_kind` |
| `workflow_change_requests` | `workflow_version_id`, `status`, `requested_by`, `reviewed_by`, `requested_at`, `reviewed_at`, `reason`, `review_comment`, `dangerous_changes_snapshot` |
| `workflow_stage_mappings` | `source_version_id`, `target_version_id`, `source_stage_id`, `target_stage_id`, `created_by` |
| `workflow_migration_jobs` | `source_version_id`, `target_version_id`, `change_request_id`, `status`, `created_by`, `started_at`, `completed_at`, `affected_interaction_count`, `migrated_interaction_count`, `error_message` |

### Заходы и исполнение workflow

| Таблица | Атрибуты |
|---|---|
| `program_instances` | `organization_id`, `direction_id`, `product_id`, `kam_user_id`, `playbook_template_id`, `workflow_version_id`, `current_stage_instance_id`, `template_snapshot`, `status`, `current_stage_code`, `academic_window_id`, `health_score`, `health_band`, `started_at`, `completed_at`, `comment`, `parent_program_id`, `legacy_interaction_id` |
| `workflow_stage_instances` | `interaction_id`, `program_instance_id`, `workflow_stage_id`, `responsible_user_id`, `status`, `started_at`, `due_at`, `completed_at`, `skipped_at` |
| `program_checklist_values` | `checklist_item_id`, `stage_instance_id`, `is_done`, `value_text`, `value_number`, `value_date`, `stakeholder_id`, `attachment_id` |
| `workflow_stage_data` | `stage_instance_id`, `payload: jsonb` |
| `workflow_checklist_extras` | `stage_instance_id`, `label`, `is_done`, `sort_order` |
| `workflow_stage_comments` | `stage_instance_id`, `author_user_id`, `text`, `deleted_at` |
| `workflow_stage_attachments` | `stage_instance_id`, `file_id`, `uploaded_by`, `description`, `created_at` |
| `workflow_transition_history` | `interaction_id`, `program_instance_id`, `from_stage_instance_id`, `to_stage_instance_id`, `transition_id`, `performed_by`, `comment`, `performed_at` |
| `program_workflow_controls` | `program_instance_id`, `status`, `payload: jsonb` |

### Данные предметной области, интеграции и документы

| Таблица | Атрибуты |
|---|---|
| `contracts` | `interaction_id`, `organization_id`, `number`, `signed_at`, `signed_on`, `valid_from`, `valid_until`, `status`, `attachment_id`, `comment`, `signer` |
| `licenses` | `contract_id`, `product_id`, `program_instance_id`, `license_number`, `signed_at`, `valid_until`, `transfer_status`, `transferred_on`, `attachment_id`, `comment`, `product_access`, `recipient_stakeholder_id` |
| `teacher_carriers` | `organization_id`, `program_instance_id`, `product_id`, `stakeholder_id`, `full_name`, `trained_on`, `qualification_until`, `last_lms_activity_on`, `status` |
| `program_metrics` | `program_instance_id`, `applications_count`, `students_count`, `streams_count`, `payment_records_count`, `teacher_activity_on`, `synced_at`, `last_website_signal_at`, `last_payment_signal_at`, `last_lms_signal_at` |
| `integration_signals` | `source`, `status`, `external_key`, `received_at`, `organization_id`, `program_instance_id`, `payload`, `normalized_payload`, `error_code`, `error_message`, `match_reason` |
| `external_course_mappings` | `source`, `external_course_name`, `direction_id`, `product_id`, `status` |
| `external_stream_mappings` | `source`, `external_course_name`, `external_stream_id`, `program_instance_id` |
| `files` | `original_name`, `storage_name`, `storage_path`, `mime_type`, `extension`, `size_bytes`, `checksum`, `uploaded_by`, `provider`, `bucket`, `object_key`, `scan_status`, `deleted_at`, `delete_after`, `deleted_by`, `purged_at`, `attachment_kind` |
| `document_templates` | `kind`, `name`, `file_id`, `external_url`, `is_active` |

### Импорт, отчёты, документация, аудит и NBA

| Таблица | Атрибуты |
|---|---|
| `import_mappings` | `name`, `created_by`, `is_system` |
| `import_mapping_fields` | `mapping_id`, `source_column`, `target_field`, `required`, `transformer` |
| `import_jobs` | `status`, `source_file_id`, `created_by`, `sheet_name`, `header_row`, `mapping_id`, `mapping_snapshot`, `diff_snapshot`, счётчики строк, timestamps обработки, `error_code`, `error_message` |
| `import_row_errors` | `import_job_id`, `row_number`, `column_name`, `target_field`, `error_code`, `message`, `raw_fragment` |
| `import_artifacts` | `import_job_id`, `file_id`, `artifact_type` |
| `report_jobs` | `status`, `format`, `filter_snapshot`, `columns_snapshot`, `created_by`, queue/start/finish timestamps, `row_count`, `error_code`, `error_message`, `request_id` |
| `report_artifacts` | `report_job_id`, `file_id`, `artifact_type`, `format`, `row_count` |
| `documentation_pages` | `slug`, `title`, `route_pattern`, `parent_id`, `sort_order`, `content_markdown`, `source_file_id` |
| `documentation_images` | `page_id`, `file_id` |
| `documentation_requests` | `page_id`, `author_user_id`, `subject`, `message`, `status` |
| `audit_events` | `actor_user_id`, `action`, `entity_type`, `entity_id`, `result`, `reason`, `error_code`, `metadata`, `request_id` |
| `nba_rules` | `code`, `name`, `is_active` |
| `nba_items` | `rule_id`, `organization_id`, `program_instance_id`, `product_id`, `entity_key`, `severity`, `reason`, `action`, `priority`, `action_target`, `due_at`, `status`, `resolved_at` |

### Legacy/переходные сущности

| Таблица | Назначение |
|---|---|
| `universities`, `university_contacts` | старый контур вузов и контактов |
| `university_interactions` | старый контур взаимодействий; может быть связан с `program_instances.legacy_interaction_id` |
| `interaction_contacts` | связи legacy-взаимодействия и контакта |

`alembic_version` — техническая таблица миграций; в срезе должна содержать `b3c4d5e6f7a8`.

## 7. Рекомендации для данных и проверки

1. Создавать runtime workflow через `WorkflowService.initialize_program_workflow`, а не прямыми INSERT: сервис создаёт stage instances, checklist values, сроки и указатели текущего этапа.
2. После seed связанных лицензий, преподавателей и метрик выполнять `HealthService.recompute(program_id)`.
3. Не подменять жизненный цикл URL-параметрами и записями `program_workflow_controls`.
4. Проверять, что для активного не-control захода ровно один `IN_PROGRESS`, а `current_stage_instance_id` совпадает с ним.
5. Проверять, что обязательные чек-листы завершённых этапов имеют `is_done=true`.
6. Публиковать плейбук до создания заходов; уже созданные заходы должны продолжать использовать свою `workflow_version_id` и snapshot.

## 8. Проверочные команды

```powershell
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend alembic current

cd frontend
npm run build
npm run test -- --run src/pages/workflow/stages/controlExecution.test.ts src/pages/workflow/stages/classesRunning.test.ts
```

Ожидаемая Alembic-ревизия: `b3c4d5e6f7a8 (head)`.
