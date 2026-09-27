/**
 * Что отдать бэкенду по этапу «Поиск контакта».
 * Экран уже ходит в живые ручки. Этот файл описывает только то, чего в API нет,
 * и временное место, куда фронт это кладёт, чтобы не блокировать закрытие этапа.
 */

export type ContactSearchBackendGap = {
  screen: string;
  field: string;
  endpoint: string;
  missing: string;
  temporary: string;
};

export const contactSearchBackendGaps: ContactSearchBackendGap[] = [
  {
    screen: 'Поиск контакта',
    field: 'Должность ответственного',
    endpoint: 'PATCH /api/stage-instances/checklist/{valueId}',
    missing: 'Раньше пункт contact с required_stakeholder_role = other принимал только role_code other.',
    temporary: 'Роль other на пункте чек-листа значит «любая должность площадки». Конкретные роли вроде teacher по-прежнему проверяются.',
  },
  {
    screen: 'Поиск контакта',
    field: 'Срок этапа',
    endpoint: 'GET /api/program-instances/{id}/workflow → stages[].due_at',
    missing: 'due_at уже считается как started_at + workflow_stages.default_duration_days и приходит для текущего этапа. В том же объекте этапа нет started_at и default_duration_days.',
    temporary: 'Плитка показывает due_at. Если поля нет, дата = сегодня + 3 дня: столько стоит «Поиск контакта» в сиде плейбука (FIND_CONTACT_SLA_DAYS).',
  },
  {
    screen: 'Поиск контакта',
    field: 'Код пункта чек-листа',
    endpoint: 'GET /api/stage-instances/{id}/checklist',
    missing: 'В ответе нет code пункта. Фронт узнаёт контактный пункт по item_type = stakeholder_role.',
    temporary: 'На этом этапе такой пункт один (code = contact). Просьба добавить code в ответ, чтобы не угадывать по типу.',
  },
  {
    screen: 'Поиск контакта',
    field: 'Источник контакта и свои пункты чек-листа',
    endpoint: 'PATCH /api/stage-instances/checklist/{valueId}',
    missing: 'У stakeholders нет источника. Нельзя создать свой пункт чек-листа этапа и сохранить его порядок: playbook_checklist_items общие на версию плейбука.',
    temporary: 'Пока это JSON в program_checklist_values.value_text контактного пункта. stakeholder_id и is_done живут как раньше: is_done = true только когда есть ФИО и телефон или почта.',
  },
];

/**
 * Временный JSON в value_text пункта contact.
 * Когда появятся свои поля, этот конверт можно разобрать и перестать писать.
 *
 * {
 *   "v": 1,
 *   "source": "university_card" | "call" | "email" | "site" | "event" | "referral" | "other" | null,
 *   "order": ["responsible", "channel", "role", "primary", "source", "custom-..."],
 *   "custom": [{ "id": "custom-...", "label": "Свой пункт", "done": false }]
 * }
 *
 * Системные коды order не создаются отдельными строками, фронт считает их сам:
 * responsible, channel — обязательны для закрытия;
 * role, primary, source — нет.
 *
 * Куда положить по-настоящему:
 * 1. stakeholders.contact_source varchar(32) null
 *    check: university_card, call, email, site, event, referral, other.
 *    Отдавать в StakeholderRead и принимать в StakeholderCreate / StakeholderUpdate.
 * 2. stage_checklist_extras:
 *    id, stage_instance_id, label, is_done, sort_order, created_at, updated_at.
 *    GET/POST /api/stage-instances/{id}/checklist-extras
 *    PATCH /api/stage-instances/checklist-extras/{id}  { label?, is_done? }
 *    PUT  /api/stage-instances/{id}/checklist-extras/order  { ids: string[] }
 *    В order вместе с системными кодами, либо отдельным полем layout.
 * 3. Закрытие этапа по-прежнему смотрит только обязательный пункт contact:
 *    ФИО и телефон или почта. Свои пункты и три нижних системных закрытие не блокируют.
 */
export const firstMeetingBackendGaps: ContactSearchBackendGap[] = [
  {
    screen: 'Выявление потребности',
    field: 'Форма включения, учебный период этапа, ограничения',
    endpoint: 'PATCH /api/stage-instances/checklist/{valueId} у пункта need_comment',
    missing: 'На этапе один текстовый пункт need_comment. Нет полей формы включения, целевого окна и ограничений. Окно захода уже есть в program_instances.academic_window_id и справочнике GET /api/academic-windows.',
    temporary: 'JSON v1 в value_text пункта need_comment: reason, format (discipline | module | elective | unknown), windowId, limits, order, custom. is_done = true, когда обоснование не короче 40 знаков, форма и окно выбраны. Окно по умолчанию — academic_window_id захода. Заметка встречи читается из value_text пункта meeting_date. Договор и лицензия на этот экран не запрашиваются.',
  },
  {
    screen: 'Пакет документов',
    field: 'Шаблоны слотов и файл рамки',
    endpoint: 'GET /api/document-templates и GET /api/organizations/{id}/contracts',
    missing: 'Нет ручки шаблонов. У договора есть attachment_id, но нет original_name и скачивания, и этот файл не привязан к вложениям этапа. Пункт чек-листа file ставится выполненным только с attachment_id вложения этапа.',
    temporary: 'Кнопка «Скачать шаблон» появляется, только если GET /api/document-templates вернёт [{ kind, name, url }] для project_contract, direction_materials, product_description. Действующая рамка (status active/signed и срок не истёк) закрывает пункт «Проект договора» без нового файла. Новая загрузка добавляет версию и не удаляет старые файлы. Свои задачи лежат JSON v1 в value_text пункта contract_project: order, custom.',
  },
  {
    screen: 'Журнал воркфлоу',
    field: 'Этап закрытого захода',
    endpoint: 'GET /api/workflow-journal',
    missing: 'В ответе нет status программы. current_stage_name берётся из program_instances.current_stage_instance_id и для legacy-захода не совпадает с этапом, который видит карточка. После «Не актуально» программа становится cancelled, но колонка «Этап» остаётся прежней, и фильтр по этапу не показывает «Заход закрыт».',
    temporary: 'Фронт помнит id закрытых программ в localStorage (rtk-eduflow:closed-programs) и подменяет этап на «Заход закрыт». Когда журнал начнёт отдавать status=cancelled и current_stage_name=«Заход закрыт», локальный список больше не нужен.',
  },
  {
    screen: 'Первая встреча',
    field: 'Дата и время, итог, заметка, свои задачи',
    endpoint: 'PATCH /api/stage-instances/checklist/{valueId} у пункта meeting_date',
    missing: 'У этапа нет полей времени, итога встречи и своих задач. meeting_protocol принимает только текст не короче 40 знаков и не знает файл протокола.',
    temporary: 'На сервер это уже уходит живыми запросами, отдельных колонок нет. JSON v1 в value_text пункта meeting_date: time (шаг 15 минут), outcome (go_product | another_meeting | not_relevant), note, source, order, custom. value_date — день слота. Файл протокола — вложение этапа с attachment_kind = meeting_protocol. Если есть только файл, в meeting_protocol.value_text пишется фраза про файл длиннее 40 знаков, чтобы сервер принял пункт.',
  },
];

export const contactNoteEnvelope = {
  version: 1,
  sources: ['university_card', 'call', 'email', 'site', 'event', 'referral', 'other'],
  systemOrder: ['responsible', 'channel', 'role', 'primary', 'source'],
  requiredToClose: ['responsible', 'channel'],
} as const;
