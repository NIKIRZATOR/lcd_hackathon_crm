# Database Architecture

Date: 2026-09-20

This document captures the Stage 0 database baseline and the planned ER model for later milestones. Planned tables are not implemented until there is an Alembic migration, model, API path and tests.

## Current CRM Schema

Current migrations:

- `cade47f9d409_init_crm_schema.py`
- `5b0d2fd1f4d8_add_roles_for_keycloak.py`

Current public tables:

| Table | Purpose |
| --- | --- |
| `alembic_version` | Alembic migration marker. |
| `universities` | University catalog. |
| `university_contacts` | Contacts related to universities. |
| `it_directions` | IT education direction catalog. |
| `it_programs` | Programs linked to directions. |
| `vendors` | Product vendor catalog. |
| `it_products` | Product catalog. |
| `program_products` | Many-to-many relation between programs and products. |
| `users` | Local CRM projection of Keycloak users. |
| `roles` | Local role catalog. |
| `user_roles` | User-role many-to-many relation. |
| `university_interactions` | Main working interaction: university x program/product x manager x workflow. |
| `interaction_contacts` | Contacts attached to interactions. |
| `workflow_templates` | Workflow template catalog. |
| `workflow_stages` | Stages within workflow templates. |
| `workflow_transitions` | Allowed workflow transitions. |
| `workflow_stage_instances` | Runtime stage instances for concrete interactions. |
| `workflow_transition_history` | Runtime transition history. |
| `workflow_stage_comments` | Comments on workflow stages. |
| `workflow_stage_attachments` | Links between workflow stages and uploaded file metadata. |
| `files` | File metadata table. Binary content should move to object storage. |

## Current Relationships

- `university_contacts.university_id` -> `universities.id`
- `it_programs.direction_id` -> `it_directions.id`
- `it_products.vendor_id` -> `vendors.id`
- `program_products.program_id` -> `it_programs.id`
- `program_products.product_id` -> `it_products.id`
- `user_roles.user_id` -> `users.id`
- `user_roles.role_id` -> `roles.id`
- `university_interactions.university_id` -> `universities.id`
- `university_interactions.program_id` -> `it_programs.id`
- `university_interactions.product_id` -> `it_products.id`
- `university_interactions.manager_user_id` -> `users.id`
- `university_interactions.workflow_template_id` -> `workflow_templates.id`
- `workflow_stages.template_id` -> `workflow_templates.id`
- `workflow_transitions.template_id` -> `workflow_templates.id`
- `workflow_transitions.from_stage_id` -> `workflow_stages.id`
- `workflow_transitions.to_stage_id` -> `workflow_stages.id`
- `workflow_stage_instances.interaction_id` -> `university_interactions.id`
- `workflow_stage_instances.workflow_stage_id` -> `workflow_stages.id`
- `workflow_transition_history.interaction_id` -> `university_interactions.id`
- `workflow_stage_comments.stage_instance_id` -> `workflow_stage_instances.id`
- `workflow_stage_attachments.stage_instance_id` -> `workflow_stage_instances.id`
- `workflow_stage_attachments.file_id` -> `files.id`

## Planned ER Groups

### Stage 1: Access And CRM Completion

| Planned table / change | Purpose |
| --- | --- |
| `manager_memberships` | Manager-to-KAM hierarchy with validity range. |
| `data_access_scopes` | Optional explicit ACL exceptions for organizations or interactions. |
| `responsible_assignment_history` | History of KAM/manager assignment changes. |
| `contracts` | Contract number, dates, status and relation to interaction. |
| `licenses` extension | Product/license lifecycle fields and relation to contract. |

### Stage 2: Workflow Governance

| Planned table / change | Purpose |
| --- | --- |
| `workflow_versions` or template version fields | Draft/published versioning. |
| `workflow_change_requests` | Proposed changes for published workflows. |
| `workflow_change_approvals` | Approval trail for risky workflow changes. |
| `workflow_stage_mappings` | Old-stage to new-stage mappings for active process migration. |
| `workflow_migration_jobs` | Background migration status and errors. |

### Stage 3: Object Storage

| Planned table / change | Purpose |
| --- | --- |
| `files.provider` | Storage provider such as MinIO or corporate S3. |
| `files.bucket` | Object storage bucket. |
| `files.object_key` | Stable object key. |
| `files.checksum` | Integrity check. |
| `files.scan_status` | Antivirus/quarantine lifecycle for later hardening. |

### Stage 4: Imports

| Planned table | Purpose |
| --- | --- |
| `import_jobs` | Import lifecycle and counters. |
| `import_mappings` | Saved column mapping profiles. |
| `import_mapping_fields` | Source column to target field rules. |
| `import_row_errors` | Validation errors by row/column. |
| `import_artifacts` | Source/error/protocol file links. |

### Stage 5: Reports

| Planned table | Purpose |
| --- | --- |
| `report_jobs` | Async report generation lifecycle. |
| `report_artifacts` | Links between report jobs and stored files. |
| `report_templates` | Reusable filters/columns for P1. |

### Stage 6: Integrations

| Planned table | Purpose |
| --- | --- |
| `integration_sources` | LMS/CMS adapter configuration. |
| `integration_events` | Inbound inbox with deduplication. |
| `external_entity_links` | External ID to internal entity mapping. |
| `integration_mappings` | External schema to internal DTO mapping. |
| `integration_outbox` | Reliable outbound event queue. |
| `integration_delivery_attempts` | Retry and delivery audit trail. |

### Stage 7: SLA, Risks, Notifications

| Planned table | Purpose |
| --- | --- |
| `sla_policies` | Normative stage durations. |
| `sla_breaches` | Actual SLA violations. |
| `risk_rules` | Configurable risk detection rules. |
| `risk_events` | Open/acknowledged/resolved risk facts. |
| `risk_score_snapshots` | Explainable health score history for P1. |
| `notification_rules` | Event/risk to recipient/channel configuration. |
| `notifications` | In-app notification inbox. |
| `notification_delivery_attempts` | External channel delivery audit. |
| `user_notification_preferences` | Per-user notification preferences for P1. |
| `tasks` / `reminders` | KAM actionable work list. |

### Stage 8: Participants And Schedule

| Planned table | Purpose |
| --- | --- |
| `participants` | Minimal participant profile after customer data confirmation. |
| `cohorts` | Education cohorts/groups. |
| `cohort_participants` | Participant-to-cohort relation. |
| `teachers` | Teacher catalog. |
| `activities` / `schedule_events` | Scheduled learning activities. |
| `activity_participants` | Attendance or participation if LMS provides it. |

## Migration Plan By Stage

| Stage | Migration direction |
| --- | --- |
| 0 | No schema change required; baseline confirmed through Alembic. |
| 1 | Add manager hierarchy, data scope, assignment history, contracts/licenses fields. |
| 2 | Add workflow versioning/governance tables and migration job tables. |
| 3 | Extend `files` for object storage metadata and add storage adapter configuration. |
| 4 | Add import job/mapping/error/artifact tables. |
| 5 | Add report job/artifact/template tables. |
| 6 | Add integration inbox/outbox/mapping/link tables. |
| 7 | Add SLA, risk and notification tables. |
| 8 | Add participant/cohort/teacher/schedule tables only after customer data confirmation. |

## Rules

- Every schema change must be delivered through Alembic.
- PostgreSQL stores structured data and object metadata, not binary file content.
- Backend must enforce RBAC and data scope; frontend checks are UX only.
- Planned tables are not considered implemented until code and tests exist.
