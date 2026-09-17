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
        db.commit()
    finally:
        db.close()

    print("Demo data seeded.")


if __name__ == "__main__":
    main()
