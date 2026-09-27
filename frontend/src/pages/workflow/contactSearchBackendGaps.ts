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
    screen: 'Подписание договора',
    field: 'Статус, срок рамки, кто подписал',
    endpoint: 'PATCH /api/stage-instances/checklist/{valueId} у пункта contract_number и POST /api/organizations/{id}/contracts',
    missing: 'На этапе нет полей статуса подписания, срока рамки и подписанта. У договора площадки нет колонки «кто подписал».',
    temporary: 'JSON v1 в value_text пункта contract_number: number, status (sent | received | returned), validUntil, signer, order, custom. value_date пункта contract_signed_on — дата. Файл — вложение этапа signed_contract. is_done у трёх пунктов только когда статус received, номер, дата и файл есть. После закрытия POST /api/organizations/{id}/contracts пишет рамку: number, signed_on, valid_until, status=signed, attachment_id файла, comment=кто подписал. Возврат загружает новую версию в этап «Пакет документов» с kind project_contract.',
  },
  {
    screen: 'Подписание лицензии',
    field: 'Вендор, статус, дата, объём, лицензия родителя',
    endpoint: 'GET /api/program-instances/{id}, GET /api/it-products/{id}, GET /api/vendors/{id}, POST /api/organizations/{id}/licenses',
    missing: 'Нет ручки контакта вендора: в vendors есть только имя, контакт лежит в vendor_contacts без API. ProgramInstanceRead не отдаёт parent_program_id, поэтому продление не знает родителя. В чек-листе нет даты подписания, статуса и объёма.',
    temporary: 'Компания и продукт читаются через product_id захода. Контакт, почта и способ связи пустые, кнопка копирования почты скрыта. Если в ответе захода появится parent_program_id, номер и сроки берутся из GET /api/program-instances/{parent}/license. JSON v1 в license_number.value_text: number, status (requested | sent | received | returned), signedOn, volume, order, custom. Срок — value_date пункта license_valid_until. Файл — kind license. is_done только когда статус received и заполнены номер, дата, срок и файл. После закрытия POST лицензии на заход без product_access. Объём пишется в comment.',
  },
  {
    screen: 'Передача и доступ к продукту',
    field: 'Получатель, дата передачи, контакт вендора',
    endpoint: 'GET /api/program-instances/{id}/license и PATCH /api/licenses/{id}',
    missing: 'В чек-листе нет получателя и даты передачи. Контакта вендора по-прежнему нет в API. Пароль и стенд не заводятся.',
    temporary: 'JSON v1 в transfer_status.value_text: status (not_transferred | requested | transferred | revoked), recipientId, access, transferredOn, order, custom. Текст доступа дублируется в product_access.value_text. Файл — kind transfer. is_done только когда статус transferred, есть получатель, сведения, дата, файл и лицензия захода. После закрытия PATCH лицензии: transfer_status=transferred, product_access, transferred_on. Отозвана и отсутствие лицензии этап не закрывают.',
  },
  {
    screen: 'Обучение преподавателя',
    field: 'Формат, сертификат, срок квалификации',
    endpoint: 'GET/POST /api/organizations/{id}/teachers и PATCH /api/teachers/{id}',
    missing: 'У носителя нет файла сертификата и формата обучения. Пункт чек-листа teacher требует роль teacher: человек другой должности получит 422. Контакта вендора нет.',
    temporary: 'JSON v1 в value_text пункта teacher: status (planned | trained | active | left), personId, format (vendor | school | certificate), trainedOn, qualificationUntil, order, custom. Дата дублируется в trained_on.value_date. Сертификат — файл этапа kind certificate. Старый сертификат — уже существующий носитель этого продукта со статусом trained или active. is_done только когда выбран человек, статус trained/active, есть дата и файл или старый сертификат. После закрытия создаётся или обновляется носитель. К обучению и Ушёл этап не закрывают.',
  },
  {
    screen: 'Подтверждение преподавателя',
    field: 'Готовность, причина, окно, отметка площадки',
    endpoint: 'GET /api/organizations/{id}/teachers, GET /api/program-instances/{id}/license, GET /api/academic-windows',
    missing: 'На этапе один текст teacher_ready. Нет смены окна захода отдельным полем PATCH. Отметка площадки не является пунктом чек-листа.',
    temporary: 'JSON v1 в teacher_ready.value_text: ready (yes | no), reason, windowId, order, custom. Носитель, дата, срок и статус читаются из teacher_carriers этого продукта. Сертификат — файл этапа обучения kind certificate. Доступ — product_access лицензии захода. Окно по умолчанию academic_window_id захода. is_done только когда готовность yes, носитель есть, статус active, квалификация не истекла и окно выбрано. Файл отметки kind site_mark необязателен. Человека на этом этапе не меняют.',
  },
  {
    screen: 'Учебный план',
    field: 'Окно, комментарий, файлы',
    endpoint: 'GET /api/academic-windows, GET /api/program-instances/{id}/license, GET /api/organizations/{id}/teachers',
    missing: 'На этапе один текст curriculum. Сервер не требует 40 знаков у этого пункта и не хранит файл плана отдельным пунктом чек-листа. Смена academic_window_id захода с этапа не пишется.',
    temporary: 'JSON v1 в curriculum.value_text: comment, windowId, order, custom. Окно по умолчанию — окно захода. Срок плитки становится plan_cutoff_on выбранного окна. План — файл kind plan, только pdf/doc/docx/xls/xlsx. Отметка — kind site_mark, не блокирует. Шаблон, если GET /api/document-templates вернёт kind plan. is_done только когда носитель active, доступ передан и есть файл плана или комментарий от 40 знаков.',
  },
  {
    screen: 'Старт занятий',
    field: 'Подтверждение и комментарий',
    endpoint: 'GET /api/integrations/program-instances/{id}/metrics',
    missing: 'В чек-листе нет комментария и файла расписания. Метрика не закрывает этап.',
    temporary: 'Дата — classes_started_on.value_date, по умолчанию classes_start_on окна. JSON v1 в classes_started.value_text: confirmed, comment, order, custom. Баннер читает students_count и last_lms_signal_at, иначе last_website_signal_at. Если метрики нет, баннер красный и комментарий обязателен. Комментарий также обязателен при сдвиге даты больше 7 дней от начала окна или если дата сигнала расходится со стартом больше чем на 7 дней. Файл kind schedule не блокирует. is_done только при носителе active, переданном доступе, закрытом плане, дате и ручном подтверждении.',
  },
  {
    screen: 'Ведение занятий',
    field: 'Статус потока, комментарий, замена преподавателя',
    endpoint: 'GET /api/integrations/program-instances/{id}/metrics',
    missing: 'У этапа нет пунктов чек-листа. Нет процесса замены преподавателя.',
    temporary: 'Статус (ok | issues | failed), комментарий, флаг замены и свои задачи лежат в localStorage rtk-eduflow:classes-running:{stageId}. Сигнал: students_count и last_lms_signal_at, иначе last_website_signal_at. Нет метрики — красный сигнал и тишина без срока. Успешное закрытие не проходит при 0 студентов и тишине дольше 30 дней. Кнопка замены только ставит флаг и не закрывает этап. Файл kind class_note не блокирует.',
  },
  {
    screen: 'Итоги периода',
    field: 'Снимок, вердикт, следующий заход',
    endpoint: 'GET /api/integrations/program-instances/{id}/metrics и POST /api/organizations/{id}/program-instances',
    missing: 'Снимок не хранится отдельной таблицей. Карточка площадки не читает родителя из адреса, поэтому кнопка «что дальше» не открывает мастер с уже выбранным плейбуком.',
    temporary: 'JSON v1 в period_result.value_text фиксирует snapshot один раз: students, applications, licenseUntil, carrierStatus, signalAt, плюс verdict, reason, comment, order, custom. Повторный заход на этап не перечитывает LMS. Предложения не создают заход. Клик пишет rtk-eduflow:next-program в sessionStorage и открывает карточку площадки. Завершение идёт обычным закрытием финального этапа: статус захода становится completed, возврат назад закрыт.',
  },
  {
    screen: 'Контроль исполнения',
    field: 'Лента сигналов',
    endpoint: 'нет этапа в маршруте захода',
    missing: 'Сервер не создаёт этап контроля и не отдаёт ленту сигналов, причину штрафа здоровья и отметки «принято / в работе».',
    temporary: 'Шаг рисуется последним в пути на клиенте и не закрывается. Сигналы считаются из сроков этапов, здоровья, носителя, лицензии, доступа, метрик и второго живого захода. Отметки и комментарии ленты лежат в localStorage rtk-eduflow:control:{programId}. После статуса completed лента замораживается. Продление не создаёт заход, только открывает площадку.',
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
