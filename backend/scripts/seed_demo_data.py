from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal
from app.modules.contacts.model import UniversityContact
from app.modules.products.model import ITProduct, ProgramProduct, Vendor
from app.modules.programs.model import ITDirection, ITProgram
from app.modules.universities.model import University
from app.modules.interactions.model import UniversityInteraction
from app.modules.licenses.model import Contract, License
from app.modules.teachers.model import TeacherCarrier
from app.modules.organizations.model import OrgAssignment, Organization, OrganizationType, Stakeholder
from app.modules.program_instances.model import AcademicWindow, ProgramInstance
from app.modules.program_instances.service import ProgramInstanceService
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.health.service import HealthService
from app.modules.integrations.service import IntegrationSyncService
from app.modules.integrations.model import ExternalCourseMapping, ExternalStreamMapping, IntegrationSignal
from app.modules.nba.service import NbaService
from app.modules.users.model import ManagerMembership, Role, User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTemplate, WorkflowTransition, WorkflowVersion
from app.modules.workflows.service import WorkflowRuntimeService
from scripts.workflow_seed_data import LEGACY_WORKFLOW_TEMPLATE_NAMES, WORKFLOW_STAGES, WORKFLOW_TEMPLATE


SHORT_PLAYBOOKS = {
    "expansion": ["identify_need", "document_package", "sign_license", "transfer_access", "train_teacher", "confirm_teacher", "curriculum", "start_classes", "classes_running", "period_results"],
    "license_renewal": ["sign_license", "transfer_access", "confirm_teacher", "curriculum", "start_classes", "classes_running", "period_results"],
    "teacher_replace": ["find_teacher", "train_teacher", "confirm_teacher", "handover_course"],
    "school_short": ["find_contact", "identify_need", "document_package", "sign_license", "transfer_access", "train_teacher", "curriculum", "start_classes", "classes_running", "period_results"],
}


UNIVERSITIES = [
    {
        "name": "Московский государственный университет имени М.В. Ломоносова",
        "short_name": "МГУ",
        "region": "Москва",
        "city": "Москва",
        "address": "Ленинские горы, д. 1",
        "website": "https://www.msu.ru",
    },
    {
        "name": "Национальный исследовательский университет ИТМО",
        "short_name": "ИТМО",
        "region": "Санкт-Петербург",
        "city": "Санкт-Петербург",
        "address": "Кронверкский проспект, д. 49, лит. А",
        "website": "https://itmo.ru",
    },
    {
        "name": "Национальный исследовательский университет «Высшая школа экономики»",
        "short_name": "НИУ ВШЭ",
        "region": "Москва",
        "city": "Москва",
        "address": "ул. Мясницкая, д. 20",
        "website": "https://www.hse.ru",
    },
    {
        "name": "Московский государственный технический университет имени Н.Э. Баумана",
        "short_name": "МГТУ",
        "region": "Москва",
        "city": "Москва",
        "address": "ул. 2-я Бауманская, д. 5, стр. 1",
        "website": "https://bmstu.ru",
    },
    {
        "name": "Московский физико-технический институт",
        "short_name": "МФТИ",
        "region": "Московская область",
        "city": "Долгопрудный",
        "address": "Институтский переулок, д. 9",
        "website": "https://mipt.ru",
    },
    {
        "name": "Новосибирский национальный исследовательский государственный университет",
        "short_name": "НГУ",
        "region": "Новосибирская область",
        "city": "Новосибирск",
        "address": "ул. Пирогова, д. 1",
        "website": "https://www.nsu.ru",
    },
    {
        "name": "Национальный исследовательский Томский государственный университет",
        "short_name": "ТГУ",
        "region": "Томская область",
        "city": "Томск",
        "address": "проспект Ленина, д. 36",
        "website": "https://www.tsu.ru",
    },
    {
        "name": "Национальный исследовательский Томский политехнический университет",
        "short_name": "ТПУ",
        "region": "Томская область",
        "city": "Томск",
        "address": "проспект Ленина, д. 30",
        "website": "https://tpu.ru",
    },
    {
        "name": "Казанский (Приволжский) федеральный университет",
        "short_name": "КФУ",
        "region": "Республика Татарстан",
        "city": "Казань",
        "address": "ул. Кремлевская, д. 18",
        "website": "https://kpfu.ru",
    },
    {
        "name": "Уральский федеральный университет имени первого Президента России Б.Н. Ельцина",
        "short_name": "УрФУ",
        "region": "Свердловская область",
        "city": "Екатеринбург",
        "address": "ул. Мира, д. 19",
        "website": "https://urfu.ru",
    },
]

DIRECTIONS = [
    {"name": "DevOps и инфраструктура", "code": "DEVOPS", "description": "CI/CD, Linux, контейнеризация и эксплуатация."},
    {"name": "Тестирование ПО", "code": "QA", "description": "Ручное и автоматизированное тестирование, SQL и Python."},
    {"name": "Python-разработка", "code": "PYTHON", "description": "Разработка приложений и сервисов на Python."},
    {"name": "Аналитика данных", "code": "DATA", "description": "Python, BI, визуализация, машинное обучение и аналитика."},
    {"name": "UX/UI-дизайн", "code": "UXUI", "description": "Проектирование пользовательских интерфейсов и дизайн-систем."},
    {"name": "Управление ИТ-проектами", "code": "PM", "description": "Управление ИТ-проектами и цифровыми продуктами."},
    {"name": "Информационная безопасность", "code": "INFOSEC", "description": "Основы защиты информации, риски и безопасный доступ."},
    {"name": "Low-code / no-code разработка", "code": "LOWCODE", "description": "Веб-разработка и аналитика на платформенных решениях."},
    {"name": "Искусственный интеллект", "code": "AI", "description": "LLM, промпт-инжиниринг и прикладное использование ИИ."},
]

PROGRAMS = [
    {"direction_code": "DEVOPS", "name": "DevOps-инженер с нуля", "version": "2026"},
    {"direction_code": "QA", "name": "Инженер-тестировщик", "version": "2026"},
    {"direction_code": "PYTHON", "name": "Python-разработчик с использованием инструментов ИИ", "version": "2026"},
    {"direction_code": "DATA", "name": "Специалист по анализу данных", "version": "2026"},
    {"direction_code": "DATA", "name": "Анализ данных без программирования", "version": "2026"},
    {"direction_code": "UXUI", "name": "Основы UX/UI-дизайна", "version": "2026"},
    {"direction_code": "AI", "name": "Промпт-инжиниринг", "version": "2026"},
    {"direction_code": "PM", "name": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»", "version": "2026"},
    {"direction_code": "LOWCODE", "name": "Веб-разработка на платформе «Акола»", "version": "2026"},
    {"direction_code": "INFOSEC", "name": "Введение в информационную безопасность", "version": "2026"},
]

VENDORS = [
    {
        "name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "description": "Оператор образовательных программ ИТ Школы Ростелеком.",
    },
    {
        "name": "ПАО «Ростелеком»",
        "description": "Технологический партнер и владелец решений экосистемы Ростелекома.",
    },
    {
        "name": "Президентская академия РАНХиГС",
        "description": "Образовательный партнер программ ИТ Школы Ростелеком.",
    },
]

PRODUCTS = [
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "DevOps-инженер с нуля",
        "description": "Образовательная программа ИТ Школы Ростелеком по DevOps.",
        "documentation_url": "https://edu-rt.ru/course/DevOps",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Инженер-тестировщик",
        "description": "Программа по тестированию ПО: QA, SQL, Python и автоматизация.",
        "documentation_url": "https://edu-rt.ru/course/inzhener-testirovshhik",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Python-разработчик с использованием инструментов ИИ",
        "description": "Программа по Python-разработке с использованием ИИ-инструментов.",
        "documentation_url": "https://edu-rt.ru/course/python-razrabotcik-s-ispolzovaniem-instrumentov-ii",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Специалист по анализу данных",
        "description": "Python, BI, визуализация, машинное обучение и аналитика больших данных.",
        "documentation_url": "https://edu-rt.ru/course/specialist-po-analizu-dannyx",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Анализ данных без программирования",
        "description": "Low-code/no-code аналитика, BI-платформы и визуализация данных.",
        "documentation_url": "https://edu-rt.ru/course/analiz-dannykh-bez-programmirovaniya",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Основы UX/UI-дизайна",
        "description": "Программа по UX/UI, прототипированию, дизайн-системам и метрикам.",
        "documentation_url": "https://edu-rt.ru/course/osnovy-uxui-dizaina",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Промпт-инжиниринг",
        "description": "Программа по работе с LLM, промптами и прикладными ИИ-сценариями.",
        "documentation_url": "https://edu-rt.ru/course/prompt-inziniring",
    },
    {
        "vendor_name": "ПАО «Ростелеком»",
        "name": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "description": "Программа управления ИТ-проектами на базе решений Ростелекома.",
        "documentation_url": "https://edu-rt.ru/course/upravlenie-it-proektami-na-baze-programmnogo-produkta-pao-rostelekom",
    },
    {
        "vendor_name": "ПАО «Ростелеком»",
        "name": "Веб-разработка на платформе «Акола»",
        "description": "Программа платформенной web-разработки на low-code/no-code решении «Акола».",
        "documentation_url": "https://edu-rt.ru/course/veb-razrabotka-na-platforme-akola",
    },
    {
        "vendor_name": "ООО «РТК ИТ» / ИТ Школа Ростелеком",
        "name": "Введение в информационную безопасность",
        "description": "Программа по основам информационной безопасности и управлению рисками.",
        "documentation_url": "https://edu-rt.ru/course",
    },
]

PROGRAM_PRODUCTS = [
    ("DevOps-инженер с нуля", "DevOps-инженер с нуля", True),
    ("Инженер-тестировщик", "Инженер-тестировщик", True),
    ("Python-разработчик с использованием инструментов ИИ", "Python-разработчик с использованием инструментов ИИ", True),
    ("Специалист по анализу данных", "Специалист по анализу данных", True),
    ("Анализ данных без программирования", "Анализ данных без программирования", True),
    ("Основы UX/UI-дизайна", "Основы UX/UI-дизайна", True),
    ("Промпт-инжиниринг", "Промпт-инжиниринг", True),
    ("Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»", "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»", True),
    ("Веб-разработка на платформе «Акола»", "Веб-разработка на платформе «Акола»", True),
    ("Введение в информационную безопасность", "Введение в информационную безопасность", True),
]

ROLES = {
    "KAM": "University account manager",
    "MANAGER": "Manager lead",
    "ADMIN": "Platform administrator",
}

USERS = [
    {
        "username": "kam1",
        "full_name": "Анна Крылова",
        "email": "kam1@example.local",
        "roles": ["KAM"],
    },
    {
        "username": "kam2",
        "full_name": "Илья Соколов",
        "email": "kam2@example.local",
        "roles": ["KAM"],
    },
    {
        "username": "manager1",
        "full_name": "Мария Орлова",
        "email": "manager1@example.local",
        "roles": ["MANAGER"],
    },
    {
        "username": "admin1",
        "full_name": "Алексей Власов",
        "email": "admin1@example.local",
        "roles": ["ADMIN"],
    },
    {
        "username": "kam3",
        "full_name": "Елена Морозова",
        "email": "kam3@example.local",
        "roles": ["KAM"],
    },
    {
        "username": "kam4",
        "full_name": "Дмитрий Волков",
        "email": "kam4@example.local",
        "roles": ["KAM"],
    },
]

MANAGER_MEMBERSHIPS = [
    ("manager1", "kam1"),
    ("manager1", "kam2"),
    ("manager1", "kam3"),
    ("manager1", "kam4"),
]

INTERACTIONS = [
    {
        "university": "МГУ",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-MSU-2026-001",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Центр развития цифровых компетенций (демо-контакт)",
        "comment": "Зрелое партнерство: материалы и лицензия переданы, программа запущена.",
    },
    {
        "university": "ИТМО",
        "program": "Специалист по анализу данных",
        "product": "Специалист по анализу данных",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-ITMO-2026-002",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Офис образовательных программ (демо-контакт)",
        "comment": "Активная программа по аналитике данных; используется для демонстрации LMS-метрик.",
    },
    {
        "university": "НИУ ВШЭ",
        "program": "Анализ данных без программирования",
        "product": "Анализ данных без программирования",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-HSE-2026-003",
        "license_signed": False,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Учебный офис (демо-контакт)",
        "comment": "Документы согласуются, передача материалов начата.",
    },
    {
        "university": "МГТУ",
        "program": "Инженер-тестировщик",
        "product": "Инженер-тестировщик",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-BMSTU-2026-004",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Кафедра информационных систем (демо-контакт)",
        "comment": "Программа QA находится на этапе внедрения в учебный процесс.",
    },
    {
        "university": "МФТИ",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-MIPT-2026-005",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Учебный департамент (демо-контакт)",
        "comment": "Программа запущена; хороший кейс для нескольких потоков и высокого спроса.",
    },
    {
        "university": "НГУ",
        "program": "Введение в информационную безопасность",
        "product": "Введение в информационную безопасность",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-NSU-2026-006",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Учебно-методическое управление (демо-контакт)",
        "comment": "Ранний этап: контакт подтвержден, договор и лицензия еще не оформлены.",
    },
    {
        "university": "ТГУ",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-TSU-2026-007",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт прикладной математики и компьютерных наук (демо-контакт)",
        "comment": "Новый продукт в действующем партнерстве; подходит для сценария expansion.",
    },
    {
        "university": "ТПУ",
        "program": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "product": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-TPU-2026-008",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Бизнес-школа ТПУ (демо-контакт)",
        "comment": "Лицензия подписана, материалы передаются; можно показать риск по SLA.",
    },
    {
        "university": "КФУ",
        "program": "Основы UX/UI-дизайна",
        "product": "Основы UX/UI-дизайна",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-KFU-2026-009",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт информационных технологий (демо-контакт)",
        "comment": "Стабильная программа с действующей лицензией.",
    },
    {
        "university": "УрФУ",
        "program": "Веб-разработка на платформе «Акола»",
        "product": "Веб-разработка на платформе «Акола»",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-URFU-2026-010",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт радиоэлектроники и информационных технологий (демо-контакт)",
        "comment": "Платформенный продукт уже передан; сценарий для контроля факта обучения.",
    },
    {
        "university": "ИТМО",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-ITMO-2026-011",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Факультет инфокоммуникационных технологий (демо-контакт)",
        "comment": "Вторая программа в одном вузе — демонстрирует корректную модель University 360.",
    },
    {
        "university": "НИУ ВШЭ",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "DEMO-RTK-HSE-2026-012",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Учебный офис (демо-контакт)",
        "comment": "Вторая программа в одном вузе, находящаяся на более раннем этапе.",
    },
]


def get_by_field[T](db: Session, model: type[T], field: str, value: object) -> T | None:
    return db.scalar(select(model).where(getattr(model, field) == value))


def seed_universities(db: Session) -> dict[str, University]:
    result = {}
    for data in UNIVERSITIES:
        university = get_by_field(db, University, "name", data["name"])
        if university is None:
            university = University(**data, is_active=True)
            db.add(university)
            db.flush()
        result[data["short_name"]] = university
    return result


def seed_contacts(db: Session, universities: dict[str, University]) -> None:
    # Публичные организационные контакты. Не используем вымышленные персональные e-mail реальных людей.
    contacts = [
        ("МГУ", "Учебный отдел ВМК МГУ", "Профильный публичный контакт", "edu@cs.msu.su"),
        ("ИТМО", "Канцелярия Университета ИТМО", "Общий контакт университета", "od@itmo.ru"),
        ("НИУ ВШЭ", "Единая справочная НИУ ВШЭ", "Общий контакт университета", "hse@hse.ru"),
        ("МГТУ", "Кафедра ИУ-3 МГТУ им. Н.Э. Баумана", "Профильный публичный контакт", "iu3@bmstu.ru"),
        ("МФТИ", "Приёмная комиссия МФТИ", "Общий контакт университета", "pk@mipt.ru"),
        ("НГУ", "Приёмная комиссия НГУ", "Общий контакт университета", "priem@nsu.ru"),
        ("ТГУ", "Приёмная ТГУ", "Общий контакт университета", "rector@tsu.ru"),
        ("ТПУ", "Приёмная комиссия ТПУ", "Общий контакт университета", "abiturient@tpu.ru"),
        ("КФУ", "Управление документооборота КФУ", "Общий контакт университета", "public.mail@kpfu.ru"),
        ("УрФУ", "Техническая поддержка УрФУ", "Публичный организационный контакт", "support@urfu.ru"),
    ]
    for short_name, full_name, position, email in contacts:
        contact = get_by_field(db, UniversityContact, "email", email)
        if contact is None:
            db.add(
                UniversityContact(
                    university_id=universities[short_name].id,
                    full_name=full_name,
                    position=position,
                    email=email,
                    is_primary=True,
                    is_active=True,
                    comment="Публичный организационный контакт; источник — официальный сайт вуза.",
                )
            )


def seed_directions(db: Session) -> dict[str, ITDirection]:
    result = {}
    for data in DIRECTIONS:
        direction = get_by_field(db, ITDirection, "code", data["code"])
        if direction is None:
            direction = ITDirection(**data, is_active=True)
            db.add(direction)
            db.flush()
        result[data["code"]] = direction
    return result


def seed_programs(db: Session, directions: dict[str, ITDirection]) -> dict[str, ITProgram]:
    result = {}
    for data in PROGRAMS:
        program = get_by_field(db, ITProgram, "name", data["name"])
        if program is None:
            program = ITProgram(
                direction_id=directions[data["direction_code"]].id,
                name=data["name"],
                version=data["version"],
                is_active=True,
            )
            db.add(program)
            db.flush()
        result[data["name"]] = program
    return result


def seed_vendors(db: Session) -> dict[str, Vendor]:
    result = {}
    for data in VENDORS:
        vendor = get_by_field(db, Vendor, "name", data["name"])
        if vendor is None:
            vendor = Vendor(**data, is_active=True)
            db.add(vendor)
            db.flush()
        result[data["name"]] = vendor
    return result


def seed_products(db: Session, vendors: dict[str, Vendor]) -> dict[str, ITProduct]:
    result = {}
    for data in PRODUCTS:
        product = get_by_field(db, ITProduct, "name", data["name"])
        if product is None:
            product = ITProduct(
                vendor_id=vendors[data["vendor_name"]].id,
                name=data["name"],
                description=data["description"],
                documentation_url=data["documentation_url"],
                is_active=True,
            )
            db.add(product)
            db.flush()
        result[data["name"]] = product
    return result


def seed_program_products(
    db: Session,
    programs: dict[str, ITProgram],
    products: dict[str, ITProduct],
) -> None:
    for program_name, product_name, is_required in PROGRAM_PRODUCTS:
        program = programs[program_name]
        product = products[product_name]
        exists = db.scalar(
            select(ProgramProduct).where(
                ProgramProduct.program_id == program.id,
                ProgramProduct.product_id == product.id,
            )
        )
        if exists is None:
            db.add(
                ProgramProduct(
                    program_id=program.id,
                    product_id=product.id,
                    is_required=is_required,
                )
            )


def seed_roles(db: Session) -> dict[str, Role]:
    result = {}
    for name, description in ROLES.items():
        role = get_by_field(db, Role, "name", name)
        if role is None:
            role = Role(name=name, description=description)
            db.add(role)
            db.flush()
        result[name] = role
    return result


def seed_users(db: Session, roles: dict[str, Role]) -> dict[str, User]:
    result = {}
    for data in USERS:
        user = get_by_field(db, User, "username", data["username"])
        local_roles = [roles[name] for name in data["roles"]]
        if user is None:
            user = User(
                username=data["username"],
                full_name=data["full_name"],
                email=data["email"],
                role=local_roles[0].name,
                is_active=True,
                roles=local_roles,
            )
            db.add(user)
            db.flush()
        else:
            user.full_name = data["full_name"]
            user.email = data["email"]
            user.role = local_roles[0].name
            user.is_active = True
            user.roles = local_roles
        result[data["username"]] = user
    return result


def seed_workflow(db: Session, users: dict[str, User]) -> WorkflowTemplate:
    creator = users["admin1"]
    template = get_by_field(db, WorkflowTemplate, "name", WORKFLOW_TEMPLATE["name"])
    if template is None:
        template = db.scalar(
            select(WorkflowTemplate).where(WorkflowTemplate.name.in_(LEGACY_WORKFLOW_TEMPLATE_NAMES))
        )
    if template is None:
        template = WorkflowTemplate(**WORKFLOW_TEMPLATE, created_by=creator.id, is_active=True)
        db.add(template)
        db.flush()
    else:
        for field, value in WORKFLOW_TEMPLATE.items():
            setattr(template, field, value)
        template.created_by = template.created_by or creator.id
        template.is_active = True
        db.flush()

    for other_template in db.scalars(
        select(WorkflowTemplate).where(
            WorkflowTemplate.id != template.id,
            WorkflowTemplate.is_default.is_(True),
        )
    ):
        other_template.is_default = False

    version = db.scalar(
        select(WorkflowVersion).where(
            WorkflowVersion.workflow_template_id == template.id,
            WorkflowVersion.version == int(WORKFLOW_TEMPLATE["version"]),
        )
    )
    if version is None:
        version = WorkflowVersion(
            workflow_template_id=template.id,
            version=int(WORKFLOW_TEMPLATE["version"]),
            status="PUBLISHED",
            created_by=creator.id,
        )
        db.add(version)
        db.flush()
    else:
        version.status = "PUBLISHED"
        version.created_by = version.created_by or creator.id

    template.code = "full_cycle"
    template.applies_to_type = "all"
    template.status = "published"
    for legacy_version in db.scalars(
        select(WorkflowVersion).where(
            WorkflowVersion.workflow_template_id == template.id,
            WorkflowVersion.id != version.id,
            WorkflowVersion.status == "PUBLISHED",
        )
    ):
        legacy_version.status = "ARCHIVED"
        legacy_version.archived_at = datetime.now(timezone.utc)

    for code, name, applies_to_type in [
        ("expansion", "Расширение", "all"),
        ("license_renewal", "Продление лицензии", "all"),
        ("teacher_replace", "Замена преподавателя", "all"),
        ("school_short", "Короткий цикл школы", "school"),
    ]:
        short_template = get_by_field(db, WorkflowTemplate, "code", code)
        if short_template is None:
            short_template = WorkflowTemplate(code=code, name=name, applies_to_type=applies_to_type, status="published", version="1", created_by=creator.id, is_active=True, is_default=False)
            db.add(short_template)
            db.flush()
        short_template.name = name
        short_template.applies_to_type = applies_to_type
        short_template.status = "published"
        short_template.is_active = True
        _seed_short_playbook(db, short_template, SHORT_PLAYBOOKS[code], creator.id)

    for deprecated_code in ("materials_update", "reactivation"):
        deprecated_template = get_by_field(db, WorkflowTemplate, "code", deprecated_code)
        if deprecated_template is not None:
            deprecated_template.is_active = False
            deprecated_template.status = "archived"

    official_stage_names = {data["name"] for data in WORKFLOW_STAGES}
    for legacy_stage in db.scalars(
        select(WorkflowStage).where(
            WorkflowStage.workflow_template_id == template.id,
            WorkflowStage.workflow_version_id == version.id,
            WorkflowStage.name.not_in(official_stage_names),
        )
    ):
        legacy_stage.is_active = False

    stages_by_name = {}
    for data in WORKFLOW_STAGES:
        stage = db.scalar(
            select(WorkflowStage).where(
                WorkflowStage.workflow_template_id == template.id,
                WorkflowStage.workflow_version_id == version.id,
                WorkflowStage.name == data["name"],
            )
        )
        if stage is None:
            stage = WorkflowStage(
                workflow_template_id=template.id,
                workflow_version_id=version.id,
                description=data.get("description"),
                is_active=True,
                is_initial=data.get("is_initial", False),
                is_final=data.get("is_final", False),
                is_optional=data.get("is_optional", False),
                default_duration_days=data.get("default_duration_days"),
                requires_comment=data.get("requires_comment", False),
                requires_attachment=data.get("requires_attachment", False),
                name=data["name"],
                order_index=data["order_index"],
            )
            db.add(stage)
            db.flush()
        else:
            stage.description = data.get("description")
            stage.is_active = True
            stage.is_initial = data.get("is_initial", False)
            stage.is_final = data.get("is_final", False)
            stage.is_optional = data.get("is_optional", False)
            stage.default_duration_days = data.get("default_duration_days")
            stage.requires_comment = data.get("requires_comment", False)
            stage.requires_attachment = data.get("requires_attachment", False)
            stage.order_index = data["order_index"]
        stage.semester_critical = 7 <= data["order_index"] <= 11
        stages_by_name[data["name"]] = stage

    ordered_stages = [stages_by_name[data["name"]] for data in WORKFLOW_STAGES]
    catalog_codes = ["find_contact", "first_meeting", "identify_need", "document_package", "sign_contract", "sign_license", "transfer_access", "train_teacher", "confirm_teacher", "curriculum", "start_classes", "classes_running", "period_results"]
    for stage, code in zip(ordered_stages, catalog_codes):
        catalog_stage = get_by_field(db, WorkflowStageCatalog, "code", code)
        if catalog_stage is not None:
            stage.stage_catalog_id = catalog_stage.id
    checklist = [
        (0, "contact", "Контакт площадки: ФИО и телефон или e-mail", "stakeholder_role", "other"),
        (1, "meeting_date", "Дата первой встречи", "date", None),
        (1, "meeting_participant", "Участник встречи со стороны площадки", "stakeholder_role", "other"),
        (1, "meeting_protocol", "Протокол встречи или комментарий не менее 40 символов", "text", None),
        (2, "need_comment", "Причина потребности", "text", None),
        (3, "contract_project", "Проект договора", "file", None, "project_contract"),
        (3, "direction_materials", "Материалы направления", "file", None, "direction_materials"),
        (3, "product_description", "Описание продукта", "file", None, "product_description"),
        (4, "contract_number", "Номер договора", "text", None),
        (4, "contract_signed_on", "Дата подписания договора", "date", None),
        (4, "contract_attachment", "Подписанный договор", "file", None, "signed_contract"),
        (5, "license_number", "Номер лицензии", "text", None),
        (5, "license_valid_until", "Срок действия лицензии", "date", None),
        (5, "license_attachment", "Подписанная лицензия", "file", None, "license"),
        (6, "transfer_status", "Подтверждение передачи", "text", None),
        (6, "product_access", "Доступ к продукту", "text", None),
        (6, "transfer_attachment", "Акт или подтверждение передачи", "file", None, "transfer"),
        (7, "teacher", "Преподаватель-носитель продукта", "stakeholder_role", "teacher"),
        (7, "trained_on", "Дата обучения преподавателя", "date", None),
        (8, "teacher_ready", "Подтверждение готовности преподавателя", "text", None),
        (9, "curriculum", "Учебный план или комментарий согласования", "text", None),
        (10, "classes_started_on", "Дата старта занятий", "date", None),
        (10, "classes_started", "Подтверждение старта занятий", "text", None),
        (12, "period_result", "Итог периода", "text", None),
    ]
    for row in checklist:
        index, code, label, item_type, stakeholder_role, *attachment_kind = row
        item = db.scalar(select(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id == ordered_stages[index].id, PlaybookChecklistItem.code == code))
        if item is None:
            item = PlaybookChecklistItem(workflow_stage_id=ordered_stages[index].id, code=code)
            db.add(item)
        item.label = label
        item.item_type = item_type
        item.required = True
        item.required_stakeholder_role = stakeholder_role
        item.required_attachment_kind = attachment_kind[0] if attachment_kind else None
    for from_stage, to_stage in zip(ordered_stages, ordered_stages[1:]):
        transition = db.scalar(
            select(WorkflowTransition).where(
                WorkflowTransition.workflow_template_id == template.id,
                WorkflowTransition.workflow_version_id == version.id,
                WorkflowTransition.from_stage_id == from_stage.id,
                WorkflowTransition.to_stage_id == to_stage.id,
            )
        )
        transition_name = f"{from_stage.name} -> {to_stage.name}"
        if transition is None:
            transition = WorkflowTransition(
                workflow_template_id=template.id,
                workflow_version_id=version.id,
                from_stage_id=from_stage.id,
                to_stage_id=to_stage.id,
            )
            db.add(transition)
        transition.name = transition_name
        transition.is_default = True
        transition.condition_code = None

    return template


def _seed_short_playbook(
    db: Session, template: WorkflowTemplate, stage_codes: list[str], creator_id
) -> None:
    version = db.scalar(
        select(WorkflowVersion).where(
            WorkflowVersion.workflow_template_id == template.id,
            WorkflowVersion.version == 1,
        )
    )
    if version is None:
        version = WorkflowVersion(
            workflow_template_id=template.id,
            version=1,
            status="PUBLISHED",
            created_by=creator_id,
            published_at=datetime.now(timezone.utc),
        )
        db.add(version)
        db.flush()
    version.status = "PUBLISHED"
    version.published_at = version.published_at or datetime.now(timezone.utc)
    for legacy_stage in db.scalars(
        select(WorkflowStage)
        .join(WorkflowStageCatalog, WorkflowStage.stage_catalog_id == WorkflowStageCatalog.id)
        .where(
            WorkflowStage.workflow_version_id == version.id,
            WorkflowStageCatalog.code.not_in(stage_codes),
        )
    ):
        legacy_stage.is_active = False
    stages: dict[str, WorkflowStage] = {}
    for order, code in enumerate(stage_codes, 1):
        catalog = get_by_field(db, WorkflowStageCatalog, "code", code)
        if catalog is None:
            raise RuntimeError(f"Missing workflow stage catalog entry: {code}")
        stage = db.scalar(
            select(WorkflowStage).where(
                WorkflowStage.workflow_version_id == version.id,
                WorkflowStage.stage_catalog_id == catalog.id,
            )
        )
        if stage is None:
            stage = WorkflowStage(
                workflow_template_id=template.id,
                workflow_version_id=version.id,
                stage_catalog_id=catalog.id,
                name=catalog.name,
                order_index=order,
            )
            db.add(stage)
            db.flush()
        stage.name = catalog.name
        stage.order_index = order
        stage.is_initial = order == 1
        stage.is_final = order == len(stage_codes)
        stage.is_active = True
        stage.semester_critical = code in {
            "transfer_materials_license",
            "support_implementation",
            "train_teachers",
            "update_curriculum",
            "classes_running",
            "confirm_active_classes",
            "confirm_activity",
        }
        stage.default_duration_days = stage.default_duration_days or 7
        stages[code] = stage
    edges = list(zip(stage_codes, stage_codes[1:]))
    if template.code == "reactivation":
        edges = [
            ("diagnose_silence", "train_teachers"),
            ("diagnose_silence", "update_curriculum"),
            ("train_teachers", "classes_running"),
            ("update_curriculum", "classes_running"),
        ]
    for from_code, to_code in edges:
        transition = db.scalar(
            select(WorkflowTransition).where(
                WorkflowTransition.workflow_version_id == version.id,
                WorkflowTransition.from_stage_id == stages[from_code].id,
                WorkflowTransition.to_stage_id == stages[to_code].id,
            )
        )
        if transition is None:
            db.add(
                WorkflowTransition(
                    workflow_template_id=template.id,
                    workflow_version_id=version.id,
                    from_stage_id=stages[from_code].id,
                    to_stage_id=stages[to_code].id,
                    name=f"{stages[from_code].name} → {stages[to_code].name}",
                    is_default=True,
                )
            )


def seed_manager_memberships(db: Session, users: dict[str, User]) -> None:
    for manager_username, kam_username in MANAGER_MEMBERSHIPS:
        manager = users[manager_username]
        kam = users[kam_username]
        membership = db.scalar(
            select(ManagerMembership).where(
                ManagerMembership.manager_user_id == manager.id,
                ManagerMembership.kam_user_id == kam.id,
            )
        )
        if membership is None:
            db.add(ManagerMembership(manager_user_id=manager.id, kam_user_id=kam.id, is_active=True))
        else:
            membership.is_active = True


def seed_interactions(
    db: Session,
    universities: dict[str, University],
    programs: dict[str, ITProgram],
    products: dict[str, ITProduct],
    users: dict[str, User],
    workflow_template: WorkflowTemplate,
) -> None:
    runtime = WorkflowRuntimeService(db)
    for data in INTERACTIONS:
        university = universities[data["university"]]
        program = programs[data["program"]]
        product = products[data["product"]]
        manager = users[data["manager"]]
        interaction = db.scalar(
            select(UniversityInteraction).where(
                UniversityInteraction.university_id == university.id,
                UniversityInteraction.program_id == program.id,
                UniversityInteraction.product_id == product.id,
            )
        )
        values = {
            "manager_user_id": manager.id,
            "workflow_template_id": workflow_template.id,
            "status": data["status"],
            "contract_number": data["contract_number"],
            "license_signed": data["license_signed"],
            "transfer_status": data["transfer_status"],
            "university_responsibles": data["university_responsibles"],
            "comment": data["comment"],
        }
        if interaction is None:
            interaction = UniversityInteraction(
                university_id=university.id,
                program_id=program.id,
                product_id=product.id,
                **values,
            )
            db.add(interaction)
            db.flush()
            runtime.initialize_interaction_workflow(interaction)
        else:
            for field, value in values.items():
                setattr(interaction, field, value)
        contract = db.scalar(
            select(Contract).where(
                Contract.interaction_id == interaction.id,
                Contract.number == data["contract_number"],
            )
        )
        if contract is None:
            contract = Contract(
                interaction_id=interaction.id,
                number=data["contract_number"],
                status=data["status"],
            )
            db.add(contract)
            db.flush()
        else:
            contract.status = data["status"]
        license_record = db.scalar(
            select(License).where(
                License.contract_id == contract.id,
                License.product_id == product.id,
            )
        )
        if license_record is None:
            license_record = License(contract_id=contract.id, product_id=product.id)
            db.add(license_record)
        license_record.transfer_status = data["transfer_status"]


def seed_organization_core(
    db: Session, universities: dict[str, University], users: dict[str, User]
) -> None:
    type_names = {"university": "Вуз", "spo": "СПО", "school": "Школа"}
    types: dict[str, OrganizationType] = {}
    for code, name in type_names.items():
        organization_type = get_by_field(db, OrganizationType, "code", code)
        if organization_type is None:
            organization_type = OrganizationType(code=code, name=name, is_active=True)
            db.add(organization_type)
            db.flush()
        types[code] = organization_type

    for university in universities.values():
        organization = db.get(Organization, university.id)
        if organization is None:
            organization = Organization(
                id=university.id,
                type_id=types["university"].id,
                name=university.name,
                short_name=university.short_name,
                region=university.region,
                city=university.city,
                status="active" if university.is_active else "archived",
            )
            db.add(organization)

    demo_organizations = [
        ("Демо колледж цифровых технологий", "Демо СПО", "spo", users["kam2"]),
        ("Демо школа № 1", "Демо школа", "school", users["kam1"]),
        ("Южный федеральный университет", "ЮФУ", "university", users["kam1"]),
        ("Санкт-Петербургский политехнический университет", "СПбПУ", "university", users["kam2"]),
        ("Президентская академия РАНХиГС", "РАНХиГС", "university", users["kam1"]),
        ("Школа №15", "Школа №15", "school", users["kam2"]),
    ]
    for name, short_name, type_code, kam in demo_organizations:
        organization = get_by_field(db, Organization, "name", name)
        if organization is None:
            organization = Organization(
                type_id=types[type_code].id,
                name=name,
                short_name=short_name,
                region="Демо-регион",
                city="Демо-город",
                status="active",
            )
            db.add(organization)
            db.flush()
        assignment = db.scalar(
            select(OrgAssignment).where(
                OrgAssignment.organization_id == organization.id,
                OrgAssignment.status == "active",
            )
        )
        if assignment is None:
            db.add(
                OrgAssignment(
                    organization_id=organization.id,
                    user_id=kam.id,
                    assigned_by=users["admin1"].id,
                    status="active",
                    assigned_at=datetime.now(timezone.utc),
                )
            )

    db.flush()

    for interaction in db.scalars(select(UniversityInteraction)).all():
        assignment = db.scalar(
            select(OrgAssignment).where(
                OrgAssignment.organization_id == interaction.university_id,
                OrgAssignment.status == "active",
            )
        )
        if assignment is None and interaction.manager_user_id is not None:
            db.add(OrgAssignment(
                organization_id=interaction.university_id,
                user_id=interaction.manager_user_id,
                assigned_by=interaction.manager_user_id,
                status="active",
                assigned_at=interaction.created_at,
            ))
            db.flush()

    for contact in db.scalars(select(UniversityContact)).all():
        if db.get(Stakeholder, contact.id) is None:
            db.add(Stakeholder(
                id=contact.id,
                organization_id=contact.university_id,
                role_code="other",
                full_name=contact.full_name,
                position=contact.position,
                email=contact.email,
                phone=contact.phone,
                is_primary=contact.is_primary,
                comment=contact.comment,
            ))


def seed_program_instances(db: Session) -> None:
    windows_data = [
        {"code": "2026_fall", "title": "Осенний семестр 2026/27", "plan_cutoff_on": date(2026, 8, 15), "classes_start_on": date(2026, 9, 1), "classes_end_on": date(2027, 1, 31), "is_current": True},
        {"code": "2027_spring", "title": "Весенний семестр 2027", "plan_cutoff_on": date(2027, 1, 20), "classes_start_on": date(2027, 2, 1), "classes_end_on": date(2027, 6, 30), "is_current": False},
    ]
    windows: dict[str, AcademicWindow] = {}
    for data in windows_data:
        window = get_by_field(db, AcademicWindow, "code", data["code"])
        if window is None:
            window = AcademicWindow(**data)
            db.add(window)
            db.flush()
        windows[data["code"]] = window

    for interaction in db.scalars(select(UniversityInteraction)).all():
        program = db.get(ProgramInstance, interaction.id)
        if program is None:
            legacy_program = db.get(ITProgram, interaction.program_id)
            program = db.scalar(select(ProgramInstance).where(
                ProgramInstance.organization_id == interaction.university_id,
                ProgramInstance.direction_id == legacy_program.direction_id,
                ProgramInstance.product_id == interaction.product_id,
                ProgramInstance.status.not_in(["completed", "cancelled"]),
            ))
        if program is None and interaction.workflow_template_id is not None:
            legacy_program = db.get(ITProgram, interaction.program_id)
            program = ProgramInstance(
                id=interaction.id,
                organization_id=interaction.university_id,
                direction_id=legacy_program.direction_id,
                product_id=interaction.product_id,
                kam_user_id=interaction.manager_user_id,
                playbook_template_id=interaction.workflow_template_id,
                template_snapshot={"legacy_interaction_id": str(interaction.id)},
                status="active",
                academic_window_id=windows["2026_fall"].id,
                health_band="green",
                started_at=interaction.started_at,
                completed_at=interaction.completed_at,
                comment=interaction.comment,
            )
            db.add(program)
        elif program is not None and program.academic_window_id is None:
            program.academic_window_id = windows["2026_fall"].id
        if program is not None:
            program.legacy_interaction_id = interaction.id
            if interaction.current_stage_instance_id is not None:
                current_stage = db.get(WorkflowStageInstance, interaction.current_stage_instance_id)
                if current_stage is not None:
                    stage = db.get(WorkflowStage, current_stage.workflow_stage_id)
                    if stage is not None and stage.stage_catalog_id is not None:
                        catalog = db.get(WorkflowStageCatalog, stage.stage_catalog_id)
                        program.current_stage_code = catalog.code if catalog is not None else program.current_stage_code

    school = get_by_field(db, Organization, "name", "Демо школа № 1")
    school_template = get_by_field(db, WorkflowTemplate, "code", "school_short")
    school_program = db.scalar(select(ITProgram).order_by(ITProgram.name))
    school_product = db.scalar(
        select(ITProduct)
        .join(ProgramProduct, ProgramProduct.product_id == ITProduct.id)
        .where(ProgramProduct.program_id == school_program.id)
    ) if school_program is not None else None
    school_kam_id = db.scalar(
        select(OrgAssignment.user_id).where(
            OrgAssignment.organization_id == school.id,
            OrgAssignment.status == "active",
        )
    ) if school is not None else None
    if school is not None and school_template is not None and school_program is not None and school_product is not None:
        demo_program = db.scalar(
            select(ProgramInstance).where(
                ProgramInstance.organization_id == school.id,
                ProgramInstance.direction_id == school_program.direction_id,
                ProgramInstance.product_id == school_product.id,
                ProgramInstance.status.not_in(["completed", "cancelled"]),
            )
        )
        if demo_program is None:
            demo_program = ProgramInstance(
                organization_id=school.id,
                direction_id=school_program.direction_id,
                product_id=school_product.id,
                kam_user_id=None,
                playbook_template_id=school_template.id,
                template_snapshot=ProgramInstanceService(db)._template_snapshot(school_template),
                status="active",
                academic_window_id=windows["2026_fall"].id,
                health_band="green",
                comment="School short playbook demo.",
            )
            db.add(demo_program)
            db.flush()
            WorkflowRuntimeService(db).initialize_program_workflow(
                demo_program, responsible_user_id=school_kam_id
            )
            db.add(
                License(
                    program_instance_id=demo_program.id,
                    product_id=demo_program.product_id,
                    transfer_status="not_transferred",
                )
            )

    required_cases = [
        ("Южный федеральный университет", "full_cycle", "ЮФУ: первая встреча просрочена, протокол отсутствует."),
        ("Санкт-Петербургский политехнический университет", "expansion", "СПбПУ: expansion, требуется проверить LMS-сигналы."),
        ("Президентская академия РАНХиГС", "full_cycle", "РАНХиГС: здоровая активная программа."),
        ("Школа №15", "school_short", "Школа №15: короткий сценарий передачи доступа."),
        ("Уральский федеральный университет имени первого Президента России Б.Н. Ельцина", "full_cycle", "УрФУ: этап согласования учебного плана перед семестром."),
    ]
    base_program = db.scalar(select(ITProgram).order_by(ITProgram.name))
    base_product = db.scalar(select(ITProduct).join(ProgramProduct, ProgramProduct.product_id == ITProduct.id).where(ProgramProduct.program_id == base_program.id)) if base_program is not None else None
    if base_program is not None and base_product is not None:
        for organization_name, template_code, comment in required_cases:
            organization = get_by_field(db, Organization, "name", organization_name)
            template = get_by_field(db, WorkflowTemplate, "code", template_code)
            if organization is None or template is None:
                continue
            program = db.scalar(select(ProgramInstance).where(ProgramInstance.organization_id == organization.id, ProgramInstance.comment == comment))
            if program is None:
                kam_id = db.scalar(select(OrgAssignment.user_id).where(OrgAssignment.organization_id == organization.id, OrgAssignment.status == "active"))
                parent = db.scalar(select(ProgramInstance).where(ProgramInstance.organization_id == organization.id, ProgramInstance.status == "active").order_by(ProgramInstance.created_at))
                program = ProgramInstance(organization_id=organization.id, direction_id=base_program.direction_id, product_id=base_product.id, parent_program_id=parent.id if parent is not None else None, kam_user_id=kam_id, playbook_template_id=template.id, template_snapshot=ProgramInstanceService(db)._template_snapshot(template), status="active", academic_window_id=windows["2026_fall"].id, health_band="green", comment=comment)
                db.add(program)
                db.flush()
                WorkflowRuntimeService(db).initialize_program_workflow(program, responsible_user_id=kam_id)

    db.flush()
    for stage_instance in db.scalars(select(WorkflowStageInstance)).all():
        for item in db.scalars(select(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id == stage_instance.workflow_stage_id)):
            exists = db.scalar(select(ProgramChecklistValue).where(ProgramChecklistValue.stage_instance_id == stage_instance.id, ProgramChecklistValue.checklist_item_id == item.id))
            if exists is None:
                db.add(ProgramChecklistValue(stage_instance_id=stage_instance.id, checklist_item_id=item.id))

    scenario_stages = {
        "ЮФУ": ("first_meeting", True),
        "СПбПУ": ("classes_running", False),
        "УрФУ": ("curriculum", False),
        "Школа №15": ("transfer_access", False),
    }
    for short_name, (stage_code, overdue) in scenario_stages.items():
        organization = db.scalar(select(Organization).where(Organization.short_name == short_name))
        if organization is None:
            continue
        program = db.scalar(select(ProgramInstance).where(ProgramInstance.organization_id == organization.id, ProgramInstance.status == "active").order_by(ProgramInstance.created_at.desc()))
        if program is None:
            continue
        target = db.scalar(select(WorkflowStageInstance).join(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id).join(WorkflowStageCatalog, WorkflowStageCatalog.id == WorkflowStage.stage_catalog_id).where(WorkflowStageInstance.program_instance_id == program.id, WorkflowStageCatalog.code == stage_code))
        if target is None:
            continue
        target_stage = db.get(WorkflowStage, target.workflow_stage_id)
        for previous, previous_stage in db.execute(
            select(WorkflowStageInstance, WorkflowStage)
            .join(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
            .where(
                WorkflowStageInstance.program_instance_id == program.id,
                WorkflowStage.order_index < target_stage.order_index,
            )
        ):
            previous.status = "COMPLETED"
            previous.started_at = datetime.now(timezone.utc) - timedelta(days=14)
            previous.completed_at = datetime.now(timezone.utc) - timedelta(days=3)
            for value, item in db.execute(
                select(ProgramChecklistValue, PlaybookChecklistItem)
                .join(PlaybookChecklistItem, PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id)
                .where(ProgramChecklistValue.stage_instance_id == previous.id)
            ):
                value.is_done = True
                if item.item_type == "text":
                    value.value_text = "Демо-факт подтверждён для завершённого этапа."
                elif item.item_type == "date":
                    value.value_date = date.today() - timedelta(days=3)
        target.status = "IN_PROGRESS"
        target.started_at = datetime.now(timezone.utc) - timedelta(days=10 if overdue else 1)
        target.due_at = datetime.now(timezone.utc) - timedelta(days=2) if overdue else datetime.now(timezone.utc) + timedelta(days=7)
        program.current_stage_instance_id = target.id
        program.current_stage_code = stage_code
        if short_name == "СПбПУ" and not db.scalar(select(IntegrationSignal.id).where(IntegrationSignal.program_instance_id == program.id, IntegrationSignal.status == "unmatched")):
            db.add(IntegrationSignal(source="lms", status="unmatched", organization_id=organization.id, program_instance_id=program.id, payload={"seed_case": "lms_issue"}, error_message="LMS record is not matched to the program"))

    first_program = db.scalar(select(ProgramInstance).order_by(ProgramInstance.created_at))
    if first_program is not None:
        existing_product_ids = select(ProgramInstance.product_id).where(
            ProgramInstance.organization_id == first_program.organization_id,
            ProgramInstance.status.not_in(["completed", "cancelled"]),
        )
        second_product = db.scalar(
            select(ITProduct)
            .join(ProgramProduct, ProgramProduct.product_id == ITProduct.id)
            .join(ITProgram, ITProgram.id == ProgramProduct.program_id)
            .where(ITProduct.id.not_in(existing_product_ids))
            .where(ITProgram.direction_id == first_program.direction_id)
            .order_by(ITProduct.name)
        )
        existing_second = db.scalar(select(ProgramInstance).where(
            ProgramInstance.organization_id == first_program.organization_id,
            ProgramInstance.direction_id == first_program.direction_id,
            ProgramInstance.product_id == second_product.id,
            ProgramInstance.status.not_in(["completed", "cancelled"]),
        )) if second_product is not None else None
        if second_product is not None and existing_second is None:
            db.add(ProgramInstance(
                organization_id=first_program.organization_id,
                direction_id=first_program.direction_id,
                product_id=second_product.id,
                kam_user_id=first_program.kam_user_id,
                playbook_template_id=first_program.playbook_template_id,
                template_snapshot={"seed_case": "organization_with_two_programs"},
                status="active",
                academic_window_id=windows["2026_fall"].id,
                health_band="green",
                comment="Second demo program for organization 360.",
            ))


def seed_stage5_integration_demo(db: Session) -> None:
    """Map one provided B2C course for the demo and intentionally leave the rest unmatched."""
    course = "Инженер-тестировщик"
    stream = "1"
    product = get_by_field(db, ITProduct, "name", course)
    if product is None:
        return
    program = db.scalar(
        select(ProgramInstance)
        .where(ProgramInstance.product_id == product.id, ProgramInstance.status == "active")
        .order_by(ProgramInstance.created_at)
    )
    if program is None:
        return
    course_mapping = db.scalar(select(ExternalCourseMapping).where(ExternalCourseMapping.source == "PAYMENT", ExternalCourseMapping.external_course_name == course))
    if course_mapping is None:
        course_mapping = ExternalCourseMapping(source="PAYMENT", external_course_name=course, direction_id=program.direction_id, product_id=program.product_id, status="active")
        db.add(course_mapping)
    else:
        course_mapping.direction_id, course_mapping.product_id, course_mapping.status = program.direction_id, program.product_id, "active"
    stream_mapping = db.scalar(select(ExternalStreamMapping).where(ExternalStreamMapping.source == "PAYMENT", ExternalStreamMapping.external_course_name == course, ExternalStreamMapping.external_stream_id == stream))
    if stream_mapping is None:
        db.add(ExternalStreamMapping(source="PAYMENT", external_course_name=course, external_stream_id=stream, program_instance_id=program.id))
    else:
        stream_mapping.program_instance_id = program.id


def seed_contracts_licenses_and_teachers(db: Session) -> None:
    programs = list(db.scalars(select(ProgramInstance).order_by(ProgramInstance.created_at)).all())
    if not programs:
        return
    now = datetime.now(timezone.utc)
    contracts: dict[object, Contract] = {}
    for index, program in enumerate(programs):
        health_case = index % 3
        contract = contracts.get(program.organization_id)
        if contract is None:
            contract = db.scalar(select(Contract).where(Contract.organization_id == program.organization_id))
            if contract is None:
                contract = Contract(
                    organization_id=program.organization_id,
                    number=f"RTK-FRAME-{str(program.organization_id)[:8]}",
                    signed_on=date(2026, 1, 15),
                    valid_until=datetime(2028, 12, 31, tzinfo=timezone.utc),
                    comment="Demo framework agreement for V2 organization.",
                )
                db.add(contract)
                db.flush()
            contracts[program.organization_id] = contract
        license_record = db.scalar(select(License).where(License.program_instance_id == program.id))
        if license_record is None:
            db.add(License(
                contract_id=contract.id,
                program_instance_id=program.id,
                product_id=program.product_id,
                license_number=f"LIC-{str(program.id)[:8]}",
                signed_at=now,
                valid_until=datetime.combine(
                    date.today() + timedelta(days=365 if health_case == 0 else 30 if health_case == 1 else -1),
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                ),
                transfer_status="transferred" if health_case in (0, 1) else "in_progress",
                transferred_on=date.today() if health_case in (0, 1) else None,
                comment="Demo license linked to V2 program instance.",
            ))
        carrier = db.scalar(select(TeacherCarrier).where(TeacherCarrier.program_instance_id == program.id))
        if carrier is None:
            stakeholder = db.scalar(select(Stakeholder).where(Stakeholder.organization_id == program.organization_id, Stakeholder.role_code.in_(["teacher", "school_teacher"])))
            db.add(TeacherCarrier(
                organization_id=program.organization_id,
                program_instance_id=program.id,
                product_id=program.product_id,
                stakeholder_id=stakeholder.id if stakeholder else None,
                full_name=stakeholder.full_name if stakeholder else "Demo Teacher Carrier",
                trained_on=date(2026, 2, 15),
                qualification_until=date.today() + timedelta(days=365 if health_case != 2 else -1),
                last_lms_activity_on=date.today() - timedelta(days=0 if health_case != 2 else 60),
                status="active",
            ))


def seed_workflow_catalog(db: Session) -> None:
    phases = [("outreach", "Выход на вуз"), ("paperwork", "Оформление"), ("onboarding", "Онбординг"), ("operations", "Эксплуатация"), ("retention", "Удержание"), ("control", "Контроль")]
    phase_by_code = {}
    for order, (code, name) in enumerate(phases, 1):
        phase = get_by_field(db, WorkflowPhase, "code", code)
        if phase is None:
            phase = WorkflowPhase(code=code, name=name, sort_order=order, is_active=True)
            db.add(phase)
            db.flush()
        elif code == "control":
            phase.is_active = False
        phase_by_code[code] = phase
    stages = [
        ("first_meeting", "Первая встреча", "outreach"),
        ("identify_need", "Выявление потребности", "outreach"),
        ("document_package", "Пакет документов", "paperwork"),
        ("sign_contract", "Подписание договора", "paperwork"),
        ("sign_license", "Подписание лицензии", "paperwork"),
        ("transfer_access", "Передача и доступ к продукту", "onboarding"),
        ("train_teacher", "Обучение преподавателя", "onboarding"),
        ("confirm_teacher", "Подтверждение преподавателя", "onboarding"),
        ("curriculum", "Учебный план", "onboarding"),
        ("start_classes", "Старт занятий", "operations"),
        ("period_results", "Итоги периода", "retention"),
        ("find_teacher", "Найти нового преподавателя", "onboarding"),
        ("handover_course", "Передать курс", "operations"),
        ("find_contact", "Найти контакт", "outreach"), ("clarify_relevance", "Уточнить актуальность", "outreach"), ("arrange_meeting", "Организовать встречу", "outreach"),
        ("exchange_docs", "Обменяться документами", "paperwork"), ("correct_docs", "Скорректировать документы", "paperwork"), ("sign_docs", "Подписать документы", "paperwork"),
        ("transfer_materials_license", "Передать материалы и лицензию", "onboarding"), ("support_implementation", "Сопроводить внедрение", "onboarding"), ("train_teachers", "Обучить преподавателей", "onboarding"), ("update_curriculum", "Обновить учебный план", "onboarding"),
        ("classes_running", "Запустить занятия", "operations"), ("update_product_docs", "Обновить документацию", "retention"), ("teacher_upskilling", "Повысить квалификацию преподавателей", "retention"), ("control", "Контроль", "control"),
        ("confirm_need", "Подтвердить потребность", "outreach"), ("reuse_contract", "Переиспользовать договор", "paperwork"),
        ("check_usage", "Проверить использование", "outreach"), ("prepare_renewal_pack", "Подготовить пакет продления", "paperwork"),
        ("confirm_active_classes", "Подтвердить активные занятия", "operations"), ("identify_new_teacher", "Найти нового преподавателя", "onboarding"),
        ("confirm_activity", "Подтвердить активность", "operations"), ("receive_new_pack", "Получить новый пакет", "paperwork"),
        ("diagnose_silence", "Диагностировать отсутствие активности", "outreach"),
    ]
    for code, name, phase_code in stages:
        stage = get_by_field(db, WorkflowStageCatalog, "code", code)
        if stage is None:
            db.add(WorkflowStageCatalog(code=code, name=name, default_phase_id=phase_by_code[phase_code].id, is_active=True))

    deprecated_codes = {
        "control", "clarify_relevance", "arrange_meeting", "exchange_docs", "correct_docs",
        "sign_docs", "transfer_materials_license", "support_implementation", "train_teachers",
        "update_curriculum", "update_product_docs", "teacher_upskilling", "confirm_need",
        "reuse_contract", "check_usage", "prepare_renewal_pack", "confirm_active_classes",
        "identify_new_teacher", "confirm_activity", "receive_new_pack", "diagnose_silence",
    }
    for stage in db.scalars(select(WorkflowStageCatalog).where(WorkflowStageCatalog.code.in_(deprecated_codes))):
        stage.is_active = False
    # Short-playbook creation immediately queries this catalog. Persist all pending
    # entries explicitly so the seed is independent of SQLAlchemy autoflush settings.
    db.flush()


def main() -> None:
    db = SessionLocal()
    try:
        universities = seed_universities(db)
        seed_contacts(db, universities)
        directions = seed_directions(db)
        programs = seed_programs(db, directions)
        vendors = seed_vendors(db)
        products = seed_products(db, vendors)
        seed_program_products(db, programs, products)
        roles = seed_roles(db)
        users = seed_users(db, roles)
        seed_workflow_catalog(db)
        workflow_template = seed_workflow(db, users)
        seed_manager_memberships(db, users)
        seed_interactions(db, universities, programs, products, users, workflow_template)
        seed_organization_core(db, universities, users)
        seed_program_instances(db)
        db.flush()
        seed_stage5_integration_demo(db)
        seed_contracts_licenses_and_teachers(db)
        db.commit()
        for program in db.scalars(select(ProgramInstance)).all():
            HealthService(db).recompute(program.id)
            NbaService(db).recompute_program(program.id)
            IntegrationSyncService(db).sync_program(program.id)
    finally:
        db.close()

    print("Demo data seeded.")


if __name__ == "__main__":
    main()
