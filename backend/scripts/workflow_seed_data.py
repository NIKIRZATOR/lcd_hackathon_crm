WORKFLOW_TEMPLATE = {
    "name": "RTK EduFlow Base Workflow",
    "description": "Official base workflow for RTK university interaction.",
    "version": "1",
    "is_default": True,
}

LEGACY_WORKFLOW_TEMPLATE_NAMES = {
    "Basic University Interaction",
}

WORKFLOW_STAGES = [
    {
        "name": "Поиск контактов ответственного в вузе",
        "order_index": 1,
        "is_initial": True,
        "default_duration_days": 3,
    },
    {
        "name": "Коммуникация и уточнение актуальности ИТ-программ",
        "order_index": 2,
        "default_duration_days": 5,
    },
    {
        "name": "Организация встречи с представителями вуза",
        "order_index": 3,
        "default_duration_days": 7,
    },
    {
        "name": "Обмен документами для подписания",
        "order_index": 4,
        "default_duration_days": 10,
        "requires_comment": True,
    },
    {
        "name": "Корректировка документов перед подписанием",
        "order_index": 5,
        "is_optional": True,
        "default_duration_days": 5,
    },
    {
        "name": "Подписание документов",
        "order_index": 6,
        "default_duration_days": 10,
        "requires_attachment": True,
    },
    {
        "name": "Передача обучающих материалов, лицензии и документации",
        "order_index": 7,
        "default_duration_days": 7,
    },
    {
        "name": "Сопровождение внедрения ИТ-продуктов",
        "order_index": 8,
        "default_duration_days": 14,
    },
    {
        "name": "Обучение преподавателей",
        "order_index": 9,
        "default_duration_days": 14,
    },
    {
        "name": "Актуализация учебной программы с учетом продукта",
        "order_index": 10,
        "default_duration_days": 14,
    },
    {
        "name": "Ведение занятий",
        "order_index": 11,
        "default_duration_days": 30,
    },
    {
        "name": "Актуализация документации и обучающих материалов",
        "order_index": 12,
        "default_duration_days": 10,
    },
    {
        "name": "Повышение квалификации преподавателей",
        "order_index": 13,
        "default_duration_days": 14,
    },
    {
        "name": "Контроль исполнения каждого этапа",
        "order_index": 14,
        "is_final": True,
        "default_duration_days": 5,
    },
]
