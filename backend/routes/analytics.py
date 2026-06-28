"""
Analytics — dashboard stats, market coverage, quality metrics.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from database import get_db
from models import DPPRecord, Manufacturer

router = APIRouter()


TARGET_MARKET_CATALOG = [
    {
        "category": "Road Construction",
        "key_products": ["Asphalt Mix", "Bitumen Binder", "Geogrid", "Geotextile", "Drainage Composite"],
        "required_standards": ["EN 13108", "EN 12591", "ASTM D6637", "EN 13249", "ISO 10319"],
        "required_documents": ["TDS", "EPD", "DoP/CE where applicable", "Test Report"],
    },
    {
        "category": "Concrete and Cement",
        "key_products": ["Cement", "Ready Mix Concrete", "Concrete Admixture", "Repair Mortar", "Grout"],
        "required_standards": ["EN 197-1", "EN 206", "ASTM C494", "EN 1504", "EN 15804"],
        "required_documents": ["TDS", "EPD", "DoP/CE", "Batch Certificate"],
    },
    {
        "category": "Geosynthetics",
        "key_products": ["Geotextile", "Geogrid", "Geomembrane", "Geocomposite Drain"],
        "required_standards": ["EN 13249", "EN 13251", "ASTM D4595", "ASTM D6637", "ISO 10318"],
        "required_documents": ["TDS", "DoP/CE", "Factory Production Control", "Test Report"],
    },
    {
        "category": "Structural Metals",
        "key_products": ["Rebar", "Structural Steel", "Anchor Bolt", "Rockfall Barrier"],
        "required_standards": ["EN 10080", "EN 1090", "ASTM A615", "ASTM F1554", "ISO 1461"],
        "required_documents": ["TDS", "Mill Certificate", "DoP/CE", "Test Report"],
    },
]


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db)):
    total_passports = db.query(func.count(DPPRecord.id)).scalar() or 0
    total_manufacturers = db.query(func.count(Manufacturer.id)).scalar() or 0

    avg_confidence = db.query(func.avg(DPPRecord.confidence_score)).scalar() or 0
    high_confidence = (
        db.query(func.count(DPPRecord.id))
        .filter(DPPRecord.confidence_score >= 90)
        .scalar() or 0
    )

    by_method = dict(
        db.query(DPPRecord.conversion_method, func.count(DPPRecord.id))
        .group_by(DPPRecord.conversion_method)
        .all()
    )

    by_doc_type = dict(
        db.query(DPPRecord.document_type, func.count(DPPRecord.id))
        .group_by(DPPRecord.document_type)
        .all()
    )

    by_category = (
        db.query(DPPRecord.category, func.count(DPPRecord.id))
        .group_by(DPPRecord.category)
        .order_by(func.count(DPPRecord.id).desc())
        .limit(15)
        .all()
    )

    by_country = (
        db.query(DPPRecord.origin_country, func.count(DPPRecord.id))
        .group_by(DPPRecord.origin_country)
        .order_by(func.count(DPPRecord.id).desc())
        .limit(10)
        .all()
    )

    crm_stages = dict(
        db.query(Manufacturer.crm_stage, func.count(Manufacturer.id))
        .group_by(Manufacturer.crm_stage)
        .all()
    )

    verified_count = (
        db.query(func.count(DPPRecord.id))
        .filter(DPPRecord.verified_by != "", DPPRecord.verified_by.isnot(None))
        .scalar() or 0
    )

    recent = (
        db.query(DPPRecord)
        .order_by(DPPRecord.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "overview": {
            "total_passports": total_passports,
            "total_manufacturers": total_manufacturers,
            "avg_confidence": round(avg_confidence, 1),
            "high_confidence_count": high_confidence,
            "verified_count": verified_count,
            "high_confidence_pct": round(high_confidence / total_passports * 100, 1) if total_passports else 0,
        },
        "by_conversion_method": by_method,
        "by_document_type": by_doc_type,
        "by_category": [{"category": c or "Uncategorized", "count": n} for c, n in by_category],
        "by_country": [{"country": c or "Unknown", "count": n} for c, n in by_country],
        "crm_pipeline": {
            "target": crm_stages.get("target", 0),
            "engaged": crm_stages.get("engaged", 0),
            "onboarded": crm_stages.get("onboarded", 0),
            "active": crm_stages.get("active", 0),
        },
        "recent_passports": [
            {
                "id": r.id,
                "passport_id": r.passport_id,
                "product_name": r.product_name,
                "manufacturer": r.manufacturer,
                "confidence_score": r.confidence_score,
                "document_type": r.document_type,
                "created_at": str(r.created_at),
            }
            for r in recent
        ],
    }


@router.get("/market-coverage")
def market_coverage(db: Session = Depends(get_db)):
    categories = (
        db.query(
            DPPRecord.category,
            func.count(DPPRecord.id).label("product_count"),
            func.count(func.distinct(DPPRecord.manufacturer)).label("manufacturer_count"),
            func.avg(DPPRecord.confidence_score).label("avg_confidence"),
            func.sum(DPPRecord.standards_count).label("total_standards"),
        )
        .group_by(DPPRecord.category)
        .order_by(func.count(DPPRecord.id).desc())
        .all()
    )

    coverage = []
    for cat, prod_count, mfr_count, avg_conf, total_std in categories:
        standards = (
            db.query(DPPRecord.dpp_json)
            .filter(DPPRecord.category == cat)
            .limit(10)
            .all()
        )
        all_standards = set()
        for (json_str,) in standards:
            try:
                import json
                dpp = json.loads(json_str)
                for s in dpp.get("standards_compliance", []):
                    all_standards.add(s)
            except Exception:
                pass

        coverage.append({
            "category": cat or "Uncategorized",
            "product_count": prod_count,
            "manufacturer_count": mfr_count,
            "avg_confidence": round(avg_conf or 0, 1),
            "total_standards_refs": total_std or 0,
            "key_standards": sorted(all_standards)[:10],
        })

    return {"categories": coverage, "total_categories": len(coverage)}


@router.get("/target-market-coverage")
def target_market_coverage(db: Session = Depends(get_db)):
    existing = {
        (cat or "").lower(): {
            "product_count": product_count,
            "manufacturer_count": manufacturer_count,
        }
        for cat, product_count, manufacturer_count in (
            db.query(
                DPPRecord.category,
                func.count(DPPRecord.id),
                func.count(func.distinct(DPPRecord.manufacturer)),
            )
            .group_by(DPPRecord.category)
            .all()
        )
    }

    targets = []
    for item in TARGET_MARKET_CATALOG:
        matched_products = 0
        matched_manufacturers = 0
        for key, stats in existing.items():
            if item["category"].lower() in key or any(p.lower() in key for p in item["key_products"]):
                matched_products += stats["product_count"]
                matched_manufacturers += stats["manufacturer_count"]
        targets.append({
            **item,
            "covered_products": matched_products,
            "covered_manufacturers": matched_manufacturers,
            "coverage_status": "covered" if matched_products else "gap",
        })

    return {
        "targets": targets,
        "total_targets": len(targets),
        "method": "Static target catalog compared with current passport records.",
    }
