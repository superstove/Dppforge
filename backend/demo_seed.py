import json
import os

from sqlalchemy.orm import Session

from models import DPPRecord
from utils import generate_qr_bytes


def seed_demo_record(db: Session) -> None:
    existing = db.query(DPPRecord).filter(DPPRecord.passport_id == "DPP-SIKAGROUT-212-DEMO").first()
    if existing:
        return

    public_url = os.getenv("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")

    dpp = {
        "dpp_version": "1.0",
        "passport_id": "DPP-SIKAGROUT-212-DEMO",
        "product_name": "SikaGrout 212",
        "manufacturer": "Sika India",
        "category": "Grout",
        "description": "Demo cementitious grout passport for DPP Forge walkthroughs.",
        "technical_properties": {
            "compressive_strength": {"value": 60, "unit": "MPa"},
            "density": {"value": 2200, "unit": "kg/m3"},
        },
        "working_properties": {
            "pot_life": {"value": 30, "unit": "minutes"},
        },
        "application": {
            "primary_use": ["Grouting"],
            "suitable_for": ["Machine foundations", "Anchor bolts"],
        },
        "standards_compliance": ["EN 1504", "ASTM C1107"],
        "batch_info": {
            "batch_number": "SG-212-DEMO",
            "origin_country": "India",
        },
        "source_document": {
            "type": "Technical Data Sheet",
            "conversion_method": "demo_seed",
            "converted_by": "DPP Forge",
        },
    }

    record = DPPRecord(
        passport_id=dpp["passport_id"],
        product_name=dpp["product_name"],
        manufacturer=dpp["manufacturer"],
        category=dpp["category"],
        batch_number=dpp["batch_info"]["batch_number"],
        origin_country="India",
        conversion_method="demo_seed",
        standards_count=len(dpp["standards_compliance"]),
        properties_count=len(dpp["technical_properties"]),
        dpp_json=json.dumps(dpp, ensure_ascii=False),
        status="active",
    )
    db.add(record)
    db.flush()

    verify_url = f"{public_url}/?passport={record.id}"
    dpp["qr_verification"] = {"verification_url": verify_url, "qr_code": "QR-SIKAGROUT-212-DEMO"}
    record.dpp_json = json.dumps(dpp, ensure_ascii=False)
    record.qr_code_data = generate_qr_bytes(verify_url)

    db.commit()
