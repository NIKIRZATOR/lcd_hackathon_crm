# Database Architecture And Backend API

Дата обновления: 2026-09-26

Документ описывает текущую backend-схему RTK EduFlow CRM. Канонический рабочий контур V2 построен вокруг `organizations` и `program_instances`; legacy-сущности `universities` и `university_interactions` сохранены для обратной совместимости.

## Структура

1. Таблицы БД: назначение, ключевые связи и примеры заполнения.
2. Backend API: endpoint, доступ, что принимает и что возвращает.

Все изменения схемы выполняются только через Alembic migrations.

## Часть 1. Таблицы БД

Текущие миграции:

- `cade47f9d409_init_crm_schema.py`
- `5b0d2fd1f4d8_add_roles_for_keycloak.py`
- `9c0f4f2a6d1b_add_access_scope_tables.py`
- `b2d7a89e4c31_extend_interactions_for_contracts.py`
- `c3f8a4d2b7e1_add_audit_events.py`
- `d7c1b2a9e8f0_add_workflow_versions.py`
- `e8f2a4c6d9b1_add_workflow_governance_migration.py`
- `f4a9c7d2e6b3_extend_files_for_object_storage.py`
- `a6e4c2f8b9d0_add_import_jobs.py`
- `b7d9a2e1c4f6_add_contracts_licenses.py`
- `c8a7d5e2f901_add_report_jobs.py`
- `4e2cb764e196_baseline_schema.py`
- `6c1e8a4d9b20_stage_8_contracts_licenses_teachers.py`
- `7d3f1a9c2e40_program_runtime_owns_workflow.py`
- `8a5e2d7f3c10_stage_10_nba.py`
- `9b6f3a1e7d50_stage_11_metrics_integrations.py`
- `a2c4e6f8b0d1_stage_1_db_invariants.py`
- `b4d6f8a0c2e1_stage_2_typed_checklist.py`
- `c1e2f3a4b5d6_allow_child_program_instances.py`
- `d2e3f4a5b6c7_stage2r_fact_attachment_metadata.py`
- `e3f4a5b6c7d8_stage3_organization_stakeholders.py`
- `f4a5b6c7d8e9_stage4_nba_priority.py`

## Каноническая схема V2

Если далее в документе legacy `university_interactions` описан как рабочий объект, это относится только к прежнему API. Для нового функционала источником истины являются следующие сущности. Все таблицы на `ModelBase`, если не отмечено иначе, также имеют `id: UUID`, `created_at: timestamptz` и `updated_at: timestamptz`.

### Организации и портфель

#### `organization_types`

- `code: varchar(32), unique`
- `name: varchar(128)`
- `is_active: boolean`

#### `organizations`

- `type_id: uuid, FK -> organization_types.id`
- `name: varchar(255)`
- `short_name: varchar(255), nullable`
- `region: varchar(255), nullable`
- `city: varchar(255), nullable`
- `status: active | paused | archived`
- `comment: text, nullable`

#### `org_assignments`

- `organization_id: uuid, FK -> organizations.id`
- `user_id: uuid, FK -> users.id` — назначенный KAM.
- `status: active | ended`
- `assigned_at: timestamptz`
- `assigned_by: uuid, FK -> users.id`
- `ended_at: timestamptz, nullable`

Есть частичный уникальный индекс: у организации может быть только одно активное назначение.

#### `stakeholders`

- `organization_id: uuid, FK -> organizations.id`
- `program_instance_id: uuid, FK -> program_instances.id, nullable`
- `role_code: vice_rector | dean | methodist | lawyer | chair | teacher | director | school_teacher | other`
- `full_name: varchar(255)`, `position: varchar(255), nullable`
- `email: varchar(255), nullable`, `phone: varchar(64), nullable`
- `is_primary: boolean`, `is_active: boolean`
- `comment: text, nullable`

### Программы и workflow runtime

#### `academic_windows`

- `code: varchar(64), unique`, `title: varchar(255)`
- `plan_cutoff_on: date`, `classes_start_on: date`, `classes_end_on: date`
- `is_current: boolean`

#### `program_instances`

- `organization_id: uuid, FK -> organizations.id`
- `direction_id: uuid, FK -> it_directions.id`
- `product_id: uuid, FK -> it_products.id`
- `kam_user_id: uuid, FK -> users.id, nullable`
- `playbook_template_id: uuid, FK -> workflow_templates.id`
- `workflow_version_id: uuid, FK -> workflow_versions.id, nullable`
- `current_stage_instance_id: uuid, FK -> workflow_stage_instances.id, nullable`
- `template_snapshot: jsonb`
- `status: draft | active | paused | completed | cancelled`
- `current_stage_code: varchar(64), nullable`
- `academic_window_id: uuid, FK -> academic_windows.id, nullable`
- `health_score: integer [0..100], nullable`, `health_band: green | yellow | red`
- `started_at: timestamptz, nullable`, `completed_at: timestamptz, nullable`
- `comment: text, nullable`
- `parent_program_id: uuid, FK -> program_instances.id, nullable` — дочерняя программа renewal/teacher replacement.
- `legacy_interaction_id: uuid, FK -> university_interactions.id, nullable, unique`

Частичный уникальный индекс не допускает два активных корневых экземпляра с одинаковыми `organization_id + direction_id + product_id`. Дочерние экземпляры исключены из этого ограничения.

#### `workflow_phases` и `workflow_stage_catalog`

- `workflow_phases`: `code` (unique), `name`, `sort_order`, `is_active`.
- `workflow_stage_catalog`: `code` (unique), `name`, `description`, `default_phase_id -> workflow_phases.id`, `is_active`.
- `workflow_stages.stage_catalog_id -> workflow_stage_catalog.id` связывает этап конкретной версии эталона с каноническим каталогом.

#### `workflow_stage_instances` и `workflow_transition_history`

- Runtime-этап имеет nullable legacy `interaction_id -> university_interactions.id` и nullable V2 `program_instance_id -> program_instances.id`; также `workflow_stage_id`, `responsible_user_id`, `status`, `started_at`, `due_at`, `completed_at`, `skipped_at`.
- `workflow_transition_history` аналогично хранит nullable `interaction_id` и `program_instance_id`, ссылки на runtime-этапы и transition, исполнителя, комментарий и время перехода.

### Facts, checklist и файлы

Отдельной таблицы facts нет: определение fact — это `playbook_checklist_items`, значение fact конкретной программы — `program_checklist_values`.

#### `playbook_checklist_items`

- `workflow_stage_id: uuid, FK -> workflow_stages.id`
- `code: varchar(64)`, `label: varchar(255)`
- `item_type: checkbox | file | date | stakeholder_role | number | text`
- `required: boolean`
- `required_stakeholder_role: varchar(32), nullable`
- `required_attachment_kind: varchar(64), nullable` — для item_type `file`.

#### `program_checklist_values`

- `checklist_item_id: uuid, FK -> playbook_checklist_items.id`
- `stage_instance_id: uuid, FK -> workflow_stage_instances.id`
- `is_done: boolean`
- одно из типизированных значений: `value_text`, `value_number`, `value_date`, `stakeholder_id -> stakeholders.id`, `attachment_id -> files.id`.

Уникальность: `(stage_instance_id, checklist_item_id)`.

#### `files`

Помимо полей object storage и lifecycle, файл имеет `attachment_kind: varchar(64), nullable`. Этот вид используется при проверке обязательного file-fact. `workflow_stage_attachments` связывает файл с runtime-этапом.

### Договоры, лицензии и преподаватели

#### `contracts`

- Новый договор принадлежит `organization_id -> organizations.id`; `interaction_id -> university_interactions.id` остаётся nullable для legacy-записей.
- Требуется хотя бы один владелец: организация или legacy interaction.
- `number`, `signed_at`, `valid_from`, `valid_until`, `status`, `signed_on`, `attachment_id -> files.id`, `comment`.

#### `licenses`

- `contract_id -> contracts.id, nullable`, `program_instance_id -> program_instances.id, nullable`; один из владельцев обязателен.
- `product_id -> it_products.id`, `license_number`, `signed_at`, `valid_until`, `transfer_status`.
- `product_access: varchar(1024), nullable` — явное подтверждение доступа к продукту.
- `transferred_on`, `attachment_id -> files.id`, `comment`.

#### `teacher_carriers`

- `organization_id -> organizations.id`, `program_instance_id -> program_instances.id, nullable`, `product_id -> it_products.id`, `stakeholder_id -> stakeholders.id, nullable`.
- `full_name`, `trained_on`, `qualification_until`, `last_lms_activity_on`.
- `status: planned | trained | active | expired | left`.

### Health, интеграции и NBA

#### `program_metrics` и `integration_signals`

- `program_metrics`: одна запись на `program_instance_id`; `applications_count`, `students_count`, `streams_count`, `teacher_activity_on`, `synced_at`.
- `integration_signals`: `source`, `status: mapped | unmatched | error`, nullable `organization_id` и `program_instance_id`, `payload: jsonb`, `error_message`.

#### `nba_rules` и `nba_items`

- `nba_rules`: `code` (unique), `name`, `is_active`.
- `nba_items`: `rule_id -> nba_rules.id`, `organization_id -> organizations.id`, nullable `program_instance_id` и `product_id`, `entity_key`, `severity: critical | high | medium | low`, `reason`, `action`.
- V2-поля действия: `priority: P0..P4`, `action_target: varchar(128), nullable`.
- Lifecycle: `due_at`, `status: active | resolved | dismissed`, `resolved_at`; уникальность `(rule_id, entity_key)`.

## UML Reference: Поля И Связи Таблиц

Этот раздел можно использовать как источник для ER/UML-диаграмм. Если не указано иначе, таблица на `ModelBase` имеет общие поля:

- `id: UUID` - primary key.
- `created_at: timestamptz`.
- `updated_at: timestamptz`.

Для сущностей, изменённых в V2, приоритет имеет раздел «Каноническая схема V2» выше: последующие дублирующие описания сохранены как исторический справочник legacy API.

### `alembic_version`

Fields:

- `version_num` - текущая применённая Alembic revision.

Relations:

- Нет business-связей.

### `roles`

Fields:

- `id`
- `name: varchar(64), unique`
- `description: varchar(255), nullable`
- `created_at`
- `updated_at`

Relations:

- `roles.id` <- `user_roles.role_id`

### `users`

Fields:

- `id`
- `keycloak_user_id: uuid, unique, nullable`
- `username: varchar(255), unique, nullable`
- `full_name: varchar(255)`
- `email: varchar(255), nullable`
- `role: varchar(64)`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `users.id` <- `user_roles.user_id`
- `users.id` <- `manager_memberships.manager_user_id`
- `users.id` <- `manager_memberships.kam_user_id`
- `users.id` <- `responsible_assignment_history.old_manager_user_id`
- `users.id` <- `responsible_assignment_history.new_manager_user_id`
- `users.id` <- `responsible_assignment_history.changed_by_user_id`
- `users.id` <- `data_access_scopes.subject_user_id`
- `users.id` <- `data_access_scopes.granted_by_user_id`
- `users.id` <- `university_interactions.manager_user_id`
- `users.id` <- `workflow_templates.created_by`
- `users.id` <- `workflow_versions.created_by`
- `users.id` <- `workflow_stage_instances.responsible_user_id`
- `users.id` <- `workflow_transition_history.performed_by`
- `users.id` <- `workflow_stage_comments.author_user_id`
- `users.id` <- `workflow_stage_attachments.uploaded_by`
- `users.id` <- `files.uploaded_by`
- `users.id` <- `audit_events.actor_user_id`
- `users.id` <- `import_jobs.created_by`
- `users.id` <- `import_mappings.created_by`

### `user_roles`

Fields:

- `user_id: uuid, PK, FK -> users.id`
- `role_id: uuid, PK, FK -> roles.id`

Relations:

- Many-to-many между `users` и `roles`.

### `manager_memberships`

Fields:

- `id`
- `manager_user_id: uuid, FK -> users.id`
- `kam_user_id: uuid, FK -> users.id`
- `valid_from: timestamptz, nullable`
- `valid_to: timestamptz, nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- Unique: `(manager_user_id, kam_user_id)`
- Index: `(manager_user_id, is_active)`
- Index: `(kam_user_id, is_active)`

### `data_access_scopes`

Fields:

- `id`
- `subject_user_id: uuid, FK -> users.id`
- `university_id: uuid, FK -> universities.id, nullable`
- `interaction_id: uuid, FK -> university_interactions.id, nullable`
- `access_level: varchar(64)`
- `granted_by_user_id: uuid, FK -> users.id, nullable`
- `valid_from: timestamptz, nullable`
- `valid_to: timestamptz, nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- Index: `(subject_user_id, is_active)`
- Index: `university_id`
- Index: `interaction_id`

### `universities`

Fields:

- `id`
- `name: varchar(255)`
- `short_name: varchar(255), nullable`
- `region: varchar(255), nullable`
- `city: varchar(255), nullable`
- `address: text, nullable`
- `website: varchar(512), nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `universities.id` <- `university_contacts.university_id`
- `universities.id` <- `university_interactions.university_id`
- `universities.id` <- `data_access_scopes.university_id`

### `university_contacts`

Fields:

- `id`
- `university_id: uuid, FK -> universities.id`
- `full_name: varchar(255)`
- `position: varchar(255), nullable`
- `email: varchar(255), nullable`
- `phone: varchar(64), nullable`
- `department: varchar(255), nullable`
- `is_primary: boolean`
- `is_active: boolean`
- `comment: text, nullable`
- `created_at`
- `updated_at`

Relations:

- `university_contacts.id` <- `interaction_contacts.contact_id`

### `it_directions`

Fields:

- `id`
- `name: varchar(255)`
- `code: varchar(64), nullable`
- `description: text, nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `it_directions.id` <- `it_programs.direction_id`

### `it_programs`

Fields:

- `id`
- `direction_id: uuid, FK -> it_directions.id`
- `name: varchar(255)`
- `description: text, nullable`
- `version: varchar(64), nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `it_programs.id` <- `program_products.program_id`
- `it_programs.id` <- `university_interactions.program_id`

### `vendors`

Fields:

- `id`
- `name: varchar(255)`
- `description: text, nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `vendors.id` <- `it_products.vendor_id`

### `it_products`

Fields:

- `id`
- `vendor_id: uuid, FK -> vendors.id, nullable`
- `name: varchar(255)`
- `description: text, nullable`
- `documentation_url: varchar(512), nullable`
- `is_active: boolean`
- `created_at`
- `updated_at`

Relations:

- `it_products.id` <- `program_products.product_id`
- `it_products.id` <- `university_interactions.product_id`

### `program_products`

Fields:

- `id`
- `program_id: uuid, FK -> it_programs.id`
- `product_id: uuid, FK -> it_products.id`
- `is_required: boolean`
- `created_at`
- `updated_at`

Relations:

- Unique: `(program_id, product_id)`

### `university_interactions`

Fields:

- `id`
- `university_id: uuid, FK -> universities.id`
- `program_id: uuid, FK -> it_programs.id`
- `product_id: uuid, FK -> it_products.id`
- `manager_user_id: uuid, FK -> users.id, nullable`
- `workflow_template_id: uuid, FK -> workflow_templates.id, nullable`
- `workflow_version_id: uuid, FK -> workflow_versions.id, nullable`
- `current_stage_instance_id: uuid, FK -> workflow_stage_instances.id, nullable`
- `status: varchar(64)`
- `contract_number: varchar(255), nullable`
- `license_signed: boolean`
- `license_signed_at: timestamptz, nullable`
- `license_valid_until: timestamptz, nullable`
- `transfer_status: varchar(64), nullable`
- `university_responsibles: text, nullable`
- `started_at: timestamptz, nullable`
- `completed_at: timestamptz, nullable`
- `comment: text, nullable`
- `created_at`
- `updated_at`

Relations:

- `university_interactions.id` <- `interaction_contacts.interaction_id`
- `university_interactions.id` <- `responsible_assignment_history.interaction_id`
- `university_interactions.id` <- `data_access_scopes.interaction_id`
- `university_interactions.id` <- `workflow_stage_instances.interaction_id`
- `university_interactions.id` <- `workflow_transition_history.interaction_id`
- Index: `workflow_version_id`

### `interaction_contacts`

Fields:

- `id`
- `interaction_id: uuid, FK -> university_interactions.id`
- `contact_id: uuid, FK -> university_contacts.id`
- `role: varchar(255), nullable`
- `is_primary: boolean`
- `created_at`
- `updated_at`

Relations:

- Unique: `(interaction_id, contact_id)`

### `responsible_assignment_history`

Fields:

- `id`
- `interaction_id: uuid, FK -> university_interactions.id`
- `old_manager_user_id: uuid, FK -> users.id, nullable`
- `new_manager_user_id: uuid, FK -> users.id, nullable`
- `changed_by_user_id: uuid, FK -> users.id`
- `reason: text, nullable`
- `changed_at: timestamptz`
- `created_at`
- `updated_at`

Relations:

- Index: `(interaction_id, changed_at)`

### `workflow_templates`

Fields:

- `id`
- `name: varchar(255)`
- `description: text, nullable`
- `version: varchar(64), nullable`
- `is_active: boolean`
- `is_default: boolean`
- `created_by: uuid, FK -> users.id, nullable`
- `code: varchar(64), unique, nullable`
- `applies_to_type: varchar(32)`
- `status: varchar(32)`
- `created_at`
- `updated_at`

Relations:

- `workflow_templates.id` <- `workflow_versions.workflow_template_id`
- `workflow_templates.id` <- `workflow_stages.workflow_template_id`
- `workflow_templates.id` <- `workflow_transitions.workflow_template_id`
- `workflow_templates.id` <- `university_interactions.workflow_template_id`

### `workflow_versions`

Fields:

- `id`
- `workflow_template_id: uuid, FK -> workflow_templates.id`
- `version: integer`
- `status: varchar(32)` - `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `supersedes_version_id: uuid, FK -> workflow_versions.id, nullable`
- `created_by: uuid, FK -> users.id, nullable`
- `published_at: timestamptz, nullable`
- `archived_at: timestamptz, nullable`
- `created_at`
- `updated_at`

Relations:

- `workflow_versions.id` <- `workflow_stages.workflow_version_id`
- `workflow_versions.id` <- `workflow_transitions.workflow_version_id`
- `workflow_versions.id` <- `university_interactions.workflow_version_id`
- Unique: `(workflow_template_id, version)`
- Index: `(workflow_template_id, status)`

### `workflow_stages`

Fields:

- `id`
- `workflow_template_id: uuid, FK -> workflow_templates.id`
- `workflow_version_id: uuid, FK -> workflow_versions.id`
- `name: varchar(255)`
- `description: text, nullable`
- `order_index: integer`
- `is_initial: boolean`
- `is_final: boolean`
- `is_optional: boolean`
- `semester_critical: boolean`
- `default_duration_days: integer, nullable`
- `requires_comment: boolean`
- `requires_attachment: boolean`
- `is_active: boolean`
- `stage_catalog_id: uuid, FK -> workflow_stage_catalog.id, nullable`
- `created_at`
- `updated_at`

Relations:

- `workflow_stages.id` <- `workflow_transitions.from_stage_id`
- `workflow_stages.id` <- `workflow_transitions.to_stage_id`
- `workflow_stages.id` <- `workflow_stage_instances.workflow_stage_id`
- Index: `(workflow_version_id, order_index)`

### `workflow_transitions`

Fields:

- `id`
- `workflow_template_id: uuid, FK -> workflow_templates.id`
- `workflow_version_id: uuid, FK -> workflow_versions.id`
- `from_stage_id: uuid, FK -> workflow_stages.id`
- `to_stage_id: uuid, FK -> workflow_stages.id`
- `name: varchar(255), nullable`
- `is_default: boolean`
- `condition_code: varchar(255), nullable`
- `created_at`
- `updated_at`

Relations:

- `workflow_transitions.id` <- `workflow_transition_history.transition_id`
- Index: `(workflow_version_id, from_stage_id)`

### `workflow_stage_instances`

Fields:

- `id`
- `interaction_id: uuid, FK -> university_interactions.id, nullable`
- `program_instance_id: uuid, FK -> program_instances.id, nullable`
- `workflow_stage_id: uuid, FK -> workflow_stages.id`
- `responsible_user_id: uuid, FK -> users.id, nullable`
- `status: varchar(64)`
- `started_at: timestamptz, nullable`
- `due_at: timestamptz, nullable`
- `completed_at: timestamptz, nullable`
- `skipped_at: timestamptz, nullable`
- `created_at`
- `updated_at`

Relations:

- `workflow_stage_instances.id` <- `university_interactions.current_stage_instance_id`
- `workflow_stage_instances.id` <- `workflow_transition_history.from_stage_instance_id`
- `workflow_stage_instances.id` <- `workflow_transition_history.to_stage_instance_id`
- `workflow_stage_instances.id` <- `workflow_stage_comments.stage_instance_id`
- `workflow_stage_instances.id` <- `workflow_stage_attachments.stage_instance_id`

### `workflow_transition_history`

Fields:

- `id`
- `interaction_id: uuid, FK -> university_interactions.id, nullable`
- `program_instance_id: uuid, FK -> program_instances.id, nullable`
- `from_stage_instance_id: uuid, FK -> workflow_stage_instances.id, nullable`
- `to_stage_instance_id: uuid, FK -> workflow_stage_instances.id, nullable`
- `transition_id: uuid, FK -> workflow_transitions.id, nullable`
- `performed_by: uuid, FK -> users.id`
- `comment: text, nullable`
- `performed_at: timestamptz, nullable`
- `created_at`
- `updated_at`

Relations:

- История связывает interaction, исходный runtime stage, целевой runtime stage и definition transition.

### `workflow_stage_comments`

Fields:

- `id`
- `stage_instance_id: uuid, FK -> workflow_stage_instances.id`
- `author_user_id: uuid, FK -> users.id`
- `text: text`
- `deleted_at: timestamptz, nullable`
- `created_at`
- `updated_at`

Relations:

- Комментарии принадлежат runtime stage instance.

### `workflow_stage_attachments`

Fields:

- `id`
- `stage_instance_id: uuid, FK -> workflow_stage_instances.id`
- `file_id: uuid, FK -> files.id`
- `uploaded_by: uuid, FK -> users.id`
- `description: text, nullable`
- `created_at`

Relations:

- Связывает runtime stage instance и file metadata.

### `files`

Fields:

- `id`
- `original_name: varchar(255)`
- `storage_name: varchar(255)` legacy compatibility field
- `storage_path: varchar(1024)` legacy compatibility field
- `mime_type: varchar(255), nullable`
- `extension: varchar(32), nullable`
- `size_bytes: bigint, nullable`
- `checksum: varchar(255), nullable`
- `provider: varchar(32), nullable`
- `bucket: varchar(255), nullable`
- `object_key: varchar(1024), nullable`
- `attachment_kind: varchar(64), nullable`
- `uploaded_by: uuid, FK -> users.id, nullable`
- `scan_status: varchar(32), default NOT_SCANNED`
- `deleted_at: timestamptz, nullable`
- `delete_after: timestamptz, nullable`
- `deleted_by: uuid, FK -> users.id, nullable`
- `purged_at: timestamptz, nullable`
- `created_at`

Relations:

- `files.id` <- `workflow_stage_attachments.file_id`
- `files.id` <- `import_jobs.source_file_id`
- `files.id` <- `import_artifacts.file_id`
- `users.id` <- `files.uploaded_by`
- `users.id` <- `files.deleted_by`

Constraints and indexes:

- Unique: `(provider, bucket, object_key)`
- Index: `(deleted_at, delete_after, purged_at)`

Lifecycle:

- Active: `deleted_at IS NULL` and `purged_at IS NULL`
- Soft deleted: `deleted_at IS NOT NULL` and `purged_at IS NULL`
- Purged: `deleted_at IS NOT NULL` and `purged_at IS NOT NULL`
- Binary content is stored in S3-compatible object storage. PostgreSQL stores metadata and lifecycle state only.

### `import_jobs`

Fields:

- `id`
- `status: varchar(32)` - `UPLOADED`, `MAPPED`, `VALIDATED`, `READY`, `RUNNING`, `DONE`, `FAILED`, `CANCELLED`.
- `source_file_id: uuid, FK -> files.id, nullable`
- `created_by: uuid, FK -> users.id`
- `sheet_name: varchar(255), nullable`
- `header_row: integer`
- `mapping_id: uuid, FK -> import_mappings.id, nullable`
- `mapping_snapshot: jsonb, nullable`
- `diff_snapshot: jsonb, nullable`
- counters: `total_rows`, `valid_rows`, `invalid_rows`, `create_count`, `update_count`, `skip_count`, `conflict_count`
- timestamps: `validated_at`, `confirmed_at`, `started_at`, `finished_at`, `created_at`, `updated_at`
- `error_code: varchar(64), nullable`
- `error_message: text, nullable`

Relations:

- `import_jobs.id` <- `import_artifacts.import_job_id`
- `import_jobs.id` <- `import_row_errors.import_job_id`
- Index: `(status, created_at)`
- Index: `created_by`

### `import_artifacts`

Fields:

- `id`
- `import_job_id: uuid, FK -> import_jobs.id`
- `file_id: uuid, FK -> files.id`
- `artifact_type: varchar(32)` - `SOURCE`, future `ERROR_REPORT`, `PROTOCOL`.
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique: `(import_job_id, file_id, artifact_type)`
- Index: `(import_job_id, artifact_type)`

### `import_mappings`

Fields:

- `id`
- `name: varchar(255), unique`
- `created_by: uuid, FK -> users.id, nullable`
- `is_system: boolean`
- `created_at`
- `updated_at`

System mapping:

- `RTK_DEFAULT_V1` maps стандартные колонки ТЗ to CRM target fields.

### `import_mapping_fields`

Fields:

- `id`
- `mapping_id: uuid, FK -> import_mappings.id`
- `source_column: varchar(255)`
- `target_field: varchar(128)`
- `required: boolean`
- `transformer: varchar(128), nullable`
- `created_at`
- `updated_at`

Constraints:

- Unique: `(mapping_id, source_column)`
- Unique: `(mapping_id, target_field)`

### `import_row_errors`

Fields:

- `id`
- `import_job_id: uuid, FK -> import_jobs.id`
- `row_number: integer`
- `column_name: varchar(255), nullable`
- `target_field: varchar(128), nullable`
- `error_code: varchar(64)`
- `message: text`
- `raw_fragment: varchar(512), nullable`
- `created_at`
- `updated_at`

Indexes:

- Index: `(import_job_id, row_number)`

### `audit_events`

Fields:

- `id`
- `actor_user_id: uuid, FK -> users.id, nullable`
- `action: varchar(128)`
- `entity_type: varchar(128)`
- `entity_id: uuid, nullable`
- `result: varchar(32)`
- `reason: text, nullable`
- `error_code: varchar(128), nullable`
- `metadata: jsonb, nullable`
- `request_id: varchar(128), nullable`
- `created_at`

Relations:

- `actor_user_id -> users.id`
- `entity_id` polymorphic: business entity UUID, interpreted together with `entity_type`.
- Index: `created_at`
- Index: `(actor_user_id, created_at)`
- Index: `(entity_type, entity_id)`
- Index: `action`

### Служебные Таблицы

| Таблица | Назначение | Пример |
| --- | --- | --- |
| `alembic_version` | Текущая версия миграций Alembic. | `version_num=d7c1b2a9e8f0` |

### Пользователи, Роли И Доступ

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `users` | Локальная CRM-проекция пользователей Keycloak. | `keycloak_user_id` связан с Keycloak `sub`. | `username=kam1`, `role=KAM` |
| `roles` | Справочник CRM-ролей. | Используется через `user_roles`. | `KAM`, `MANAGER`, `ADMIN` |
| `user_roles` | Many-to-many связь пользователей и ролей. | `user_id -> users.id`, `role_id -> roles.id`. | `kam1 -> KAM` |
| `manager_memberships` | Иерархия руководитель -> КАМ для data scope. | `manager_user_id -> users.id`, `kam_user_id -> users.id`. | `manager1 -> kam1`, `is_active=true` |
| `data_access_scopes` | Ручные ACL-исключения доступа к вузу или interaction. | `subject_user_id -> users.id`, optional `university_id`, optional `interaction_id`. | `subject=<user>`, `interaction=<id>`, `access_level=READ` |

Пример логики заполнения:

```text
users:
  kam1     -> KAM
  kam2     -> KAM
  manager1 -> MANAGER
  admin1   -> ADMIN

manager_memberships:
  manager1 -> kam1

Результат:
  kam1 видит свои interactions.
  manager1 видит interactions kam1.
  manager1 не видит interactions kam2.
  admin1 видит все.
```

### CRM-Каталоги

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `universities` | Справочник вузов. | Используется в contacts и interactions. | `name=Demo University`, `region=Tomsk` |
| `university_contacts` | Контакты со стороны вузов. | `university_id -> universities.id`. | `full_name=Ivan Sokolov`, `is_primary=true` |
| `it_directions` | Направления IT-образования. | Используется в programs. | `name=Software Engineering` |
| `it_programs` | Программы обучения. | `direction_id -> it_directions.id`. | `name=Python Backend`, `code=PY-BE` |
| `vendors` | Вендоры продуктов. | Используется в products. | `name=Rostelecom` |
| `it_products` | Продукты/ПО. | `vendor_id -> vendors.id`. | `name=Edu Platform`, `product_type=LMS` |
| `program_products` | Связь программ и продуктов. | `program_id -> it_programs.id`, `product_id -> it_products.id`. | `program=Python Backend`, `product=Edu Platform` |

### Interactions

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `university_interactions` | Основной рабочий объект CRM: вуз, программа, продукт, ответственный и workflow. | `university_id`, `program_id`, `product_id`, `manager_user_id`, `workflow_template_id`, `current_stage_instance_id`. | `contract_number=RTK-DEMO-001`, `manager_user_id=kam1`, `status=ACTIVE` |
| `interaction_contacts` | Контакты, прикрепленные к конкретному interaction. | `interaction_id -> university_interactions.id`, `contact_id -> university_contacts.id`. | `interaction=RTK-DEMO-001`, `role=decision_maker` |
| `responsible_assignment_history` | История смены ответственного КАМ. | `interaction_id -> university_interactions.id`, old/new/changed_by -> `users.id`. | `old_manager=kam1`, `new_manager=kam2`, `reason=handoff` |
| `contracts` | Нормализованные договоры interaction. | `interaction_id -> university_interactions.id`. | `number=RTK-DEMO-001` |
| `licenses` | Нормализованные лицензии по договору и продукту. | `contract_id -> contracts.id`, `product_id -> it_products.id`. | `transfer_status=TRANSFERRED` |

Поля договора/лицензии в `university_interactions`:

- `contract_number`;
- `license_signed`;
- `license_signed_at`;
- `license_valid_until`;
- `transfer_status`;
- `university_responsibles`;
- `comment`.

Legacy note:

- Эти flattened поля временно сохранены для backward compatibility существующего Interactions API.
- Stage 4.1 importer пишет normalized `contracts` / `licenses` и синхронно поддерживает legacy fields.

### `contracts`

Fields:

- `id`
- `interaction_id: uuid, FK -> university_interactions.id`
- `number: varchar(255)`
- `signed_at: timestamptz, nullable`
- `valid_from: timestamptz, nullable`
- `valid_until: timestamptz, nullable`
- `status: varchar(64), nullable`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique: `(interaction_id, number)`
- Index: `interaction_id`

### `licenses`

Fields:

- `id`
- `contract_id: uuid, FK -> contracts.id`
- `product_id: uuid, FK -> it_products.id`
- `license_number: varchar(255), nullable`
- `signed_at: timestamptz, nullable`
- `valid_until: timestamptz, nullable`
- `transfer_status: varchar(64), nullable`
- `product_access: varchar(1024), nullable`
- `program_instance_id: uuid, FK -> program_instances.id, nullable`
- `transferred_on: date, nullable`
- `attachment_id: uuid, FK -> files.id, nullable`
- `comment: varchar, nullable`
- `created_at`
- `updated_at`

Constraints and indexes:

- Unique: `(contract_id, product_id)`
- Index: `contract_id`
- Index: `product_id`

Пример interaction:

```json
{
  "university_id": "11111111-1111-1111-1111-111111111111",
  "program_id": "22222222-2222-2222-2222-222222222222",
  "product_id": "33333333-3333-3333-3333-333333333333",
  "manager_user_id": "44444444-4444-4444-4444-444444444444",
  "workflow_template_id": "55555555-5555-5555-5555-555555555555",
  "status": "ACTIVE",
  "contract_number": "RTK-DEMO-001",
  "license_signed": true,
  "license_signed_at": "2026-09-21T09:00:00Z",
  "license_valid_until": "2027-09-21T09:00:00Z",
  "transfer_status": "TRANSFERRED",
  "university_responsibles": "Ivan Sokolov, Head of Department",
  "comment": "Demo interaction for stage 1 scope checks."
}
```

### Workflow

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `workflow_templates` | Логические шаблоны workflow. | Используется в versions и interactions. | `name=RTK EduFlow Base Workflow`, `is_default=true` |
| `workflow_versions` | Версии workflow template. | `workflow_template_id -> workflow_templates.id`, `supersedes_version_id -> workflow_versions.id`. | `version=1`, `status=PUBLISHED` |
| `workflow_stages` | Этапы внутри конкретной версии workflow. | `workflow_template_id -> workflow_templates.id`, `workflow_version_id -> workflow_versions.id`. | `name=Подписание документов`, `order_index=6` |
| `workflow_transitions` | Разрешенные переходы между этапами внутри версии. | `workflow_version_id -> workflow_versions.id`, `from_stage_id`, `to_stage_id -> workflow_stages.id`. | `from=stage 4`, `to=stage 5` |
| `workflow_stage_instances` | Runtime-экземпляры этапов для interaction. | `interaction_id -> university_interactions.id`, `workflow_stage_id -> workflow_stages.id`. | `status=IN_PROGRESS`, `responsible_user_id=kam1` |
| `workflow_transition_history` | История переходов workflow. | `interaction_id`, stage instances, transition, `performed_by -> users.id`. | `performed_by=kam1`, `comment=done` |
| `workflow_stage_comments` | Комментарии к runtime-этапам. | `stage_instance_id -> workflow_stage_instances.id`, `author_user_id -> users.id`. | `comment=Waiting for university confirmation` |
| `workflow_stage_attachments` | Связь этапов workflow с файлами. | `stage_instance_id -> workflow_stage_instances.id`, `file_id -> files.id`. | `stage_instance_id=<id>`, `file_id=<id>` |

Runtime-логика:

```text
При создании interaction backend берет workflow_template_id,
выбирает текущую PUBLISHED workflow_version,
сохраняет workflow_version_id в interaction,
создает workflow_stage_instances для активных stages этой version,
назначает responsible_user_id = interaction.manager_user_id
и ставит начальный stage в IN_PROGRESS.
```

### Файлы

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `files` | Метаданные файлов; бинарный контент хранится в S3-совместимом object storage. | `uploaded_by -> users.id`; используется в `workflow_stage_attachments`. | `original_name=contract.pdf`, `mime_type=application/pdf` |

### Imports

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `import_jobs` | Жизненный цикл одного XLS/XLSX импорта. | `source_file_id -> files.id`, `created_by -> users.id`, `mapping_id -> import_mappings.id`. | `status=READY`, `total_rows=427` |
| `import_artifacts` | Связь import job с файловыми артефактами. | `import_job_id -> import_jobs.id`, `file_id -> files.id`. | `artifact_type=SOURCE` |
| `import_mappings` | Переиспользуемые mapping presets. | `created_by -> users.id`. | `name=RTK_DEFAULT_V1`, `is_system=true` |
| `import_mapping_fields` | Колонка spreadsheet -> target CRM field. | `mapping_id -> import_mappings.id`. | `source_column=Название ВУЗа`, `target_field=university.name` |
| `import_row_errors` | Структурированные ошибки строк validation. | `import_job_id -> import_jobs.id`. | `row_number=17`, `error_code=MANAGER_NOT_FOUND` |

### Audit

| Таблица | Назначение | Основные связи | Пример заполнения |
| --- | --- | --- | --- |
| `audit_events` | Журнал критичных backend-действий. | `actor_user_id -> users.id`, `entity_id` хранит id бизнес-сущности. | `action=interaction.assign`, `entity_type=interaction`, `result=SUCCESS` |

Текущие audit actions:

- `interaction.create`;
- `interaction.update`;
- `interaction.assign`;
- `interaction.delete`;
- `workflow.transition`;
- `manager_membership.create`;
- `manager_membership.update`;
- `manager_membership.deactivate`.

Заготовки под этап 3:

- `file.upload`;
- `file.download`;
- `file.delete`;
- `file.scan_status_changed`;
- `storage.presign_generated`.

Stage 4 import actions:

- `import.upload`;
- `import.mapping.update`;
- `import.validate`;
- `import.diff`;
- `import.confirm`;
- `import.complete`;
- `import.fail`.

Пример `audit_events.metadata`:

```json
{
  "old_manager_user_id": "44444444-4444-4444-4444-444444444444",
  "new_manager_user_id": "66666666-6666-6666-6666-666666666666"
}
```

## Часть 2. Backend API

Все endpoints ниже имеют префикс `/api`.

Стандартный ответ ошибки:

```json
{
  "code": "FORBIDDEN",
  "message": "Cannot access this interaction",
  "details": null,
  "request_id": "6f3f843b-4e5c-46df-9df7-0628d88f3d3c"
}
```

Контракт одинаков для HTTP-ошибок, ошибок валидации и необработанных исключений. Тот же
`request_id` возвращается в заголовке `X-Request-ID` и может использоваться для поиска
события в журнале и логах.

### Auth

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/auth/me` | Authenticated | Bearer token | Текущего пользователя |
| `GET` | `/auth/role-check` | `KAM`, `MANAGER`, `ADMIN` | Bearer token | Информацию о доступе |
| `POST` | `/auth/token` | Public | Swagger OAuth2 username/password form | Keycloak bearer token |

Пример ответа `/auth/me`:

```json
{
  "id": "user-id",
  "keycloak_user_id": "keycloak-sub",
  "username": "kam1",
  "full_name": "KAM User",
  "email": "kam1@example.local",
  "role": "KAM",
  "roles": ["KAM"]
}
```

`POST /auth/token` используется Swagger UI для ручной проверки API. В Swagger нужно нажать `Authorize`, ввести demo `username` и `password`, а `client_id` и `client_secret` оставить пустыми. Backend сам использует public client `rtk-eduflow-frontend` и Keycloak password grant.

Demo users:

| Username | Password | Role |
| --- | --- | --- |
| `kam1` | `kam1` | `KAM` |
| `kam2` | `kam2` | `KAM` |
| `manager1` | `manager1` | `MANAGER` |
| `admin1` | `admin1` | `ADMIN` |
| `viewer1` | `viewer1` | no CRM role |

### Universities

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/universities` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, `region`, `city`, pagination/sort | `Page[UniversityRead]` с учетом scope |
| `GET` | `/universities/{university_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityRead` |
| `POST` | `/universities` | `MANAGER`, `ADMIN` | `UniversityCreate` | `UniversityRead` |
| `PATCH` | `/universities/{university_id}` | `MANAGER`, `ADMIN` | `UniversityUpdate` | `UniversityRead` |
| `PATCH` | `/universities/{university_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `UniversityRead` |

### University Contacts

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/university-contacts` | `KAM`, `MANAGER`, `ADMIN` | `search`, `university_id`, `is_active`, `is_primary`, pagination/sort | `Page[UniversityContactRead]` с учетом scope |
| `GET` | `/university-contacts/{contact_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityContactRead` |
| `POST` | `/university-contacts` | `MANAGER`, `ADMIN` | `UniversityContactCreate` | `UniversityContactRead` |
| `PATCH` | `/university-contacts/{contact_id}` | `MANAGER`, `ADMIN` | `UniversityContactUpdate` | `UniversityContactRead` |
| `PATCH` | `/university-contacts/{contact_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `UniversityContactRead` |

### Programs And Directions

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/it-directions` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, pagination/sort | `Page[ITDirectionRead]` |
| `GET` | `/it-directions/{direction_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITDirectionRead` |
| `POST` | `/it-directions` | `MANAGER`, `ADMIN` | `ITDirectionCreate` | `ITDirectionRead` |
| `PATCH` | `/it-directions/{direction_id}` | `MANAGER`, `ADMIN` | `ITDirectionUpdate` | `ITDirectionRead` |
| `PATCH` | `/it-directions/{direction_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITDirectionRead` |
| `GET` | `/it-programs` | `KAM`, `MANAGER`, `ADMIN` | `search`, `direction_id`, `is_active`, pagination/sort | `Page[ITProgramRead]` |
| `GET` | `/it-programs/{program_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITProgramRead` |
| `POST` | `/it-programs` | `MANAGER`, `ADMIN` | `ITProgramCreate` | `ITProgramRead` |
| `PATCH` | `/it-programs/{program_id}` | `MANAGER`, `ADMIN` | `ITProgramUpdate` | `ITProgramRead` |
| `PATCH` | `/it-programs/{program_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITProgramRead` |

### Products And Vendors

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/vendors` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, pagination/sort | `Page[VendorRead]` |
| `GET` | `/vendors/{vendor_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `VendorRead` |
| `POST` | `/vendors` | `MANAGER`, `ADMIN` | `VendorCreate` | `VendorRead` |
| `PATCH` | `/vendors/{vendor_id}` | `MANAGER`, `ADMIN` | `VendorUpdate` | `VendorRead` |
| `PATCH` | `/vendors/{vendor_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `VendorRead` |
| `GET` | `/it-products` | `KAM`, `MANAGER`, `ADMIN` | `search`, `vendor_id`, `is_active`, pagination/sort | `Page[ITProductRead]` |
| `GET` | `/it-products/{product_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ITProductRead` |
| `POST` | `/it-products` | `MANAGER`, `ADMIN` | `ITProductCreate` | `ITProductRead` |
| `PATCH` | `/it-products/{product_id}` | `MANAGER`, `ADMIN` | `ITProductUpdate` | `ITProductRead` |
| `PATCH` | `/it-products/{product_id}/deactivate` | `MANAGER`, `ADMIN` | path id | `ITProductRead` |
| `GET` | `/program-products` | `KAM`, `MANAGER`, `ADMIN` | `program_id`, `product_id`, `is_required`, pagination/sort | `Page[ProgramProductRead]` |
| `GET` | `/program-products/{link_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `ProgramProductRead` |
| `POST` | `/program-products` | `MANAGER`, `ADMIN` | `ProgramProductCreate` | `ProgramProductRead` |
| `PATCH` | `/program-products/{link_id}` | `MANAGER`, `ADMIN` | `ProgramProductUpdate` | `ProgramProductRead` |
| `DELETE` | `/program-products/{link_id}` | `MANAGER`, `ADMIN` | path id | `204 No Content` |

### Interactions

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/interactions` | `KAM`, `MANAGER`, `ADMIN` | `university_id`, `program_id`, `product_id`, `manager_user_id`, `status`, pagination/sort | `Page[UniversityInteractionRead]` с учетом scope |
| `GET` | `/interactions/{interaction_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `UniversityInteractionRead` |
| `POST` | `/interactions` | `KAM`, `MANAGER`, `ADMIN` | `UniversityInteractionCreate` | `UniversityInteractionRead` |
| `PATCH` | `/interactions/{interaction_id}` | `KAM`, `MANAGER`, `ADMIN` | `UniversityInteractionUpdate`, кроме смены `manager_user_id` | `UniversityInteractionRead` |
| `POST` | `/interactions/{interaction_id}/assign` | `MANAGER`, `ADMIN` | `UniversityInteractionAssign` | `UniversityInteractionRead` |
| `GET` | `/interactions/{interaction_id}/assignment-history` | `KAM`, `MANAGER`, `ADMIN` | path id, pagination | `Page[ResponsibleAssignmentHistoryRead]` |
| `DELETE` | `/interactions/{interaction_id}` | `ADMIN` | path id | `204 No Content` |

Пример создания:

```json
{
  "university_id": "11111111-1111-1111-1111-111111111111",
  "program_id": "22222222-2222-2222-2222-222222222222",
  "product_id": "33333333-3333-3333-3333-333333333333",
  "manager_user_id": "44444444-4444-4444-4444-444444444444",
  "workflow_template_id": "55555555-5555-5555-5555-555555555555",
  "status": "ACTIVE",
  "contract_number": "RTK-DEMO-001",
  "license_signed": true,
  "license_signed_at": "2026-09-21T09:00:00Z",
  "license_valid_until": "2027-09-21T09:00:00Z",
  "transfer_status": "TRANSFERRED",
  "university_responsibles": "Ivan Sokolov, Head of Department",
  "comment": "Created from demo data."
}
```

Пример назначения:

```json
{
  "manager_user_id": "66666666-6666-6666-6666-666666666666",
  "reason": "Reassigned by manager after scope review."
}
```

Снятие ответственного:

```json
{
  "manager_user_id": null,
  "reason": "Temporarily unassigned before redistribution."
}
```

Правила:

- `KAM` работает только со своими interactions.
- `MANAGER` работает только с interactions своих KAM.
- `ADMIN` видит и администрирует все.
- `manager_user_id` нельзя менять через `PATCH /interactions/{id}`.
- Фильтр `manager_user_id` не расширяет data scope.

### Imports

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `POST` | `/imports` | `ADMIN` | multipart `file=.xls/.xlsx` | `ImportJobRead` |
| `GET` | `/imports` | `ADMIN` | pagination | `Page[ImportJobRead]` |
| `GET` | `/imports/{job_id}` | `ADMIN` | path id | `ImportJobRead` |
| `GET` | `/imports/{job_id}/preview` | `ADMIN` | `limit` | sheet names, headers, sample rows, total rows, file type |
| `PATCH` | `/imports/{job_id}/config` | `ADMIN` | `sheet_name`, `header_row` | updated `ImportJobRead`, mapping/errors/diff invalidated |
| `GET` | `/imports/fields` | `ADMIN` | none | list of target CRM fields |
| `GET` | `/imports/mappings` | `ADMIN` | none | reusable mappings, including `RTK_DEFAULT_V1` |
| `POST` | `/imports/mappings` | `ADMIN` | mapping name and fields | `ImportMappingRead` |
| `GET` | `/imports/{job_id}/mapping` | `ADMIN` | path id | job mapping snapshot |
| `PUT` | `/imports/{job_id}/mapping` | `ADMIN` | `mapping_id` or custom fields | job mapping snapshot |
| `POST` | `/imports/{job_id}/validate` | `ADMIN` | path id | validation counters |
| `GET` | `/imports/{job_id}/errors` | `ADMIN` | pagination | `Page[ImportRowErrorRead]` |
| `GET` | `/imports/{job_id}/diff` | `ADMIN` | path id | CREATE/UPDATE/SKIP/CONFLICT diff |
| `POST` | `/imports/{job_id}/confirm` | `ADMIN` | path id | final counters and status |

Import pipeline:

```text
upload -> preview -> mapping -> validation -> diff -> confirm
```

Rules:

- `POST /imports`, preview, mapping, validation and diff do not mutate CRM business tables.
- Source spreadsheet metadata is stored in `files`; binary content is stored in S3 bucket `imports`.
- Object keys are generated as `imports/<import_job_id>/<uuid>.<ext>` and do not use the user filename.
- `confirm` is rejected when row validation errors or unresolved conflicts exist.
- `confirm` also rejects stale diff with `409 IMPORT_STALE_DIFF` when input, mapping or relevant CRM fingerprint changed after diff.
- XLSX signature is checked as ZIP (`PK`); legacy XLS is checked as OLE Compound (`D0 CF 11 E0 A1 B1 1A E1`).
- Only `ADMIN` can run import operations.

### Manager Memberships

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/users/manager-memberships` | `ADMIN` | `manager_user_id`, `kam_user_id`, `is_active`, pagination/sort | `Page[ManagerMembershipRead]` |
| `POST` | `/users/manager-memberships` | `ADMIN` | `ManagerMembershipCreate` | `ManagerMembershipRead` |
| `PATCH` | `/users/manager-memberships/{membership_id}` | `ADMIN` | `ManagerMembershipUpdate` | `ManagerMembershipRead` |
| `PATCH` | `/users/manager-memberships/{membership_id}/deactivate` | `ADMIN` | path id | `ManagerMembershipRead` |

Пример создания:

```json
{
  "manager_user_id": "manager-user-id",
  "kam_user_id": "kam-user-id",
  "valid_from": null,
  "valid_to": null
}
```

Правила:

- `manager_user_id` должен иметь роль `MANAGER`;
- `kam_user_id` должен иметь роль `KAM`;
- manager и KAM не могут быть одним пользователем;
- повторный `POST` по существующей паре реактивирует связь.

### Workflow

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/workflows/templates` | `KAM`, `MANAGER`, `ADMIN` | `search`, `is_active`, `is_default`, pagination/sort | `Page[WorkflowTemplateRead]` |
| `GET` | `/workflows/templates/{template_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowTemplateRead` |
| `POST` | `/workflows/templates` | `ADMIN` | `WorkflowTemplateCreate` | `WorkflowTemplateRead` |
| `PATCH` | `/workflows/templates/{template_id}` | `ADMIN` | `WorkflowTemplateUpdate` | `WorkflowTemplateRead` |
| `GET` | `/workflows/templates/{template_id}/versions` | `KAM`, `MANAGER`, `ADMIN` | path id | `list[WorkflowVersionRead]` |
| `POST` | `/workflows/templates/{template_id}/versions/draft` | `ADMIN` | path id | `WorkflowVersionRead` |
| `POST` | `/workflows/versions/{version_id}/publish` | `ADMIN` | path id | `WorkflowVersionRead` |
| `GET` | `/workflows/stages` | `KAM`, `MANAGER`, `ADMIN` | `workflow_template_id`, `workflow_version_id`, `is_active`, pagination/sort | `Page[WorkflowStageRead]` |
| `GET` | `/workflows/stages/{stage_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowStageRead` |
| `POST` | `/workflows/stages` | `ADMIN` | `WorkflowStageCreate` | `WorkflowStageRead` |
| `PATCH` | `/workflows/stages/{stage_id}` | `ADMIN` | `WorkflowStageUpdate` | `WorkflowStageRead` |
| `GET` | `/workflows/transitions` | `KAM`, `MANAGER`, `ADMIN` | `workflow_template_id`, `workflow_version_id`, `from_stage_id`, `to_stage_id`, `is_default`, pagination/sort | `Page[WorkflowTransitionRead]` |
| `GET` | `/workflows/transitions/{transition_id}` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowTransitionRead` |
| `POST` | `/workflows/transitions` | `ADMIN` | `WorkflowTransitionCreate` | `WorkflowTransitionRead` |
| `PATCH` | `/workflows/transitions/{transition_id}` | `ADMIN` | `WorkflowTransitionUpdate` | `WorkflowTransitionRead` |
| `GET` | `/workflows/stage-instances` | `KAM`, `MANAGER`, `ADMIN` | `interaction_id`, `status`, pagination/sort | `Page[WorkflowStageInstanceRead]` |
| `GET` | `/workflows/interactions/{interaction_id}/current-stage` | `KAM`, `MANAGER`, `ADMIN` | path id | `WorkflowStageInstanceRead` |
| `PATCH` | `/workflows/stage-instances/{stage_instance_id}/status` | `KAM`, `MANAGER`, `ADMIN` | `WorkflowStageInstanceStatusUpdate` | `WorkflowStageInstanceRead` |
| `POST` | `/workflows/stage-instances/{stage_instance_id}/attachments` | `KAM`, `MANAGER`, `ADMIN` with interaction scope | multipart `file`, optional `description` | `WorkflowAttachmentRead` |
| `GET` | `/workflows/stage-instances/{stage_instance_id}/attachments` | `KAM`, `MANAGER`, `ADMIN` with interaction scope | path id | `list[WorkflowAttachmentRead]` |
| `GET` | `/workflows/attachments/{attachment_id}/download` | `KAM`, `MANAGER`, `ADMIN` with interaction scope | path id | binary stream |
| `DELETE` | `/workflows/attachments/{attachment_id}` | `KAM`, `MANAGER`, `ADMIN` with interaction scope | path id | `WorkflowAttachmentRead` |
| `POST` | `/workflows/attachments/{attachment_id}/restore` | `KAM`, `MANAGER`, `ADMIN` with interaction scope | path id | `WorkflowAttachmentRead` |
| `GET` | `/workflows/transition-history` | `KAM`, `MANAGER`, `ADMIN` | `interaction_id`, pagination/sort | `Page[WorkflowTransitionHistoryRead]` |
| `POST` | `/workflows/interactions/{interaction_id}/transition` | `KAM`, `MANAGER`, `ADMIN` | `WorkflowTransitionExecute` | `WorkflowTransitionResult` |

Пример workflow transition:

```json
{
  "transition_id": "transition-id",
  "comment": "Stage completed",
  "skip_current": false
}
```

Scope rules:

- runtime endpoints проверяют доступ к interaction;
- non-admin roles должны передавать `interaction_id` при списочных runtime-запросах;
- workflow template/stage/transition editing доступен только `ADMIN`;
- published workflow version immutable: structural edits разрешены только в draft version.

### Audit

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/audit/events` | `ADMIN` | `actor_user_id`, `action`, `entity_type`, `entity_id`, `result`, `date_from`, `date_to`, pagination/sort | `Page[AuditEventRead]` |

Примеры:

```text
GET /api/audit/events?action=interaction.assign
GET /api/audit/events?entity_type=interaction&entity_id=<interaction_id>
GET /api/audit/events?result=SUCCESS
```

Пример ответа:

```json
{
  "items": [
    {
      "id": "audit-event-id",
      "actor_user_id": "admin-user-id",
      "action": "interaction.assign",
      "entity_type": "interaction",
      "entity_id": "interaction-id",
      "result": "SUCCESS",
      "reason": "verification unassign",
      "error_code": null,
      "metadata": {
        "old_manager_user_id": "kam1-id",
        "new_manager_user_id": null
      },
      "request_id": "request-id",
      "created_at": "2026-09-21T09:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Health

| Method | Path | Доступ | Принимает | Возвращает |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Public | nothing | `{"status": "ok", "service": "backend"}` |

## Плановые Таблицы Следующих Этапов

Эти таблицы не считаются реализованными, пока нет Alembic migration, модели, API и тестов.

| Этап | Плановые изменения |
| --- | --- |
| 2 | Частично реализовано: `workflow_versions`, draft/publish lifecycle, runtime binding. Впереди: governance, change requests, approvals, stage mappings, migration jobs. |
| 3 | Implemented: S3-compatible object storage metadata in `files`, workflow attachment upload/list/download, soft delete, restore, purge command, and active-file checks for `requires_attachment`. |
| 4 | Imports: `import_jobs`, mappings, row errors, import artifacts. |
| 5 | Reports: `report_jobs`, `report_artifacts`, `report_templates`. |
| 6 | Integrations: sources, inbox/outbox, external links, mappings, delivery attempts. |
| 7 | SLA, risks, notifications. |
| 8 | Participants, cohorts, teachers, schedule после подтверждения данных заказчика. |

## Общие Правила

- PostgreSQL хранит структурированные данные и metadata, не бинарный контент файлов.
- Backend enforce RBAC/data scope; frontend-проверки считаются только UX-слоем.
- Audit metadata не должна содержать токены, raw JWT, секреты и лишние персональные данные.
- Любой новый бизнес-контур должен иметь миграцию, модель, API, Swagger-описание и минимальные тесты.
