"""
TDS-to-JSON Converter Routes
=============================

Manual + Automatic conversion endpoints. No auth required (standalone app).
"""

import json
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, Query as QueryParam
from fastapi.responses import Response
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from database import get_db
from models import DPPRecord
from url_utils import dpp_verification_url, public_app_base_url
from utils import generate_qr_bytes

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

CONSTRUCTASK_URL = os.getenv("CONSTRUCTASK_URL", "https://constructask.vercel.app").rstrip("/")
MINIMUM_SAVE_CONFIDENCE = 0

# ---------------------------------------------------------------------------
# Unit normalization
# ---------------------------------------------------------------------------

UNIT_MAP = {
    "kn/m": "kN/m", "kpa": "kPa", "mpa": "MPa", "mm": "mm", "m": "m",
    "cm": "cm", "kg": "kg", "g/m2": "g/m²", "g/m²": "g/m²",
    "g/cm3": "g/cm³", "g/cm³": "g/cm³",
    "kgco2e": "kgCO2e", "kgco2e/m2": "kgCO2e/m²",
    "°c": "°C", "deg c": "°C", "celsius": "°C",
    "%": "%", "percent": "%", "hours": "hours", "hrs": "hours",
    "minutes": "minutes", "min": "minutes", "months": "months",
    "years": "years", "µm": "µm", "micron": "µm",
    "nm": "Nm", "litres": "litres", "liters": "litres",
    "units": "units", "tonnes": "tonnes",
    "s-1": "s⁻¹", "m2/s": "m²/s", "ph": "pH",
    "kg/m2": "kg/m²", "kg/m3": "kg/m³",
}


def normalize_unit(raw: str) -> str:
    return UNIT_MAP.get(raw.lower().strip(), raw.strip())


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def _clean_pdf_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _page_blocks_text(page: Any) -> str:
    blocks = page.get_text("blocks") or []
    text_blocks = []
    for block in blocks:
        if len(block) >= 5 and str(block[4]).strip():
            x0, y0 = float(block[0]), float(block[1])
            text_blocks.append((y0, x0, str(block[4]).strip()))
    text_blocks.sort(key=lambda item: (round(item[0] / 8), item[1]))
    return "\n".join(block[2] for block in text_blocks)


def _page_table_text(page: Any) -> str:
    try:
        tables = page.find_tables()
    except Exception:
        return ""

    rows = []
    for table in getattr(tables, "tables", []):
        try:
            for row in table.extract():
                cells = [str(cell).strip() for cell in row if cell and str(cell).strip()]
                if cells:
                    rows.append(" | ".join(cells))
        except Exception:
            continue
    return "\n".join(rows)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        import fitz
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PyMuPDF not installed. Run: pip install PyMuPDF",
        )
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open PDF. The file may be corrupted or password protected.")

    if doc.needs_pass:
        doc.close()
        raise HTTPException(status_code=400, detail="Password-protected PDFs are not supported. Please upload an unlocked TDS PDF.")

    pages = []
    image_only_pages = 0
    for index, page in enumerate(doc, start=1):
        direct = page.get_text("text") or ""
        blocks = _page_blocks_text(page)
        tables = _page_table_text(page)

        candidates = [direct, blocks, f"{blocks}\n{tables}" if tables else ""]
        best = max(candidates, key=lambda value: len(value.strip()))
        best = _clean_pdf_text(best)

        if len(best) < 25:
            image_only_pages += 1
            continue

        pages.append(f"--- Page {index} ---\n{best}")

    page_count = doc.page_count
    doc.close()

    merged = _clean_pdf_text("\n\n".join(pages))

    if not merged or image_only_pages > 0:
        ocr_text = _ocr_pdf_pages(pdf_bytes, image_only_pages if merged else page_count)
        if ocr_text:
            if merged:
                merged += f"\n\n--- OCR Extracted ({image_only_pages} page(s)) ---\n{ocr_text}"
            else:
                merged = ocr_text
            merged += "\n\n[Extraction note: OCR was used for scanned pages. Review the output carefully.]"

    if not merged:
        raise HTTPException(
            status_code=422,
            detail=(
                "This looks like a scanned/image-only PDF and OCR could not extract text. "
                "Install Tesseract OCR or use a text-selectable PDF."
            ),
        )

    if image_only_pages and "[Extraction note:" not in merged:
        merged += (
            f"\n\n[Extraction note: {image_only_pages} of {page_count} page(s) had little or no selectable text. "
            "Review the output carefully.]"
        )

    return merged


def _ocr_pdf_pages(pdf_bytes: bytes, max_pages: int = 10) -> str:
    try:
        import fitz
        from PIL import Image
        import pytesseract
    except ImportError:
        return ""

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return ""

    ocr_pages = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        try:
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img, lang="eng")
            text = _clean_pdf_text(text)
            if len(text) > 25:
                ocr_pages.append(f"--- OCR Page {i + 1} ---\n{text}")
        except Exception:
            continue

    doc.close()
    return "\n\n".join(ocr_pages)


# ---------------------------------------------------------------------------
# AI extraction
# ---------------------------------------------------------------------------

DOC_PROMPTS = {
    "tds": "Technical Data Sheet",
    "epd": "Environmental Product Declaration (EPD)",
    "dop": "Declaration of Performance (DoP / CE marking)",
    "test_report": "Test Report / Laboratory Certificate",
}


def _build_extraction_prompt(text: str, doc_type: str = "tds") -> str:
    doc_label = DOC_PROMPTS.get(doc_type, "Technical Data Sheet")

    extra_rules = ""
    if doc_type == "epd":
        extra_rules = """
- Extract LCA / environmental impact data: GWP (Global Warming Potential), ODP, AP, EP, POCP, ADPE, ADPF
- Put environmental impact values in technical_properties with their functional unit
- Extract declared unit, product stage (A1-A3, C1-C4, D), EPD program operator, EPD number
- Map carbon_footprint_value to the GWP-total A1-A3 value if present
"""
    elif doc_type == "dop":
        extra_rules = """
- Extract CE marking details: notified body number, system of AVCP (1/1+/2+/3/4)
- Extract declared performance values for each essential characteristic
- Map EN standard references (e.g. EN 13162, EN 12004) to standards_compliance
- Extract DoP reference number, ETAG/EAD references if present
"""
    elif doc_type == "test_report":
        extra_rules = """
- Extract test method, specimen details, test date, laboratory name
- Map each test result to technical_properties with the test method reference
- Extract pass/fail conclusions if stated
"""

    return f"""You are a construction materials data extraction assistant.

Extract product information from the following {doc_label} text and return ONLY valid JSON (no markdown, no explanation).
The source may come from any document layout: paragraphs, multi-column brochures, table rows separated by pipes, mixed headings, or manufacturer-specific labels.

Use this exact JSON structure:
{{
  "product_name": "...",
  "manufacturer": "...",
  "category": "...",
  "description": "...",
  "technical_properties": {{
    "property_name": {{ "value": ..., "unit": "...", "test_method": "..." }}
  }},
  "working_properties": {{
    "property_name": {{ "value": ..., "unit": "..." }}
  }},
  "applications": ["..."],
  "suitable_for": ["..."],
  "standards_compliance": ["..."],
  "packaging": "...",
  "storage": "...",
  "shelf_life_months": 12,
  "confidence": {{
    "product_name": 95,
    "manufacturer": 90,
    "technical_properties": 85,
    "standards_compliance": 80,
    "overall": 87
  }}
}}

Rules:
- Extract all numerical values with their units, including ranges such as 6-7 MPa or 16-24 hours
- Put application-time values such as open time, pot life, adjustability time, time to traffic, water demand, mix ratio, coverage, curing time, shelf life in working_properties
- Put performance/engineering values such as compressive strength, tensile adhesion, slip, density, deformation, thickness, elongation, load, permeability in technical_properties
- Normalize units (MPa, N/mm2, kN/m, kg/m2, kg/m3, %, hours, minutes, mm, m)
- Include test method references where mentioned (ISO, EN, ASTM, ANSI, IS, BIS)
- If the document uses tables, infer the property name from the row/column label
- If a value is not found, omit the field rather than inventing it
- For each key field, estimate a confidence score (0-100) based on how clearly the value was stated in the source text
- The overall confidence is the weighted average across all extracted fields{extra_rules}
- Return ONLY the JSON object, nothing else

{doc_label} Text:
{text[:14000]}"""


def ai_extract_fields(text: str, doc_type: str = "tds") -> dict:
    if os.getenv("TDS_OPENAI_API_KEY"):
        return _extract_with_openai(text, os.getenv("TDS_OPENAI_API_KEY", ""), doc_type)
    elif os.getenv("TDS_GEMINI_API_KEY"):
        return _extract_with_gemini(text, os.getenv("TDS_GEMINI_API_KEY", ""), doc_type)
    else:
        return _extract_with_regex(text)


def _extract_with_openai(text: str, api_key: str, doc_type: str = "tds") -> dict:
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": _build_extraction_prompt(text, doc_type)}],
            temperature=0.1,
            max_tokens=4000,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        return {"_extraction_error": _friendly_error(e, "OpenAI"), **_extract_with_regex(text)}


def _extract_with_gemini(text: str, api_key: str, doc_type: str = "tds") -> dict:
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model_name = os.getenv("TDS_GEMINI_MODEL", "gemini-2.5-flash")
        print(f"[GEMINI] Using model: {model_name}, key: {api_key[:8]}..., text length: {len(text)}")
        model = genai.GenerativeModel(model_name)
        resp = model.generate_content(
            _build_extraction_prompt(text, doc_type),
            generation_config={"temperature": 0.1, "max_output_tokens": 4000},
        )
        raw = resp.text.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        print(f"[GEMINI] Extraction succeeded, response length: {len(raw)}")
        return json.loads(raw)
    except Exception as e:
        print(f"[GEMINI] Extraction failed: {type(e).__name__}: {e}")
        return {"_extraction_error": _friendly_error(e, "Gemini"), **_extract_with_regex(text)}


def _friendly_error(error: Exception, provider: str) -> str:
    msg = str(error).lower()
    if "invalid_api_key" in msg or "401" in msg:
        return f"{provider} API key invalid. Used regex fallback."
    if "quota" in msg or "429" in msg:
        return f"{provider} rate limit reached. Used regex fallback."
    return f"{provider} extraction failed. Used regex fallback."


def _infer_category(text: str) -> str:
    lowered = text.lower()
    rules = [
        ("Tile Adhesive", ["tile adhesive", "adhesive mortar", "thin bed", "c2te"]),
        ("Block Jointing Mortar", ["block jointing", "fixoblock", "aac block"]),
        ("Waterproofing", ["waterproofing", "water proofing", "membrane"]),
        ("Grout", ["grout", "grouting"]),
        ("Concrete Admixture", ["admixture", "plasticizer", "superplasticizer"]),
        ("Geosynthetic Reinforcement", ["geogrid", "geosynthetic", "reinforcement grid"]),
        ("Geotextile", ["geotextile", "nonwoven", "non-woven"]),
        ("Drainage System", ["drainage", "draincore", "geocomposite drain"]),
        ("Anchoring System", ["anchor", "bolt", "rock bolt"]),
        ("Erosion Control", ["erosion", "slope protection", "slopeshield"]),
        ("Rockfall Protection", ["rockfall", "barrier", "rock barrier"]),
    ]
    for cat, needles in rules:
        if any(n in lowered for n in needles):
            return cat
    return "Construction Material"


def _infer_manufacturer(text: str, product_name: str) -> str:
    candidates = {
        "UltraTech": ["ultratech", "fixoblock"],
        "LATICRETE": ["laticrete"],
        "MYK LATICRETE": ["myk laticrete"],
        "Sika": ["sika"],
        "Fosroc": ["fosroc"],
        "Maccaferri": ["maccaferri"],
        "GeoStruct Materials": ["geostruct"],
        "Delta GeoSystems": ["delta geo"],
        "TerraGrid India": ["terragrid"],
        "CoreBuild Materials": ["corebuild"],
    }
    combined = f"{product_name}\n{text}".lower()
    for mfr, needles in candidates.items():
        if any(n in combined for n in needles):
            return mfr
    return ""


def _extract_with_regex(text: str) -> dict:
    extracted: dict[str, Any] = {}
    lines = text.split("\n")

    for line in lines[:10]:
        line = line.strip()
        if line and len(line) > 3 and not line.startswith(("http", "www", "page", "Page", " ")):
            extracted.setdefault("product_name", line)
            break

    product_name = extracted.get("product_name", "")
    inferred_mfr = _infer_manufacturer(text, product_name)
    if inferred_mfr:
        extracted["manufacturer"] = inferred_mfr
    extracted["category"] = _infer_category(text)

    standards = []
    tech_props = {}
    working_props = {}
    working_keywords = (
        "open time", "pot life", "adjustability", "traffic", "walkable", "curing",
        "setting time", "water", "mix ratio", "coverage", "shelf life", "workability",
    )
    for line in lines:
        for pat in [r"(ISO\s*\d+[\w\-]*)", r"(EN\s*\d+[\w\-]*)", r"(ASTM\s*[A-Z]\d+[\w\-]*)", r"(ANSI\s*[A-Z]?\d+[\w\.\-]*)", r"(IS\s*\d+[\w\-]*)"]:
            for m in re.findall(pat, line, re.IGNORECASE):
                if m not in standards:
                    standards.append(m)

        kv = re.match(
            r"^([A-Za-z0-9\s\-/().]+?)\s*(?:[:=]|\|)\s*([<>]?\s*\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?)\s*([A-Za-z/%°²³⁻¹μµ.\- ]+)?",
            line.strip(),
        )
        if kv:
            key = re.sub(r"[^a-z0-9]+", "_", kv.group(1).lower()).strip("_")
            raw_value = kv.group(2).strip()
            if re.search(r"[-–]", raw_value):
                val: Any = re.sub(r"\s+", "", raw_value.replace("–", "-"))
            else:
                try:
                    val = float(raw_value.replace(",", "").replace("<", "").replace(">", "").strip())
                    if val == int(val):
                        val = int(val)
                except ValueError:
                    val = raw_value
            prop = {"value": val, "unit": normalize_unit((kv.group(3) or "").strip())}
            if any(word in key.replace("_", " ") for word in working_keywords):
                working_props[key] = prop
            else:
                tech_props[key] = prop

    if standards:
        extracted["standards_compliance"] = standards
    if tech_props:
        extracted["technical_properties"] = tech_props
    if working_props:
        extracted["working_properties"] = working_props

    extracted["_extraction_method"] = "regex_fallback"
    return extracted


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_dpp(dpp: dict) -> list[str]:
    warnings = []
    for f in ["product_name", "manufacturer", "category", "technical_properties", "standards_compliance"]:
        if not dpp.get(f):
            warnings.append(f"Missing or empty: {f}")
    tp = dpp.get("technical_properties", {})
    if isinstance(tp, dict) and len(tp) == 0:
        warnings.append("No technical properties extracted")
    sc = dpp.get("standards_compliance", [])
    if isinstance(sc, list) and len(sc) == 0:
        warnings.append("No standards compliance entries")
    return warnings


def _field_sources(fields: dict, doc_type: str) -> list[dict]:
    title = fields.get("tds_title") or fields.get("product_name") or "Source document"
    source_type = DOC_PROMPTS.get(doc_type, "Source document")
    base_conf = fields.get("confidence", {})
    sources = []
    for field in ["product_name", "manufacturer", "category", "standards_compliance", "technical_properties"]:
        value = fields.get(field)
        if value:
            sources.append({
                "field": field,
                "source_type": source_type,
                "source_title": title,
                "citation": fields.get(f"{field}_citation", ""),
                "confidence": base_conf.get(field, base_conf.get("overall", 0)),
            })
    return sources


def _ensure_quality_metadata(dpp: dict, conversion_method: str = "manual") -> dict:
    confidence = dpp.get("confidence", {})
    if "data_rights" not in dpp:
        dpp["data_rights"] = {
            "permission_status": "internal_review",
            "rights_holder": dpp.get("manufacturer", ""),
            "allowed_uses": ["internal_review", "manufacturer_authorized_public_qr"],
            "license_notes": "Confirm manufacturer permission before publishing externally.",
        }
    if "evidence" not in dpp:
        source = dpp.get("source_document", {})
        dpp["evidence"] = {
            "minimum_confidence_required": MINIMUM_SAVE_CONFIDENCE,
            "field_sources": [
                {
                    "field": "product_name",
                    "source_type": source.get("type", "Source document"),
                    "source_title": source.get("document_title", dpp.get("product_name", "")),
                    "citation": "",
                    "confidence": confidence.get("product_name", confidence.get("overall", 0)),
                },
                {
                    "field": "manufacturer",
                    "source_type": source.get("type", "Source document"),
                    "source_title": source.get("document_title", dpp.get("product_name", "")),
                    "citation": "",
                    "confidence": confidence.get("manufacturer", confidence.get("overall", 0)),
                },
            ],
            "quality_notes": "Field citations must be completed during review for authority-grade records.",
        }
    dpp.setdefault("audit_trail", []).append({
        "event": "dpp_created",
        "actor": dpp.get("source_document", {}).get("converted_by", "DPP Forge"),
        "method": conversion_method,
        "timestamp": datetime.now().isoformat(),
    })
    return dpp


# ---------------------------------------------------------------------------
# DPP JSON builder
# ---------------------------------------------------------------------------

def build_dpp(fields: dict, batch_number: str = "", origin_country: str = "India", doc_type: str = "tds") -> dict:
    from datetime import timezone
    product_name = fields.get("product_name", "Unknown Product")
    slug = re.sub(r"[^A-Z0-9]", "-", product_name.upper())[:20].strip("-")
    now = datetime.now(timezone.utc)
    passport_id = f"DPP-{slug}-{date.today().year}-{now.strftime('%H%M%S')}"

    confidence = fields.get("confidence", {})

    dpp = {
        "dpp_version": "1.0",
        "passport_id": passport_id,
        "product_name": product_name,
        "manufacturer": fields.get("manufacturer", ""),
        "category": fields.get("category", ""),
        "description": fields.get("description", ""),
        "document_type": doc_type,
        "technical_properties": fields.get("technical_properties", {}),
        "working_properties": fields.get("working_properties", {}),
        "application": {
            "primary_use": fields.get("applications", []),
            "suitable_for": fields.get("suitable_for", []),
        },
        "standards_compliance": fields.get("standards_compliance", []),
        "packaging_and_storage": {
            "packaging": fields.get("packaging", ""),
            "storage": fields.get("storage", ""),
            "shelf_life": {
                "value": fields.get("shelf_life_months", 12),
                "unit": "months",
                "condition": "unopened, original packaging",
            },
        },
        "sustainability": {
            "recycled_content_pct": fields.get("recycled_content_pct", 0),
            "carbon_footprint": {
                "value": fields.get("carbon_footprint_value", 0),
                "unit": fields.get("carbon_footprint_unit", "kgCO2e/unit"),
            },
            "recyclable": fields.get("recyclable", True),
        },
        "batch_info": {
            "batch_number": batch_number or f"BATCH-{date.today().strftime('%Y%m%d')}",
            "production_date": str(date.today()),
            "origin_country": origin_country,
            "factory_location": fields.get("factory_location", ""),
        },
        "qr_verification": {
            "qr_code": f"QR-{slug}-{date.today().year}",
            "verification_url": dpp_verification_url(passport_id),
            "scan_type": "check_specification",
        },
        "confidence": {
            "overall": confidence.get("overall", 0),
            "product_name": confidence.get("product_name", 0),
            "manufacturer": confidence.get("manufacturer", 0),
            "technical_properties": confidence.get("technical_properties", 0),
            "standards_compliance": confidence.get("standards_compliance", 0),
        },
        "source_document": {
            "type": DOC_PROMPTS.get(doc_type, "Technical Data Sheet"),
            "document_type_code": doc_type,
            "document_title": fields.get("tds_title", f"{product_name} - {DOC_PROMPTS.get(doc_type, 'Technical Data Sheet')}"),
            "revision": fields.get("tds_revision", ""),
            "date_issued": fields.get("tds_date", ""),
            "conversion_method": fields.get("_extraction_method", "manual"),
            "converted_by": fields.get("converted_by", "DPP Forge"),
            "conversion_date": str(date.today()),
        },
        **({"additional_info": fields["additional_info"]} if fields.get("additional_info") else {}),
    }
    dpp["evidence"] = {
        "minimum_confidence_required": MINIMUM_SAVE_CONFIDENCE,
        "field_sources": _field_sources(fields, doc_type),
        "quality_notes": "Review each extracted field against cited source material before external publication.",
    }
    dpp["data_rights"] = {
        "permission_status": "internal_review",
        "rights_holder": fields.get("manufacturer", ""),
        "allowed_uses": ["internal_review", "manufacturer_authorized_public_qr"],
        "license_notes": "Manufacturer permission or public document reuse rights must be confirmed.",
    }
    dpp["audit_trail"] = [{
        "event": "dpp_created",
        "actor": fields.get("converted_by", "DPP Forge"),
        "method": fields.get("_extraction_method", "manual"),
        "timestamp": now.isoformat(),
    }]
    return dpp


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ManualInput(BaseModel):
    product_name: str
    manufacturer: str
    category: str = ""
    description: str = ""
    technical_properties: dict = Field(default_factory=dict)
    working_properties: dict = Field(default_factory=dict)
    applications: list[str] = Field(default_factory=list)
    suitable_for: list[str] = Field(default_factory=list)
    standards_compliance: list[str] = Field(default_factory=list)
    batch_number: str = ""
    origin_country: str = "India"
    factory_location: str = ""
    packaging: str = ""
    storage: str = ""
    shelf_life_months: int = 12
    recycled_content_pct: int = 0
    carbon_footprint_value: float = 0.0
    carbon_footprint_unit: str = "kgCO2e/unit"
    document_type: str = "tds"
    tds_title: str = ""
    tds_revision: str = ""
    tds_date: str = ""
    additional_info: dict = Field(default_factory=dict)


class SaveInput(BaseModel):
    dpp_json: dict
    qr_type: str = "dpp_forge"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/manual")
def manual_convert(payload: ManualInput):
    """Manual TDS-to-JSON conversion."""
    fields = payload.model_dump()
    fields["_extraction_method"] = "manual"
    fields["confidence"] = {"overall": 100, "product_name": 100, "manufacturer": 100, "technical_properties": 100, "standards_compliance": 100}
    dpp = build_dpp(fields, payload.batch_number, payload.origin_country, payload.document_type)
    warnings = validate_dpp(dpp)
    return {
        "status": "review_required",
        "conversion_method": "manual",
        "document_type": payload.document_type,
        "warnings": warnings,
        "extracted_dpp": dpp,
    }


@router.post("/upload", response_model=None)
@limiter.limit("10/minute")
async def upload_extract(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = "tds",
):
    """Upload PDF (TDS/EPD/DoP/Test Report), extract text, AI-map fields, return DPP JSON for review."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    if doc_type not in DOC_PROMPTS:
        doc_type = "tds"

    pdf_bytes = await file.read()
    raw_text = extract_text_from_pdf(pdf_bytes)

    if len(raw_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text from PDF. It may be a scanned image.",
        )

    extracted = ai_extract_fields(raw_text, doc_type)
    method = extracted.pop("_extraction_method", "ai")
    error = extracted.pop("_extraction_error", None)
    extracted["_extraction_method"] = method

    dpp = build_dpp(extracted, extracted.get("batch_number", ""), extracted.get("origin_country", "India"), doc_type)
    warnings = validate_dpp(dpp)
    if error:
        warnings.append(error)

    return {
        "status": "review_required",
        "conversion_method": method,
        "document_type": doc_type,
        "raw_text_preview": raw_text[:2000],
        "raw_text_length": len(raw_text),
        "warnings": warnings,
        "extracted_dpp": dpp,
        "source_file_name": file.filename,
    }


@router.post("/batch-upload", response_model=None)
@limiter.limit("5/minute")
async def batch_upload(
    request: Request,
    files: list[UploadFile] = File(...),
    doc_type: str = "tds",
):
    """Upload multiple PDFs for batch conversion."""
    if len(files) > 20:
        raise HTTPException(400, "Maximum 20 files per batch")
    if doc_type not in DOC_PROMPTS:
        doc_type = "tds"

    results = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            results.append({"file": file.filename or "unknown", "status": "error", "detail": "Not a PDF file"})
            continue
        if file.size and file.size > 10 * 1024 * 1024:
            results.append({"file": file.filename, "status": "error", "detail": "File too large (max 10MB)"})
            continue

        try:
            pdf_bytes = await file.read()
            raw_text = extract_text_from_pdf(pdf_bytes)
            if len(raw_text.strip()) < 50:
                results.append({"file": file.filename, "status": "error", "detail": "Not enough text extracted"})
                continue

            extracted = ai_extract_fields(raw_text, doc_type)
            method = extracted.pop("_extraction_method", "ai")
            error = extracted.pop("_extraction_error", None)
            extracted["_extraction_method"] = method

            dpp = build_dpp(extracted, extracted.get("batch_number", ""), extracted.get("origin_country", "India"), doc_type)
            warnings = validate_dpp(dpp)
            if error:
                warnings.append(error)

            results.append({
                "file": file.filename,
                "status": "review_required",
                "conversion_method": method,
                "document_type": doc_type,
                "warnings": warnings,
                "extracted_dpp": dpp,
                "source_file_name": file.filename,
            })
        except HTTPException as he:
            results.append({"file": file.filename, "status": "error", "detail": he.detail})
        except Exception as e:
            results.append({"file": file.filename, "status": "error", "detail": str(e)})

    succeeded = sum(1 for r in results if r["status"] == "review_required")
    failed = len(results) - succeeded
    return {
        "status": "ok",
        "total": len(results),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }


@router.post("/preview-qr")
def preview_qr(payload: SaveInput, request: Request):
    """Generate a QR code from DPP JSON without saving to database. Returns QR as PNG."""
    dpp = payload.dpp_json
    passport_id = dpp.get("passport_id", f"DPP-PREVIEW-{date.today().year}")
    verify_url = (
        f"{CONSTRUCTASK_URL}/?dpp={passport_id}"
        if payload.qr_type == "constructask"
        else dpp.get("qr_verification", {}).get(
            "verification_url",
            dpp_verification_url(passport_id, request),
        )
    )

    qr_bytes = generate_qr_bytes(verify_url)

    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{passport_id}.png"'},
    )


@router.post("/download-json")
def download_json(payload: SaveInput):
    """Download DPP JSON as a file without saving to database."""
    dpp = payload.dpp_json
    passport_id = dpp.get("passport_id", "dpp-export")
    json_bytes = json.dumps(dpp, indent=2, ensure_ascii=False).encode("utf-8")

    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{passport_id}.json"'},
    )


@router.post("/save")
@limiter.limit("20/minute")
def save_dpp(request: Request, payload: SaveInput, db: Session = Depends(get_db)):
    """Save approved DPP JSON, generate QR code, store in database."""
    dpp = payload.dpp_json
    passport_id = dpp.get("passport_id", f"DPP-UNKNOWN-{date.today().year}")
    product_name = dpp.get("product_name", "Unknown")
    manufacturer = dpp.get("manufacturer", "Unknown")
    existing = db.query(DPPRecord).filter(DPPRecord.passport_id == passport_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Passport {passport_id} already exists. Edit the passport ID or delete the existing one.")

    sustainability = dpp.get("sustainability", {})
    carbon = sustainability.get("carbon_footprint", {})

    confidence = dpp.get("confidence", {})
    overall_confidence = float(confidence.get("overall", 0) or 0)
    if overall_confidence < MINIMUM_SAVE_CONFIDENCE:
        raise HTTPException(
            status_code=422,
            detail=f"Overall confidence must be at least {MINIMUM_SAVE_CONFIDENCE}% before saving. Current: {overall_confidence:.0f}%.",
        )
    dpp = _ensure_quality_metadata(
        dpp,
        dpp.get("source_document", {}).get("conversion_method", "manual"),
    )

    record = DPPRecord(
        passport_id=passport_id,
        product_name=product_name,
        manufacturer=manufacturer,
        category=dpp.get("category", ""),
        batch_number=dpp.get("batch_info", {}).get("batch_number", ""),
        origin_country=dpp.get("batch_info", {}).get("origin_country", "India"),
        conversion_method=dpp.get("source_document", {}).get("conversion_method", "manual"),
        document_type=dpp.get("source_document", {}).get("document_type_code", "tds"),
        carbon_footprint=carbon.get("value", 0),
        standards_count=len(dpp.get("standards_compliance", [])),
        properties_count=len(dpp.get("technical_properties", {})),
        confidence_score=overall_confidence,
        confidence_details=json.dumps(confidence),
        source_file_name=dpp.get("_source_file_name", ""),
        qr_code_path=passport_id,
        qr_code_data=None,
        dpp_json=json.dumps(dpp, ensure_ascii=False),
        status="active",
    )
    db.add(record)
    db.flush()

    verify_url = dpp_verification_url(record.id, request)
    constructask_url = f"{CONSTRUCTASK_URL}/?dpp={passport_id}"
    dpp.setdefault("qr_verification", {})
    dpp["qr_verification"]["verification_url"] = verify_url
    dpp["qr_verification"]["constructask_url"] = constructask_url
    record.qr_code_data = generate_qr_bytes(verify_url)
    record.dpp_json = json.dumps(dpp, ensure_ascii=False)

    db.commit()
    db.refresh(record)

    return {
        "status": "saved",
        "id": record.id,
        "passport_id": passport_id,
        "product_name": product_name,
        "qr_code_url": f"/api/passports/{record.id}/qr",
        "dpp_qr_code_url": f"/api/passports/{record.id}/qr",
        "constructask_qr_code_url": f"/api/passports/{record.id}/constructask-qr",
        "verification_url": verify_url,
        "dpp_verification_url": verify_url,
        "constructask_verification_url": constructask_url,
        "message": f"DPP for '{product_name}' saved with QR code.",
    }


@router.get("/workflow")
def workflow_info():
    """Workflow documentation."""
    return {
        "manual_workflow": {
            "title": "Manual TDS-to-JSON Conversion",
            "steps": [
                "Read the Technical Data Sheet",
                "Identify engineering parameters",
                "Extract values with units",
                "Enter into DPP JSON schema",
                "Normalize units",
                "Review and validate",
                "Save DPP + generate QR",
            ],
            "time": "20-60 minutes per TDS",
        },
        "automatic_workflow": {
            "title": "Automatic TDS-to-JSON Conversion",
            "steps": [
                "Upload TDS PDF",
                "Extract text (PyMuPDF / OCR)",
                "AI identifies product fields",
                "Map to DPP JSON schema",
                "Normalize units",
                "Validate",
                "Human review",
                "Save DPP + generate QR",
            ],
            "time": "1-5 minutes per TDS + review",
            "note": "Human review is mandatory for construction material safety",
        },
        "constructask_integration": {
            "description": "Generated QR codes point to ConstructAsk verification URL",
            "qr_url_format": f"{public_app_base_url()}/?passport=123",
            "import": "Saved DPP JSON files can be imported into ConstructAsk",
        },
    }
