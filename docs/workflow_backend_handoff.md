# Workflow и редактор плейбуков — handoff для backend

Документ фиксирует данные, которые на frontend сейчас являются демо-данными,
fallback-значениями, `localStorage`-состоянием либо не имеют полноценного API-контракта.
Область: журнал workflow, карточка захода, 14 этапов, плейбуки и редактор.

## P0. Общий runtime workflow

### Журнал

`GET /api/workflow-journal` должен всегда возвращать:

- `status`: `active | completed | cancelled | refused`;
- корректный `current_stage_name`; для завершённого или отменённого захода — «Заход закрыт»;
- реальные `students_count` и `applications_count`;
- согласованные с карточкой данные для legacy-заходов.

Сейчас при пустом ответе frontend показывает `sampleJournal()`, а отсутствующие число студентов
и заявок генерирует из `id`. После закрытия/отмены этап в журнале временно подменяется через
`localStorage` (`rtk-eduflow:closed-programs`).

### Runtime-этапы

В `GET /api/program-instances/{id}/workflow → stages[]` нужны:

- `code`;
- `phase_name`;
- `started_at`;
- `default_duration_days`;
- `due_at`.

`phase_name` не должен заменяться на `Other`, когда фаза известна.

### Этап 14 «Контроль исполнения»

Этап `control` должен быть серверной частью опубликованного Full Cycle и создаваться у нового
захода вместе с остальными этапами. Сейчас он дорисовывается на клиенте, а факт входа в него,
комментарии и статусы контроля лежат в `localStorage`.

Нужны endpoint'ы:

```http
GET  /api/program-instances/{id}/control-feed
POST /api/program-instances/{id}/control-feed
PATCH /api/program-instances/{id}/control-feed/{feedId}
```

Предлагаемые поля записи: `id`, `program_instance_id`, `author_id`, `text`, `signal_id?`,
`status` (`new | accepted | in_progress | resolved`), `created_at`, `updated_at`, `checked_at`.

Также нужны:

- причины штрафов health score, а не только балл и цвет;
- реальные `active_streams`;
- временной ряд LMS-активности, например `activity_by_week`;
- серверное хранение входа в контроль и последней проверки.

## P0. Редактор плейбуков

Новый редактор пока сохраняет черновик, публикацию и список локально в браузере. Payload
формируется, но на API не отправляется. Выбранные KAM также берутся из `SAMPLE_KAMS`.

Нужен единый контракт:

```http
GET    /api/management/playbooks
GET    /api/management/playbooks/{id}
POST   /api/management/playbooks
PATCH  /api/management/playbooks/{id}
POST   /api/management/playbooks/{id}/versions/draft
PUT    /api/management/playbooks/{id}/versions/{versionId}/content
POST   /api/management/playbooks/{id}/versions/{versionId}/publish
POST   /api/management/playbooks/{id}/versions/{versionId}/archive
GET    /api/users?role=KAM&scope=team
```

Сервер должен хранить:

- плейбук: имя, описание, статус, источник, автора, даты, версию;
- правило применимости/выбора в мастере;
- видимость: всем или выбранным KAM;
- фазы с порядком;
- этапы: `code`, имя, описание, порядок, SLA, признак пропуска, фаза;
- блоки этапа и их порядок;
- конфигурацию блоков: обязательность, минимальная длина, поля/факты, checklist items,
  document slots, допустимые форматы, шаблон документа, флаги;
- переходы между этапами.

Дополнительно по текущему конструктору:

- `POST /api/management/playbooks/{id}/versions/draft` обязан вернуть **новый** `id` черновика, не исходный published id. Пока 404/старый id — frontend пишет отдельную локальную запись.
- `GET /api/users?role=KAM` — список `{ id, full_name }` для доступа «выбранным KAM». Пока 404 — `SAMPLE_KAMS`.
- Автопункты чеклиста несут `factId` из каталога фактов. Runtime `POST .../transition` должен считать пункт выполненным, когда факт заполнен. Конструктор это только настраивает.
- `POST /api/management/playbooks/{id}/versions/current/publish` принимает полный payload draft. Пока 404 — публикация пишется в localStorage.
- Загрузка шаблона документа: `POST /api/attachments` и поле `template_attachment_id`. Сейчас в draft кладётся только `template` = имя файла.
- Блок `access` (передача/доступ) отделён от `license`. Шаблон документа — файл (`template` / upload), не строка. Метрики LMS/сайта в предпросмотре пустые, живые значения только из `GET .../metrics`.

Требования к операциям:

- создавать плейбук с нуля и draft из опубликованной версии;
- автосохранять draft на сервере;
- публиковать только валидную версию;
- сохранять весь граф транзакционно;
- не переписывать снимок workflow у действующих заходов;
- вести аудит создания, изменения, публикации и архивации.

Существующие endpoints шаблонов/стадий/переходов покрывают базовую модель, но не покрывают
фазы, блоки, видимость, содержимое draft целиком, порядок блоков и массовое сохранение.

## P0. Плейбуки и мастер создания захода

Сервер должен хранить и выдавать опубликованные Full Cycle, Expansion, License Renewal,
Short School и Replace Teacher.

```http
GET /api/organizations/{organizationId}/available-playbooks?direction_id=...&product_id=...
```

Ответ: `playbook_id`, `name`, `version_id`, `available`, `recommended`, `reason`,
`blocked_reason`, тип создаваемого захода и, при необходимости, родитель.

При создании захода сервер должен:

- проверять уникальность живой тройки «площадка × направление × продукт»;
- создавать снимок опубликованной версии;
- сохранять `parent_program_id` для продления и замены преподавателя;
- возвращать `parent_program_id` в `ProgramInstanceRead`.

## Данные и API по этапам

### 1. Поиск контакта

- `stakeholders.contact_source`;
- пользовательские пункты checklist конкретного этапа, их статус и порядок;
- `code` у runtime checklist item;
- правило: `required_stakeholder_role=other` означает любую должность площадки.

Предлагаемая сущность `stage_checklist_extras`: `id`, `stage_instance_id`, `label`,
`is_done`, `sort_order`, `created_at`, `updated_at`.

```http
GET/POST /api/stage-instances/{id}/checklist-extras
PATCH    /api/stage-instances/checklist-extras/{id}
PUT      /api/stage-instances/{id}/checklist-extras/order
```

### 2. Первая встреча

- время встречи;
- итог: `go_product | another_meeting | not_relevant`;
- заметка и источник;
- файл протокола как доказательство, без текстовой заглушки на 40 символов;
- пользовательские задачи.

### 3. Выявление потребности

- форма включения: `discipline | module | elective | unknown`;
- целевое учебное окно;
- ограничения и обоснование;
- пользовательские задачи и порядок.

### 4. Пакет документов

- `GET /api/document-templates`;
- шаблоны `project_contract`, `direction_materials`, `product_description`;
- у договора: имя, URL/скачивание, версии и связь с вложением этапа;
- пользовательские задачи.

### 5. Подписание договора

- номер;
- статус: `sent | received | returned`;
- дата подписания, срок действия, подписант;
- файл подписанного договора;
- новая версия файла при возврате на доработку.

### 6. Подписание лицензии

- API контактов вендора;
- статус, дата подписания, объём/условия лицензии;
- связь с лицензией и `parent_program_id` родительского захода при продлении.

### 7. Передача и доступ

- получатель;
- дата передачи;
- доступ: URL/стенд/учётная запись/инструкция;
- статус `not_transferred | requested | transferred | revoked`;
- контакт вендора, история и файл подтверждения.

### 8. Обучение преподавателя

Расширить носителя полями `training_format`, `certificate_attachment_id`,
`qualification_until`, `status` (`planned | trained | active | left`).

### 9. Подтверждение преподавателя

- готовность;
- причина неготовности;
- отметка площадки;
- явный `PATCH /api/program-instances/{id}` для смены учебного окна.

### 10. Учебный план

- файл плана как отдельный обязательный факт;
- серверная проверка минимальной длины комментария;
- сохранение `academic_window_id`;
- история версий плана.

### 11. Старт занятий

- ручное подтверждение старта;
- дата, комментарий, файл расписания;
- LMS-сигнал — информация, но не автоматическое закрытие этапа.

### 12. Ведение занятий

- статус `ok | issues | failed`;
- комментарий, файл заметки, пользовательские задачи;
- создание дочернего захода «Замена преподавателя».

Сейчас эти данные хранятся в `localStorage`.

### 13. Итоги периода

Нужна отдельная сущность `program_period_results`: студенты, заявки, потоки, дата последнего
сигнала, лицензия, преподаватель, вердикт, причина, комментарий. Снимок должен фиксироваться
один раз и не пересчитываться после закрытия этапа. Нужны параметры/endpoint для запуска
мастера следующего захода с уже выбранным родителем и рекомендованным плейбуком.

## Серверные правила и безопасность

- Проверять допустимые расширения файлов на backend: `png, jpeg/jpg, pdf, zip, gzip/gz, rar,
  doc, docx, xls, xlsx`.
- Валидировать обязательные факты при переходе на сервере.
- Разрешать пропуск только если `can_skip=true`.
- Проверять права KAM, руководителя и администратора на чтение, изменение, публикацию и переходы.
- Логировать переходы, возвраты, публикацию версии, смену KAM и действия контроля.
- Не позволять менять опубликованный шаблон напрямую: изменения только в новой draft-версии.
- Не менять снимок workflow у уже созданного захода.

## Текущие временные источники данных, которые нужно убрать

- `sampleJournal()` и программы с `gap-` id;
- генерация студентов/заявок из `id`;
- fallback фазы «Прочее»;
- fallback баннера «Нет открытого действия»;
- локальный этап 14 и его control feed;
- локальный статус ведения занятий;
- локальное запоминание закрытых программ;
- локальные draft/publish/index плейбуков;
- `SAMPLE_PLAYBOOKS` и `SAMPLE_KAMS`.
