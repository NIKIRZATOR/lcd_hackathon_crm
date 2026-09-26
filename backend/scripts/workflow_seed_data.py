WORKFLOW_TEMPLATE = {
    "name": "RTK EduFlow Full Cycle",
    "description": "Canonical 13-stage workflow for organizations without a framework contract.",
    "version": "2",
    "is_default": True,
}

LEGACY_WORKFLOW_TEMPLATE_NAMES = {"Basic University Interaction"}

WORKFLOW_STAGES = [
    {"name": "Поиск контакта", "order_index": 1, "is_initial": True, "default_duration_days": 3},
    {"name": "Первая встреча", "order_index": 2, "default_duration_days": 7},
    {"name": "Выявление потребности", "order_index": 3, "default_duration_days": 5},
    {"name": "Пакет документов", "order_index": 4, "default_duration_days": 10},
    {"name": "Подписание договора", "order_index": 5, "default_duration_days": 10},
    {"name": "Подписание лицензии", "order_index": 6, "default_duration_days": 10},
    {"name": "Передача и доступ к продукту", "order_index": 7, "default_duration_days": 7},
    {"name": "Обучение преподавателя", "order_index": 8, "default_duration_days": 14},
    {"name": "Подтверждение преподавателя", "order_index": 9, "default_duration_days": 7},
    {"name": "Учебный план", "order_index": 10, "default_duration_days": 14},
    {"name": "Старт занятий", "order_index": 11, "default_duration_days": 7},
    {"name": "Ведение занятий", "order_index": 12},
    {"name": "Итоги периода", "order_index": 13, "is_final": True, "default_duration_days": 7},
]
