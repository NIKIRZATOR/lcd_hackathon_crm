RTK_DEFAULT_MAPPING_NAME = "RTK_DEFAULT_V1"

RTK_DEFAULT_FIELDS = [
    {"source_column": "Название ВУЗа", "target_field": "university.name", "required": True},
    {"source_column": "Вендор", "target_field": "vendor.name", "required": True},
    {"source_column": "ПО", "target_field": "product.name", "required": True},
    {"source_column": "Номер договора", "target_field": "contract.number", "required": False},
    {"source_column": "Подписание лицензии", "target_field": "license.signed_at", "required": False},
    {"source_column": "Срок действия лицензии (год)", "target_field": "license.valid_until", "required": False},
    {"source_column": "Статус по передачи", "target_field": "license.transfer_status", "required": False},
    {"source_column": "ФИО Менеджера", "target_field": "manager.full_name", "required": False},
    {"source_column": "Ответственные от ВУЗа", "target_field": "university_contact.full_name", "required": False},
    {"source_column": "Комментарий", "target_field": "interaction.comment", "required": False},
]
