# Stage 5 — отчёт о готовности backend

## Реализовано

- Один расширенный integration contour: Fixture Adapter → нормализация → `IntegrationSignal` → сопоставление → metrics / Health / NBA.
- Коды источников: `WEBSITE`, `LMS`, `PAYMENT`, `B2C_USER`, `VENDOR_CATALOG`.
- Идемпотентная обработка загруженных файлов по примерам схем, vendor/product/contact upsert, B2C staging, course/stream mappings и ADMIN replay.
- ADMIN-only endpoints диагностики: источники, обработка файла, сигналы, raw signal, mappings и replay. Raw payload не возвращается обычным списком диагностики.
- В метрики добавлены payment-record count и timestamps каждого источника. Payment не меняет формулу Health.

## Проверка внешних данных

| Файл | Происхождение | Обрабатываемые поля | Сознательно исключённые поля |
| --- | --- | --- | --- |
| `Вендоры.xlsx` | пример схемы источника | vendor, отдельные products, contact, phone, email, канал связи | отсутствуют обязательные исключения для импорта каталога |
| `Загрузка пользователей.xlsx` | пример схемы источника | ФИО, хеш нормализованных email/phone, внешний ключ человека | СНИЛС, паспорт, адрес, дата рождения, образование, данные диплома |
| `Данные оплат.json` | пример схемы источника | номер заявки, курс, поток, минимальные хеши для matching | сумма, валюта, дата/статус платежа, provider и transaction id: этих данных в схеме нет |
| WEBSITE/LMS JSON | demo fixture команды | organization/product codes, event id/time и metrics | не представляются как данные заказчика |

Business keys для vendor и order — соответственно нормализованные vendor/product/contact значения и `PAYMENT + order number`. Повторная загрузка безопасно игнорируется. Order без явного course и stream mapping остаётся `unmatched`; он не создаёт ProgramInstance и не переводит workflow. Примеры в `local_docs` не монтируются в runtime backend: будущий UI загрузит входящий файл в `POST /api/integrations/sources/{source}/process`.

## Проверки

- Миграция Alembic `d8e9f0a1b2c3` применена к Docker PostgreSQL.
- Adapter tests покрывают схемы источников vendor, B2C user и payment: ячейку с несколькими продуктами, минимизацию PII и ведущий `null` в JSON.
- Целевые backend tests для upload-based adapters: 6 passed.

## Отложено по запросу

Не изменялись frontend diagnostics Stage 5, B2C widgets в Organization 360/Program Detail и frontend synchronization.
