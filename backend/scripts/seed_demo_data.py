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
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.checklists.model import PlaybookChecklistItem, ProgramChecklistValue
from app.modules.health.service import HealthService
from app.modules.integrations.service import IntegrationSyncService
from app.modules.nba.service import NbaService
from app.modules.users.model import ManagerMembership, Role, User
from app.modules.workflows.model import WorkflowStage, WorkflowStageInstance, WorkflowTemplate, WorkflowTransition, WorkflowVersion
from app.modules.workflows.service import WorkflowRuntimeService
from scripts.workflow_seed_data import LEGACY_WORKFLOW_TEMPLATE_NAMES, WORKFLOW_STAGES, WORKFLOW_TEMPLATE


UNIVERSITIES = [
    {
        "name": "Moscow State University",
        "short_name": "MSU",
        "region": "Moscow",
        "city": "Moscow",
        "address": "Leninskie Gory, 1",
        "website": "https://msu.ru",
    },
    {
        "name": "ITMO University",
        "short_name": "ITMO",
        "region": "Saint Petersburg",
        "city": "Saint Petersburg",
        "address": "Kronverksky Ave, 49",
        "website": "https://itmo.ru",
    },
    {
        "name": "Novosibirsk State University",
        "short_name": "NSU",
        "region": "Novosibirsk Oblast",
        "city": "Novosibirsk",
        "address": "Pirogova St, 1",
        "website": "https://nsu.ru",
    },
    {
        "name": "Tomsk State University",
        "short_name": "TSU",
        "region": "Tomsk Oblast",
        "city": "Tomsk",
        "address": "Lenina Ave, 36",
        "website": "https://tsu.ru",
    },
    {
        "name": "Kazan Federal University",
        "short_name": "KFU",
        "region": "Tatarstan",
        "city": "Kazan",
        "address": "Kremlyovskaya St, 18",
        "website": "https://kpfu.ru",
    },
]

DIRECTIONS = [
    {"name": "DevOps", "code": "DEVOPS", "description": "Infrastructure, CI/CD, and operations."},
    {"name": "Data Science", "code": "DS", "description": "Data analysis and machine learning."},
    {"name": "Quality Assurance", "code": "QA", "description": "Software testing and quality engineering."},
]

PROGRAMS = [
    {"direction_code": "DEVOPS", "name": "DevOps Basic", "version": "2026.1"},
    {"direction_code": "DEVOPS", "name": "Cloud Infrastructure", "version": "2026.1"},
    {"direction_code": "DS", "name": "Applied Machine Learning", "version": "2026.1"},
    {"direction_code": "DS", "name": "Data Engineering", "version": "2026.1"},
    {"direction_code": "QA", "name": "QA Automation", "version": "2026.1"},
]

VENDORS = [
    {"name": "RTK Cloud", "description": "Cloud and infrastructure tools."},
    {"name": "RTK Data", "description": "Data platform products."},
    {"name": "RTK Quality", "description": "Testing and quality products."},
]

PRODUCTS = [
    {
        "vendor_name": "RTK Cloud",
        "name": "Cloud Lab",
        "description": "Cloud training environment.",
        "documentation_url": "https://example.org/cloud-lab/docs",
    },
    {
        "vendor_name": "RTK Cloud",
        "name": "Deploy Manager",
        "description": "Deployment automation toolkit.",
        "documentation_url": "https://example.org/deploy-manager/docs",
    },
    {
        "vendor_name": "RTK Data",
        "name": "Data Platform",
        "description": "Educational data platform.",
        "documentation_url": "https://example.org/data-platform/docs",
    },
    {
        "vendor_name": "RTK Data",
        "name": "ML Studio",
        "description": "Machine learning lab environment.",
        "documentation_url": "https://example.org/ml-studio/docs",
    },
    {
        "vendor_name": "RTK Quality",
        "name": "Test Automation Kit",
        "description": "Automated testing toolkit.",
        "documentation_url": "https://example.org/test-kit/docs",
    },
]

PROGRAM_PRODUCTS = [
    ("DevOps Basic", "Cloud Lab", True),
    ("DevOps Basic", "Deploy Manager", True),
    ("Cloud Infrastructure", "Cloud Lab", True),
    ("Applied Machine Learning", "Data Platform", True),
    ("Applied Machine Learning", "ML Studio", True),
    ("Data Engineering", "Data Platform", True),
    ("QA Automation", "Test Automation Kit", True),
    ("QA Automation", "Deploy Manager", False),
]

ROLES = {
    "KAM": "University account manager",
    "MANAGER": "Manager lead",
    "ADMIN": "Platform administrator",
}

USERS = [
    {
        "username": "kam1",
        "full_name": "KAM User",
        "email": "kam1@example.local",
        "roles": ["KAM"],
    },
    {
        "username": "kam2",
        "full_name": "KAM Two",
        "email": "kam2@example.local",
        "roles": ["KAM"],
    },
    {
        "username": "manager1",
        "full_name": "Manager User",
        "email": "manager1@example.local",
        "roles": ["MANAGER"],
    },
    {
        "username": "admin1",
        "full_name": "Admin User",
        "email": "admin1@example.local",
        "roles": ["ADMIN"],
    },
]

MANAGER_MEMBERSHIPS = [
    ("manager1", "kam1"),
]

INTERACTIONS = [
    {
        "university": "MSU",
        "program": "DevOps Basic",
        "product": "Cloud Lab",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-DEMO-001",
        "license_signed": True,
        "transfer_status": "TRANSFERRED",
        "university_responsibles": "Ivan Sokolov",
        "comment": "Visible to kam1 and manager1.",
    },
    {
        "university": "ITMO",
        "program": "Applied Machine Learning",
        "product": "ML Studio",
        "manager": "kam1",
        "status": "ACTIVE",
        "contract_number": "RTK-DEMO-002",
        "license_signed": False,
        "transfer_status": "IN_PROGRESS",
        "university_responsibles": "Anna Petrova",
        "comment": "Second interaction in manager1 scope.",
    },
    {
        "university": "NSU",
        "program": "QA Automation",
        "product": "Test Automation Kit",
        "manager": "kam2",
        "status": "ACTIVE",
        "contract_number": "RTK-DEMO-003",
        "license_signed": False,
        "transfer_status": "NOT_STARTED",
        "university_responsibles": "Dmitry Kuznetsov",
        "comment": "Visible to kam2 and admin1, not manager1.",
    },
]

# Extended demo dataset: approximately 2.5x the original catalog volume.
UNIVERSITIES.extend([
    {"name": f"Demo Partner University {index}", "short_name": f"DPU{index}", "region": "Demo Region", "city": f"Demo City {index}", "address": f"Demo street {index}", "website": f"https://dpu{index}.example.local"}
    for index in range(1, 9)
])
DIRECTIONS.extend([
    {"name": name, "code": code, "description": f"{name} learning direction."}
    for code, name in [("SEC", "Information Security"), ("BA", "Business Analytics"), ("FE", "Frontend Development"), ("BE", "Backend Development"), ("PM", "Project Management")]
])
VENDORS.extend([{"name": f"RTK Demo Vendor {index}", "description": "Demo vendor."} for index in range(1, 6)])
for index, direction in enumerate(DIRECTIONS[3:], 1):
    PROGRAMS.append({"direction_code": direction["code"], "name": f"{direction['name']} Basic", "version": "2026.1"})
    PRODUCTS.append({"vendor_name": VENDORS[(index + 2) % len(VENDORS)]["name"], "name": f"Demo Product {index}", "description": "Extended demo product.", "documentation_url": f"https://example.org/demo-{index}"})
USERS.extend([
    {"username": f"kam{index}", "full_name": f"KAM Demo {index}", "email": f"kam{index}@example.local", "roles": ["KAM"]}
    for index in range(3, 7)
] + [{"username": "manager2", "full_name": "Manager Demo", "email": "manager2@example.local", "roles": ["MANAGER"]}, {"username": "admin2", "full_name": "Admin Demo", "email": "admin2@example.local", "roles": ["ADMIN"]}])
MANAGER_MEMBERSHIPS.extend([("manager1", "kam3"), ("manager2", "kam4"), ("manager2", "kam5"), ("manager2", "kam6")])
for index in range(1, 9):
    INTERACTIONS.append({"university": f"DPU{index}", "program": "DevOps Basic", "product": "Cloud Lab", "manager": f"kam{3 + (index % 4)}", "status": "ACTIVE", "contract_number": f"RTK-EXT-{index:03d}", "license_signed": bool(index % 2), "transfer_status": "IN_PROGRESS", "university_responsibles": f"Demo Contact {index}", "comment": "Extended demo interaction."})

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
    contacts = [
        ("MSU", "Ivan Sokolov", "Head of Department", "ivan.sokolov@msu.demo"),
        ("ITMO", "Anna Petrova", "Program Curator", "anna.petrova@itmo.demo"),
        ("NSU", "Dmitry Kuznetsov", "Dean Assistant", "dmitry.kuznetsov@nsu.demo"),
        ("TSU", "Maria Smirnova", "Academic Lead", "maria.smirnova@tsu.demo"),
        ("KFU", "Sergey Orlov", "Industry Liaison", "sergey.orlov@kfu.demo"),
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
                    comment="Demo contact",
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

    for code, name, applies_to_type in [
        ("expansion", "Расширение", "all"), ("license_renewal", "Продление лицензии", "all"),
        ("teacher_replace", "Замена преподавателя", "all"), ("materials_update", "Обновление материалов", "all"),
        ("school_short", "Короткий цикл школы", "school"), ("reactivation", "Реактивация", "all"),
    ]:
        if get_by_field(db, WorkflowTemplate, "code", code) is None:
            db.add(WorkflowTemplate(code=code, name=name, applies_to_type=applies_to_type, status="draft", version="1", created_by=creator.id, is_active=True, is_default=False))

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
        stages_by_name[data["name"]] = stage

    ordered_stages = [stages_by_name[data["name"]] for data in WORKFLOW_STAGES]
    catalog_codes = ["find_contact", "clarify_relevance", "arrange_meeting", "exchange_docs", "correct_docs", "sign_docs", "transfer_materials_license", "support_implementation", "train_teachers", "update_curriculum", "classes_running", "update_product_docs", "teacher_upskilling", "control"]
    for stage, code in zip(ordered_stages, catalog_codes):
        catalog_stage = get_by_field(db, WorkflowStageCatalog, "code", code)
        if catalog_stage is not None:
            stage.stage_catalog_id = catalog_stage.id
    checklist = [(0, "contact", "Контакт стейкхолдера подтверждён", "stakeholder_role"), (2, "meeting", "Дата встречи указана", "date"), (5, "contract", "Договор приложен", "file"), (8, "teacher", "Преподаватель обучен", "checkbox")]
    for index, code, label, item_type in checklist:
        if db.scalar(select(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id == ordered_stages[index].id, PlaybookChecklistItem.code == code)) is None:
            db.add(PlaybookChecklistItem(workflow_stage_id=ordered_stages[index].id, code=code, label=label, item_type=item_type, required=True))
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


def seed_organization_core(db: Session, universities: dict[str, University]) -> None:
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

    for stage_instance in db.scalars(select(WorkflowStageInstance)).all():
        for item in db.scalars(select(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id == stage_instance.workflow_stage_id)):
            exists = db.scalar(select(ProgramChecklistValue).where(ProgramChecklistValue.stage_instance_id == stage_instance.id, ProgramChecklistValue.checklist_item_id == item.id))
            if exists is None:
                db.add(ProgramChecklistValue(stage_instance_id=stage_instance.id, checklist_item_id=item.id))

    first_program = db.scalar(select(ProgramInstance).order_by(ProgramInstance.created_at))
    if first_program is not None:
        second_product = db.scalar(select(ITProduct).where(ITProduct.id != first_program.product_id).order_by(ITProduct.name))
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
        phase_by_code[code] = phase
    stages = [
        ("find_contact", "Найти контакт", "outreach"), ("clarify_relevance", "Уточнить актуальность", "outreach"), ("arrange_meeting", "Организовать встречу", "outreach"),
        ("exchange_docs", "Обменяться документами", "paperwork"), ("correct_docs", "Скорректировать документы", "paperwork"), ("sign_docs", "Подписать документы", "paperwork"),
        ("transfer_materials_license", "Передать материалы и лицензию", "onboarding"), ("support_implementation", "Сопроводить внедрение", "onboarding"), ("train_teachers", "Обучить преподавателей", "onboarding"), ("update_curriculum", "Обновить учебный план", "onboarding"),
        ("classes_running", "Запустить занятия", "operations"), ("update_product_docs", "Обновить документацию", "retention"), ("teacher_upskilling", "Повысить квалификацию преподавателей", "retention"), ("control", "Контроль", "control"),
    ]
    for code, name, phase_code in stages:
        stage = get_by_field(db, WorkflowStageCatalog, "code", code)
        if stage is None:
            db.add(WorkflowStageCatalog(code=code, name=name, default_phase_id=phase_by_code[phase_code].id, is_active=True))


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
        seed_organization_core(db, universities)
        seed_program_instances(db)
        db.flush()
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
