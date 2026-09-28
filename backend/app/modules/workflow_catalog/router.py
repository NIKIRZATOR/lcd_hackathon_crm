import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.common.errors import get_request_id
from app.core.database import get_db_session
from app.modules.auth.access import CATALOG_WRITE_ROLES
from app.modules.auth.dependencies import require_roles
from app.modules.checklists.model import PlaybookChecklistItem
from app.modules.users.model import Role, User
from app.modules.workflow_catalog.model import WorkflowPhase, WorkflowStageCatalog
from app.modules.workflows.model import WorkflowStage, WorkflowTemplate, WorkflowTransition, WorkflowVersion
from app.modules.workflows.service import WorkflowVersionService

router = APIRouter(prefix="/management", tags=["management"], dependencies=[Depends(require_roles(*CATALOG_WRITE_ROLES))])

@router.get("/stages")
def list_stages(db: Session = Depends(get_db_session)):
    rows = db.execute(select(WorkflowStageCatalog.code, WorkflowStageCatalog.name, WorkflowPhase.code.label("phase")).join(WorkflowPhase, WorkflowPhase.id == WorkflowStageCatalog.default_phase_id).order_by(WorkflowStageCatalog.code)).all()
    return [{"code": row.code, "name": row.name, "phase": row.phase} for row in rows]


@router.get("/playbooks")
def list_playbooks(db: Session = Depends(get_db_session)):
    rows = db.execute(
        select(
            WorkflowTemplate.id,
            WorkflowTemplate.code,
            WorkflowTemplate.name,
            WorkflowTemplate.applies_to_type,
            WorkflowTemplate.status,
            WorkflowVersion.version.label("published_version"),
        )
        .outerjoin(
            WorkflowVersion,
            (WorkflowVersion.workflow_template_id == WorkflowTemplate.id)
            & (WorkflowVersion.status == "PUBLISHED"),
        )
        .order_by(WorkflowTemplate.code)
    ).all()
    return [
        {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "applies_to_type": row.applies_to_type,
            "status": row.status,
            "published_version": row.published_version,
        }
        for row in rows
    ]


def _template(db: Session, template_id: UUID) -> WorkflowTemplate:
    template = db.get(WorkflowTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Workflow template not found")
    return template


def _draft(db: Session, template_id: UUID) -> WorkflowVersion | None:
    return db.scalar(
        select(WorkflowVersion)
        .where(
            WorkflowVersion.workflow_template_id == template_id,
            WorkflowVersion.status == "DRAFT",
        )
        .order_by(WorkflowVersion.version.desc())
    )


def _editor_version(db: Session, template_id: UUID) -> WorkflowVersion | None:
    return _draft(db, template_id) or db.scalar(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_template_id == template_id)
        .order_by(
            (WorkflowVersion.status == "PUBLISHED").desc(),
            WorkflowVersion.version.desc(),
        )
    )


def _editor_response(template: WorkflowTemplate, version: WorkflowVersion) -> dict:
    return {
        "id": str(template.id),
        "version_id": str(version.id),
        "version": version.version,
        "status": version.status.lower(),
        "content": version.editor_content,
    }


@router.get("/kams")
def list_kams(db: Session = Depends(get_db_session)):
    users = db.scalars(
        select(User)
        .join(User.roles)
        .where(Role.name == "KAM", User.is_active.is_(True))
        .order_by(User.full_name)
    ).unique().all()
    return [{"id": str(user.id), "full_name": user.full_name} for user in users]


@router.get("/playbooks/{template_id}/editor")
def get_playbook_editor(template_id: UUID, db: Session = Depends(get_db_session)):
    template = _template(db, template_id)
    version = _editor_version(db, template_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Workflow version not found")
    return _editor_response(template, version)


@router.post("/playbooks", status_code=201)
def create_playbook(
    payload: dict,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    name = str(payload.get("name") or "").strip() or "Без названия"
    template = WorkflowTemplate(
        name=name,
        description=str(payload.get("description") or "").strip() or None,
        is_active=True,
        is_default=False,
        created_by=current_user.id,
        applies_to_type="all",
        status="draft",
    )
    db.add(template)
    db.flush()
    version = WorkflowVersion(
        workflow_template_id=template.id,
        version=1,
        status="DRAFT",
        created_by=current_user.id,
        editor_content=payload,
    )
    db.add(version)
    db.commit()
    db.refresh(template)
    db.refresh(version)
    return _editor_response(template, version)


@router.put("/playbooks/{template_id}/editor")
def save_playbook_editor(
    template_id: UUID,
    payload: dict,
    db: Session = Depends(get_db_session),
):
    template = _template(db, template_id)
    version = _draft(db, template_id)
    if version is None:
        raise HTTPException(status_code=409, detail="Published playbook requires a new draft version")
    template.name = str(payload.get("name") or template.name).strip() or template.name
    template.description = str(payload.get("description") or "").strip() or None
    template.status = "draft"
    version.editor_content = payload
    db.commit()
    db.refresh(version)
    return _editor_response(template, version)


@router.post("/playbooks/{template_id}/versions/draft", status_code=201)
def create_playbook_draft(
    template_id: UUID,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    template = _template(db, template_id)
    version = WorkflowVersionService(db).create_draft(
        template_id,
        created_by=current_user.id,
        request_id=get_request_id(request),
    )
    template.status = "draft"
    db.commit()
    return _editor_response(template, version)


def _code(value: object, fallback: str) -> str:
    normalized = re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip("_")
    return (normalized or fallback)[:64]


def _materialize_editor_graph(db: Session, template: WorkflowTemplate, version: WorkflowVersion, payload: dict) -> None:
    old_stage_ids = list(
        db.scalars(select(WorkflowStage.id).where(WorkflowStage.workflow_version_id == version.id)).all()
    )
    if old_stage_ids:
        db.execute(delete(PlaybookChecklistItem).where(PlaybookChecklistItem.workflow_stage_id.in_(old_stage_ids)))
        db.execute(delete(WorkflowTransition).where(WorkflowTransition.workflow_version_id == version.id))
        db.execute(delete(WorkflowStage).where(WorkflowStage.workflow_version_id == version.id))
        db.flush()

    rows: list[tuple[dict, WorkflowStage]] = []
    flattened = [stage for phase in payload.get("phases", []) for stage in phase.get("stages", [])]
    for index, data in enumerate(flattened):
        catalog_code = data.get("catalog_code")
        catalog = db.scalar(select(WorkflowStageCatalog).where(WorkflowStageCatalog.code == catalog_code)) if catalog_code else None
        blocks = data.get("blocks") or []
        stage = WorkflowStage(
            workflow_template_id=template.id,
            workflow_version_id=version.id,
            name=str(data.get("name") or "Этап"),
            description=str(data.get("description") or "").strip() or None,
            order_index=index + 1,
            is_initial=index == 0,
            is_final=index == len(flattened) - 1,
            is_optional=bool(data.get("can_skip")),
            default_duration_days=data.get("sla_days"),
            requires_comment=any(block.get("kind") == "comment" and block.get("required") for block in blocks),
            requires_attachment=any(block.get("kind") in {"document", "documents"} and block.get("required") for block in blocks),
            is_active=True,
            stage_catalog_id=catalog.id if catalog else None,
        )
        db.add(stage)
        db.flush()
        rows.append((data, stage))
        item_index = 0
        for block in blocks:
            kind = block.get("kind")
            if kind == "checklist":
                for item in block.get("items") or []:
                    item_index += 1
                    db.add(PlaybookChecklistItem(
                        workflow_stage_id=stage.id,
                        code=_code(item.get("factId") or item.get("id"), f"check_{item_index}"),
                        label=str(item.get("text") or "Пункт"),
                        item_type="checkbox",
                        required=bool(item.get("required")),
                    ))
            elif kind == "fields":
                for item in block.get("fields") or []:
                    item_index += 1
                    fact_id = item.get("factId")
                    db.add(PlaybookChecklistItem(
                        workflow_stage_id=stage.id,
                        code=_code(fact_id, f"field_{item_index}"),
                        label=str(fact_id or "Поле"),
                        item_type="text",
                        required=bool(item.get("required")),
                    ))
            elif kind in {"document", "documents"}:
                slots = block.get("slots") or [block]
                for slot in slots:
                    item_index += 1
                    doc_type = slot.get("docType") or block.get("docType") or "document"
                    db.add(PlaybookChecklistItem(
                        workflow_stage_id=stage.id,
                        code=_code(slot.get("id"), f"document_{item_index}"),
                        label=str(slot.get("title") or block.get("title") or "Документ"),
                        item_type="file",
                        required=bool(slot.get("required", block.get("required", False))),
                        required_attachment_kind=str(doc_type),
                    ))

    for (left_data, left), (_, right) in zip(rows, rows[1:]):
        db.add(WorkflowTransition(
            workflow_template_id=template.id,
            workflow_version_id=version.id,
            from_stage_id=left.id,
            to_stage_id=right.id,
            name=f"{left.name} → {right.name}",
            is_default=True,
        ))
    db.flush()


@router.post("/playbooks/{template_id}/publish")
def publish_playbook(
    template_id: UUID,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_roles(*CATALOG_WRITE_ROLES)),
):
    template = _template(db, template_id)
    version = _draft(db, template_id)
    if version is None:
        raise HTTPException(status_code=409, detail="Workflow draft not found")
    version.editor_content = payload
    _materialize_editor_graph(db, template, version, payload)
    published = WorkflowVersionService(db).publish_version(
        version.id,
        actor_user_id=current_user.id,
        request_id=get_request_id(request),
    )
    return _editor_response(template, published)
