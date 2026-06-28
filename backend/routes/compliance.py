"""
EU ESPR Compliance Engine — ESPR field checks, GS1 Digital Link generation,
3-tier access control, GWP carbon calculator, and EU DPP Registry export.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import DPPRecord

router = APIRouter()

# ---------------------------------------------------------------------------
# EU ESPR mandatory field definitions
# ---------------------------------------------------------------------------

ESPR_MANDATORY_FIELDS = {
    "unique_identifier": {
        "label": "Unique Product Identifier",
        "description": "GS1 Digital Link URI or equivalent unique ID",
        "regulation": "ESPR Art. 9(1)",
        "tier": "public",
    },
    "product_name": {
        "label": "Product Name",
        "description": "Commercial name of the product",
        "regulation": "ESPR Art. 9(1)",
        "tier": "public",
    },
    "manufacturer": {
        "label": "Manufacturer Details",
        "description": "Name, address, and contact of the manufacturer",
        "regulation": "ESPR Art. 9(1)(a)",
        "tier": "public",
    },
    "material_composition": {
        "label": "Material Composition",
        "description": "Full material breakdown including critical raw materials",
        "regulation": "ESPR Art. 9(1)(c)",
        "tier": "authorized",
    },
    "substances_of_concern": {
        "label": "Substances of Concern",
        "description": "SCIP-aligned hazardous substance declarations",
        "regulation": "ESPR Art. 9(1)(d)",
        "tier": "authorized",
    },
    "carbon_footprint": {
        "label": "Carbon Footprint (GWP)",
        "description": "Global Warming Potential per functional unit",
        "regulation": "ESPR Art. 9(1)(e) / CPR Jan 2026",
        "tier": "public",
    },
    "recycled_content": {
        "label": "Recycled Content",
        "description": "Percentage of recycled material by weight",
        "regulation": "ESPR Art. 9(1)(f)",
        "tier": "public",
    },
    "durability_performance": {
        "label": "Durability & Performance",
        "description": "Technical properties demonstrating product durability",
        "regulation": "ESPR Art. 9(1)(g)",
        "tier": "public",
    },
    "standards_compliance": {
        "label": "Standards & Compliance",
        "description": "EN/ISO/ASTM standards and CE/DoP declarations",
        "regulation": "ESPR Art. 9(1)(h)",
        "tier": "public",
    },
    "end_of_life": {
        "label": "End-of-Life Instructions",
        "description": "Recycling, reuse, and disposal guidance",
        "regulation": "ESPR Art. 9(1)(i)",
        "tier": "authorized",
    },
    "country_of_origin": {
        "label": "Country of Origin",
        "description": "Country where the product was manufactured",
        "regulation": "ESPR Art. 9(1)(b)",
        "tier": "public",
    },
    "batch_identifier": {
        "label": "Batch / Lot Identifier",
        "description": "Batch or lot number for traceability",
        "regulation": "ESPR Art. 9(1)(a)",
        "tier": "authority",
    },
}

# CPR-specific fields for cement and steel (mandatory from Jan 2026)
CPR_ADDITIONAL_FIELDS = {
    "gwp_value": {
        "label": "GWP Declaration Value",
        "description": "Numeric GWP in kg CO2-eq per functional unit",
        "regulation": "CPR Delegated Act — Jan 2026",
        "tier": "public",
    },
    "epd_reference": {
        "label": "EPD Reference",
        "description": "Link or reference to Environmental Product Declaration",
        "regulation": "CPR Art. 22",
        "tier": "public",
    },
}

CPR_CATEGORIES = {"cement", "steel", "concrete", "iron", "rebar", "structural steel",
                   "reinforcement", "clinker", "slag", "fly ash"}


COMPLIANCE_RULEBOOK = [
    {
        "id": "espr-core-fields",
        "name": "ESPR core DPP field presence",
        "source_type": "regulation",
        "source": "EU 2024/1781 field mapping interpreted for construction DPP records",
        "validation_status": "requires_expert_review",
    },
    {
        "id": "cpr-material-trigger",
        "name": "CPR construction product category trigger",
        "source_type": "internal_mapping",
        "source": "Keyword mapping for cement, concrete, steel, rebar, and related binders",
        "validation_status": "requires_expert_review",
    },
    {
        "id": "gwp-reference-factors",
        "name": "Reference GWP benchmark factors",
        "source_type": "industry_reference",
        "source": "Embedded benchmark table; replace with licensed/current LCA source before production decisions",
        "validation_status": "requires_expert_review",
    },
]


@router.get("/rulebook")
def rulebook():
    return {
        "validation_status": "requires_expert_review",
        "disclaimer": "Compliance mappings are operational checks, not legal certification. A qualified standards/compliance expert must validate them before authority-grade use.",
        "rules": COMPLIANCE_RULEBOOK,
    }


def _check_field(dpp: dict, field_key: str) -> dict:
    """Check if a mandatory field is present and populated in the DPP."""
    result = {"field": field_key, "status": "missing", "value": None}

    if field_key == "unique_identifier":
        gs1 = dpp.get("gs1_identifier") or dpp.get("passport_id", "")
        if gs1:
            result["status"] = "pass"
            result["value"] = gs1
    elif field_key == "product_name":
        v = dpp.get("product_name", "")
        if v and v.strip() and not v.startswith("---"):
            result["status"] = "pass"
            result["value"] = v
        elif v:
            result["status"] = "warning"
            result["value"] = v
    elif field_key == "manufacturer":
        v = dpp.get("manufacturer", "")
        if v and v.strip():
            result["status"] = "pass"
            result["value"] = v
    elif field_key == "material_composition":
        tech = dpp.get("technical_properties", {})
        composition_keywords = {"composition", "content", "material", "chemical", "mineral",
                                "ite", "ite_content", "ite_%"}
        found = [k for k in tech if any(kw in k.lower() for kw in composition_keywords)]
        if found:
            result["status"] = "pass"
            result["value"] = f"{len(found)} composition properties found"
        elif tech:
            result["status"] = "warning"
            result["value"] = "Technical properties exist but no explicit composition data"
    elif field_key == "substances_of_concern":
        additional = dpp.get("additional_info", {})
        tech = dpp.get("technical_properties", {})
        soc_keywords = {"hazard", "toxic", "svhc", "reach", "substance", "voc", "formaldehyde",
                        "lead", "chromium", "asbestos", "danger"}
        all_keys = list(tech.keys()) + list(additional.keys())
        found = [k for k in all_keys if any(kw in k.lower() for kw in soc_keywords)]
        if found:
            result["status"] = "pass"
            result["value"] = f"{len(found)} substance declarations found"
        else:
            result["status"] = "warning"
            result["value"] = "No substance of concern data declared (may be N/A for this product)"
    elif field_key == "carbon_footprint":
        sus = dpp.get("sustainability", {})
        cf = sus.get("carbon_footprint", {})
        if cf and cf.get("value") and cf["value"] > 0:
            result["status"] = "pass"
            result["value"] = f"{cf['value']} {cf.get('unit', 'kgCO2e')}"
        elif sus.get("recycled_content_pct", 0) > 0:
            result["status"] = "warning"
            result["value"] = "Sustainability data exists but no specific GWP value"
    elif field_key == "recycled_content":
        sus = dpp.get("sustainability", {})
        rc = sus.get("recycled_content_pct", 0)
        if rc is not None and rc > 0:
            result["status"] = "pass"
            result["value"] = f"{rc}%"
        elif rc == 0:
            result["status"] = "warning"
            result["value"] = "Declared as 0% (valid if accurate)"
    elif field_key == "durability_performance":
        tech = dpp.get("technical_properties", {})
        if len(tech) >= 2:
            result["status"] = "pass"
            result["value"] = f"{len(tech)} technical properties documented"
        elif len(tech) == 1:
            result["status"] = "warning"
            result["value"] = "Only 1 property — consider adding more"
    elif field_key == "standards_compliance":
        stds = dpp.get("standards_compliance", [])
        if len(stds) >= 1:
            result["status"] = "pass"
            result["value"] = f"{len(stds)} standards referenced"
    elif field_key == "end_of_life":
        additional = dpp.get("additional_info", {})
        eol_keywords = {"recycl", "reuse", "disposal", "end_of_life", "end-of-life",
                        "disassembl", "deconstruct", "waste"}
        desc = dpp.get("description", "").lower()
        all_text = desc + " ".join(str(v) for v in additional.values()).lower()
        if any(kw in all_text for kw in eol_keywords):
            result["status"] = "pass"
            result["value"] = "End-of-life information found"
        else:
            result["status"] = "missing"
            result["value"] = None
    elif field_key == "country_of_origin":
        batch = dpp.get("batch_info", {})
        v = batch.get("origin_country", "")
        if v and v.strip():
            result["status"] = "pass"
            result["value"] = v
    elif field_key == "batch_identifier":
        batch = dpp.get("batch_info", {})
        v = batch.get("batch_number", "")
        if v and v.strip():
            result["status"] = "pass"
            result["value"] = v
    elif field_key == "gwp_value":
        sus = dpp.get("sustainability", {})
        cf = sus.get("carbon_footprint", {})
        if cf and cf.get("value") and cf["value"] > 0:
            result["status"] = "pass"
            result["value"] = f"{cf['value']} {cf.get('unit', 'kgCO2e')}"
    elif field_key == "epd_reference":
        doc_type = dpp.get("document_type", "")
        source = dpp.get("source_document", {})
        if doc_type == "epd" or "epd" in source.get("type", "").lower():
            result["status"] = "pass"
            result["value"] = source.get("document_title", "EPD referenced")
        else:
            result["status"] = "warning"
            result["value"] = "No EPD linked — consider adding EPD reference"

    return result


# ---------------------------------------------------------------------------
# 1. ESPR Compliance Engine
# ---------------------------------------------------------------------------

@router.get("/{record_id}/check")
def check_compliance(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    dpp = json.loads(record.dpp_json)
    category = (dpp.get("category", "") or "").lower()

    fields_to_check = dict(ESPR_MANDATORY_FIELDS)
    is_cpr_product = any(c in category for c in CPR_CATEGORIES)
    if is_cpr_product:
        fields_to_check.update(CPR_ADDITIONAL_FIELDS)

    results = []
    for key, meta in fields_to_check.items():
        check = _check_field(dpp, key)
        results.append({
            **check,
            "label": meta["label"],
            "description": meta["description"],
            "regulation": meta["regulation"],
            "access_tier": meta["tier"],
        })

    pass_count = sum(1 for r in results if r["status"] == "pass")
    warn_count = sum(1 for r in results if r["status"] == "warning")
    miss_count = sum(1 for r in results if r["status"] == "missing")
    total = len(results)

    score = round(((pass_count + warn_count * 0.5) / total) * 100) if total else 0

    if score >= 80:
        grade = "green"
    elif score >= 50:
        grade = "amber"
    else:
        grade = "red"

    return {
        "passport_id": record.passport_id,
        "product_name": dpp.get("product_name", ""),
        "category": dpp.get("category", ""),
        "is_cpr_product": is_cpr_product,
        "compliance_score": score,
        "grade": grade,
        "summary": {
            "total_fields": total,
            "pass": pass_count,
            "warning": warn_count,
            "missing": miss_count,
        },
        "fields": results,
        "applicable_regulations": (
            ["ESPR (EU 2024/1781)", "CPR Delegated Act (Jan 2026)"]
            if is_cpr_product
            else ["ESPR (EU 2024/1781)"]
        ),
    }


@router.get("/overview")
def compliance_overview(db: Session = Depends(get_db)):
    records = db.query(DPPRecord).all()
    if not records:
        return {"total": 0, "green": 0, "amber": 0, "red": 0, "avg_score": 0, "items": []}

    items = []
    green = amber = red = 0
    total_score = 0

    for record in records:
        dpp = json.loads(record.dpp_json)
        category = (dpp.get("category", "") or "").lower()

        fields_to_check = dict(ESPR_MANDATORY_FIELDS)
        if any(c in category for c in CPR_CATEGORIES):
            fields_to_check.update(CPR_ADDITIONAL_FIELDS)

        results = [_check_field(dpp, key) for key in fields_to_check]
        pass_count = sum(1 for r in results if r["status"] == "pass")
        warn_count = sum(1 for r in results if r["status"] == "warning")
        total = len(results)
        score = round(((pass_count + warn_count * 0.5) / total) * 100) if total else 0

        if score >= 80:
            grade = "green"
            green += 1
        elif score >= 50:
            grade = "amber"
            amber += 1
        else:
            grade = "red"
            red += 1

        total_score += score
        items.append({
            "id": record.id,
            "passport_id": record.passport_id,
            "product_name": dpp.get("product_name", ""),
            "manufacturer": dpp.get("manufacturer", ""),
            "category": dpp.get("category", ""),
            "compliance_score": score,
            "grade": grade,
        })

    return {
        "total": len(records),
        "green": green,
        "amber": amber,
        "red": red,
        "avg_score": round(total_score / len(records)),
        "items": sorted(items, key=lambda x: x["compliance_score"]),
    }


# ---------------------------------------------------------------------------
# 2. 3-Tier Access Control
# ---------------------------------------------------------------------------

ACCESS_TIERS = {
    "public": {
        "label": "Public (Consumer)",
        "description": "Basic product info visible to anyone who scans the QR code",
    },
    "authorized": {
        "label": "Authorized (Recyclers, Repairers)",
        "description": "Detailed material and composition data for authorized stakeholders",
    },
    "authority": {
        "label": "Authority (Market Surveillance)",
        "description": "Full compliance documentation for regulatory authorities",
    },
}

PUBLIC_FIELDS = {
    "dpp_version", "passport_id", "gs1_identifier", "product_name", "manufacturer",
    "category", "description", "document_type", "standards_compliance",
    "packaging_and_storage", "application", "qr_verification",
    "sustainability", "batch_info",
}

AUTHORIZED_FIELDS = PUBLIC_FIELDS | {
    "technical_properties", "working_properties", "additional_info",
}

AUTHORITY_FIELDS = AUTHORIZED_FIELDS | {
    "source_document", "confidence",
}

TIER_FIELD_MAP = {
    "public": PUBLIC_FIELDS,
    "authorized": AUTHORIZED_FIELDS,
    "authority": AUTHORITY_FIELDS,
}


@router.get("/{record_id}/access")
def get_tiered_access(
    record_id: int,
    tier: str = Query("public", regex="^(public|authorized|authority)$"),
    db: Session = Depends(get_db),
):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    dpp = json.loads(record.dpp_json)
    allowed_fields = TIER_FIELD_MAP.get(tier, PUBLIC_FIELDS)
    filtered_dpp = {k: v for k, v in dpp.items() if k in allowed_fields}

    return {
        "access_tier": tier,
        "tier_info": ACCESS_TIERS[tier],
        "passport_id": record.passport_id,
        "product_name": dpp.get("product_name", ""),
        "fields_visible": len(filtered_dpp),
        "fields_total": len(dpp),
        "dpp_data": filtered_dpp,
    }


# ---------------------------------------------------------------------------
# 3. GS1 Digital Link Identifiers
# ---------------------------------------------------------------------------

GS1_COMPANY_PREFIX = "0860000"


def generate_gs1_identifier(passport_id: str, product_name: str) -> dict:
    hash_input = f"{passport_id}:{product_name}"
    hash_hex = hashlib.sha256(hash_input.encode()).hexdigest()

    gtin_digits = re.sub(r"[^0-9]", "", hash_hex[:12]).ljust(13, "0")[:13]
    digits = [int(d) for d in gtin_digits]
    checksum = (10 - sum(d * (3 if i % 2 else 1) for i, d in enumerate(digits)) % 10) % 10
    gtin14 = gtin_digits + str(checksum)

    serial = passport_id.replace("DPP-", "").replace("-", "")[:20]
    digital_link = f"https://id.gs1.org/01/{gtin14}/21/{serial}"

    return {
        "gtin": gtin14,
        "serial_number": serial,
        "digital_link_uri": digital_link,
        "data_carrier": "QR Code (GS1 Digital Link)",
        "ai_01": gtin14,
        "ai_21": serial,
    }


@router.get("/{record_id}/gs1")
def get_gs1_identifier(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    dpp = json.loads(record.dpp_json)
    gs1 = generate_gs1_identifier(record.passport_id, dpp.get("product_name", ""))

    return {
        "passport_id": record.passport_id,
        "product_name": dpp.get("product_name", ""),
        "gs1": gs1,
    }


# ---------------------------------------------------------------------------
# 4. Carbon Footprint Calculator (GWP)
# ---------------------------------------------------------------------------

GWP_FACTORS = {
    "cement": {"gwp_per_kg": 0.9, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "concrete": {"gwp_per_kg": 0.13, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "steel": {"gwp_per_kg": 1.55, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "rebar": {"gwp_per_kg": 1.99, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "aluminium": {"gwp_per_kg": 8.24, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "glass": {"gwp_per_kg": 0.86, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "brick": {"gwp_per_kg": 0.24, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "timber": {"gwp_per_kg": 0.46, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "plaster": {"gwp_per_kg": 0.12, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "insulation": {"gwp_per_kg": 1.86, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "pvc": {"gwp_per_kg": 2.41, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "bitumen": {"gwp_per_kg": 0.49, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "tile adhesive": {"gwp_per_kg": 0.74, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "mortar": {"gwp_per_kg": 0.20, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "geomembrane": {"gwp_per_kg": 2.53, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
    "grout": {"gwp_per_kg": 0.35, "unit": "kgCO2e/kg", "source": "ICE Database v3.0"},
}

TRANSPORT_FACTORS = {
    "road": 0.0001,
    "rail": 0.00003,
    "sea": 0.00001,
    "air": 0.0006,
}


@router.post("/carbon-calculator")
def carbon_calculator(data: dict):
    material = data.get("material", "").lower().strip()
    weight_kg = float(data.get("weight_kg", 0))
    transport_mode = data.get("transport_mode", "road").lower()
    transport_km = float(data.get("transport_km", 0))
    recycled_pct = float(data.get("recycled_content_pct", 0))
    custom_gwp = data.get("custom_gwp_per_kg")

    if custom_gwp:
        gwp_per_kg = float(custom_gwp)
        source = "User-provided value"
    elif material in GWP_FACTORS:
        gwp_per_kg = GWP_FACTORS[material]["gwp_per_kg"]
        source = GWP_FACTORS[material]["source"]
    else:
        matched = None
        for key in GWP_FACTORS:
            if key in material or material in key:
                matched = key
                break
        if matched:
            gwp_per_kg = GWP_FACTORS[matched]["gwp_per_kg"]
            source = GWP_FACTORS[matched]["source"]
        else:
            return {
                "error": f"Unknown material '{material}'",
                "available_materials": sorted(GWP_FACTORS.keys()),
                "tip": "Use 'custom_gwp_per_kg' to provide your own emission factor",
            }

    recycled_reduction = 1 - (recycled_pct / 100 * 0.6)
    production_gwp = weight_kg * gwp_per_kg * recycled_reduction

    transport_factor = TRANSPORT_FACTORS.get(transport_mode, TRANSPORT_FACTORS["road"])
    transport_gwp = weight_kg * transport_km * transport_factor

    total_gwp = round(production_gwp + transport_gwp, 4)

    lca_stages = {
        "A1_A3_production": round(production_gwp, 4),
        "A4_transport": round(transport_gwp, 4),
        "total_A1_A4": total_gwp,
    }

    return {
        "material": material,
        "weight_kg": weight_kg,
        "gwp_factor": gwp_per_kg,
        "gwp_factor_source": source,
        "recycled_content_pct": recycled_pct,
        "recycled_reduction_factor": round(recycled_reduction, 3),
        "transport_mode": transport_mode,
        "transport_km": transport_km,
        "lca_stages": lca_stages,
        "total_gwp_kgCO2e": total_gwp,
        "unit": "kgCO2e",
        "gwp_per_unit": round(total_gwp / max(weight_kg, 1), 6),
        "gwp_per_unit_label": "kgCO2e/kg",
        "methodology": "EN 15804+A2 (simplified)",
        "available_materials": sorted(GWP_FACTORS.keys()),
    }


@router.get("/{record_id}/carbon")
def passport_carbon(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    dpp = json.loads(record.dpp_json)
    category = (dpp.get("category", "") or "").lower().strip()
    sustainability = dpp.get("sustainability", {})
    carbon = sustainability.get("carbon_footprint", {})

    result = {
        "passport_id": record.passport_id,
        "product_name": dpp.get("product_name", ""),
        "category": dpp.get("category", ""),
    }

    if carbon and carbon.get("value") and carbon["value"] > 0:
        result["declared_gwp"] = {
            "value": carbon["value"],
            "unit": carbon.get("unit", "kgCO2e"),
            "source": "Extracted from document",
        }

    factor = None
    for key in GWP_FACTORS:
        if key in category or category in key:
            factor = GWP_FACTORS[key]
            break

    if factor:
        result["reference_gwp"] = {
            "value": factor["gwp_per_kg"],
            "unit": factor["unit"],
            "source": factor["source"],
            "material": category,
        }

        if carbon and carbon.get("value") and carbon["value"] > 0:
            declared = carbon["value"]
            reference = factor["gwp_per_kg"]
            if declared < reference * 0.7:
                rating = "excellent"
            elif declared < reference:
                rating = "good"
            elif declared < reference * 1.3:
                rating = "average"
            else:
                rating = "high"
            result["gwp_rating"] = rating
            result["vs_benchmark"] = f"{round((declared / reference - 1) * 100)}% vs industry average"
    else:
        result["reference_gwp"] = None

    result["recycled_content_pct"] = sustainability.get("recycled_content_pct", 0)
    result["cpr_applicable"] = any(c in category for c in CPR_CATEGORIES)
    result["cpr_deadline"] = "January 2026" if result["cpr_applicable"] else None

    return result


# ---------------------------------------------------------------------------
# 5. EU DPP Registry Export
# ---------------------------------------------------------------------------

@router.get("/{record_id}/registry-export")
def registry_export(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")

    dpp = json.loads(record.dpp_json)
    gs1 = generate_gs1_identifier(record.passport_id, dpp.get("product_name", ""))
    sustainability = dpp.get("sustainability", {})
    batch = dpp.get("batch_info", {})
    source = dpp.get("source_document", {})
    tech_props = dpp.get("technical_properties", {})

    registry_payload = {
        "schema_version": "1.0.0",
        "registry": "EU DPP Registry (ESPR)",
        "submission_date": datetime.now(timezone.utc).isoformat(),
        "status": "draft",

        "identifier": {
            "gs1_digital_link": gs1["digital_link_uri"],
            "gtin": gs1["gtin"],
            "serial_number": gs1["serial_number"],
            "internal_passport_id": record.passport_id,
        },

        "economic_operator": {
            "name": dpp.get("manufacturer", ""),
            "role": "manufacturer",
            "country": batch.get("origin_country", ""),
        },

        "product": {
            "name": dpp.get("product_name", ""),
            "category": dpp.get("category", ""),
            "description": dpp.get("description", ""),
            "document_type": dpp.get("document_type", ""),
        },

        "environmental_information": {
            "carbon_footprint": {
                "value": sustainability.get("carbon_footprint", {}).get("value", 0),
                "unit": sustainability.get("carbon_footprint", {}).get("unit", "kgCO2e"),
                "methodology": "EN 15804+A2",
            },
            "recycled_content_pct": sustainability.get("recycled_content_pct", 0),
            "recyclable": sustainability.get("recyclable", False),
        },

        "technical_documentation": {
            "standards": dpp.get("standards_compliance", []),
            "properties_count": len(tech_props),
            "source_document": {
                "type": source.get("type", ""),
                "title": source.get("document_title", ""),
                "date": source.get("date_issued", ""),
            },
        },

        "traceability": {
            "batch_number": batch.get("batch_number", ""),
            "production_date": batch.get("production_date", ""),
            "origin_country": batch.get("origin_country", ""),
            "factory_location": batch.get("factory_location", ""),
        },

        "data_quality": {
            "confidence_score": record.confidence_score,
            "conversion_method": record.conversion_method,
            "data_carrier": "QR Code (GS1 Digital Link)",
        },

        "access_rights": {
            "public_fields": list(PUBLIC_FIELDS),
            "authorized_fields": list(AUTHORIZED_FIELDS - PUBLIC_FIELDS),
            "authority_fields": list(AUTHORITY_FIELDS - AUTHORIZED_FIELDS),
        },
    }

    return registry_payload
