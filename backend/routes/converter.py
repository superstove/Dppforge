"""
TDS-to-JSON Converter Routes
=============================

Manual + Automatic conversion endpoints. No auth required (standalone app).
"""

import json
import os
import re
from copy import deepcopy
from datetime import date, datetime, timezone
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
MINIMUM_SAVE_CONFIDENCE = 90

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
    "auto": "Auto-detected construction product evidence",
    "tds": "Technical Data Sheet",
    "epd": "Environmental Product Declaration (EPD)",
    "dop": "Declaration of Performance (DoP / CE marking)",
    "test_report": "Test Report / Laboratory Certificate",
    "sds": "Safety Data Sheet (SDS)",
    "fpc": "Factory Production Control certificate",
    "certificate": "Quality, environmental, or occupational certificate",
    "installation": "Installation or application instruction",
    "maintenance": "Maintenance instruction",
    "warranty": "Warranty document",
    "end_of_life": "Recycling or end-of-life instruction",
    "catalogue": "Product catalogue",
}


def classify_document(text: str, requested_type: str = "auto") -> dict:
    lowered = text.lower()
    rules = [
        ("sds", ["safety data sheet", "section 2 hazards", "hazard identification", "ghs"]),
        ("dop", ["declaration of performance", "avcp", "notified body", "ce marking"]),
        ("epd", ["environmental product declaration", "program operator", "declared unit", "lca"]),
        ("fpc", ["factory production control", "fpc certificate"]),
        ("test_report", ["test report", "laboratory report", "test certificate"]),
        ("installation", ["installation instruction", "application instruction", "method statement"]),
        ("maintenance", ["maintenance instruction", "inspection interval"]),
        ("warranty", ["warranty", "guarantee"]),
        ("end_of_life", ["end of life", "recycling instruction", "disposal instruction"]),
        ("catalogue", ["product catalogue", "catalogue", "brochure"]),
    ]
    detected = "tds"
    for doc_type, needles in rules:
        if any(needle in lowered for needle in needles):
            detected = doc_type
            break
    if requested_type in DOC_PROMPTS and requested_type != "auto":
        detected = requested_type
    product_count = max(1, len(re.findall(r"\bproduct\s+[a-z0-9][\w -]*", lowered)))
    return {
        "document_type": detected,
        "document_label": DOC_PROMPTS.get(detected, DOC_PROMPTS["tds"]),
        "product_count": product_count,
        "classification_method": "keyword",
    }


def ai_extract_product_drafts(text: str, doc_type: str = "tds") -> list[dict]:
    extracted = ai_extract_fields(text, doc_type)
    return [extracted]


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


GEMINI_PREFERRED_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
]


def _normalize_gemini_model_name(name: str) -> str:
    return name.replace("models/", "", 1).strip()


def _gemini_model_candidates(genai, configured_model: str | None = None) -> list[str]:
    discovered: list[str] = []
    try:
        for model in genai.list_models():
            methods = getattr(model, "supported_generation_methods", []) or []
            name = _normalize_gemini_model_name(getattr(model, "name", ""))
            if name.startswith("gemini") and "generateContent" in methods:
                discovered.append(name)
    except Exception as exc:
        print(f"[GEMINI] Could not list models: {type(exc).__name__}: {exc}")

    candidates: list[str] = []

    def add(name: str | None) -> None:
        normalized = _normalize_gemini_model_name(name or "")
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    add(configured_model)
    for preferred in GEMINI_PREFERRED_MODELS:
        if not discovered or preferred in discovered:
            add(preferred)
    for model_name in discovered:
        if "flash" in model_name:
            add(model_name)
    for model_name in discovered:
        add(model_name)

    return candidates or GEMINI_PREFERRED_MODELS.copy()


def _parse_ai_json(raw: str) -> dict:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _extract_with_gemini(text: str, api_key: str, doc_type: str = "tds") -> dict:
    last_error = None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model_name = os.getenv("TDS_GEMINI_MODEL", "").strip() or None
        models_to_try = _gemini_model_candidates(genai, model_name)
        print(f"[GEMINI] API key loaded: yes, candidate models: {', '.join(models_to_try[:5])}, text length: {len(text)}")
    except Exception as e:
        print(f"[GEMINI] Setup failed: {type(e).__name__}: {e}")
        return {"_extraction_error": _friendly_error(e, "Gemini"), **_extract_with_regex(text)}

    for m in models_to_try:
        try:
            print(f"[GEMINI] Trying model: {m}, text length: {len(text)}")
            model = genai.GenerativeModel(m)
            resp = model.generate_content(
                _build_extraction_prompt(text, doc_type),
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=4000,
                ),
                request_options={"timeout": 120},
            )
            if not resp.parts:
                print(f"[GEMINI] Model {m} returned empty response, trying next")
                continue
            raw = resp.text.strip()
            print(f"[GEMINI] Extraction succeeded with {m}, response length: {len(raw)}")
            return _parse_ai_json(raw)
        except Exception as e:
            last_error = e
            print(f"[GEMINI] Model {m} failed: {type(e).__name__}: {e}")
            continue

    print(f"[GEMINI] All models failed, falling back to regex")
    return {"_extraction_error": _friendly_error(last_error or Exception("All models failed"), "Gemini"), **_extract_with_regex(text)}


def _friendly_error(error: Exception, provider: str) -> str:
    msg = str(error).lower()
    if (
        "invalid_api_key" in msg
        or "api key not valid" in msg
        or "permission denied" in msg
        or "api_key_invalid" in msg
        or "401" in msg
        or "403" in msg
    ):
        return f"{provider} API key invalid. Used regex fallback."
    if "quota" in msg or "429" in msg:
        return f"{provider} rate limit reached. Used regex fallback."
    if "404" in msg and "model" in msg:
        return f"{provider} model unavailable. Check TDS_GEMINI_MODEL on Render. Used regex fallback."
    if "deadline" in msg or "timeout" in msg or "timed out" in msg:
        return f"{provider} request timed out. Check Render logs/network and try again. Used regex fallback."
    return f"{provider} extraction failed. Used regex fallback."


def _retryable_ai_error(error: str) -> str:
    return error.replace("Used regex fallback.", "Please retry the PDF extraction.")


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

    def is_noise_line(value: str) -> bool:
        lowered = value.strip().lower()
        if not lowered:
            return True
        if re.fullmatch(r"-+\s*(ocr\s*)?page\s+\d+\s*-+", lowered):
            return True
        if lowered.startswith(("http", "www", "page ")):
            return True
        if lowered in {"technical data sheet", "technical data sheet (tds)", "product data sheet", "data sheet", "tds"}:
            return True
        if lowered.startswith(("sample document", "document no", "revision:", "issue date", "property value unit")):
            return True
        return False

    def looks_like_product_name(value: str) -> bool:
        if is_noise_line(value):
            return False
        if len(value) < 4 or len(value) > 120:
            return False
        if re.search(r"[:=|]", value):
            return False
        if re.search(r"\d+\s*(mpa|mm|kg|g/m|%|hours?|minutes?)\b", value, re.IGNORECASE):
            return False
        return bool(re.search(r"[A-Za-z]{3,}", value))

    for line in lines[:40]:
        line = line.strip()
        product_match = re.match(r"^(?:product|product name)\s*[:=-]\s*(.+)$", line, flags=re.IGNORECASE)
        if product_match and looks_like_product_name(product_match.group(1)):
            extracted["product_name"] = product_match.group(1).strip()
            break

    for line in lines[:40]:
        line = line.strip()
        manufacturer_match = re.match(r"^(?:manufacturer|company|manufactured by)\s*[:=-]\s*(.+)$", line, flags=re.IGNORECASE)
        if manufacturer_match:
            extracted["manufacturer"] = manufacturer_match.group(1).strip()
            break

    for line in lines[:15]:
        line = line.strip()
        if extracted.get("product_name"):
            break
        if looks_like_product_name(line):
            extracted.setdefault("product_name", line)
            break

    product_name = extracted.get("product_name", "")
    inferred_mfr = _infer_manufacturer(text, product_name)
    if inferred_mfr and not extracted.get("manufacturer"):
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

    confidence = {
        "product_name": 95 if extracted.get("product_name") else 0,
        "manufacturer": 95 if extracted.get("manufacturer") else 0,
        "technical_properties": 92 if len(tech_props) >= 3 else 75 if tech_props else 0,
        "standards_compliance": 92 if standards else 0,
    }
    populated_scores = [score for score in confidence.values() if score > 0]
    confidence["overall"] = round(sum(populated_scores) / len(populated_scores)) if populated_scores else 0
    extracted["confidence"] = confidence
    extracted["_extraction_method"] = "regex_fallback"
    return extracted


def _extract_with_regex(text: str) -> dict:
    extracted: dict[str, Any] = {}
    lines = text.split("\n")

    def is_noise_line(value: str) -> bool:
        lowered = value.strip().lower()
        if not lowered:
            return True
        if re.fullmatch(r"-+\s*(ocr\s*)?page\s+\d+\s*-+", lowered):
            return True
        if lowered.startswith(("http", "www", "page ")):
            return True
        if lowered in {"technical data sheet", "technical data sheet (tds)", "product data sheet", "data sheet", "tds"}:
            return True
        if lowered.startswith(("sample document", "document no", "revision:", "issue date", "property value unit")):
            return True
        return False

    def looks_like_product_name(value: str) -> bool:
        if is_noise_line(value):
            return False
        if len(value) < 4 or len(value) > 120:
            return False
        if re.search(r"[:=|]", value):
            return False
        if re.search(r"\d+\s*(mpa|mm|kg|g/m|%|hours?|minutes?)\b", value, re.IGNORECASE):
            return False
        return bool(re.search(r"[A-Za-z]{3,}", value))

    for line in lines[:40]:
        product_match = re.match(r"^(?:product|product name)\s*[:=-]\s*(.+)$", line.strip(), flags=re.IGNORECASE)
        if product_match and looks_like_product_name(product_match.group(1)):
            extracted["product_name"] = product_match.group(1).strip()
            break

    for line in lines[:40]:
        manufacturer_match = re.match(r"^(?:manufacturer|company|manufactured by)\s*[:=-]\s*(.+)$", line.strip(), flags=re.IGNORECASE)
        if manufacturer_match:
            extracted["manufacturer"] = manufacturer_match.group(1).strip()
            break

    for line in lines[:15]:
        line = line.strip()
        if extracted.get("product_name"):
            break
        if looks_like_product_name(line):
            extracted["product_name"] = line
            break

    product_name = extracted.get("product_name", "")
    inferred_mfr = _infer_manufacturer(text, product_name)
    if inferred_mfr and not extracted.get("manufacturer"):
        extracted["manufacturer"] = inferred_mfr
    extracted["category"] = _infer_category(text)

    standards: list[str] = []
    tech_props: dict[str, dict] = {}
    working_props: dict[str, dict] = {}
    working_keywords = (
        "open time", "pot life", "adjustability", "traffic", "walkable", "curing",
        "setting time", "water", "mix ratio", "mixing ratio", "coverage",
        "shelf life", "workability", "application thickness",
    )

    def add_property(raw_name: str, raw_value: str, unit: str) -> None:
        key = re.sub(r"[^a-z0-9]+", "_", raw_name.lower()).strip("_")
        if not key or key in {"property", "value", "test_method", "tolerance"}:
            return
        value_text = raw_value.strip().replace("–", "-").replace("â€“", "-")
        if "-" in value_text:
            value: Any = re.sub(r"\s+", "", value_text)
        else:
            try:
                cleaned = (
                    value_text.replace(",", "")
                    .replace("<=", "")
                    .replace(">=", "")
                    .replace("<", "")
                    .replace(">", "")
                    .strip()
                )
                value = float(cleaned)
                if value == int(value):
                    value = int(value)
            except ValueError:
                value = value_text
        prop = {"value": value, "unit": normalize_unit(unit.strip())}
        if any(word in key.replace("_", " ") for word in working_keywords):
            working_props[key] = prop
        else:
            tech_props[key] = prop

    for line in lines:
        clean_line = line.strip()
        for pat in [
            r"(ISO\s*\d+[\w\-]*)",
            r"(EN\s*\d+[\w\-]*)",
            r"(ASTM\s*[A-Z]\d+[\w\-]*)",
            r"(ANSI\s*[A-Z]?\d+[\w\.\-]*)",
            r"(IS\s*\d+[\w\-]*)",
        ]:
            for match in re.findall(pat, clean_line, re.IGNORECASE):
                normalized = re.sub(r"\s+", " ", match).strip().upper()
                if normalized not in standards:
                    standards.append(normalized)

        numeric_row = re.search(
            r"\b((?:<=|>=|<|>)?\s*\d[\d.,]*(?:\s*(?:-|to|–)\s*\d[\d.,]*)?)\b\s*(.*)$",
            clean_line,
            re.IGNORECASE,
        )
        if numeric_row:
            raw_name = clean_line[: numeric_row.start()].strip(" :-|")
            if (
                raw_name
                and len(raw_name) <= 45
                and not re.search(r"^(revision|document|issue date|property value|rev|page)\b", raw_name, re.IGNORECASE)
                and not re.search(r"\b(referencing|designed as|certification|compliance|standard)\b", raw_name, re.IGNORECASE)
            ):
                rest = numeric_row.group(2).strip()
                unit_match = re.match(r"([A-Za-z0-9/%°²³µμ.\-/]+(?:\s*/\s*\d+\s*kg)?)", rest)
                unit = unit_match.group(1) if unit_match else ""
                add_property(raw_name, numeric_row.group(1), unit)
                continue

        row_match = re.match(
            r"^([A-Za-z][A-Za-z\s/\-()]+?)\s+([<>]=?\s*\d[\d.,]*(?:\s*[-–â€“]\s*\d[\d.,]*)?)\s+(.+)$",
            clean_line,
        )
        if row_match and not re.search(r"^(revision|document|issue date|property value)\b", row_match.group(1), re.IGNORECASE):
            unit = row_match.group(3).split()[0]
            if len(unit) <= 16:
                add_property(row_match.group(1), row_match.group(2), unit)
                continue

        table_match = re.match(
            r"^([A-Za-z][A-Za-z\s/\-()]+?)\s+([<>]=?\s*\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?)\s+([A-Za-z/%°²³µμ.\-/]+(?:\s*/\s*\d+\s*kg)?)\b",
            clean_line,
        )
        if table_match and not re.search(r"^(revision|document|issue date)\b", table_match.group(1), re.IGNORECASE):
            add_property(table_match.group(1), table_match.group(2), table_match.group(3))
            continue

        kv_match = re.match(
            r"^([A-Za-z0-9\s\-/().]+?)\s*(?:[:=]|\|)\s*([<>]=?\s*\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?)\s*([A-Za-z/%°²³µμ.\- ]+)?",
            clean_line,
        )
        if kv_match:
            add_property(kv_match.group(1), kv_match.group(2), kv_match.group(3) or "")

    if standards:
        extracted["standards_compliance"] = standards
    if tech_props:
        extracted["technical_properties"] = tech_props
    if working_props:
        extracted["working_properties"] = working_props

    confidence = {
        "product_name": 95 if extracted.get("product_name") else 0,
        "manufacturer": 95 if extracted.get("manufacturer") else 0,
        "technical_properties": 92 if len(tech_props) >= 3 else 75 if tech_props else 0,
        "standards_compliance": 92 if standards else 0,
    }
    populated_scores = [score for score in confidence.values() if score > 0]
    confidence["overall"] = round(sum(populated_scores) / len(populated_scores)) if populated_scores else 0
    extracted["confidence"] = confidence
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
    source_document_id = fields.get("_source_document_id", "")
    sources = []
    for field in ["product_name", "manufacturer", "category", "standards_compliance", "technical_properties"]:
        value = fields.get(field)
        if value:
            confidence = base_conf.get(field, base_conf.get("overall", 0))
            sources.append({
                "field": field,
                "field_path": field,
                "source_document_id": source_document_id,
                "source_type": source_type,
                "source_title": title,
                "page": fields.get(f"{field}_page", "1"),
                "section": fields.get(f"{field}_section", ""),
                "quote": fields.get(f"{field}_quote", ""),
                "citation": fields.get(f"{field}_citation", "Page 1"),
                "extraction_method": fields.get("_extraction_method", "ai"),
                "confidence": confidence,
                "ai_confidence": confidence,
                "review_status": "pending",
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
    source_document_id = fields.get("_source_document_id") or f"SRC-{slug}-{now.strftime('%H%M%S%f')[:10]}"
    fields["_source_document_id"] = source_document_id

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
            "source_document_id": source_document_id,
            "type": DOC_PROMPTS.get(doc_type, "Technical Data Sheet"),
            "document_type_code": doc_type,
            "document_title": fields.get("tds_title", f"{product_name} - {DOC_PROMPTS.get(doc_type, 'Technical Data Sheet')}"),
            "title": fields.get("tds_title", f"{product_name} - {DOC_PROMPTS.get(doc_type, 'Technical Data Sheet')}"),
            "issuer": fields.get("issuer", fields.get("manufacturer", "")),
            "revision": fields.get("tds_revision", ""),
            "issue_date": fields.get("tds_date", ""),
            "expiry_date": fields.get("expiry_date", ""),
            "file_name": fields.get("_source_file_name", ""),
            "rights_status": fields.get("rights_status", "internal_review"),
            "review_status": "pending",
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
    additional_info = fields.get("additional_info", {}) if isinstance(fields.get("additional_info", {}), dict) else {}
    for section in ["identifiers", "manufacturing", "supply_chain", "health_safety", "lifecycle"]:
        if section in fields:
            dpp[section] = fields[section]
        elif section in additional_info:
            dpp[section] = additional_info[section]
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


class ApprovalInput(BaseModel):
    dpp_json: dict
    reviewer: str
    reviewed_confidence: float = Field(ge=0, le=100)
    rights_status: str
    notes: str = ""


APPROVABLE_RIGHTS = {"manufacturer_authorized", "public_document", "licensed_reuse", "authority_approved"}


def publication_issues(dpp: dict, payload: ApprovalInput | None = None) -> list[str]:
    issues = []
    if not dpp.get("product_name") or not dpp.get("manufacturer"):
        issues.append("Product identity must include product name and manufacturer.")
    evidence = dpp.get("evidence", {})
    field_sources = evidence.get("field_sources", []) if isinstance(evidence, dict) else []
    cited_fields = {src.get("field") or src.get("field_path") for src in field_sources if src.get("citation") or src.get("quote")}
    for field in ["product_name", "manufacturer"]:
        if field not in cited_fields:
            issues.append(f"Required field citations missing for {field}.")
    conflicts = dpp.get("conflicts", [])
    critical_conflicts = [c for c in conflicts if c.get("severity", "critical") == "critical" and c.get("status") != "resolved"] if isinstance(conflicts, list) else []
    if critical_conflicts:
        issues.append("Critical conflicts must be resolved before approval.")
    rights_status = payload.rights_status if payload else dpp.get("data_rights", {}).get("permission_status", "")
    if rights_status not in APPROVABLE_RIGHTS:
        issues.append("Rights status must permit publication.")
    reviewed_confidence = payload.reviewed_confidence if payload else dpp.get("review", {}).get("reviewed_confidence", 0)
    if reviewed_confidence < MINIMUM_SAVE_CONFIDENCE:
        issues.append(f"Reviewed confidence must be at least {MINIMUM_SAVE_CONFIDENCE}%.")
    if payload and not payload.reviewer.strip():
        issues.append("Reviewer is required.")
    return issues


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


@router.post("/approve")
def approve_dpp(payload: ApprovalInput):
    issues = publication_issues(payload.dpp_json, payload)
    if issues:
        raise HTTPException(status_code=422, detail={"message": "Approval requirements not met", "issues": issues})

    dpp = deepcopy(payload.dpp_json)
    reviewed_at = datetime.now(timezone.utc).isoformat()
    dpp.setdefault("data_rights", {})
    dpp["data_rights"]["permission_status"] = payload.rights_status
    dpp["review"] = {
        "status": "approved",
        "reviewer": payload.reviewer.strip(),
        "reviewed_confidence": payload.reviewed_confidence,
        "reviewed_at": reviewed_at,
        "notes": payload.notes,
    }
    for source in dpp.get("evidence", {}).get("field_sources", []):
        source.setdefault("ai_confidence", source.get("confidence", 0))
        source["review_status"] = "reviewed"
        source["reviewer"] = payload.reviewer.strip()
        source["reviewed_at"] = reviewed_at
    dpp.setdefault("audit_trail", []).append({
        "event": "human_review_approved",
        "actor": payload.reviewer.strip(),
        "method": "server_approval",
        "timestamp": reviewed_at,
    })
    return {"status": "approved", "dpp_json": dpp}


@router.post("/upload", response_model=None)
@limiter.limit("10/minute")
async def upload_extract(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = "tds",
):
    """Upload PDF evidence, extract text, classify document, and return one or more DPP drafts for review."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    if doc_type not in DOC_PROMPTS:
        doc_type = "auto"

    pdf_bytes = await file.read()
    raw_text = extract_text_from_pdf(pdf_bytes)

    if len(raw_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text from PDF. It may be a scanned image.",
        )

    classification = classify_document(raw_text, doc_type)
    detected_doc_type = classification["document_type"]
    extracted_drafts = ai_extract_product_drafts(raw_text, detected_doc_type)

    drafts = []
    warnings = []
    method = "ai"
    for index, extracted in enumerate(extracted_drafts, start=1):
        method = extracted.pop("_extraction_method", method)
        error = extracted.pop("_extraction_error", None)
        if error:
            raise HTTPException(status_code=503, detail=_retryable_ai_error(error))
        extracted["_extraction_method"] = method
        extracted["_source_file_name"] = file.filename
        extracted["_source_document_id"] = f"SRC-{date.today().strftime('%Y%m%d')}-{index}"
        dpp = build_dpp(extracted, extracted.get("batch_number", ""), extracted.get("origin_country", "India"), detected_doc_type)
        dpp["_source_file_name"] = file.filename
        drafts.append(dpp)
        warnings.extend(validate_dpp(dpp))

    if not drafts:
        raise HTTPException(status_code=422, detail="No product drafts could be extracted from this document.")

    dpp = drafts[0]

    return {
        "status": "review_required",
        "conversion_method": method,
        "document_type": detected_doc_type,
        "detected_document_type": detected_doc_type,
        "document_classification": classification,
        "product_count": len(drafts),
        "drafts": drafts,
        "raw_text_preview": raw_text[:2000],
        "raw_text_length": len(raw_text),
        "warnings": sorted(set(warnings)),
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
    ai_confidence = float(confidence.get("overall", 0) or 0)
    review = dpp.get("review", {})
    reviewed_confidence = float(review.get("reviewed_confidence", 0) or 0) if review.get("status") == "approved" else 0
    overall_confidence = reviewed_confidence or ai_confidence
    if overall_confidence < MINIMUM_SAVE_CONFIDENCE:
        raise HTTPException(
            status_code=422,
            detail=f"Overall confidence must be at least {MINIMUM_SAVE_CONFIDENCE}% before saving. Current: {overall_confidence:.0f}%.",
        )
    if review.get("status") == "approved":
        issues = publication_issues(dpp)
        if issues:
            raise HTTPException(status_code=422, detail={"message": "Approval requirements not met", "issues": issues})
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
