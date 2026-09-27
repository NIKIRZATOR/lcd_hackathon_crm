# Интеграционный контур Stage 5

Production API кейсодержателем не предоставлен. В конкурсном контуре будущий UI передаёт полученный файл в Fixture Adapter через `POST /api/integrations/sources/{source}/process`. Файлы `local_docs/file_examples/Вендоры.xlsx`, `Загрузка пользователей.xlsx` и `Данные оплат.json` — примеры входных схем, а не runtime-источник. Team demo fixture `program_signals.json` используется только для WEBSITE/LMS demo и не является данными заказчика.

```text
загруженный файл → Fixture Adapter (или будущий HTTP adapter)
  → разбор / валидация / нормализация
  → IntegrationSignal
  → явное сопоставление
  → ProgramMetric → Health / NBA
```

Адаптеры не содержат бизнес-правил. Канонический сигнал хранит источник, внешний ключ, время приёма, процесс-статус, raw и normalized payload, ошибку и nullable program mapping. Повторный `source + external key` не создаёт повторный сигнал.

## Загрузка и доступ

UI выбирает источник (`WEBSITE`, `LMS`, `PAYMENT`, `B2C_USER` или `VENDOR_CATALOG`) и прикладывает файл. Backend помещает его во временное хранилище ровно на время разбора, после чего удаляет временный файл. Для `VENDOR_CATALOG`, `B2C_USER` и `PAYMENT` файл обязателен. WEBSITE/LMS без файла используют исключительно детерминированную team demo fixture.

Обработкой, просмотром диагностики, созданием mappings и replay управляет только `ADMIN`. Обычный список сигналов содержит нормализованные данные, статус, причину сопоставления и программу; raw payload доступен отдельным ADMIN endpoint. Это исключает передачу raw B2C PII KAM и MANAGER.

Источник `VENDOR_CATALOG` обновляет Vendor, Product и VendorContact по нормализованным business keys. Одна ячейка с несколькими продуктами становится несколькими продуктами.

Пользовательский XLSX читается полностью только адаптером. В operational payload остаются внешний ключ, ФИО для demo matching и хеши нормализованных email/телефона; СНИЛС, паспорт, адрес, дата рождения и диплом не переносятся. Raw payload доступен только ADMIN и не попадает в журналы событий.

`PAYMENT` означает нейтральный B2C order/enrollment signal. Наличие строки в переданном файле даёт одну запись источника для demo, но не означает денежную сумму, дату или успешный transaction status. `null` в JSON игнорируется. Связь с программой требует явных course и stream mappings; иначе сигнал остаётся `unmatched`. Unmatched — контролируемое состояние, которое ADMIN может сопоставить и replay без создания ProgramInstance или автоматического закрытия этапа.

## Сопоставление и статусы

1. `PAYMENT` связывается с B2C staging user по hash нормализованного email, затем по hash нормализованного телефона. ФИО используется лишь как дополнительная проверка.
2. Затем ищутся active course mapping и stream mapping. Только однозначное сопоставление даёт `mapped` ProgramInstance.
3. При отсутствии mapping создаётся `unmatched`, а не предположение о вузе или программе.
4. Повторная загрузка с тем же business key даёт `ignored`; ошибки разбора или обработки получают `error` и диагностический код.

ADMIN создаёт course mapping и stream mapping, затем запускает replay. Replay обрабатывает только ранее unmatched сигналы и пересчитывает затронутые `ProgramMetric`, Health и NBA. Он не создаёт ProgramInstance и не выполняет workflow transition.

Метрики программы: applications, payment records, students, streams и последние сигналы каждого источника. Payment не меняет формулу Health. Будущие `HttpWebsiteAdapter`, `HttpLmsAdapter` и `HttpPaymentAdapter` должны выдавать тот же `AdapterRecord`, поэтому business processing не меняется.

