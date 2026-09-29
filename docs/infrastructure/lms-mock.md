# Mock LMS — DEMO / STUB

Этот контур показывает двустороннюю интеграцию по настоящим HTTP-запросам:

```text
CRM → Mock LMS → callback CRM → integrations pipeline → метрики программы
```

Mock LMS — учебный сервис. Он не является интеграцией с реальной LMS кейсодержателя.

## Что происходит

1. Администратор передаёт ProgramInstance в Mock LMS.
2. CRM отправляет программу, организацию, поток и доступные даты по HTTP.
3. Mock LMS возвращает внешний идентификатор вида `LMS-xxxxxxxx`.
4. CRM сохраняет LMS ID, статус `SYNCED` и время синхронизации в ProgramInstance.
5. Из «Управление → Интеграции» можно отправить demo-событие в Mock LMS.
6. Mock LMS делает HTTP callback в CRM: `POST /api/integrations/lms/events`.
7. CRM сохраняет raw и normalized signal, сопоставляет его с ProgramInstance, обновляет число студентов и создаёт audit event.

Поддерживаются события `STUDENT_ENROLLED`, `COURSE_STARTED` и `COURSE_COMPLETED`.

## Настройка и запуск

В `.env.example` для тестового запуска должны быть заданы:

```env
LMS_MOCK_ENABLED=true
LMS_BASE_URL=http://mock-lms:8080
LMS_SERVICE_TOKEN=replace-with-a-test-token
MOCK_LMS_PORT=8090
```

Запуск в текущем локальном окружении:

```powershell
docker compose -p lcd_hackathon_crm --env-file .env.example --profile mock-lms up -d --build
```

Проверка доступности Mock LMS:

```powershell
Invoke-RestMethod http://localhost:8090/api/health
```

Ожидаемый результат:

```json
{"status":"ok","service":"mock-lms"}
```

## Проверка через интерфейс

### 1. CRM → LMS

1. Войдите под ADMIN.
2. Откройте «Организации» и карточку нужной организации.
3. На вкладке «Программы» найдите строку нужной программы.
4. В правой колонке `LMS` нажмите «Передать в LMS».
5. Дождитесь сообщения «Программа передана в Mock LMS».

В этой же строке появятся зелёный статус `SYNCED`, LMS ID и время синхронизации в подсказке статуса. Повторная кнопка называется «Обновить в LMS».

### 2. LMS → CRM

1. Откройте «Управление → Интеграции».
2. В блоке `LMS · DEMO / STUB` выберите ту же организацию, в которой программа была передана в LMS.
3. В поле «Программа в LMS» выберите переданную программу.
4. Выберите `STUDENT_ENROLLED` и количество студентов, например `35`.
5. Нажмите «Сымитировать событие LMS».

После успешного callback появится уведомление. В нижней таблице «Сигналы» появится LMS-сигнал со статусом `mapped`; на странице организации в столбце «Студенты» будет обновлено число.

## Как интерпретировать результат

| Наблюдение | Ожидаемое значение |
| --- | --- |
| Отправка программы | `SYNCED`, LMS ID, время синхронизации |
| Событие известной программы | signal `mapped`, обновлены студенты |
| Повтор одного `event_id` | signal `ignored`, данные не меняются |
| Неизвестный LMS ID | signal `unmatched`, данные программы не меняются |
| Неверный service token | HTTP `401` |
| Mock LMS недоступен | статус отправки программы `FAILED` |

## Как проверить idempotency и unmatched вручную

Для обычной демонстрации UI генерирует новый `event_id`, поэтому достаточно проверить `mapped`. Повтор и unmatched можно проверить HTTP-запросами к Mock LMS с тем же сервисным токеном:

```powershell
$headers = @{ 'X-LMS-Service-Token' = 'replace-with-a-test-token' }
$body = @{ event_id = 'demo-repeat-001'; external_program_id = 'LMS-xxxxxxxx'; type = 'STUDENT_ENROLLED'; student_count = 35 } | ConvertTo-Json
Invoke-RestMethod http://localhost:8090/api/demo/events -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

Повторите команду без изменения `event_id`: в ответе CRM будет `ignored`. Для `unmatched` замените `external_program_id` на несуществующий, например `LMS-unknown`.

## Если что-то не видно или не работает

- Нет кнопки `LMS` — выполните `Ctrl+F5`: frontend запущен в режиме разработки и должен подхватить изменения.
- В выпадающем списке «Программа в LMS» пусто — выбрана не та организация либо программу ещё не передали в LMS. Список намеренно показывает только переданные программы.
- Ошибка «Mock LMS недоступен» — проверьте `/api/health`, `LMS_MOCK_ENABLED=true` и профиль `mock-lms`.
- Логотипы или файлы отдают `500` — для Docker в `.env.example` должен быть `S3_ENDPOINT=minio:9000`, а не `localhost:9000`.

## Безопасность и ограничение контура

Все server-to-server запросы используют `X-LMS-Service-Token`. Demo-токен в `.env.example` не является секретом и допустим только локально. Для production нужен отдельный секрет и отключённый mock-профиль; этот документ не описывает подключение к реальной LMS.
