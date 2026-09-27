import json
from pathlib import Path

from openpyxl import Workbook

from app.modules.integrations.adapters import (
    normalize_email,
    normalize_phone,
    parse_b2c_user_fixture,
    parse_payment_fixture,
    parse_vendor_fixture,
    split_products,
)


def _xlsx(path: Path, headers: list[str], rows: list[list[object]]) -> Path:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    return path


def test_vendor_fixture_splits_multi_product_cell(tmp_path: Path) -> None:
    path = _xlsx(
        tmp_path / "vendors.xlsx",
        ["Компания", "Продукт", "ФИО", "Телефон", "Почта", "Способ связи"],
        [
            [
                "ООО «ТДата»",
                "«RT.DataLake», «RT.Warehouse»",
                "Смирнова Анна",
                "+7 (911) 222-33-44",
                "contact@example.ru",
                "Чат",
            ]
        ],
    )
    records = parse_vendor_fixture(path)

    assert len(records) == 2
    assert {record.normalized_payload["product_name"] for record in records} == {
        "RT.DataLake",
        "RT.Warehouse",
    }
    assert split_products("«RT.DataLake», «RT.Warehouse»") == [
        "RT.DataLake",
        "RT.Warehouse",
    ]


def test_b2c_user_fixture_minimizes_operational_payload(tmp_path: Path) -> None:
    path = _xlsx(
        tmp_path / "users.xlsx",
        [
            "Фамилия",
            "Имя",
            "Отчествопри наличии)",
            "Номер телефона",
            "Email",
            "СНИЛС",
            "Номер паспорта",
        ],
        [
            [
                "Иванов",
                "Иван",
                "Иванович",
                "79990000000",
                "user@example.ru",
                "secret",
                "secret",
            ]
        ],
    )
    records = parse_b2c_user_fixture(path)

    assert len(records) == 1
    payload = records[0].normalized_payload
    assert {"external_person_key", "full_name", "email_hash", "phone_hash"} == set(
        payload
    )
    assert "СНИЛС" not in payload and "Номер паспорта" not in payload


def test_payment_fixture_ignores_leading_null_and_has_stable_order_keys(
    tmp_path: Path,
) -> None:
    path = tmp_path / "payments.json"
    path.write_text(
        json.dumps(
            [
                None,
                {
                    "Номер заявки": "ORD-1",
                    "Курс": "Курс",
                    "Фамилия": "Иванов",
                    "Имя": "Иван",
                    "Телефон": "79990000000",
                    "Email": "user@example.ru",
                    "Номер потока": 1,
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    records = parse_payment_fixture(path)

    assert len(records) == 1
    assert len({record.external_key for record in records}) == 1
    assert all(record.source == "PAYMENT" for record in records)
    assert all("amount" not in record.normalized_payload for record in records)


def test_email_and_phone_normalization_are_deterministic() -> None:
    assert normalize_email(" User@Example.Ru ") == "user@example.ru"
    assert normalize_phone("8 (999) 023-43-65") == "79990234365"
