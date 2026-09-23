from __future__ import annotations

import sys
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
from app.modules.users.model import ManagerMembership, Role, User
from app.modules.workflows.model import WorkflowStage, WorkflowTemplate, WorkflowTransition, WorkflowVersion
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
        workflow_template = seed_workflow(db, users)
        seed_manager_memberships(db, users)
        seed_interactions(db, universities, programs, products, users, workflow_template)
        db.commit()
    finally:
        db.close()

    print("Demo data seeded.")


if __name__ == "__main__":
    main()
