from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import MetaData, Table, inspect, select
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
    {
        "name": "Санкт-Петербургский политехнический университет Петра Великого",
        "short_name": "СПбПУ",
        "region": "Санкт-Петербург",
        "city": "Санкт-Петербург",
        "address": "ул. Политехническая, д. 29",
        "website": "https://www.spbstu.ru",
    },
    {
        "name": "Санкт-Петербургский государственный университет",
        "short_name": "СПбГУ",
        "region": "Санкт-Петербург",
        "city": "Санкт-Петербург",
        "address": "Университетская наб., д. 7–9",
        "website": "https://spbu.ru",
    },
    {
        "name": "Национальный исследовательский ядерный университет «МИФИ»",
        "short_name": "НИЯУ МИФИ",
        "region": "Москва",
        "city": "Москва",
        "address": "Каширское шоссе, д. 31",
        "website": "https://mephi.ru",
    },
    {
        "name": "Национальный исследовательский технологический университет «МИСИС»",
        "short_name": "НИТУ МИСИС",
        "region": "Москва",
        "city": "Москва",
        "address": "Ленинский проспект, д. 4, стр. 1",
        "website": "https://misis.ru",
    },
    {
        "name": "Московский авиационный институт (национальный исследовательский университет)",
        "short_name": "МАИ",
        "region": "Москва",
        "city": "Москва",
        "address": "Волоколамское шоссе, д. 4",
        "website": "https://mai.ru",
    },
    {
        "name": "Национальный исследовательский Нижегородский государственный университет имени Н.И. Лобачевского",
        "short_name": "ННГУ",
        "region": "Нижегородская область",
        "city": "Нижний Новгород",
        "address": "проспект Гагарина, д. 23",
        "website": "https://www.unn.ru",
    },
    {
        "name": "Самарский национальный исследовательский университет имени академика С.П. Королёва",
        "short_name": "Самарский университет",
        "region": "Самарская область",
        "city": "Самара",
        "address": "Московское шоссе, д. 34",
        "website": "https://ssau.ru",
    },
    {
        "name": "Дальневосточный федеральный университет",
        "short_name": "ДВФУ",
        "region": "Приморский край",
        "city": "Владивосток",
        "address": "о. Русский, п. Аякс, д. 10",
        "website": "https://www.dvfu.ru",
    },
    {
        "name": "Южный федеральный университет",
        "short_name": "ЮФУ",
        "region": "Ростовская область",
        "city": "Ростов-на-Дону",
        "address": "ул. Большая Садовая, д. 105/42",
        "website": "https://sfedu.ru",
    },
    {
        "name": "МИРЭА — Российский технологический университет",
        "short_name": "РТУ МИРЭА",
        "region": "Москва",
        "city": "Москва",
        "address": "проспект Вернадского, д. 78",
        "website": "https://www.mirea.ru",
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
        "email": "kam1@rtk-edu.local",
        "roles": ["KAM"],
    },
    {
        "username": "kam2",
        "full_name": "Илья Соколов",
        "email": "kam2@rtk-edu.local",
        "roles": ["KAM"],
    },
    {
        "username": "manager1",
        "full_name": "Мария Орлова",
        "email": "manager1@rtk-edu.local",
        "roles": ["MANAGER"],
    },
    {
        "username": "admin1",
        "full_name": "Алексей Власов",
        "email": "admin1@rtk-edu.local",
        "roles": ["ADMIN"],
    },
    {
        "username": "kam3",
        "full_name": "Елена Морозова",
        "email": "kam3@rtk-edu.local",
        "roles": ["KAM"],
    },
    {
        "username": "kam4",
        "full_name": "Дмитрий Волков",
        "email": "kam4@rtk-edu.local",
        "roles": ["KAM"],
    },
]

MANAGER_MEMBERSHIPS = [
    ("manager1", "kam1"),
    ("manager1", "kam2"),
    ("manager1", "kam3"),
    ("manager1", "kam4"),
]


TEACHER_NAMES = [
    "Александр Воронов",
    "Наталья Белова",
    "Сергей Лебедев",
    "Ольга Миронова",
    "Максим Громов",
    "Ирина Кузнецова",
    "Андрей Фролов",
    "Екатерина Соколова",
    "Михаил Орлов",
    "Татьяна Власова",
]

VENDOR_CONTACT_NAMES = [
    "Сергей Лебедев",
    "Ольга Миронова",
    "Андрей Фролов",
]

INTERACTIONS = [
    {
        "university": "МГУ",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-MSU-2026-001",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Центр развития цифровых компетенций",
        "comment": "Зрелое партнерство: материалы и лицензия переданы, программа запущена.",
    },
    {
        "university": "ИТМО",
        "program": "Специалист по анализу данных",
        "product": "Специалист по анализу данных",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-ITMO-2026-002",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Офис образовательных программ",
        "comment": "Активная программа по аналитике данных; LMS-метрики регулярно синхронизируются.",
    },
    {
        "university": "НИУ ВШЭ",
        "program": "Анализ данных без программирования",
        "product": "Анализ данных без программирования",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-HSE-2026-003",
        "license_signed": False,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Учебный офис",
        "comment": "Документы согласуются, передача материалов начата.",
    },
    {
        "university": "МГТУ",
        "program": "Инженер-тестировщик",
        "product": "Инженер-тестировщик",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-BMSTU-2026-004",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Кафедра информационных систем",
        "comment": "Программа QA находится на этапе внедрения в учебный процесс.",
    },
    {
        "university": "МФТИ",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-MIPT-2026-005",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Учебный департамент",
        "comment": "Программа запущена; хороший кейс для нескольких потоков и высокого спроса.",
    },
    {
        "university": "НГУ",
        "program": "Введение в информационную безопасность",
        "product": "Введение в информационную безопасность",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-NSU-2026-006",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Учебно-методическое управление",
        "comment": "Ранний этап: контакт подтвержден, договор и лицензия еще не оформлены.",
    },
    {
        "university": "ТГУ",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-TSU-2026-007",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт прикладной математики и компьютерных наук",
        "comment": "Новый продукт в действующем партнерстве; подходит для сценария expansion.",
    },
    {
        "university": "ТПУ",
        "program": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "product": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-TPU-2026-008",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Бизнес-школа ТПУ",
        "comment": "Лицензия подписана, материалы передаются; можно показать риск по SLA.",
    },
    {
        "university": "КФУ",
        "program": "Основы UX/UI-дизайна",
        "product": "Основы UX/UI-дизайна",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-KFU-2026-009",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт информационных технологий",
        "comment": "Стабильная программа с действующей лицензией.",
    },
    {
        "university": "УрФУ",
        "program": "Веб-разработка на платформе «Акола»",
        "product": "Веб-разработка на платформе «Акола»",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-URFU-2026-010",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт радиоэлектроники и информационных технологий",
        "comment": "Платформенный продукт уже передан; сценарий для контроля факта обучения.",
    },
    {
        "university": "ИТМО",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-ITMO-2026-011",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Факультет инфокоммуникационных технологий",
        "comment": "Вторая активная программа в университете; отображается в общей карточке University 360.",
    },
    {
        "university": "НИУ ВШЭ",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-HSE-2026-012",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Учебный офис",
        "comment": "Вторая программа в одном вузе, находящаяся на более раннем этапе.",
    },
    {
        "university": "СПбПУ",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-SPBPU-2026-013",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт компьютерных наук и кибербезопасности",
        "comment": "Программа внедрена, преподаватели обучены, отслеживается активность в LMS.",
    },
    {
        "university": "СПбГУ",
        "program": "Специалист по анализу данных",
        "product": "Специалист по анализу данных",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-SPBU-2026-014",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Центр ИИ и науки о данных",
        "comment": "Активная программа по аналитике данных с несколькими учебными потоками.",
    },
    {
        "university": "НИЯУ МИФИ",
        "program": "Введение в информационную безопасность",
        "product": "Введение в информационную безопасность",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-MEPHI-2026-015",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт интеллектуальных кибернетических систем",
        "comment": "Программа информационной безопасности находится в активной фазе обучения.",
    },
    {
        "university": "НИТУ МИСИС",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-MISIS-2026-016",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Институт компьютерных наук",
        "comment": "Лицензия оформлена, продолжается подключение учебных групп к продукту.",
    },
    {
        "university": "МАИ",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-MAI-2026-017",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "ИТ-центр университета",
        "comment": "Программа используется для подготовки по инфраструктуре и эксплуатации сервисов.",
    },
    {
        "university": "ННГУ",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-UNN-2026-018",
        "license_signed": False,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Учебное управление",
        "comment": "Согласовывается лицензионный контур, учебный план уже подготовлен.",
    },
    {
        "university": "Самарский университет",
        "program": "Инженер-тестировщик",
        "product": "Инженер-тестировщик",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-SSAU-2026-019",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Учебно-методическое управление",
        "comment": "Программа QA запущена, по LMS регулярно поступают показатели активности.",
    },
    {
        "university": "ДВФУ",
        "program": "Специалист по анализу данных",
        "product": "Специалист по анализу данных",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-FEFU-2026-020",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Учебный офис",
        "comment": "Действующая программа с несколькими потоками студентов.",
    },
    {
        "university": "ЮФУ",
        "program": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "product": "Управление ИТ-проектами на базе программного продукта ПАО «Ростелеком»",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-SFEDU-2026-021",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Учебное управление",
        "comment": "Программа находится на этапе передачи материалов и подготовки запуска занятий.",
    },
    {
        "university": "РТУ МИРЭА",
        "program": "Введение в информационную безопасность",
        "product": "Введение в информационную безопасность",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-MIREA-2026-022",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт кибербезопасности и цифровых технологий",
        "comment": "Действующая программа по информационной безопасности.",
    },
    {
        "university": "СПбПУ",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-SPBPU-2026-023",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт компьютерных наук и кибербезопасности",
        "comment": "Вторая программа университета; используется отдельный учебный поток DevOps.",
    },
    {
        "university": "СПбГУ",
        "program": "Промпт-инжиниринг",
        "product": "Промпт-инжиниринг",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-SPBU-2026-024",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Центр ИИ и науки о данных",
        "comment": "Новая программа: потребность подтверждена, документы находятся на согласовании.",
    },
    {
        "university": "НИЯУ МИФИ",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-MEPHI-2026-025",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Институт интеллектуальных кибернетических систем",
        "comment": "Вторая программа университета, выполняется передача доступа и материалов.",
    },
    {
        "university": "НИТУ МИСИС",
        "program": "Специалист по анализу данных",
        "product": "Специалист по анализу данных",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-MISIS-2026-026",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт компьютерных наук",
        "comment": "Программа аналитики данных запущена и перешла в операционную фазу.",
    },
    {
        "university": "МАИ",
        "program": "Инженер-тестировщик",
        "product": "Инженер-тестировщик",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-MAI-2026-027",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "ИТ-центр университета",
        "comment": "Вторая программа находится на раннем этапе оформления документов.",
    },
    {
        "university": "ННГУ",
        "program": "Введение в информационную безопасность",
        "product": "Введение в информационную безопасность",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-UNN-2026-028",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Учебное управление",
        "comment": "Вторая программа университета; материалы и доступ к продукту переданы.",
    },
    {
        "university": "Самарский университет",
        "program": "DevOps-инженер с нуля",
        "product": "DevOps-инженер с нуля",
        "manager": "kam4",
        "status": "ACTIVE",
        "contract_number": "RTK-SSAU-2026-029",
        "license_signed": True,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Учебно-методическое управление",
        "comment": "Дополнительная программа DevOps готовится к старту нового потока.",
    },
    {
        "university": "РТУ МИРЭА",
        "program": "Python-разработчик с использованием инструментов ИИ",
        "product": "Python-разработчик с использованием инструментов ИИ",
        "manager": "kam3",
        "status": "ACTIVE",
        "contract_number": "RTK-MIREA-2026-030",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Институт информационных технологий",
        "comment": "Вторая программа университета; занятия идут, данные поступают из LMS.",
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
        ("СПбПУ", "Дирекция образовательных программ СПбПУ", "Организационный контакт", "edu.dep@spbstu.ru"),
        ("СПбГУ", "Центр ИИ и науки о данных СПбГУ", "Профильный организационный контакт", "aicenter@spbu.ru"),
        ("НИЯУ МИФИ", "Справочная НИЯУ МИФИ", "Общий контакт университета", "info@mephi.ru"),
        ("НИТУ МИСИС", "Канцелярия НИТУ МИСИС", "Общий контакт университета", "kancela@misis.ru"),
        ("МАИ", "Отдел информационных сетей МАИ", "Профильный организационный контакт", "ois@mai.ru"),
        ("ННГУ", "Студенческий многофункциональный центр ННГУ", "Организационный контакт", "mfc@unn.ru"),
        ("Самарский университет", "Канцелярия Самарского университета", "Общий контакт университета", "ssau@ssau.ru"),
        ("ДВФУ", "Приёмная комиссия ДВФУ", "Организационный контакт", "priem@dvfu.ru"),
        ("ЮФУ", "Управление международной деятельности ЮФУ", "Организационный контакт", "welcome@sfedu.ru"),
        ("РТУ МИРЭА", "Приёмная комиссия РТУ МИРЭА", "Организационный контакт", "pk@mirea.ru"),
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

    additional_organizations = [
        ("Колледж цифровых технологий «Вектор»", "Колледж «Вектор»", "spo", "Москва", "Москва", users["kam2"]),
        ("Лицей информационных технологий", "ИТ-лицей", "school", "Москва", "Москва", users["kam1"]),
        ("Лицей инженерных технологий", "Инженерный лицей", "school", "Томская область", "Томск", users["kam2"]),
    ]
    for name, short_name, type_code, region, city, kam in additional_organizations:
        organization = get_by_field(db, Organization, "name", name)
        if organization is None:
            organization = Organization(
                type_id=types[type_code].id,
                name=name,
                short_name=short_name,
                region=region,
                city=city,
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

    school = get_by_field(db, Organization, "name", "Лицей информационных технологий")
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
        school_program_instance = db.scalar(
            select(ProgramInstance).where(
                ProgramInstance.organization_id == school.id,
                ProgramInstance.direction_id == school_program.direction_id,
                ProgramInstance.product_id == school_product.id,
                ProgramInstance.status.not_in(["completed", "cancelled"]),
            )
        )
        if school_program_instance is None:
            school_program_instance = ProgramInstance(
                organization_id=school.id,
                direction_id=school_program.direction_id,
                product_id=school_product.id,
                kam_user_id=None,
                playbook_template_id=school_template.id,
                template_snapshot=ProgramInstanceService(db)._template_snapshot(school_template),
                status="active",
                academic_window_id=windows["2026_fall"].id,
                health_band="green",
                comment="Короткий цикл внедрения образовательного продукта для школьной площадки.",
            )
            db.add(school_program_instance)
            db.flush()
            WorkflowRuntimeService(db).initialize_program_workflow(
                school_program_instance, responsible_user_id=school_kam_id
            )

    required_cases = [
        ("Южный федеральный университет", "full_cycle", "ЮФУ: первая встреча просрочена, протокол отсутствует."),
        ("Санкт-Петербургский политехнический университет Петра Великого", "expansion", "СПбПУ: expansion, требуется проверить LMS-сигналы."),
        ("Национальный исследовательский ядерный университет «МИФИ»", "full_cycle", "НИЯУ МИФИ: стабильная активная программа."),
        ("Лицей инженерных технологий", "school_short", "Инженерный лицей: короткий сценарий передачи доступа."),
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
        "Инженерный лицей": ("transfer_access", False),
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
                    value.value_text = "Требование этапа выполнено и подтверждено ответственным сотрудником."
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
                comment="Вторая активная программа организации для отображения в карточке 360.",
            ))



def seed_university_stage_distribution(db: Session) -> None:
    """Spread university programs across the main workflow for dashboard/funnel coverage."""
    protected_codes = {"first_meeting", "classes_running", "curriculum", "transfer_access"}
    now = _utcnow()

    programs = list(
        db.scalars(
            select(ProgramInstance)
            .join(Organization, Organization.id == ProgramInstance.organization_id)
            .join(OrganizationType, OrganizationType.id == Organization.type_id)
            .where(
                ProgramInstance.status == "active",
                OrganizationType.code == "university",
            )
            .order_by(Organization.name, ProgramInstance.created_at)
        ).all()
    )

    target_codes = [
        "find_contact",
        "first_meeting",
        "identify_need",
        "document_package",
        "sign_contract",
        "sign_license",
        "transfer_access",
        "train_teacher",
        "confirm_teacher",
        "curriculum",
        "start_classes",
        "classes_running",
        "period_results",
    ]

    for index, program in enumerate(programs):
        # Preserve scenarios explicitly positioned earlier in seed_program_instances.
        if program.current_stage_code in protected_codes and index < 8:
            continue

        desired_code = target_codes[index % len(target_codes)]
        target = db.scalar(
            select(WorkflowStageInstance)
            .join(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
            .join(WorkflowStageCatalog, WorkflowStageCatalog.id == WorkflowStage.stage_catalog_id)
            .where(
                WorkflowStageInstance.program_instance_id == program.id,
                WorkflowStageCatalog.code == desired_code,
            )
        )
        if target is None:
            continue

        target_stage = db.get(WorkflowStage, target.workflow_stage_id)
        if target_stage is None:
            continue

        stage_rows = list(
            db.execute(
                select(WorkflowStageInstance, WorkflowStage)
                .where(
                    WorkflowStageInstance.program_instance_id == program.id,
                    WorkflowStage.id == WorkflowStageInstance.workflow_stage_id,
                )
                .order_by(WorkflowStage.order_index)
            )
        )

        for stage_instance, stage in stage_rows:
            if stage.order_index < target_stage.order_index:
                stage_instance.status = "COMPLETED"
                stage_instance.started_at = stage_instance.started_at or (now - timedelta(days=30 - (index % 8)))
                stage_instance.completed_at = stage_instance.completed_at or (now - timedelta(days=15 - (index % 6)))
                stage_instance.due_at = stage_instance.due_at or (now - timedelta(days=16 - (index % 6)))
            elif stage_instance.id == target.id:
                stage_instance.status = "IN_PROGRESS"
                stage_instance.started_at = stage_instance.started_at or (now - timedelta(days=4 + (index % 8)))
                # Roughly every fifth program is overdue so risk widgets are non-empty.
                stage_instance.due_at = (
                    now - timedelta(days=1 + (index % 3))
                    if index % 5 == 0
                    else now + timedelta(days=3 + (index % 9))
                )
                stage_instance.completed_at = None
            else:
                if str(stage_instance.status).upper() not in {"COMPLETED", "DONE"}:
                    stage_instance.status = "PENDING"
                    stage_instance.started_at = None
                    stage_instance.completed_at = None

        program.current_stage_instance_id = target.id
        program.current_stage_code = desired_code

    db.flush()


def seed_stage5_integration_mappings(db: Session) -> None:
    """Map one provided B2C course and intentionally leave the rest unmatched."""
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
    # The database allows one license per (contract, product), not one per
    # ProgramInstance. Keep pending ORM objects in this cache as well: they
    # are not visible to a SQL query until flush and otherwise get duplicated.
    licenses_by_contract_product = {
        (license_record.contract_id, license_record.product_id): license_record
        for license_record in db.scalars(select(License)).all()
        if license_record.contract_id is not None
    }
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
                    comment="Рамочный договор с организацией на использование образовательных продуктов.",
                )
                db.add(contract)
                db.flush()
            contracts[program.organization_id] = contract
        license_key = (contract.id, program.product_id)
        license_record = licenses_by_contract_product.get(license_key)
        if license_record is None:
            license_record = db.scalar(select(License).where(License.program_instance_id == program.id))
            if license_record is not None and license_record.contract_id in {None, contract.id}:
                license_record.contract_id = contract.id
            else:
                license_record = License(
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
                    comment="Лицензия связана с конкретной программой внедрения.",
                )
                db.add(license_record)
            licenses_by_contract_product[license_key] = license_record
        carrier = db.scalar(select(TeacherCarrier).where(TeacherCarrier.program_instance_id == program.id))
        if carrier is None:
            stakeholder = db.scalar(select(Stakeholder).where(Stakeholder.organization_id == program.organization_id, Stakeholder.role_code.in_(["teacher", "school_teacher"])))
            db.add(TeacherCarrier(
                organization_id=program.organization_id,
                program_instance_id=program.id,
                product_id=program.product_id,
                stakeholder_id=stakeholder.id if stakeholder else None,
                full_name=stakeholder.full_name if stakeholder else "Александр Воронов",
                trained_on=date(2026, 2, 15),
                qualification_until=date.today() + timedelta(days=365 if health_case != 2 else -1),
                last_lms_activity_on=date.today() - timedelta(days=0 if health_case != 2 else 60),
                status="active",
            ))

    db.flush()


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



# ---------------------------------------------------------------------------
# Extended seed dataset (V2)
# ---------------------------------------------------------------------------
# The base seed above creates the minimal working contour.  The helpers below
# enrich it with deterministic seed values for the remaining business fields
# and create representative records for auxiliary tables from the data schema.
# They deliberately keep state-dependent nullable fields NULL when NULL is the
# correct domain value (for example completed_at on an active program).

_REFLECTED_TABLES: dict[str, Table] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _stable_seed_key(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9а-яё]+", "-", value, flags=re.IGNORECASE)
    value = value.strip("-")
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
    ascii_part = re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:36]
    return f"{ascii_part or 'seed'}-{digest}"


def _table(db: Session, name: str) -> Table | None:
    bind = db.get_bind()
    if name in _REFLECTED_TABLES:
        return _REFLECTED_TABLES[name]
    if not inspect(bind).has_table(name):
        return None
    table = Table(name, MetaData(), autoload_with=bind)
    _REFLECTED_TABLES[name] = table
    return table


def _core_upsert(
    db: Session,
    table_name: str,
    key: dict[str, object],
    values: dict[str, object],
) -> dict[str, object] | None:
    """Small idempotent upsert for auxiliary tables whose model import is not needed here."""
    table = _table(db, table_name)
    if table is None:
        return None

    key = {k: v for k, v in key.items() if k in table.c}
    payload = {k: v for k, v in values.items() if k in table.c}
    now = _utcnow()
    if "created_at" in table.c:
        payload.setdefault("created_at", now)
    if "updated_at" in table.c:
        payload.setdefault("updated_at", now)

    stmt = select(table)
    for field, value in key.items():
        stmt = stmt.where(table.c[field] == value)
    row = db.execute(stmt.limit(1)).mappings().first()

    if row is not None:
        update_values = {k: v for k, v in payload.items() if k not in key}
        if update_values:
            update_stmt = table.update()
            for field, value in key.items():
                update_stmt = update_stmt.where(table.c[field] == value)
            db.execute(update_stmt.values(**update_values))
        merged = dict(row)
        merged.update(update_values)
        return merged

    insert_values = {**key, **payload}
    if "id" in table.c and "id" not in insert_values:
        insert_values["id"] = uuid4()
    db.execute(table.insert().values(**insert_values))
    return insert_values


def _published_version(db: Session, template_id) -> WorkflowVersion | None:
    return db.scalar(
        select(WorkflowVersion)
        .where(
            WorkflowVersion.workflow_template_id == template_id,
            WorkflowVersion.status == "PUBLISHED",
        )
        .order_by(WorkflowVersion.version.desc())
    )


def seed_full_field_enrichment(db: Session, users: dict[str, User]) -> None:
    """Fill business-relevant fields that the minimal seed intentionally left empty."""
    now = _utcnow()

    # Catalog: deterministic business keys and full descriptions.
    for vendor in db.scalars(select(Vendor)).all():
        if hasattr(vendor, "business_key") and not vendor.business_key:
            vendor.business_key = f"vendor-{_stable_seed_key(vendor.name)}"
        vendor.description = vendor.description or f"Поставщик или партнёр продуктового каталога — {vendor.name}."
        if hasattr(vendor, "is_active"):
            vendor.is_active = True

    for product in db.scalars(select(ITProduct)).all():
        if hasattr(product, "business_key") and not product.business_key:
            product.business_key = f"product-{_stable_seed_key(product.name)}"
        product.description = product.description or f"Описание образовательного продукта «{product.name}»."
        if hasattr(product, "documentation_url") and not product.documentation_url:
            product.documentation_url = "https://edu-rt.ru/course"
        product.is_active = True

    for program in db.scalars(select(ITProgram)).all():
        if hasattr(program, "description") and not program.description:
            program.description = f"Образовательная программа «{program.name}» ({program.version})."
        program.is_active = True

    # Local users.  keycloak_user_id must match the actual token `sub`, so it is
    # filled only when explicitly supplied through env; inventing it would break auth.
    for username, user in users.items():
        env_name = f"SEED_KEYCLOAK_SUB_{username.upper()}"
        if hasattr(user, "keycloak_user_id") and not user.keycloak_user_id:
            user.keycloak_user_id = os.getenv(env_name) or None
        user.is_active = True

    # Legacy contacts: ensure fields useful for University 360 are present.
    for index, contact in enumerate(db.scalars(select(UniversityContact).order_by(UniversityContact.created_at)).all(), 1):
        # Do not invent a real-looking public phone for a real university.
        # The verified organizational e-mail remains the primary seed contact.
        if hasattr(contact, "department") and not contact.department:
            contact.department = "Учебное или профильное подразделение"
        contact.is_primary = True if contact.is_primary is None else contact.is_primary
        contact.is_active = True
        contact.comment = contact.comment or "Основной организационный контакт для взаимодействия по программам."

    # Organizations and assignments.
    for org in db.scalars(select(Organization)).all():
        org.status = org.status or "active"
        if hasattr(org, "comment") and not org.comment:
            org.comment = "Организация участвует в действующих образовательных программах RTK EduFlow."

    for membership in db.scalars(select(ManagerMembership)).all():
        if hasattr(membership, "valid_from") and membership.valid_from is None:
            membership.valid_from = now - timedelta(days=180)
        membership.is_active = True

    for assignment in db.scalars(select(OrgAssignment)).all():
        assignment.status = assignment.status or "active"
        assignment.assigned_at = assignment.assigned_at or (now - timedelta(days=120))
        assignment.assigned_by = assignment.assigned_by or users["admin1"].id

    # Workflow metadata.
    for template in db.scalars(select(WorkflowTemplate)).all():
        template.description = template.description or f"Playbook «{template.name}»: последовательность этапов и правил взаимодействия."
        template.is_active = True
        template.created_by = template.created_by or users["admin1"].id
        template.status = template.status or "published"
        template.applies_to_type = template.applies_to_type or "all"

    for version in db.scalars(select(WorkflowVersion)).all():
        version.created_by = version.created_by or users["admin1"].id
        if version.status == "PUBLISHED" and version.published_at is None:
            version.published_at = now - timedelta(days=210)

    for stage in db.scalars(select(WorkflowStage)).all():
        stage.description = stage.description or f"Действия и критерии завершения этапа «{stage.name}»."
        stage.is_active = True
        stage.is_initial = bool(stage.is_initial)
        stage.is_final = bool(stage.is_final)
        stage.is_optional = bool(stage.is_optional)
        stage.semester_critical = bool(stage.semester_critical)
        stage.default_duration_days = stage.default_duration_days or 7
        stage.requires_comment = bool(stage.requires_comment)
        stage.requires_attachment = bool(stage.requires_attachment)

    for catalog in db.scalars(select(WorkflowStageCatalog)).all():
        catalog.description = catalog.description or f"Справочное описание этапа «{catalog.name}»."
        catalog.is_active = bool(catalog.is_active)

    for transition in db.scalars(select(WorkflowTransition)).all():
        transition.name = transition.name or "Переход между этапами"
        transition.is_default = True if transition.is_default is None else transition.is_default

    for index, stakeholder in enumerate(db.scalars(select(Stakeholder).order_by(Stakeholder.created_at)).all(), 1):
        stakeholder.role_code = stakeholder.role_code or "other"
        stakeholder.position = stakeholder.position or "Представитель образовательной организации"
        stakeholder.email = stakeholder.email or f"stakeholder{index:02d}@rtk-edu.local"
        stakeholder.phone = stakeholder.phone or f"+7-000-600-{index:04d}"
        stakeholder.is_primary = bool(stakeholder.is_primary)
        stakeholder.is_active = True if stakeholder.is_active is None else stakeholder.is_active
        stakeholder.comment = stakeholder.comment or "Контакт образовательной организации для рабочего взаимодействия."

    # Legacy interactions: complete contractual dates and workflow binding.
    interactions = list(db.scalars(select(UniversityInteraction).order_by(UniversityInteraction.created_at)).all())
    for index, interaction in enumerate(interactions, 1):
        version = _published_version(db, interaction.workflow_template_id) if interaction.workflow_template_id else None
        if hasattr(interaction, "workflow_version_id") and interaction.workflow_version_id is None and version is not None:
            interaction.workflow_version_id = version.id
        interaction.status = interaction.status or "ACTIVE"
        interaction.started_at = interaction.started_at or (now - timedelta(days=120 - (index % 30)))
        interaction.comment = interaction.comment or "Взаимодействие сохранено в legacy-контуре для обратной совместимости."
        if interaction.license_signed:
            interaction.license_signed_at = interaction.license_signed_at or (now - timedelta(days=70 - (index % 12)))
            interaction.license_valid_until = interaction.license_valid_until or (now + timedelta(days=260 + index))
        if not interaction.university_responsibles:
            interaction.university_responsibles = "Ответственный учебного подразделения"

    db.flush()

    # ProgramInstance is the canonical business unit.  Bind every program to a
    # concrete published version and initialize missing runtime state.
    runtime = WorkflowRuntimeService(db)
    programs = list(db.scalars(select(ProgramInstance).order_by(ProgramInstance.created_at)).all())
    for index, program in enumerate(programs, 1):
        version = _published_version(db, program.playbook_template_id) if program.playbook_template_id else None
        if program.workflow_version_id is None and version is not None:
            program.workflow_version_id = version.id
        if not program.template_snapshot and program.playbook_template_id is not None:
            template = db.get(WorkflowTemplate, program.playbook_template_id)
            if template is not None:
                program.template_snapshot = ProgramInstanceService(db)._template_snapshot(template)
        program.status = program.status or "active"
        program.started_at = program.started_at or (now - timedelta(days=95 - (index % 20)))
        program.comment = program.comment or "Программа внедрения с полным операционным контекстом."
        if program.current_stage_instance_id is None and program.playbook_template_id is not None:
            runtime.initialize_program_workflow(program, responsible_user_id=program.kam_user_id)
            db.flush()
        if program.current_stage_instance_id is not None and not program.current_stage_code:
            instance = db.get(WorkflowStageInstance, program.current_stage_instance_id)
            if instance is not None:
                stage = db.get(WorkflowStage, instance.workflow_stage_id)
                if stage is not None and stage.stage_catalog_id is not None:
                    catalog = db.get(WorkflowStageCatalog, stage.stage_catalog_id)
                    if catalog is not None:
                        program.current_stage_code = catalog.code
        if program.health_score is None:
            program.health_score = 80 - (index % 4) * 10
        if not program.health_band:
            program.health_band = "green" if program.health_score >= 70 else "yellow"

    db.flush()

    # Program-scoped stakeholders use deterministic synthetic seed values.
    for index, program in enumerate(programs, 1):
        org = db.get(Organization, program.organization_id)
        if org is None:
            continue
        stakeholder = db.scalar(
            select(Stakeholder).where(
                Stakeholder.organization_id == org.id,
                Stakeholder.program_instance_id == program.id,
                Stakeholder.role_code == "teacher",
            )
        )
        if stakeholder is None:
            stakeholder = Stakeholder(
                organization_id=org.id,
                program_instance_id=program.id,
                role_code="teacher",
                full_name=TEACHER_NAMES[(index - 1) % len(TEACHER_NAMES)],
                position="Преподаватель-носитель продукта",
                email=f"teacher{index:02d}@rtk-edu.local",
                phone=f"+7-000-700-{index:04d}",
                is_primary=False,
                is_active=True,
                comment="Преподаватель-носитель продукта, закреплённый за программой.",
            )
            db.add(stakeholder)
        else:
            stakeholder.position = stakeholder.position or "Преподаватель-носитель продукта"
            stakeholder.email = stakeholder.email or f"teacher{index:02d}@rtk-edu.local"
            stakeholder.phone = stakeholder.phone or f"+7-000-700-{index:04d}"
            stakeholder.is_active = True
            stakeholder.comment = stakeholder.comment or "Преподаватель-носитель продукта, закреплённый за программой."

    db.flush()


def seed_auxiliary_relations(db: Session, users: dict[str, User]) -> None:
    """Seed relation/history tables that are not needed by the minimal seed."""
    now = _utcnow()
    interactions = list(db.scalars(select(UniversityInteraction).order_by(UniversityInteraction.created_at)).all())
    contacts = list(db.scalars(select(UniversityContact).order_by(UniversityContact.created_at)).all())

    # interaction_contacts
    for interaction in interactions:
        contact = next((c for c in contacts if c.university_id == interaction.university_id), None)
        if contact is None:
            continue
        _core_upsert(
            db,
            "interaction_contacts",
            {"interaction_id": interaction.id, "contact_id": contact.id},
            {"role": "decision_maker", "is_primary": True},
        )

    # data_access_scopes: one explicit legacy scope per KAM for diagnostics/RBAC scenarios.
    for interaction in interactions[:8]:
        if interaction.manager_user_id is None:
            continue
        _core_upsert(
            db,
            "data_access_scopes",
            {
                "subject_user_id": interaction.manager_user_id,
                "university_id": interaction.university_id,
                "interaction_id": interaction.id,
            },
            {
                "access_level": "write",
                "granted_by_user_id": users["admin1"].id,
                "valid_from": now - timedelta(days=90),
                "valid_to": now + timedelta(days=365),
                "is_active": True,
            },
        )

    # One historical reassignment entry; current responsibility remains unchanged.
    if interactions:
        interaction = interactions[0]
        old_manager = users.get("kam2")
        new_manager = db.get(User, interaction.manager_user_id) if interaction.manager_user_id else users.get("kam1")
        if old_manager is not None and new_manager is not None:
            _core_upsert(
                db,
                "responsible_assignment_history",
                {"interaction_id": interaction.id, "reason": "Плановая передача ответственности между менеджерами"},
                {
                    "old_manager_user_id": old_manager.id,
                    "new_manager_user_id": new_manager.id,
                    "changed_by_user_id": users["manager1"].id,
                    "changed_at": now - timedelta(days=75),
                },
            )

    # Vendor contacts with stable business keys.
    vendors = list(db.scalars(select(Vendor).order_by(Vendor.name)).all())
    products = list(db.scalars(select(ITProduct).order_by(ITProduct.name)).all())
    for index, vendor in enumerate(vendors, 1):
        vendor_product = next((p for p in products if p.vendor_id == vendor.id), None)
        business_key = f"vendor-contact-{_stable_seed_key(vendor.name)}"
        _core_upsert(
            db,
            "vendor_contacts",
            {"business_key": business_key},
            {
                "vendor_id": vendor.id,
                "product_id": vendor_product.id if vendor_product else None,
                "full_name": VENDOR_CONTACT_NAMES[(index - 1) % len(VENDOR_CONTACT_NAMES)],
                "phone": f"+7-000-900-{index:04d}",
                "email": f"vendor{index:02d}@rtk-edu.local",
                "preferred_channel": "email",
            },
        )

    # Historical assignment covers ended_at without corrupting the active owner.
    historical_org = db.scalar(select(Organization).order_by(Organization.created_at.desc()))
    if historical_org is not None:
        _core_upsert(
            db,
            "org_assignments",
            {
                "organization_id": historical_org.id,
                "user_id": users["kam4"].id,
                "status": "ended",
            },
            {
                "assigned_at": now - timedelta(days=300),
                "assigned_by": users["manager1"].id,
                "ended_at": now - timedelta(days=190),
            },
        )

    db.flush()


def seed_checklist_values_and_comments(db: Session, users: dict[str, User]) -> None:
    now = _utcnow()
    stage_instances = list(db.scalars(select(WorkflowStageInstance)).all())
    for stage_instance in stage_instances:
        program = db.get(ProgramInstance, stage_instance.program_instance_id) if stage_instance.program_instance_id else None
        stakeholder = None
        if program is not None:
            stakeholder = db.scalar(
                select(Stakeholder).where(
                    Stakeholder.program_instance_id == program.id,
                    Stakeholder.is_active.is_(True),
                )
            )
        values = list(
            db.execute(
                select(ProgramChecklistValue, PlaybookChecklistItem)
                .join(PlaybookChecklistItem, PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id)
                .where(ProgramChecklistValue.stage_instance_id == stage_instance.id)
            )
        )
        for value, item in values:
            is_completed = str(stage_instance.status).upper() in {"COMPLETED", "DONE"}
            if is_completed:
                value.is_done = True
            elif value.is_done is None:
                value.is_done = False

            # Fill the field matching item_type.  Other value_* columns stay NULL
            # because the checklist is a typed union, not four simultaneous values.
            if value.is_done:
                if item.item_type == "text" and not value.value_text:
                    value.value_text = f"Выполнено требование «{item.label}»."
                elif item.item_type == "number" and value.value_number is None:
                    value.value_number = 25
                elif item.item_type == "date" and value.value_date is None:
                    value.value_date = date.today() - timedelta(days=5)
                elif item.item_type == "stakeholder_role" and value.stakeholder_id is None and stakeholder is not None:
                    value.stakeholder_id = stakeholder.id

        author_id = stage_instance.responsible_user_id or users["admin1"].id
        _core_upsert(
            db,
            "workflow_stage_comments",
            {
                "stage_instance_id": stage_instance.id,
                "author_user_id": author_id,
                "text": "Текущий статус этапа подтверждён ответственным сотрудником.",
            },
            {"deleted_at": None},
        )

    # Transition history for already completed adjacent stages.
    for program in db.scalars(select(ProgramInstance)).all():
        instances = list(
            db.scalars(
                select(WorkflowStageInstance)
                .join(WorkflowStage, WorkflowStage.id == WorkflowStageInstance.workflow_stage_id)
                .where(WorkflowStageInstance.program_instance_id == program.id)
                .order_by(WorkflowStage.order_index)
            ).all()
        )
        for left, right in zip(instances, instances[1:]):
            if str(left.status).upper() not in {"COMPLETED", "DONE"}:
                continue
            transition = db.scalar(
                select(WorkflowTransition).where(
                    WorkflowTransition.from_stage_id == left.workflow_stage_id,
                    WorkflowTransition.to_stage_id == right.workflow_stage_id,
                )
            )
            if transition is None:
                continue
            _core_upsert(
                db,
                "workflow_transition_history",
                {
                    "program_instance_id": program.id,
                    "from_stage_instance_id": left.id,
                    "to_stage_instance_id": right.id,
                },
                {
                    "interaction_id": program.legacy_interaction_id,
                    "transition_id": transition.id,
                    "performed_by": program.kam_user_id or users["admin1"].id,
                    "comment": "Переход выполнен после подтверждения обязательных требований этапа.",
                    "performed_at": left.completed_at or (now - timedelta(days=3)),
                },
            )

    db.flush()


def seed_integration_signals_full(db: Session) -> None:
    """Create deterministic WEBSITE/LMS/PAYMENT snapshots for every active program."""
    now = _utcnow()
    programs = list(db.scalars(select(ProgramInstance).where(ProgramInstance.status == "active").order_by(ProgramInstance.created_at)).all())
    # A payment course mapping is unique by (source, external_course_name). Several
    # ProgramInstance records may use one product/course, so keep newly created
    # mappings visible in this run instead of adding duplicate pending ORM rows.
    course_mappings = {
        mapping.external_course_name: mapping
        for mapping in db.scalars(
            select(ExternalCourseMapping).where(ExternalCourseMapping.source == "PAYMENT")
        ).all()
    }
    for index, program in enumerate(programs, 1):
        org = db.get(Organization, program.organization_id)
        product = db.get(ITProduct, program.product_id)
        if org is None or product is None:
            continue

        applications = 18 + index * 3
        students = max(6, applications - (index % 5) * 2)
        streams = 1 + (index % 3)
        teacher_activity = date.today() - timedelta(days=index % 11)

        signal_specs = [
            (
                "WEBSITE",
                f"WEB-{program.id}",
                {
                    "organization": org.short_name or org.name,
                    "product": product.name,
                    "applications_count": applications,
                    "source_type": "seed",
                },
                {
                    "organization_id": str(org.id),
                    "product_id": str(product.id),
                    "applications_count": applications,
                },
                now - timedelta(days=2),
            ),
            (
                "LMS",
                f"LMS-{program.id}",
                {
                    "organization": org.short_name or org.name,
                    "product": product.name,
                    "students_count": students,
                    "streams_count": streams,
                    "teacher_activity_on": teacher_activity.isoformat(),
                    "source_type": "seed",
                },
                {
                    "organization_id": str(org.id),
                    "product_id": str(product.id),
                    "students_count": students,
                    "streams_count": streams,
                    "teacher_activity_on": teacher_activity.isoformat(),
                },
                now - timedelta(days=1),
            ),
        ]
        for source, external_key, payload, normalized, received_at in signal_specs:
            existing = db.scalar(
                select(IntegrationSignal).where(
                    IntegrationSignal.source == source,
                    IntegrationSignal.external_key == external_key,
                )
            )
            if existing is None:
                existing = IntegrationSignal(source=source, external_key=external_key)
                db.add(existing)
            existing.status = "mapped"
            existing.received_at = received_at
            existing.organization_id = org.id
            existing.program_instance_id = program.id
            existing.payload = payload
            existing.normalized_payload = normalized
            existing.error_code = None
            existing.error_message = None
            existing.match_reason = "exact organization + product mapping"

        # Explicit PAYMENT mapping for each seeded program.  These records are
        # operational B2C signals only, never revenue/financial facts.
        course_name = product.name
        stream_id = f"STREAM-{index:02d}"
        course_mapping = course_mappings.get(course_name)
        if course_mapping is None:
            course_mapping = ExternalCourseMapping(
                source="PAYMENT",
                external_course_name=course_name,
                direction_id=program.direction_id,
                product_id=program.product_id,
                status="active",
            )
            db.add(course_mapping)
            course_mappings[course_name] = course_mapping
        else:
            course_mapping.direction_id = program.direction_id
            course_mapping.product_id = program.product_id
            course_mapping.status = "active"

        stream_mapping = db.scalar(
            select(ExternalStreamMapping).where(
                ExternalStreamMapping.source == "PAYMENT",
                ExternalStreamMapping.external_course_name == course_name,
                ExternalStreamMapping.external_stream_id == stream_id,
            )
        )
        if stream_mapping is None:
            stream_mapping = ExternalStreamMapping(
                source="PAYMENT",
                external_course_name=course_name,
                external_stream_id=stream_id,
                program_instance_id=program.id,
            )
            db.add(stream_mapping)
        else:
            stream_mapping.program_instance_id = program.id

        for payment_no in range(1, 1 + (index % 4) + 1):
            external_key = f"PAY-{program.id}-{payment_no:02d}"
            payment = db.scalar(
                select(IntegrationSignal).where(
                    IntegrationSignal.source == "PAYMENT",
                    IntegrationSignal.external_key == external_key,
                )
            )
            if payment is None:
                payment = IntegrationSignal(source="PAYMENT", external_key=external_key)
                db.add(payment)
            payment.status = "mapped"
            payment.received_at = now - timedelta(hours=12 - payment_no)
            payment.organization_id = org.id
            payment.program_instance_id = program.id
            payment.payload = {
                "Номер заявки": external_key,
                "Курс": course_name,
                "Номер потока": stream_id,
                "Email": f"learner{index:02d}{payment_no:02d}@source.local",
                "source_type": "seed",
            }
            payment.normalized_payload = {
                "application_number": external_key,
                "course": course_name,
                "stream": stream_id,
                "contact_hash": hashlib.sha256(f"student{index:02d}{payment_no:02d}".encode()).hexdigest(),
            }
            payment.error_code = None
            payment.error_message = None
            payment.match_reason = "explicit course + stream mapping"

    # Diagnostic examples cover error fields without polluting ProgramMetric.
    first_org = db.scalar(select(Organization).order_by(Organization.created_at))
    if first_org is not None:
        diagnostic_specs = [
            (
                "PAYMENT",
                "PAY-UNMATCHED-001",
                "unmatched",
                "MAPPING_NOT_FOUND",
                "Отсутствует сопоставление внешнего курса или потока",
                {"Номер заявки": "PAY-UNMATCHED-001", "Курс": "Архитектура облачных решений", "Номер потока": "404", "source_type": "seed"},
            ),
            (
                "LMS",
                "LMS-INVALID-001",
                "error",
                "VALIDATION_ERROR",
                "Некорректный LMS payload: значение students_count не прошло валидацию",
                {"organization": str(first_org.id), "students_count": "not-a-number", "source_type": "seed"},
            ),
        ]
        for source, external_key, status, error_code, error_message, payload in diagnostic_specs:
            signal = db.scalar(
                select(IntegrationSignal).where(
                    IntegrationSignal.source == source,
                    IntegrationSignal.external_key == external_key,
                )
            )
            if signal is None:
                signal = IntegrationSignal(source=source, external_key=external_key)
                db.add(signal)
            signal.status = status
            signal.received_at = now
            signal.organization_id = first_org.id
            signal.program_instance_id = None
            signal.payload = payload
            signal.normalized_payload = {"source_type": "seed", "valid": False}
            signal.error_code = error_code
            signal.error_message = error_message
            signal.match_reason = "diagnostic validation case"

    db.flush()


def seed_contracts_full(db: Session) -> None:
    now = _utcnow()
    programs = list(db.scalars(select(ProgramInstance).order_by(ProgramInstance.created_at)).all())
    licenses_by_contract_product = {
        (license_record.contract_id, license_record.product_id): license_record
        for license_record in db.scalars(select(License)).all()
        if license_record.contract_id is not None
    }
    for index, program in enumerate(programs, 1):
        contract = db.scalar(
            select(Contract).where(
                Contract.organization_id == program.organization_id,
            ).order_by(Contract.created_at)
        )
        if contract is None:
            continue
        contract.status = contract.status or "active"
        contract.signed_at = contract.signed_at or (now - timedelta(days=140 - (index % 15)))
        contract.valid_from = contract.valid_from or (now - timedelta(days=135 - (index % 15)))
        contract.signed_on = contract.signed_on or date(2026, 1, 15)
        contract.valid_until = contract.valid_until or (now + timedelta(days=700))
        contract.comment = contract.comment or "Рамочный договор на использование образовательного продукта."

        license_key = (contract.id, program.product_id)
        license_record = licenses_by_contract_product.get(license_key)
        if license_record is None:
            continue
        license_record.license_number = license_record.license_number or f"LIC-{str(program.id)[:8]}"
        license_record.signed_at = license_record.signed_at or (now - timedelta(days=100 - (index % 10)))
        license_record.valid_until = license_record.valid_until or (now + timedelta(days=365))
        license_record.transfer_status = license_record.transfer_status or "transferred"
        license_record.product_access = license_record.product_access or "granted"
        if license_record.transfer_status.lower() in {"transferred", "done", "completed"}:
            license_record.transferred_on = license_record.transferred_on or (date.today() - timedelta(days=45 - (index % 10)))
        license_record.comment = license_record.comment or "Лицензия привязана к конкретной программе внедрения."

        carrier = db.scalar(select(TeacherCarrier).where(TeacherCarrier.program_instance_id == program.id))
        if carrier is not None:
            stakeholder = db.scalar(
                select(Stakeholder).where(
                    Stakeholder.program_instance_id == program.id,
                    Stakeholder.role_code == "teacher",
                )
            )
            carrier.organization_id = program.organization_id
            carrier.product_id = program.product_id
            carrier.stakeholder_id = carrier.stakeholder_id or (stakeholder.id if stakeholder else None)
            carrier.full_name = carrier.full_name or (stakeholder.full_name if stakeholder else TEACHER_NAMES[(index - 1) % len(TEACHER_NAMES)])
            carrier.trained_on = carrier.trained_on or (date.today() - timedelta(days=90))
            carrier.qualification_until = carrier.qualification_until or (date.today() + timedelta(days=275))
            carrier.last_lms_activity_on = carrier.last_lms_activity_on or (date.today() - timedelta(days=index % 14))
            carrier.status = carrier.status or "active"

    db.flush()


def seed_governance_audit_and_requests(db: Session, users: dict[str, User]) -> None:
    """Representative governance/audit data without mutating the published runtime version."""
    now = _utcnow()
    template = get_by_field(db, WorkflowTemplate, "code", "full_cycle")
    version = _published_version(db, template.id) if template is not None else None
    change_request_row = None

    if version is not None:
        change_request_row = _core_upsert(
            db,
            "workflow_change_requests",
            {
                "workflow_version_id": version.id,
                "requested_by": users["manager1"].id,
                "reason": "Запрос на уточнение нормативного срока этапа",
            },
            {
                "status": "APPROVED",
                "reviewed_by": users["admin1"].id,
                "requested_at": now - timedelta(days=40),
                "reviewed_at": now - timedelta(days=39),
                "review_comment": "Запрос рассмотрен; опубликованная версия остаётся неизменяемой.",
                "dangerous_changes_snapshot": {"source_type": "seed", "changes": ["default_duration_days"]},
            },
        )

        # Create one archived governance-only version. It is never bound to an
        # active ProgramInstance, but provides supersedes/mapping/job data.
        archived_version = db.scalar(
            select(WorkflowVersion).where(
                WorkflowVersion.workflow_template_id == template.id,
                WorkflowVersion.status == "ARCHIVED",
                WorkflowVersion.supersedes_version_id == version.id,
            )
        )
        if archived_version is None:
            max_version = max(
                [v.version for v in db.scalars(select(WorkflowVersion).where(WorkflowVersion.workflow_template_id == template.id)).all()]
                or [version.version]
            )
            archived_version = WorkflowVersion(
                workflow_template_id=template.id,
                version=max_version + 1,
                status="ARCHIVED",
                supersedes_version_id=version.id,
                created_by=users["admin1"].id,
                published_at=now - timedelta(days=35),
                archived_at=now - timedelta(days=30),
            )
            db.add(archived_version)
            db.flush()

        source_stages = list(
            db.scalars(
                select(WorkflowStage)
                .where(WorkflowStage.workflow_version_id == version.id)
                .order_by(WorkflowStage.order_index)
            ).all()
        )
        target_stages: list[WorkflowStage] = []
        for source_stage in source_stages:
            target = db.scalar(
                select(WorkflowStage).where(
                    WorkflowStage.workflow_version_id == archived_version.id,
                    WorkflowStage.stage_catalog_id == source_stage.stage_catalog_id,
                    WorkflowStage.order_index == source_stage.order_index,
                )
            )
            if target is None:
                target = WorkflowStage(
                    workflow_template_id=template.id,
                    workflow_version_id=archived_version.id,
                    name=source_stage.name,
                    description=f"Архивная копия: {source_stage.description or source_stage.name}",
                    order_index=source_stage.order_index,
                    is_initial=source_stage.is_initial,
                    is_final=source_stage.is_final,
                    is_optional=source_stage.is_optional,
                    semester_critical=source_stage.semester_critical,
                    default_duration_days=source_stage.default_duration_days,
                    requires_comment=source_stage.requires_comment,
                    requires_attachment=source_stage.requires_attachment,
                    is_active=False,
                    stage_catalog_id=source_stage.stage_catalog_id,
                )
                db.add(target)
                db.flush()
            target_stages.append(target)
            _core_upsert(
                db,
                "workflow_stage_mappings",
                {
                    "source_version_id": version.id,
                    "target_version_id": archived_version.id,
                    "source_stage_id": source_stage.id,
                    "target_stage_id": target.id,
                },
                {"created_by": users["admin1"].id},
            )

        if change_request_row is not None:
            _core_upsert(
                db,
                "workflow_migration_jobs",
                {
                    "source_version_id": version.id,
                    "target_version_id": archived_version.id,
                    "change_request_id": change_request_row["id"],
                },
                {
                    "status": "FAILED",
                    "created_by": users["admin1"].id,
                    "started_at": now - timedelta(days=29, minutes=5),
                    "completed_at": now - timedelta(days=29),
                    "affected_interaction_count": 3,
                    "migrated_interaction_count": 0,
                    "error_message": "Миграция остановлена из-за несовместимости этапов; активные программы не изменены.",
                },
            )

    # Knowledge-base page/request.
    page = _core_upsert(
        db,
        "documentation_pages",
        {"slug": "getting-started"},
        {
            "title": "Начало работы с RTK EduFlow",
            "route_pattern": "/docs/getting-started",
            "parent_id": None,
            "sort_order": 10,
            "content_markdown": "# RTK EduFlow\nКраткая встроенная документация по работе с CRM.",
            "source_file_id": None,
        },
    )
    if page is not None and page.get("id") is not None:
        _core_upsert(
            db,
            "documentation_requests",
            {
                "page_id": page["id"],
                "author_user_id": users["kam1"].id,
                "subject": "Уточнить описание этапа",
            },
            {
                "message": "Нужно уточнить критерии завершения этапа и перечень обязательных документов.",
                "status": "open",
            },
        )

    active_count = len(list(db.scalars(select(ProgramInstance).where(ProgramInstance.status == "active")).all()))
    _core_upsert(
        db,
        "report_jobs",
        {"request_id": "REPORT-PROGRAMS-001"},
        {
            "status": "completed",
            "format": "xlsx",
            "filter_snapshot": {"status": ["active"], "source_type": "seed"},
            "columns_snapshot": ["organization", "product", "stage", "health", "kam"],
            "created_by": users["manager1"].id,
            "queued_at": now - timedelta(hours=3),
            "started_at": now - timedelta(hours=2, minutes=58),
            "finished_at": now - timedelta(hours=2, minutes=55),
            "row_count": active_count,
            "error_code": None,
            "error_message": None,
        },
    )
    _core_upsert(
        db,
        "report_jobs",
        {"request_id": "REPORT-FAILED-001"},
        {
            "status": "failed",
            "format": "pdf",
            "filter_snapshot": {"source_type": "seed", "scenario": "failed"},
            "columns_snapshot": ["organization", "health"],
            "created_by": users["admin1"].id,
            "queued_at": now - timedelta(hours=1),
            "started_at": now - timedelta(minutes=58),
            "finished_at": now - timedelta(minutes=57),
            "row_count": 0,
            "error_code": "EXPORT_ERROR",
            "error_message": "Ошибка формирования отчёта: не удалось подготовить выходной файл.",
        },
    )

    # Immutable audit examples include both success and failed outcomes.
    program = db.scalar(select(ProgramInstance).order_by(ProgramInstance.created_at))
    if program is not None:
        audit_specs = [
            ("program.view", "success", "Карточка программы открыта пользователем", None),
            ("workflow.transition", "success", "Переход по workflow подтверждён пользователем", None),
            ("integration.signal.sync", "success", "Агрегаты программы пересчитаны после интеграционного сигнала", None),
            ("report.export", "failed", "Ошибка формирования файла отчёта", "EXPORT_ERROR"),
        ]
        for action, result, reason, error_code in audit_specs:
            _core_upsert(
                db,
                "audit_events",
                {"request_id": f"AUDIT-{_stable_seed_key(action)}", "action": action},
                {
                    "actor_user_id": users["kam1"].id,
                    "entity_type": "program_instance",
                    "entity_id": str(program.id),
                    "result": result,
                    "reason": reason,
                    "error_code": error_code,
                    "metadata": {"source_type": "seed", "program_instance_id": str(program.id)},
                },
            )

    db.flush()

def _object_storage_client():
    """Return (put_object, delete_object) callables or (None, None)."""
    if os.getenv("SEED_FILES", "1").lower() not in {"1", "true", "yes", "on"}:
        return None, None

    endpoint = (
        os.getenv("S3_ENDPOINT_URL")
        or os.getenv("S3_ENDPOINT")
        or os.getenv("MINIO_ENDPOINT_URL")
        or os.getenv("MINIO_ENDPOINT")
    )
    access_key = os.getenv("S3_ACCESS_KEY") or os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("MINIO_ROOT_USER")
    secret_key = os.getenv("S3_SECRET_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("MINIO_ROOT_PASSWORD")
    if not endpoint or not access_key or not secret_key:
        return None, None
    if not endpoint.startswith("http://") and not endpoint.startswith("https://"):
        endpoint = f"http://{endpoint}:9000" if ":" not in endpoint else f"http://{endpoint}"

    try:
        import boto3  # type: ignore

        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=os.getenv("S3_REGION", "us-east-1"),
        )

        def put_object(bucket: str, key: str, body: bytes, mime: str) -> None:
            try:
                client.head_bucket(Bucket=bucket)
            except Exception:
                client.create_bucket(Bucket=bucket)
            client.put_object(Bucket=bucket, Key=key, Body=body, ContentType=mime)

        def delete_object(bucket: str, key: str) -> None:
            client.delete_object(Bucket=bucket, Key=key)

        return put_object, delete_object
    except Exception:
        pass

    try:
        from minio import Minio  # type: ignore
        from io import BytesIO
        endpoint_no_scheme = endpoint.replace("http://", "").replace("https://", "")
        client = Minio(endpoint_no_scheme, access_key=access_key, secret_key=secret_key, secure=endpoint.startswith("https://"))

        def put_object(bucket: str, key: str, body: bytes, mime: str) -> None:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
            client.put_object(bucket, key, BytesIO(body), len(body), content_type=mime)

        def delete_object(bucket: str, key: str) -> None:
            client.remove_object(bucket, key)

        return put_object, delete_object
    except Exception:
        return None, None


def seed_object_storage_records(db: Session, users: dict[str, User]) -> None:
    """Seed real MinIO objects + file rows; safely skipped when object storage is disabled."""
    put_object, delete_object = _object_storage_client()
    files_table = _table(db, "files")
    if put_object is None or files_table is None:
        print("[seed] object storage is unavailable/disabled; file-backed seed records were skipped")
        return

    now = _utcnow()

    def ensure_file(bucket: str, key: str, name: str, mime: str, kind: str, content: bytes, *, deleted=False, purged=False):
        checksum = hashlib.sha256(content).hexdigest()
        if not purged:
            put_object(bucket, key, content, mime)
        else:
            try:
                delete_object(bucket, key)
            except Exception:
                pass
        values = {
            "original_name": name,
            "storage_name": key.rsplit("/", 1)[-1],
            "storage_path": f"{bucket}/{key}",
            "mime_type": mime,
            "extension": Path(name).suffix.lower().lstrip("."),
            "size_bytes": len(content),
            "checksum": checksum,
            "provider": "s3",
            "attachment_kind": kind,
            "uploaded_by": users["admin1"].id,
            "scan_status": "clean",
            "deleted_at": now - timedelta(days=5) if deleted else None,
            "delete_after": now + timedelta(days=25) if deleted else None,
            "deleted_by": users["admin1"].id if deleted else None,
            "purged_at": now - timedelta(days=1) if purged else None,
        }
        return _core_upsert(db, "files", {"bucket": bucket, "object_key": key}, values)

    contract_file = ensure_file(
        "workflow-files",
        "contracts/signed-contract.txt",
        "signed-contract.txt",
        "text/plain",
        "signed_contract",
        "Подписанный договор. Содержимое сформировано seed-скриптом и не является юридическим документом.\n".encode(),
    )
    license_file = ensure_file(
        "workflow-files",
        "licenses/license.txt",
        "license.txt",
        "text/plain",
        "license",
        "Лицензия на образовательный продукт. Содержимое сформировано seed-скриптом и не является юридическим документом.\n".encode(),
    )
    source_file = ensure_file(
        "imports",
        "vendor-catalog.csv",
        "vendor-catalog.csv",
        "text/csv",
        "import_source",
        "Компания,Продукт,ФИО,Телефон,Почта,Способ связи\nООО «РТК ИТ»,Инженер-тестировщик,Сергей Лебедев,+70000000000,vendor.contact@rtk-edu.local,email\n".encode(),
    )
    report_file = ensure_file(
        "reports",
        "programs-report.csv",
        "programs-report.csv",
        "text/csv",
        "report",
        "organization,product,status\nМГУ,DevOps-инженер с нуля,active\n".encode(),
    )
    doc_file = ensure_file(
        "documentation",
        "getting-started.md",
        "getting-started.md",
        "text/markdown",
        "documentation",
        b"# RTK EduFlow\nSeeded documentation source.\n",
    )
    # 1x1 transparent PNG for documentation_images.
    import base64
    image_file = ensure_file(
        "documentation",
        "getting-started.png",
        "getting-started.png",
        "image/png",
        "documentation_image",
        base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
    )

    # Lifecycle examples for delete_after/deleted_by/purged_at coverage.
    ensure_file(
        "workflow-files",
        "lifecycle/soft-deleted.txt",
        "soft-deleted.txt",
        "text/plain",
        "other",
        b"Soft-deleted workflow attachment\n",
        deleted=True,
    )
    ensure_file(
        "workflow-files",
        "lifecycle/purged.txt",
        "purged.txt",
        "text/plain",
        "other",
        b"Purged workflow attachment metadata\n",
        purged=True,
    )

    # Attach real file rows to one contract/license and one stage attachment.
    first_contract = db.scalar(select(Contract).order_by(Contract.created_at))
    if first_contract is not None and contract_file is not None:
        first_contract.attachment_id = contract_file.get("id")
    first_license = db.scalar(select(License).order_by(License.created_at))
    if first_license is not None and license_file is not None:
        first_license.attachment_id = license_file.get("id")
    first_stage = db.scalar(select(WorkflowStageInstance).order_by(WorkflowStageInstance.created_at))
    if first_stage is not None and contract_file is not None:
        _core_upsert(
            db,
            "workflow_stage_attachments",
            {"stage_instance_id": first_stage.id, "file_id": contract_file.get("id")},
            {"uploaded_by": users["kam1"].id, "description": "Подписанный документ, приложенный к этапу workflow."},
        )

    # Import scenario: mapping + fields + completed job + an invalid-row example.
    mapping = _core_upsert(
        db,
        "import_mappings",
        {"name": "Vendor catalog mapping"},
        {"created_by": users["admin1"].id, "is_system": False},
    )
    if mapping is not None:
        field_specs = [
            ("Компания", "vendor.name", True, "trim"),
            ("Продукт", "product.name", True, "split_csv"),
            ("ФИО", "vendor_contact.full_name", False, "trim"),
            ("Телефон", "vendor_contact.phone", False, "normalize_phone"),
            ("Почта", "vendor_contact.email", False, "lower"),
            ("Способ связи", "vendor_contact.preferred_channel", False, "lower"),
        ]
        for source_column, target_field, required, transformer in field_specs:
            _core_upsert(
                db,
                "import_mapping_fields",
                {"mapping_id": mapping["id"], "source_column": source_column},
                {"target_field": target_field, "required": required, "transformer": transformer},
            )

    job = None
    if source_file is not None:
        job = _core_upsert(
            db,
            "import_jobs",
            {"source_file_id": source_file["id"], "created_by": users["admin1"].id},
            {
                "status": "completed",
                "sheet_name": "Sheet1",
                "header_row": 1,
                "mapping_id": mapping.get("id") if mapping else None,
                "mapping_snapshot": {"source_type": "seed", "name": "Vendor catalog mapping"},
                "diff_snapshot": {"create": 1, "update": 0, "skip": 0, "conflict": 0},
                "total_rows": 2,
                "valid_rows": 1,
                "invalid_rows": 1,
                "create_count": 1,
                "update_count": 0,
                "skip_count": 0,
                "conflict_count": 0,
                "validated_at": now - timedelta(minutes=15),
                "confirmed_at": now - timedelta(minutes=14),
                "started_at": now - timedelta(minutes=13),
                "finished_at": now - timedelta(minutes=12),
                "error_code": None,
                "error_message": None,
            },
        )
    if job is not None:
        _core_upsert(
            db,
            "import_row_errors",
            {"import_job_id": job["id"], "row_number": 3, "column_name": "Почта"},
            {
                "target_field": "vendor_contact.email",
                "error_code": "INVALID_EMAIL",
                "message": "Некорректный e-mail в импортируемой строке.",
                "raw_fragment": "not-an-email",
            },
        )
        if source_file is not None:
            _core_upsert(
                db,
                "import_artifacts",
                {"import_job_id": job["id"], "file_id": source_file["id"]},
                {"artifact_type": "SOURCE"},
            )

    # Documentation source-file link + image relation.
    page_table = _table(db, "documentation_pages")
    if page_table is not None and doc_file is not None:
        page = db.execute(select(page_table).where(page_table.c.slug == "getting-started")).mappings().first()
        if page is not None:
            db.execute(page_table.update().where(page_table.c.id == page["id"]).values(source_file_id=doc_file["id"]))
            if image_file is not None:
                _core_upsert(
                    db,
                    "documentation_images",
                    {"page_id": page["id"], "file_id": image_file["id"]},
                    {},
                )

    # Give one typed file checklist a real attachment instead of a dangling FK.
    if contract_file is not None:
        file_item = db.scalar(
            select(ProgramChecklistValue)
            .join(PlaybookChecklistItem, PlaybookChecklistItem.id == ProgramChecklistValue.checklist_item_id)
            .where(PlaybookChecklistItem.item_type == "file")
            .order_by(ProgramChecklistValue.created_at)
        )
        if file_item is not None:
            file_item.attachment_id = contract_file["id"]
            file_item.is_done = True

    # Report artifact.
    report_table = _table(db, "report_jobs")
    if report_table is not None and report_file is not None:
        job_row = db.execute(select(report_table).where(report_table.c.request_id == "REPORT-PROGRAMS-001")).mappings().first()
        if job_row is not None:
            _core_upsert(
                db,
                "report_artifacts",
                {"report_job_id": job_row["id"], "file_id": report_file["id"]},
                {"artifact_type": "RESULT", "format": "csv", "row_count": 1},
            )

    db.flush()


def validate_seed(db: Session) -> None:
    """Fail fast on the most important V2 consistency errors."""
    problems: list[str] = []
    programs = list(db.scalars(select(ProgramInstance)).all())
    for program in programs:
        required = {
            "organization_id": program.organization_id,
            "direction_id": program.direction_id,
            "product_id": program.product_id,
            "playbook_template_id": program.playbook_template_id,
            "workflow_version_id": program.workflow_version_id,
            "current_stage_instance_id": program.current_stage_instance_id,
            "academic_window_id": program.academic_window_id,
            "status": program.status,
            "current_stage_code": program.current_stage_code,
            "started_at": program.started_at,
        }
        missing = [name for name, value in required.items() if value is None]
        if missing:
            problems.append(f"ProgramInstance {program.id}: missing {', '.join(missing)}")
            continue
        stage_instance = db.get(WorkflowStageInstance, program.current_stage_instance_id)
        if stage_instance is None or stage_instance.program_instance_id != program.id:
            problems.append(f"ProgramInstance {program.id}: current_stage_instance_id belongs to another program")

    for vendor in db.scalars(select(Vendor)).all():
        if hasattr(vendor, "business_key") and not vendor.business_key:
            problems.append(f"Vendor {vendor.name}: business_key is empty")
    for product in db.scalars(select(ITProduct)).all():
        if hasattr(product, "business_key") and not product.business_key:
            problems.append(f"Product {product.name}: business_key is empty")

    if problems:
        raise RuntimeError("Seed validation failed:\n - " + "\n - ".join(problems))

    print(f"[seed] V2 validation OK: {len(programs)} program instances")

def main() -> None:
    db = SessionLocal()
    try:
        # Base contour.
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
        seed_university_stage_distribution(db)
        db.flush()

        # Rich V2 seed dataset.
        seed_full_field_enrichment(db, users)
        seed_auxiliary_relations(db, users)
        seed_stage5_integration_mappings(db)

        db.flush()
        
        seed_integration_signals_full(db)
        seed_contracts_licenses_and_teachers(db)
        seed_contracts_full(db)
        seed_checklist_values_and_comments(db, users)
        seed_governance_audit_and_requests(db, users)

        # Commit the relational graph before invoking services that re-query it.
        db.commit()

        # Derived state is always computed from source records, not hard-coded.
        for program in db.scalars(select(ProgramInstance)).all():
            IntegrationSyncService(db).sync_program(program.id)
            HealthService(db).recompute(program.id)
            NbaService(db).recompute_program(program.id)
        db.commit()

        # File-backed tables are seeded only when a real MinIO/S3 endpoint exists.
        # This prevents dangling PostgreSQL metadata when lightweight local stacks
        # run with object storage disabled.
        seed_object_storage_records(db, users)
        db.commit()

        validate_seed(db)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("Seed data created (extended V2 dataset).")


if __name__ == "__main__":
    main()
