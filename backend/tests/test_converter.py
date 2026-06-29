"""Integration tests for the DPP conversion pipeline."""

import os
import sys
from pathlib import Path

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

client = TestClient(app)


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


def test_market_coverage_includes_target_catalog_without_passports():
    res = client.get("/api/analytics/target-market-coverage")
    assert res.status_code == 200
    data = res.json()
    categories = {item["category"] for item in data["targets"]}
    assert "Road Construction" in categories
    road = next(item for item in data["targets"] if item["category"] == "Road Construction")
    assert "Asphalt Mix" in road["key_products"]
    assert "EN 13108" in road["required_standards"]


def test_compliance_rulebook_marks_rules_as_pending_expert_validation():
    res = client.get("/api/compliance/rulebook")
    assert res.status_code == 200
    data = res.json()
    assert data["validation_status"] == "requires_expert_review"
    assert data["rules"]
    assert data["rules"][0]["source_type"] in {"regulation", "industry_reference", "internal_mapping"}
