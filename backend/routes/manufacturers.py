"""
Manufacturer CRM — pipeline management for manufacturer outreach and onboarding.
Stages: target → engaged → onboarded → active
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session


def _clean(val: str, max_len: int = 500) -> str:
    return re.sub(r"<[^>]*>", "", val).replace("\x00", "").strip()[:max_len]

from database import get_db
from models import CRMActivity, DPPRecord, Manufacturer, ManufacturerClaim, ManufacturerDocumentRequest, ManufacturerUpload

router = APIRouter()


class ManufacturerCreate(BaseModel):
    name: str
    country: str = ""
    website: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    contact_person: str = ""
    crm_stage: str = "target"
    notes: str = ""
    categories: str = ""


class ManufacturerUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    website: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    contact_person: str | None = None
    crm_stage: str | None = None
    notes: str | None = None
    categories: str | None = None


class ActivityCreate(BaseModel):
    activity_type: str
    description: str = ""


class ClaimCreate(BaseModel):
    claimant_name: str = ""
    claimant_email: str = ""
    role: str = ""
    rights_basis: str = ""
    requested_scope: str = ""
    requested_documents: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    submitted_documents: list[int] = Field(default_factory=list)


class ClaimReview(BaseModel):
    status: str
    reviewer: str = ""
    review_notes: str = ""
    authority_scope: str = ""


class DocumentRequestCreate(BaseModel):
    requested_documents: list[str] = Field(default_factory=list)
    product_scope: str = ""
    message: str = ""
    due_date: str = ""


class ManufacturerUploadCreate(BaseModel):
    document_request_id: int | None = None
    document_type: str
    title: str = ""
    file_name: str = ""
    product_scope: str = ""
    rights_status: str = "internal_review"
    metadata: dict = Field(default_factory=dict)


VALID_STAGES = {"target", "engaged", "onboarded", "active"}
VALID_CLAIM_STATUSES = {"submitted", "approved", "rejected", "revision_requested"}


def _loads_list(value: str) -> list:
    try:
        parsed = json.loads(value or "[]")
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _serialize_claim(claim: ManufacturerClaim) -> dict:
    return {
        "id": claim.id,
        "manufacturer_id": claim.manufacturer_id,
        "claimant_name": claim.claimant_name,
        "claimant_email": claim.claimant_email,
        "role": claim.role,
        "rights_basis": claim.rights_basis,
        "requested_scope": claim.requested_scope,
        "requested_documents": _loads_list(claim.requested_documents),
        "permissions": _loads_list(claim.permissions),
        "submitted_documents": _loads_list(claim.submitted_documents),
        "authority_scope": claim.authority_scope,
        "authority_status": claim.authority_status,
        "revision_number": claim.revision_number,
        "status": claim.status,
        "reviewer": claim.reviewer,
        "review_notes": claim.review_notes,
        "created_at": str(claim.created_at),
        "reviewed_at": str(claim.reviewed_at) if claim.reviewed_at else None,
    }


def _claim_profile(db: Session, mfr_id: int) -> dict:
    claims = (
        db.query(ManufacturerClaim)
        .filter(ManufacturerClaim.manufacturer_id == mfr_id)
        .order_by(ManufacturerClaim.created_at.desc())
        .all()
    )
    latest = claims[0] if claims else None
    return {
        "status": latest.status if latest else "unclaimed",
        "claim_count": len(claims),
        "latest_claim_id": latest.id if latest else None,
        "rights_basis": latest.rights_basis if latest else "",
        "requested_scope": latest.requested_scope if latest else "",
        "authority_status": latest.authority_status if latest else "none",
    }


def _serialize_document_request(request: ManufacturerDocumentRequest, uploads: list[ManufacturerUpload] | None = None) -> dict:
    requested = _loads_list(request.requested_documents)
    uploaded_types = {u.document_type for u in uploads or [] if u.document_request_id == request.id}
    return {
        "id": request.id,
        "manufacturer_id": request.manufacturer_id,
        "product_scope": request.product_scope,
        "requested_documents": requested,
        "missing_documents": [doc for doc in requested if doc not in uploaded_types],
        "message": request.message,
        "due_date": request.due_date,
        "status": request.status,
        "created_at": str(request.created_at),
        "updated_at": str(request.updated_at),
    }


def _serialize_upload(upload: ManufacturerUpload) -> dict:
    return {
        "id": upload.id,
        "manufacturer_id": upload.manufacturer_id,
        "document_request_id": upload.document_request_id,
        "document_type": upload.document_type,
        "title": upload.title,
        "file_name": upload.file_name,
        "product_scope": upload.product_scope,
        "rights_status": upload.rights_status,
        "review_status": upload.review_status,
        "metadata": json.loads(upload.metadata_json or "{}"),
        "created_at": str(upload.created_at),
    }


@router.get("/")
def list_manufacturers(
    stage: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Manufacturer)
    if stage and stage in VALID_STAGES:
        query = query.filter(Manufacturer.crm_stage == stage)
    total = query.count()
    records = query.order_by(Manufacturer.updated_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "items": [_serialize_manufacturer(m) for m in records],
    }


@router.get("/pipeline")
def pipeline_summary(db: Session = Depends(get_db)):
    counts = (
        db.query(Manufacturer.crm_stage, func.count(Manufacturer.id))
        .group_by(Manufacturer.crm_stage)
        .all()
    )
    pipeline = {s: 0 for s in VALID_STAGES}
    for stage, count in counts:
        pipeline[stage] = count
    return {
        "stages": pipeline,
        "total": sum(pipeline.values()),
    }


@router.post("/")
def create_manufacturer(payload: ManufacturerCreate, db: Session = Depends(get_db)):
    existing = db.query(Manufacturer).filter(Manufacturer.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Manufacturer '{payload.name}' already exists.")

    mfr = Manufacturer(**payload.model_dump())
    db.add(mfr)
    db.commit()
    db.refresh(mfr)

    db.add(CRMActivity(
        manufacturer_id=mfr.id,
        activity_type="note",
        description=f"Added to pipeline as '{payload.crm_stage}'.",
    ))
    db.commit()

    return _serialize_manufacturer(mfr)


@router.get("/{mfr_id}")
def get_manufacturer(mfr_id: int, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    passports = (
        db.query(DPPRecord)
        .filter(DPPRecord.manufacturer_id == mfr_id)
        .order_by(DPPRecord.created_at.desc())
        .limit(20)
        .all()
    )
    activities = (
        db.query(CRMActivity)
        .filter(CRMActivity.manufacturer_id == mfr_id)
        .order_by(CRMActivity.created_at.desc())
        .limit(50)
        .all()
    )

    result = _serialize_manufacturer(mfr)
    result["claim_profile"] = _claim_profile(db, mfr.id)
    claims = (
        db.query(ManufacturerClaim)
        .filter(ManufacturerClaim.manufacturer_id == mfr_id)
        .order_by(ManufacturerClaim.created_at.desc())
        .limit(20)
        .all()
    )
    requests = (
        db.query(ManufacturerDocumentRequest)
        .filter(ManufacturerDocumentRequest.manufacturer_id == mfr_id)
        .order_by(ManufacturerDocumentRequest.created_at.desc())
        .all()
    )
    uploads = (
        db.query(ManufacturerUpload)
        .filter(ManufacturerUpload.manufacturer_id == mfr_id)
        .order_by(ManufacturerUpload.created_at.desc())
        .all()
    )
    result["claims"] = [_serialize_claim(c) for c in claims]
    result["document_requests"] = [_serialize_document_request(r, uploads) for r in requests]
    result["uploads"] = [_serialize_upload(u) for u in uploads]
    result["passports"] = [
        {
            "id": p.id,
            "passport_id": p.passport_id,
            "product_name": p.product_name,
            "category": p.category,
            "confidence_score": p.confidence_score,
            "document_type": p.document_type,
            "status": p.status,
            "created_at": str(p.created_at),
        }
        for p in passports
    ]
    result["activities"] = [
        {
            "id": a.id,
            "activity_type": a.activity_type,
            "description": a.description,
            "created_at": str(a.created_at),
        }
        for a in activities
    ]
    return result


@router.post("/{mfr_id}/claims")
def submit_claim(mfr_id: int, payload: ClaimCreate, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    claim = ManufacturerClaim(
        manufacturer_id=mfr_id,
        claimant_name=payload.claimant_name,
        claimant_email=payload.claimant_email,
        role=payload.role,
        rights_basis=payload.rights_basis,
        requested_scope=payload.requested_scope,
        status="submitted",
        requested_documents=json.dumps(payload.requested_documents),
        permissions=json.dumps(payload.permissions),
        submitted_documents=json.dumps(payload.submitted_documents),
    )
    db.add(claim)
    db.add(CRMActivity(
        manufacturer_id=mfr_id,
        activity_type="claim",
        description=f"Claim submitted by {payload.claimant_name or payload.claimant_email or 'manufacturer contact'}.",
    ))
    db.commit()
    db.refresh(claim)
    return _serialize_claim(claim)


@router.post("/{mfr_id}/document-requests", status_code=201)
def create_document_request(mfr_id: int, payload: DocumentRequestCreate, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    request = ManufacturerDocumentRequest(
        manufacturer_id=mfr_id,
        product_scope=_clean(payload.product_scope, 200),
        requested_documents=json.dumps([_clean(d, 100) for d in payload.requested_documents[:20]]),
        message=_clean(payload.message, 2000),
        due_date=_clean(payload.due_date, 20),
    )
    db.add(request)
    db.add(CRMActivity(
        manufacturer_id=mfr_id,
        activity_type="document_request",
        description=f"Requested documents: {', '.join(payload.requested_documents)} for {payload.product_scope or 'manufacturer portfolio'}.",
    ))
    db.commit()
    db.refresh(request)
    return _serialize_document_request(request, [])


@router.post("/{mfr_id}/uploads", status_code=201)
def create_manufacturer_upload(mfr_id: int, payload: ManufacturerUploadCreate, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    if payload.document_request_id:
        request = (
            db.query(ManufacturerDocumentRequest)
            .filter(ManufacturerDocumentRequest.id == payload.document_request_id, ManufacturerDocumentRequest.manufacturer_id == mfr_id)
            .first()
        )
        if not request:
            raise HTTPException(status_code=404, detail="Document request not found")
    upload = ManufacturerUpload(
        manufacturer_id=mfr_id,
        document_request_id=payload.document_request_id,
        document_type=_clean(payload.document_type, 50),
        title=_clean(payload.title, 200),
        file_name=_clean(payload.file_name, 200),
        product_scope=_clean(payload.product_scope, 200),
        rights_status=_clean(payload.rights_status, 50),
        review_status="pending",
        metadata_json=json.dumps(payload.metadata),
    )
    db.add(upload)
    db.add(CRMActivity(
        manufacturer_id=mfr_id,
        activity_type="document_upload",
        description=f"Received {payload.document_type} metadata for {payload.product_scope or payload.title}.",
    ))
    db.commit()
    db.refresh(upload)
    return _serialize_upload(upload)


@router.patch("/claims/{claim_id}")
def review_claim(claim_id: int, payload: ClaimReview, db: Session = Depends(get_db)):
    if payload.status not in VALID_CLAIM_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid claim status")

    claim = db.query(ManufacturerClaim).filter(ManufacturerClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = payload.status
    claim.reviewer = payload.reviewer
    claim.review_notes = payload.review_notes
    claim.reviewed_at = datetime.now(timezone.utc)
    if payload.status == "revision_requested":
        claim.revision_number = (claim.revision_number or 0) + 1
        claim.authority_status = "revision_requested"
    elif payload.status == "approved":
        claim.authority_status = "authorized"
        claim.authority_scope = payload.authority_scope or claim.requested_scope
    elif payload.status == "rejected":
        claim.authority_status = "rejected"
    db.add(CRMActivity(
        manufacturer_id=claim.manufacturer_id,
        activity_type="claim_review",
        description=f"Claim {payload.status} by {payload.reviewer or 'reviewer'}. {payload.review_notes}".strip(),
    ))
    db.commit()
    db.refresh(claim)
    return _serialize_claim(claim)


@router.get("/{mfr_id}/outreach-template")
def outreach_template(mfr_id: int, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    categories = mfr.categories or "your construction product range"
    email_subject = f"Digital Product Passport data cooperation for {mfr.name}"
    email_body = (
        f"Hello {mfr.contact_person or mfr.name} team,\n\n"
        "Origentity is building construction-native Digital Product Passports for QR-ready product records. "
        f"We would like to verify source data for {categories}: TDS, EPD, DoP/CE declarations, test reports, "
        "batch identifiers, and permitted reuse rights.\n\n"
        "The goal is to publish only manufacturer-authorized data, with field-level citations and confidence scoring. "
        "Could we schedule a short call to confirm the right contact and upload/approval process?\n\n"
        "Regards,\nOrigentity DPP team"
    )
    call_script = (
        "Confirm product categories, identify the QA/specification owner, explain QR-ready DPP records, "
        "ask which documents may be reused, and agree the claim-profile approval contact."
    )
    return {
        "manufacturer_id": mfr.id,
        "email_subject": email_subject,
        "email_body": email_body,
        "phone_script": call_script,
        "video_agenda": [
            "DPP value and QR scan experience",
            "Required documents: TDS, EPD, DoP/CE, test reports",
            "Data rights and claim-profile approval",
            "Upload/review workflow and active record maintenance",
        ],
    }


@router.patch("/{mfr_id}")
def update_manufacturer(mfr_id: int, payload: ManufacturerUpdate, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    old_stage = mfr.crm_stage
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(mfr, key, value)

    if "crm_stage" in updates and updates["crm_stage"] != old_stage:
        db.add(CRMActivity(
            manufacturer_id=mfr.id,
            activity_type="stage_change",
            description=f"Stage changed: {old_stage} → {updates['crm_stage']}",
        ))
        if updates["crm_stage"] == "onboarded" and not mfr.onboarded_at:
            mfr.onboarded_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(mfr)
    return _serialize_manufacturer(mfr)


@router.post("/{mfr_id}/activities")
def add_activity(mfr_id: int, payload: ActivityCreate, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    activity = CRMActivity(
        manufacturer_id=mfr_id,
        activity_type=payload.activity_type,
        description=payload.description,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    return {
        "id": activity.id,
        "activity_type": activity.activity_type,
        "description": activity.description,
        "created_at": str(activity.created_at),
    }


@router.delete("/{mfr_id}")
def delete_manufacturer(mfr_id: int, db: Session = Depends(get_db)):
    mfr = db.query(Manufacturer).filter(Manufacturer.id == mfr_id).first()
    if not mfr:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    db.delete(mfr)
    db.commit()
    return {"status": "deleted", "id": mfr_id}


def _serialize_manufacturer(m: Manufacturer) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "country": m.country,
        "website": m.website,
        "contact_email": m.contact_email,
        "contact_phone": m.contact_phone,
        "contact_person": m.contact_person,
        "crm_stage": m.crm_stage,
        "notes": m.notes,
        "categories": m.categories,
        "products_count": m.products_count,
        "onboarded_at": str(m.onboarded_at) if m.onboarded_at else None,
        "created_at": str(m.created_at),
        "updated_at": str(m.updated_at),
    }
