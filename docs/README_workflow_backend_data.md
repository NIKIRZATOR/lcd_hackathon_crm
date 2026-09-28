# Backend-данные для страницы Workflow

## Назначение

Этот набор изменений подготавливает backend и базу данных для замены временных данных страницы Workflow реальными серверными данными.

Frontend в этой ветке не переводится на новые источники. Существующие mock-файлы и fallback-механизмы оставлены, чтобы изменения можно было подключить отдельным этапом после merge.

Основные сценарии, для которых подготовлен backend:

- журнал workflow и карточка программного захода;
- данные 13 рабочих этапов workflow;
- 14-й блок «Контроль исполнения»;
- стандартные и пользовательские пункты checklist;
- комментарии и вложения этапов;
- контакты площадки и поставщика продукта;
- договоры, лицензии и передача доступа;
- преподаватели и подтверждение их готовности;
- учебные окна и учебный план;
- шаблоны документов;
- корректное отображение закрытых заходов.

## Что реализовано

### 1. Данные рабочих этапов

Добавлено персистентное хранилище `workflow_stage_data`. Одна запись принадлежит одному `WorkflowStageInstance` и содержит JSON payload соответствующего этапа.

Поддержаны 13 основных кодов этапов:

1. `find_contact`;
2. `first_meeting`;
3. `identify_need`;
4. `document_package`;
5. `sign_contract`;
6. `sign_license`;
7. `transfer_access`;
8. `train_teacher`;
9. `confirm_teacher`;
10. `curriculum`;
11. `start_classes`;
12. `classes_running`;
13. `period_results`.

Для payload добавлены Pydantic-схемы. Backend проверяет поля и допустимые значения в зависимости от кода этапа. Неизвестные поля отклоняются ответом `422`.

API:

- `GET /api/workflows/stage-instances/{stage_instance_id}/data` — получить данные этапа;
- `PUT /api/workflows/stage-instances/{stage_instance_id}/data` — полностью заменить данные этапа;
- `GET /api/workflows/stage-data/schemas` — получить JSON Schema всех поддержанных этапов.

Рекомендуемая модель использования:

- `workflow_stage_data` хранит состояние формы этапа;
- `program_checklist_values` хранит факты выполнения стандартного checklist;
- профильные сущности (`Contract`, `License`, `TeacherCarrier`, `ProgramInstance`) остаются источником итоговых бизнес-данных после закрытия этапа.

### 2. Пользовательские пункты checklist

Добавлена таблица `workflow_checklist_extras` для задач, созданных пользователем внутри конкретного этапа.

API:

- `GET /api/stage-instances/{stage_instance_id}/checklist-extras`;
- `POST /api/stage-instances/{stage_instance_id}/checklist-extras`;
- `PATCH /api/stage-instances/checklist-extras/{extra_id}`;
- `PUT /api/stage-instances/{stage_instance_id}/checklist-extras/order`;
- `DELETE /api/stage-instances/checklist-extras/{extra_id}`.

Стандартный checklist дополнительно возвращает поле `code`, поэтому frontend может находить пункты по стабильному бизнес-коду, а не по отображаемому названию.

### 3. Контроль исполнения

Добавлена таблица `program_workflow_controls`. Она хранит серверное состояние 14-го блока Workflow — «Контроль исполнения».

API:

- `GET /api/program-instances/{program_instance_id}/control`;
- `PUT /api/program-instances/{program_instance_id}/control`.

Поддерживаются состояния `active` и `frozen`. В JSON payload можно хранить сигналы, подтверждения, комментарии и архивное состояние блока.

Это позволяет отказаться от:

- `rtk-eduflow:control-entered:{programId}`;
- `rtk-eduflow:control:{programId}`;
- локального вычисления сохранённого состояния контроля после перезагрузки страницы.

### 4. Договоры и лицензии

В договор добавлено поле:

- `signer` — подписант договора.

В лицензию добавлено поле:

- `recipient_stakeholder_id` — получатель доступа из списка stakeholder организации.

При записи получателя backend проверяет, что stakeholder принадлежит той же организации, что и программный заход.

Ответы договоров и лицензий дополнены:

- `attachment_name`;
- `attachment_download_url`.

API скачивания:

- `GET /api/contracts/{contract_id}/attachment/download`;
- `GET /api/licenses/{license_id}/attachment/download`.

Доступ к файлам проверяется через область видимости организации текущего пользователя.

### 5. Шаблоны документов

Добавлена таблица `document_templates`. Шаблон может ссылаться на:

- файл из закрытого object storage через `file_id`;
- внешний источник через `external_url`.

API:

- `GET /api/document-templates`;
- `POST /api/document-templates` — только `ADMIN`;
- `PATCH /api/document-templates/{template_id}` — только `ADMIN`;
- `GET /api/document-templates/{template_id}/download`.

Для файлов backend отдаёт защищённый stream. Для внешнего источника возвращается redirect.

В demo seed добавлены шаблоны:

- `contract_project`;
- `direction_materials`;
- `product_description`;
- `curriculum_plan`.

### 6. Учебное окно

Добавлена возможность изменить учебное окно уже созданного программного захода:

- `PATCH /api/program-instances/{program_instance_id}/academic-window`.

После изменения backend пересчитывает health и NBA программы.

### 7. Контакты

Для stakeholder добавлено поле `contact_source` со значениями:

- `university_card`;
- `call`;
- `email`;
- `site`;
- `event`;
- `referral`;
- `other`.

Для контактов поставщика подготовлены API:

- `GET /api/vendors/{vendor_id}/contacts`;
- `POST /api/vendors/{vendor_id}/contacts`;
- `PATCH /api/vendor-contacts/{contact_id}`.

### 8. Программный заход и журнал

`ProgramInstanceRead` теперь возвращает `parent_program_id`. Это необходимо для сценариев продления лицензии и замены преподавателя.

Журнал workflow возвращает статус программы. Для отменённой программы отображаемое название этапа формируется как «Заход закрыт».

После подключения frontend больше не потребуется список закрытых программ в `localStorage`.

## Миграции

Добавлены последовательные миграции:

- `aa1b2c3d4e5f_workflow_stage_data.py` — данные этапов, дополнительные checklist-пункты и `contact_source`;
- `ab2c3d4e5f6a_program_workflow_control.py` — состояние контроля исполнения;
- `ac3d4e5f6a7b_workflow_backend_fields.py` — шаблоны документов, подписант договора и получатель лицензии.

Актуальный head:

```text
ac3d4e5f6a7b
```

Применение:

```bash
docker compose run --rm backend alembic upgrade head
```

Проверка миграций выполняется как для чистой базы, так и для опубликованной legacy-схемы:

```bash
docker compose run --rm backend python -m scripts.check_migration_paths
```

## Demo seed

`backend/scripts/seed_demo_data.py` дополнен данными для новых таблиц и полей.

После запуска seed в проверенной локальной базе создано:

- 36 программных заходов;
- 459 записей `workflow_stage_data`;
- данные по всем 13 основным типам этапов;
- 497 дополнительных checklist-пунктов;
- 36 записей контроля исполнения;
- 4 шаблона документов;
- 22 договора с заполненным подписантом;
- 35 лицензий с заполненным получателем;
- 56 stakeholder с источником контакта.

Запуск:

```bash
docker compose run --rm backend python scripts/seed_demo_data.py
```

Seed остаётся идемпотентным и может запускаться повторно.

## Что уже проверено

- полный backend test suite: `137 passed`;
- Ruff: без ошибок;
- `git diff --check`: без ошибок;
- компиляция backend и миграций: успешно;
- upgrade чистой базы до head: успешно;
- upgrade legacy-схемы до head: успешно;
- повторный запуск demo seed: успешно;
- валидация всех 459 сохранённых payload этапов: успешно;
- новые endpoints присутствуют в OpenAPI/Swagger.

## Что осталось сделать

Основная оставшаяся работа находится на frontend.

### 1. Согласовать контракты

Перед переключением компонентов необходимо устранить несколько несовпадений:

- frontend ожидает у шаблона поле `url`, backend возвращает `download_url`;
- frontend ищет шаблон учебного плана с `kind="plan"`, seed создаёт `kind="curriculum_plan"`;
- необходимо согласовать пары статусов `returned/rejected`, `requested/in_progress`, `issues/attention`;
- frontend должен отправлять только поля, предусмотренные схемой конкретного этапа. Пользовательские задачи и их порядок должны храниться через `checklist-extras`, а не внутри произвольного JSON формы.

Эти различия можно исправить на любой стороне, но итоговый контракт должен быть единым до массового подключения компонентов.

### 2. Добавить frontend API-адаптеры

Нужно добавить типизированные функции для:

- чтения и записи `workflow_stage_data`;
- CRUD и сортировки `checklist-extras`;
- чтения и записи `program workflow control`;
- получения контактов поставщика;
- изменения academic window;
- получения и скачивания шаблонов документов;
- скачивания вложений договоров и лицензий.

### 3. Переключить 13 компонентов этапов

Каждый компонент этапа должен:

1. при открытии загружать payload из БД;
2. отображать пустое состояние, если данных нет;
3. сохранять изменения через API;
4. после закрытия этапа записывать итоговые данные в профильную сущность;
5. пользовательские checklist-пункты сохранять через `checklist-extras`.

Отдельные итоговые операции:

- при подписании договора отправлять `signer`, а не записывать подписанта в `comment`;
- при передаче доступа отправлять `recipient_stakeholder_id`;
- при выборе другого учебного окна вызывать endpoint изменения окна;
- контакты поставщика читать из `/vendors/{id}/contacts`;
- ссылки на шаблоны и вложения брать из серверных download endpoints.

### 4. Переключить блок контроля

`ControlExecutionStage` должен читать и сохранять состояние через `/control`. После этого можно отключить хранение ленты и факта входа в контроль в `localStorage`.

### 5. Убрать runtime fallback на mock

Из рабочего маршрута Workflow необходимо отключить:

- `sampleJournal()`;
- `filledCount()`;
- `gapDesk`;
- `liveItems`, `liveDetails`, `liveActivity`;
- fallback на `getWorkflowDetailMock()` для бизнес-страницы;
- `rtk-eduflow:closed-programs`;
- `rtk-eduflow:classes-running:*`;
- `rtk-eduflow:control-entered:*`;
- `rtk-eduflow:control:*`.

Если серверное значение отсутствует, интерфейс должен показывать пустое состояние или `—`, но не генерировать demo-значение.

Mock-файлы при этом можно оставить для unit-тестов и Storybook/демонстрационных сценариев. Удалять их до завершения frontend-переключения не требуется.

### 6. Обновить frontend-тесты

Минимальный набор проверок после подключения:

- восстановление формы этапа после перезагрузки страницы;
- сохранение каждого из 13 типов этапов;
- создание, изменение, сортировка и удаление дополнительных задач;
- сохранение контроля исполнения;
- работа с настоящими UUID этапов, комментариев и файлов;
- скачивание шаблонов и вложений;
- договор с подписантом;
- лицензия с получателем;
- смена учебного окна;
- корректное отображение отменённой программы;
- отсутствие runtime fallback на mock при пустом API.

## Рекомендуемый порядок последующего merge

1. Влить backend-ветку и применить миграции.
2. Повторно запустить demo seed на локальном окружении.
3. Согласовать перечисленные различия API-контрактов.
4. Подключить frontend API-адаптеры.
5. Перевести этапы по одному, начиная с `find_contact` и заканчивая `period_results`.
6. Подключить серверный блок контроля.
7. Отключить runtime mock/fallback только после прохождения frontend-тестов и ручного smoke-теста всего маршрута.

## Ограничения

- Production-интеграции Website/LMS не добавлялись. Соответствующие данные по-прежнему поступают через существующий integration/fixture pipeline.
- Изменения не удаляют frontend mocks и не меняют визуальную часть Workflow.
- Создание дочернего захода из предложения «продление/замена» остаётся frontend-сценарием поверх уже существующего `POST /api/organizations/{id}/program-instances` и `parent_program_id`.
