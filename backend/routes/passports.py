"""
Passport management — list, view, download QR, delete saved DPP records.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models import DPPRecord

router = APIRouter()


@router.get("/")
def list_passports(db: Session = Depends(get_db)):
    records = db.query(DPPRecord).order_by(DPPRecord.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "passport_id": r.passport_id,
            "product_name": r.product_name,
            "manufacturer": r.manufacturer,
            "category": r.category,
            "batch_number": r.batch_number,
            "conversion_method": r.conversion_method,
            "standards_count": r.standards_count,
            "properties_count": r.properties_count,
            "qr_code_url": f"/api/passports/{r.id}/qr" if r.qr_code_data else None,
            "status": r.status,
            "created_at": str(r.created_at),
        }
        for r in records
    ]


@router.get("/{record_id}")
def get_passport(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")
    return {
        "id": record.id,
        "passport_id": record.passport_id,
        "product_name": record.product_name,
        "manufacturer": record.manufacturer,
        "category": record.category,
        "batch_number": record.batch_number,
        "origin_country": record.origin_country,
        "conversion_method": record.conversion_method,
        "qr_code_url": f"/api/passports/{record.id}/qr" if record.qr_code_data else None,
        "status": record.status,
        "created_at": str(record.created_at),
        "dpp_json": json.loads(record.dpp_json),
    }


@router.get("/{record_id}/qr")
def get_qr_code(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record or not record.qr_code_data:
        raise HTTPException(status_code=404, detail="QR code not found")
    return Response(
        content=record.qr_code_data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.delete("/{record_id}")
def delete_passport(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")
    db.delete(record)
    db.commit()
    return {"status": "deleted", "id": record_id, "passport_id": record.passport_id}
