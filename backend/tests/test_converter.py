"""Integration tests for the DPP conversion pipeline."""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///./test_dpp.db"

import database
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///./test_dpp.db", connect_args={"check_same_thread": False})
database.engine = engine
database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import DPPRecord
database.Base.metadata.drop_all(bind=engine)
database.Base.metadata.create_all(bind=engine)

from main import app
from fastapi.testclient import TestClient
import fitz
from routes.passports import _generate_dpp_pdf
from routes import converter
from routes.converter import _extract_with_regex, _friendly_error, _gemini_model_candidates
from url_utils import public_app_base_url

client = TestClient(app)


def _manual_dpp(product_name: str = "Reviewed Product") -> dict:
    res = client.post("/api/convert/manual", json={
        "product_name": product_name,
        "manufacturer": "Review Corp",
        "category": "Concrete",
        "standards_compliance": ["EN 206"],
        "technical_properties": {"compressive_strength": {"value": 40, "unit": "MPa"}},
    })
    assert res.status_code == 200
    return res.json()["extracted_dpp"]


def _approved_dpp(product_name: str = "Approved Product") -> dict:
    dpp = _manual_dpp(product_name)
    dpp["confidence"]["overall"] = 72
    approved = client.post("/api/convert/approve", json={
        "dpp_json": dpp,
        "reviewer": "Product Passport Engineer",
        "reviewed_confidence": 95,
        "rights_status": "manufacturer_authorized",
    })
    assert approved.status_code == 200
    return approved.json()["dpp_json"]


def _upload_pdf(text: str, doc_type: str = "auto"):
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = document.tobytes()
    document.close()
    return client.post(
        f"/api/convert/upload?doc_type={doc_type}",
        files={"file": ("evidence.pdf", pdf_bytes, "application/pdf")},
    )


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_manual_convert_basic():
    payload = {
        "product_name": "Test Grout 100",
        "manufacturer": "Test Corp",
        "category": "Grout",
        "description": "A test product.",
        "technical_properties": {
            "compressive_strength": {"value": 45, "unit": "MPa", "test_method": "EN 12190"},
        },
        "standards_compliance": ["EN 1504-6"],
        "applications": ["Grouting"],
    }
    res = client.post("/api/convert/manual", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "review_required"
    assert data["conversion_method"] == "manual"

    dpp = data["extracted_dpp"]
    assert dpp["product_name"] == "Test Grout 100"
    assert dpp["manufacturer"] == "Test Corp"
    assert "compressive_strength" in dpp["technical_properties"]
    assert dpp["passport_id"].startswith("DPP-")
    assert dpp["dpp_version"] == "1.0"


def test_manual_convert_missing_fields():
    payload = {"product_name": "Bare Product", "manufacturer": "X"}
    res = client.post("/api/convert/manual", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["warnings"]) > 0


def test_manual_convert_preserves_unknown_values_and_structured_chain_data():
    payload = {
        "product_name": "Evidence Honest Product",
        "manufacturer": "Example Manufacturer",
        "identifiers": {"gtin": "8901234567890"},
        "manufacturing": {"facility_name": "Plant A"},
        "supply_chain": {"supplier": "Supplier One"},
        "health_safety": {"sds_url": "https://example.test/sds.pdf"},
        "lifecycle": {"recycling": "Separate clean packaging"},
    }
    res = client.post("/api/convert/manual", json=payload)
    assert res.status_code == 200
    dpp = res.json()["extracted_dpp"]

    assert dpp["batch_info"] == {
        "batch_number": "",
        "production_date": "",
        "origin_country": "",
        "factory_location": "",
    }
    assert dpp["packaging_and_storage"]["shelf_life"]["value"] is None
    assert dpp["sustainability"]["recycled_content_pct"] is None
    assert dpp["sustainability"]["carbon_footprint"]["value"] is None
    assert dpp["sustainability"]["recyclable"] is None
    assert dpp["confidence"]["overall"] == 100
    assert dpp["identifiers"]["gtin"] == "8901234567890"
    assert dpp["manufacturing"]["facility_name"] == "Plant A"
    assert dpp["supply_chain"]["supplier"] == "Supplier One"
    assert dpp["health_safety"]["sds_url"].endswith("sds.pdf")
    assert dpp["lifecycle"]["recycling"] == "Separate clean packaging"


def test_save_and_list_and_delete():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Pipeline Test Product",
        "manufacturer": "Test",
        "category": "Adhesive",
        "standards_compliance": ["ISO 10319"],
        "technical_properties": {"tensile": {"value": 50, "unit": "kN/m"}},
    })
    dpp = manual.json()["extracted_dpp"]

    save = client.post("/api/convert/save", json={"dpp_json": dpp})
    assert save.status_code == 200
    saved = save.json()
    assert saved["status"] == "saved"
    record_id = saved["id"]

    listing = client.get("/api/passports/")
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert any(p["id"] == record_id for p in items)

    detail = client.get(f"/api/passports/{record_id}")
    assert detail.status_code == 200
    assert detail.json()["product_name"] == "Pipeline Test Product"

    qr = client.get(f"/api/passports/{record_id}/qr")
    assert qr.status_code == 200
    assert qr.headers["content-type"] == "image/png"

    deleted = client.delete(f"/api/passports/{record_id}")
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"

    missing = client.get(f"/api/passports/{record_id}")
    assert missing.status_code == 404


def test_upload_rejects_non_pdf():
    res = client.post("/api/convert/upload", files={"file": ("test.txt", b"not a pdf", "text/plain")})
    assert res.status_code == 400


def test_upload_returns_retryable_error_when_configured_ai_fails(monkeypatch):
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Test Product Technical Data Sheet\nManufacturer: Test Corp\nStrength: 40 MPa\nEN 206")
    pdf_bytes = document.tobytes()
    document.close()

    monkeypatch.setenv("TDS_GEMINI_API_KEY", "configured-for-test")
    monkeypatch.setattr(
        converter,
        "ai_extract_fields",
        lambda _text, _doc_type: {
            "_extraction_method": "regex_fallback",
            "_extraction_error": "Gemini rate limit reached. Used regex fallback.",
            "product_name": "Test Product Technical Data Sheet",
        },
    )

    res = client.post(
        "/api/convert/upload?doc_type=tds",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )

    assert res.status_code == 503
    assert res.json()["detail"] == "Gemini rate limit reached. Please retry the PDF extraction."


def test_preview_qr():
    dpp = {"passport_id": "DPP-TEST-QR", "product_name": "QR Test"}
    res = client.post("/api/convert/preview-qr", json={"dpp_json": dpp})
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"


def test_download_json():
    dpp = {"passport_id": "DPP-DOWNLOAD-TEST", "product_name": "Download Test"}
    res = client.post("/api/convert/download-json", json={"dpp_json": dpp})
    assert res.status_code == 200
    assert "application/json" in res.headers["content-type"]


def test_pagination():
    res = client.get("/api/passports/?limit=2&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_save_rejects_low_confidence_passports():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Low Confidence Product",
        "manufacturer": "Test",
        "category": "Geotextile",
        "standards_compliance": ["EN 13249"],
        "technical_properties": {"mass": {"value": 200, "unit": "g/m2"}},
    })
    dpp = manual.json()["extracted_dpp"]
    dpp["confidence"]["overall"] = 89

    res = client.post("/api/convert/save", json={"dpp_json": dpp})

    assert res.status_code == 422
    assert "90" in res.json()["detail"]


def test_save_rejects_zero_confidence_regex_fallback_passports():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Regex Fallback Product",
        "manufacturer": "Test",
        "category": "Geotextile",
        "standards_compliance": ["EN 13249"],
        "technical_properties": {"mass": {"value": 200, "unit": "g/m2"}},
    })
    dpp = manual.json()["extracted_dpp"]
    dpp["confidence"]["overall"] = 0
    dpp["source_document"]["conversion_method"] = "regex_fallback"

    res = client.post("/api/convert/save", json={"dpp_json": dpp})

    assert res.status_code == 422
    assert "90" in res.json()["detail"]
    assert "Current: 0%" in res.json()["detail"]


def test_approval_preserves_ai_confidence_and_records_human_review():
    dpp = _manual_dpp("AI Confidence Preserved Product")
    dpp["confidence"]["overall"] = 72

    res = client.post("/api/convert/approve", json={
        "dpp_json": dpp,
        "reviewer": "Product Passport Engineer",
        "reviewed_confidence": 95,
        "rights_status": "manufacturer_authorized",
    })

    assert res.status_code == 200
    approved = res.json()["dpp_json"]
    assert approved["confidence"]["overall"] == 72
    assert approved["review"]["reviewed_confidence"] == 95
    assert approved["review"]["status"] == "approved"
    assert approved["data_rights"]["permission_status"] == "manufacturer_authorized"
    assert approved["audit_trail"][-1]["event"] == "human_review_approved"


def test_approval_rejects_missing_required_citations():
    dpp = _manual_dpp("Citation Missing Product")
    dpp["evidence"]["field_sources"] = []

    res = client.post("/api/convert/approve", json={
        "dpp_json": dpp,
        "reviewer": "Reviewer",
        "reviewed_confidence": 95,
        "rights_status": "manufacturer_authorized",
    })

    assert res.status_code == 422
    assert "citations" in str(res.json()["detail"]).lower()


def test_save_uses_reviewed_confidence_without_overwriting_ai_score():
    approved = _approved_dpp("Reviewed Save Product")

    save = client.post("/api/convert/save", json={"dpp_json": approved})

    assert save.status_code == 200
    detail = client.get(f"/api/passports/{save.json()['id']}").json()
    assert detail["dpp_json"]["confidence"]["overall"] == 72
    assert detail["confidence_score"] == 95


def test_document_classifier_detects_supported_types():
    assert converter.classify_document("Safety Data Sheet SECTION 2 Hazards")["document_type"] == "sds"
    assert converter.classify_document("Declaration of Performance AVCP notified body")["document_type"] == "dop"
    assert converter.classify_document("Factory Production Control certificate")["document_type"] == "fpc"


def test_multi_product_document_returns_separate_drafts(monkeypatch):
    monkeypatch.setattr(converter, "ai_extract_product_drafts", lambda *_args, **_kwargs: [
        {"product_name": "Product A", "manufacturer": "Maker A", "category": "Concrete", "confidence": {"overall": 91}},
        {"product_name": "Product B", "manufacturer": "Maker B", "category": "Concrete", "confidence": {"overall": 92}},
    ])

    res = _upload_pdf("Product A Technical Data Sheet\nProduct B Technical Data Sheet", "auto")

    assert res.status_code == 200
    data = res.json()
    assert data["product_count"] == 2
    assert len(data["drafts"]) == 2
    assert data["drafts"][0]["product_name"] == "Product A"
    assert data["drafts"][1]["product_name"] == "Product B"


def test_upload_adds_source_document_registry_and_field_evidence(monkeypatch):
    monkeypatch.setattr(converter, "ai_extract_product_drafts", lambda *_args, **_kwargs: [
        {
            "product_name": "Evidence Upload Product",
            "manufacturer": "Evidence Maker",
            "category": "Geotextile",
            "standards_compliance": ["EN 13249"],
            "technical_properties": {"mass": {"value": 200, "unit": "g/m2"}},
            "confidence": {"overall": 91, "product_name": 94, "manufacturer": 93, "technical_properties": 90},
            "issuer": "Evidence Maker",
            "tds_revision": "R3",
            "tds_date": "2026-06-01",
            "expiry_date": "2028-06-01",
        }
    ])

    res = _upload_pdf("Evidence Upload Product\nManufacturer: Evidence Maker\nMass: 200 g/m2", "auto")

    assert res.status_code == 200
    dpp = res.json()["extracted_dpp"]
    source = dpp["source_document"]
    assert source["source_document_id"]
    assert source["issuer"] == "Evidence Maker"
    assert source["revision"] == "R3"
    assert source["issue_date"] == "2026-06-01"
    assert source["expiry_date"] == "2028-06-01"
    assert source["file_name"] == "evidence.pdf"
    evidence = dpp["evidence"]["field_sources"][0]
    assert evidence["source_document_id"] == source["source_document_id"]
    assert evidence["ai_confidence"] == evidence["confidence"]
    assert evidence["review_status"] == "pending"


def test_regex_fallback_does_not_use_page_markers_as_identity_fields():
    extracted = _extract_with_regex(
        "--- Page 1 ---\n"
        "UltraTech Fixoblock Jointing Mortar\n"
        "UltraTech Cement Ltd\n"
        "Compressive strength: 7 MPa\n"
        "EN 998-2\n"
    )

    assert extracted["product_name"] == "UltraTech Fixoblock Jointing Mortar"
    assert extracted["manufacturer"] == "UltraTech"
    assert extracted["category"] == "Block Jointing Mortar"
    assert extracted["product_name"] != "--- Page 1 ---"


def test_regex_fallback_extracts_labeled_tds_identity_and_table_rows():
    extracted = _extract_with_regex(
        "--- Page 1 ---\n"
        "Technical Data Sheet (TDS)\n"
        "Sample document for demonstration only.\n"
        "Product: BuildBond X500 Polymer-Modified Tile Adhesive\n"
        "Manufacturer: BuildCore Materials Pvt. Ltd.\n"
        "Document No.: TDS-BBX500-2026-01\n"
        "Revision: 1.0 Issue Date: 30 June 2026\n"
        "Property Value Unit Test Method Tolerance\n"
        "Bulk density 1.45 g/cm3 Internal example +/-0.05\n"
        "Mixing ratio 5.5-6.0 L / 20 kg Internal +/-0.2 L\n"
        "Pot life 3 hours EN 12004 guidance +/-0.5 h\n"
        "Open time 30 minutes EN 12004 as stated\n"
        "Tensile adhesion strength 1.4 MPa EN 12004 +/-0.2\n"
        "Slip resistance <=0.5 mm EN 1308 example Max\n"
        "Compressive strength 28 MPa Internal +/-2\n"
        "Application thickness 3-10 mm Application\n"
        "Coverage 4-6 kg/m2 Calculated Varies\n"
        "Standards Compliance\n"
        "Designed as a sample specification referencing EN 12004, ISO 13007 and IS 15477.\n"
        "Application Instructions\n"
        "Mix with clean water, allow 5 minutes to slake, remix, apply using a notched trowel.\n"
        "Surface Preparation\n"
        "Substrates must be clean, sound, dry or SSD as appropriate, free from dust and oil.\n"
        "Packaging, Storage & Shelf Life\n"
        "20 kg moisture-resistant bags. Store unopened in a cool, dry location on pallets. Shelf life: 12 months.\n"
        "Health & Safety\n"
        "Wear gloves and eye protection. Refer to the Safety Data Sheet before handling.\n"
        "Sustainability\n"
        "Packaging is recyclable where facilities exist.\n"
        "Manufacturer Contact\n"
        "Email: technical@buildcore.example Phone: +91-1800-000-000\n"
    )

    assert extracted["product_name"] == "BuildBond X500 Polymer-Modified Tile Adhesive"
    assert extracted["manufacturer"] == "BuildCore Materials Pvt. Ltd."
    assert extracted["category"] == "Tile Adhesive"
    assert extracted["technical_properties"]["bulk_density"]["value"] == 1.45
    assert extracted["technical_properties"]["tensile_adhesion_strength"]["unit"] == "MPa"
    assert extracted["working_properties"]["pot_life"]["value"] == 3
    assert extracted["working_properties"]["open_time"]["unit"] == "minutes"
    assert "EN 12004" in extracted["standards_compliance"]
    assert "ISO 13007" in extracted["standards_compliance"]
    assert "IS 15477" in extracted["standards_compliance"]
    assert extracted["confidence"]["overall"] >= 90
    assert extracted["confidence"]["product_name"] >= 90
    assert extracted["confidence"]["manufacturer"] >= 90
    assert "notched trowel" in extracted["lifecycle"]["installation"]
    assert extracted["shelf_life_months"] == 12
    assert extracted["health_safety"]["sds_required"] is True
    assert extracted["supply_chain"]["email"] == "technical@buildcore.example"


def test_upload_does_not_invent_origin_when_source_has_no_origin():
    res = _upload_pdf(
        "Technical Data Sheet\n"
        "Product: BuildBond X500 Polymer-Modified Tile Adhesive\n"
        "Manufacturer: BuildCore Materials Pvt. Ltd.\n"
        "Bulk density 1.45 g/cm3 Internal\n"
        "Tensile adhesion strength 1.4 MPa EN 12004\n"
        "Compressive strength 28 MPa Internal\n"
        "Designed as a sample specification referencing EN 12004, ISO 13007 and IS 15477.\n",
        "tds",
    )

    assert res.status_code == 200
    dpp = res.json()["extracted_dpp"]
    assert dpp["batch_info"]["origin_country"] == ""


def test_gemini_friendly_error_includes_actionable_details():
    message = _friendly_error(RuntimeError("404 models/gemini-2.5-flash is not found"), "Gemini")

    assert "model unavailable" in message
    assert "TDS_GEMINI_MODEL" in message


def test_gemini_model_candidates_use_discovered_generate_content_models():
    class FakeGenai:
        @staticmethod
        def list_models():
            return [
                SimpleNamespace(name="models/text-embedding-004", supported_generation_methods=["embedContent"]),
                SimpleNamespace(name="models/gemini-1.5-flash", supported_generation_methods=["generateContent"]),
                SimpleNamespace(name="models/gemini-2.0-flash", supported_generation_methods=["generateContent"]),
            ]

    candidates = _gemini_model_candidates(FakeGenai, "gemini-2.5-flash")

    assert candidates[:3] == ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
    assert "text-embedding-004" not in candidates


def test_gemini_friendly_error_covers_permission_and_bad_key():
    bad_key = _friendly_error(RuntimeError("API key not valid. Please pass a valid API key."), "Gemini")
    forbidden = _friendly_error(RuntimeError("403 Permission denied"), "Gemini")

    assert "API key invalid" in bad_key
    assert "API key invalid" in forbidden


def test_saved_passport_contains_data_rights_evidence_and_audit_trail():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Evidence Ready Product",
        "manufacturer": "Evidence Corp",
        "category": "Concrete",
        "standards_compliance": ["EN 206"],
        "technical_properties": {"compressive_strength": {"value": 40, "unit": "MPa"}},
    })
    dpp = manual.json()["extracted_dpp"]

    save = client.post("/api/convert/save", json={"dpp_json": dpp})
    assert save.status_code == 200
    record_id = save.json()["id"]

    detail = client.get(f"/api/passports/{record_id}").json()["dpp_json"]
    assert detail["data_rights"]["permission_status"] == "internal_review"
    assert detail["evidence"]["minimum_confidence_required"] == 90
    assert detail["evidence"]["field_sources"][0]["field"] == "product_name"
    assert detail["audit_trail"][0]["event"] == "dpp_created"


def test_saved_passport_qr_verification_url_uses_request_host_without_public_env(monkeypatch):
    monkeypatch.delenv("PUBLIC_APP_URL", raising=False)
    monkeypatch.delenv("APP_URL", raising=False)
    monkeypatch.delenv("CONSTRUCTASK_VERIFY_URL", raising=False)
    manual = client.post("/api/convert/manual", json={
        "product_name": "Request Host QR Product",
        "manufacturer": "QR Corp",
        "category": "Concrete",
        "standards_compliance": ["EN 206"],
        "technical_properties": {"compressive_strength": {"value": 40, "unit": "MPa"}},
    })
    dpp = manual.json()["extracted_dpp"]

    save = client.post("/api/convert/save", json={"dpp_json": dpp})

    assert save.status_code == 200
    saved = save.json()
    assert saved["verification_url"].startswith("http://testserver/")
    assert "localhost" not in saved["verification_url"]

    detail = client.get(f"/api/passports/{saved['id']}").json()["dpp_json"]
    assert detail["qr_verification"]["verification_url"] == saved["verification_url"]


def test_public_app_base_url_uses_render_external_url(monkeypatch):
    monkeypatch.delenv("PUBLIC_APP_URL", raising=False)
    monkeypatch.delenv("APP_URL", raising=False)
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://dppforge.onrender.com")
    monkeypatch.delenv("CONSTRUCTASK_VERIFY_URL", raising=False)

    assert public_app_base_url() == "https://dppforge.onrender.com"


def test_scanned_qr_root_url_displays_saved_dpp_json():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Scannable QR Product",
        "manufacturer": "Scan Corp",
        "category": "Concrete",
        "standards_compliance": ["EN 206"],
        "technical_properties": {"compressive_strength": {"value": 40, "unit": "MPa"}},
    })
    dpp = manual.json()["extracted_dpp"]
    save = client.post("/api/convert/save", json={"dpp_json": dpp})
    assert save.status_code == 200

    res = client.get(f"/?passport={save.json()['id']}")

    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Scannable QR Product" in res.text
    assert "&quot;technical_properties&quot;" in res.text
    assert "&quot;compressive_strength&quot;" in res.text


def test_manufacturer_claim_workflow_and_outreach_templates():
    created = client.post("/api/manufacturers/", json={
        "name": "Claimable Manufacturer",
        "country": "India",
        "contact_email": "qa@example.com",
        "categories": "Geotextile, Concrete",
    })
    assert created.status_code == 200
    mfr_id = created.json()["id"]

    claim = client.post(f"/api/manufacturers/{mfr_id}/claims", json={
        "claimant_name": "QA Lead",
        "claimant_email": "qa@example.com",
        "role": "Quality Manager",
        "rights_basis": "Manufacturer authorized data steward",
        "requested_scope": "TDS, EPD, DoP uploads",
    })
    assert claim.status_code == 200
    claim_id = claim.json()["id"]
    assert claim.json()["status"] == "submitted"

    approved = client.patch(f"/api/manufacturers/claims/{claim_id}", json={
        "status": "approved",
        "reviewer": "DPP Ops",
        "review_notes": "Verified by call",
    })
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    detail = client.get(f"/api/manufacturers/{mfr_id}").json()
    assert detail["claim_profile"]["status"] == "approved"
    assert detail["claims"][0]["reviewer"] == "DPP Ops"

    templates = client.get(f"/api/manufacturers/{mfr_id}/outreach-template")
    assert templates.status_code == 200
    assert "Digital Product Passport" in templates.json()["email_subject"]


def test_quality_record_and_batch_qr_envelope():
    approved = _approved_dpp("Batch QR Product")
    save = client.post("/api/convert/save", json={"dpp_json": approved})
    assert save.status_code == 200
    record_id = save.json()["id"]

    qa = client.post(f"/api/passports/{record_id}/quality-records", json={
        "batch_number": "B-100",
        "lot_number": "L-7",
        "serial_number": "S-1",
        "status": "passed",
        "tested_by": "QA Engineer",
        "test_date": "2026-06-30",
        "results": [{"property": "strength", "value": 40, "unit": "MPa"}],
        "disposition": "release",
    })

    assert qa.status_code == 201
    envelope = client.get(f"/api/passports/{record_id}/batch/B-100").json()
    assert envelope["qr_level"] == "batch"
    assert envelope["quality_status"] == "passed"
    assert envelope["product"]["passport_id"] == approved["passport_id"]
    qr = client.get(f"/api/passports/{record_id}/batch/B-100/qr")
    assert qr.status_code == 200
    assert qr.headers["content-type"] == "image/png"


def test_manufacturer_document_request_upload_revision_and_authority():
    created = client.post("/api/manufacturers/", json={
        "name": "Authority Manufacturer",
        "country": "India",
        "contact_email": "authority@example.com",
        "categories": "Road Construction",
    })
    assert created.status_code == 200
    mfr_id = created.json()["id"]

    request = client.post(f"/api/manufacturers/{mfr_id}/document-requests", json={
        "requested_documents": ["TDS", "EPD", "DoP"],
        "product_scope": "Geogrid BX",
        "message": "Please upload current source evidence.",
        "due_date": "2026-07-15",
    })
    assert request.status_code == 201

    upload = client.post(f"/api/manufacturers/{mfr_id}/uploads", json={
        "document_request_id": request.json()["id"],
        "document_type": "TDS",
        "title": "Geogrid BX TDS",
        "file_name": "geogrid-bx.pdf",
        "rights_status": "manufacturer_authorized",
        "product_scope": "Geogrid BX",
    })
    assert upload.status_code == 201
    assert upload.json()["review_status"] == "pending"

    claim = client.post(f"/api/manufacturers/{mfr_id}/claims", json={
        "claimant_name": "Authority Lead",
        "claimant_email": "authority@example.com",
        "role": "Technical Manager",
        "rights_basis": "Authorized manufacturer representative",
        "requested_scope": "Geogrid BX public QR",
        "requested_documents": ["TDS", "EPD", "DoP"],
        "permissions": ["public_qr", "export"],
        "submitted_documents": [upload.json()["id"]],
    })
    assert claim.status_code == 200

    revision = client.patch(f"/api/manufacturers/claims/{claim.json()['id']}", json={
        "status": "revision_requested",
        "reviewer": "DPP Ops",
        "review_notes": "Need EPD and DoP.",
    })
    assert revision.status_code == 200
    assert revision.json()["revision_number"] == 1

    approved = client.patch(f"/api/manufacturers/claims/{claim.json()['id']}", json={
        "status": "approved",
        "reviewer": "DPP Ops",
        "review_notes": "Authority confirmed.",
        "authority_scope": "Geogrid BX",
    })
    assert approved.status_code == 200
    assert approved.json()["authority_status"] == "authorized"

    detail = client.get(f"/api/manufacturers/{mfr_id}").json()
    assert detail["document_requests"][0]["missing_documents"] == ["EPD", "DoP"]
    assert detail["uploads"][0]["file_name"] == "geogrid-bx.pdf"
    assert detail["claim_profile"]["authority_status"] == "authorized"


def test_market_coverage_includes_target_catalog_without_passports():
    res = client.get("/api/analytics/target-market-coverage")
    assert res.status_code == 200
    data = res.json()
    categories = {item["category"] for item in data["targets"]}
    assert "Road Construction" in categories
    road = next(item for item in data["targets"] if item["category"] == "Road Construction")
    assert "Asphalt Mix" in road["key_products"]
    assert "EN 13108" in road["required_standards"]
    assert road["sector"] == "road_construction"
    assert road["expert_validation_status"] == "requires_expert_review"
    assert "missing_documents" in road


def test_target_coverage_marks_partial_when_passport_lacks_required_documents():
    approved = _approved_dpp("Road Geogrid Product")
    approved["category"] = "Geogrid"
    approved["source_document"]["document_type_code"] = "tds"
    approved["standards_compliance"] = ["ASTM D6637"]
    save = client.post("/api/convert/save", json={"dpp_json": approved})
    assert save.status_code == 200

    res = client.get("/api/analytics/target-market-coverage?sector=road_construction")

    road = next(item for item in res.json()["targets"] if item["category"] == "Road Construction")
    assert road["coverage_status"] == "partial"
    assert "EPD" in road["missing_documents"]
    assert "EN 13249" in road["missing_standards"]


def test_compliance_rulebook_marks_rules_as_pending_expert_validation():
    res = client.get("/api/compliance/rulebook")
    assert res.status_code == 200
    data = res.json()
    assert data["validation_status"] == "requires_expert_review"
    assert data["rules"]
    assert data["rules"][0]["source_type"] in {"regulation", "industry_reference", "internal_mapping"}


def test_pdf_export_contains_complete_passport_sections():
    dpp = {
        "product_name": "Complete Tile Adhesive",
        "manufacturer": "UltraTech",
        "category": "Tile Adhesive",
        "document_type": "Technical Data Sheet",
        "description": "Polymer-modified adhesive for interior and exterior tiles.",
        "technical_properties": {
            "tensile_adhesion": {
                "value": "1.50-2.00",
                "unit": "N/mm2",
                "test_method": "EN 12004",
            },
        },
        "working_properties": {
            "water_powder_ratio": {"value": 25, "unit": "%"},
            "adjustability_time": {"value": 30, "unit": "minutes"},
        },
        "standards_compliance": ["EN 12004", "ISO 13007"],
        "applications": ["Wall tiles", "Floor tiles"],
        "packaging": {"size": "20 kg", "type": "moisture-resistant bag"},
        "storage": {"conditions": "Dry covered area", "shelf_life": {"value": 12, "unit": "months"}},
        "sustainability": {
            "recycled_content_pct": 5,
            "carbon_footprint": {"value": 1.2, "unit": "kgCO2e/kg"},
        },
        "source_document": {
            "title": "Complete Adhesive TDS",
            "document_type": "TDS",
            "revision": "R2",
        },
        "batch_info": {"batch_number": "BATCH-42", "origin_country": "India"},
        "qr_verification": {"verification_url": "https://example.com/passport/42"},
    }
    record = SimpleNamespace(
        passport_id="DPP-COMPLETE-42",
        conversion_method="manual",
        confidence_score=96,
        status="active",
        created_at=datetime(2026, 6, 29, tzinfo=timezone.utc),
    )

    pdf_bytes = _generate_dpp_pdf(dpp, record)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)

    for expected in [
        "Technical Properties",
        "Tensile Adhesion",
        "1.50-2.00",
        "EN 12004",
        "Working Properties",
        "Water Powder Ratio",
        "Adjustability Time",
        "30",
        "minutes",
        "Applications",
        "Wall tiles",
        "Packaging and Storage",
        "20 kg moisture-resistant bag",
        "Source Document",
        "Complete Adhesive TDS",
        "Verification",
        "https://example.com/passport/42",
    ]:
        assert expected in text


def test_lifecycle_sections_are_added_to_dpp_and_exported_to_ifc():
    manual = client.post("/api/convert/manual", json={
        "product_name": "Lifecycle Product",
        "manufacturer": "Lifecycle Corp",
        "category": "Road Construction",
        "description": "Road material with lifecycle data.",
        "technical_properties": {"tensile": {"value": 50, "unit": "kN/m"}},
        "standards_compliance": ["EN 13249"],
        "packaging": "Roll packed",
        "storage": "Store dry",
        "additional_info": {
            "identifiers": {"sku": "LC-100", "gtin": "08901234567890"},
            "manufacturing": {"factory": "Pune Plant", "production_date": "2026-06-01", "quantity": 1000, "unit_of_measure": "m2"},
            "supply_chain": {"transport": "covered truck", "supplier": "Lifecycle Corp"},
            "health_safety": {"hazards": ["No classified hazard"], "sds_required": True},
            "lifecycle": {
                "installation": "Install on prepared subgrade.",
                "maintenance": "Inspect annually.",
                "warranty": "5 years",
                "repair": "Patch damaged area.",
                "reuse": "Reuse if undamaged.",
                "recycling": "Recycle polymer where local facilities exist.",
                "disposal": "Dispose according to local rules.",
            },
        },
    })
    assert manual.status_code == 200
    dpp = manual.json()["extracted_dpp"]
    assert dpp["identifiers"]["sku"] == "LC-100"
    assert dpp["lifecycle"]["installation"] == "Install on prepared subgrade."

    approved = client.post("/api/convert/approve", json={
        "dpp_json": dpp,
        "reviewer": "DPP Engineer",
        "reviewed_confidence": 96,
        "rights_status": "manufacturer_authorized",
    }).json()["dpp_json"]
    save = client.post("/api/convert/save", json={"dpp_json": approved})
    assert save.status_code == 200

    ifc = client.get(f"/api/passports/{save.json()['id']}/export-ifc")
    assert ifc.status_code == 200
    assert "DPP_Lifecycle" in ifc.text
    assert "Install on prepared subgrade." in ifc.text
