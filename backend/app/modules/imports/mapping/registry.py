from dataclasses import dataclass


@dataclass(frozen=True)
class TargetField:
    key: str
    label: str
    type: str
    required: bool
    entity: str


TARGET_FIELDS: tuple[TargetField, ...] = (
    TargetField("university.name", "Название ВУЗа", "string", True, "university"),
    TargetField("vendor.name", "Вендор", "string", True, "vendor"),
    TargetField("product.name", "ПО", "string", True, "product"),
    TargetField("direction.name", "ИТ-направление", "string", False, "direction"),
    TargetField("program.name", "ИТ-программа", "string", False, "program"),
    TargetField("contract.number", "Номер договора", "string", False, "interaction"),
    TargetField("license.signed_at", "Подписание лицензии", "date", False, "interaction"),
    TargetField("license.valid_until", "Срок действия лицензии", "date_or_year", False, "interaction"),
    TargetField("license.transfer_status", "Статус по передачи", "string", False, "interaction"),
    TargetField("manager.full_name", "ФИО Менеджера", "string", False, "manager"),
    TargetField("manager.email", "Email менеджера", "string", False, "manager"),
    TargetField("university_contact.full_name", "Ответственные от ВУЗа", "string", False, "contact"),
    TargetField("interaction.comment", "Комментарий", "string", False, "interaction"),
)

TARGET_FIELD_BY_KEY = {field.key: field for field in TARGET_FIELDS}
REQUIRED_TARGETS = {field.key for field in TARGET_FIELDS if field.required}


def normalize_text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalized_key(value: object | None) -> str | None:
    text = normalize_text(value)
    return text.casefold() if text else None
