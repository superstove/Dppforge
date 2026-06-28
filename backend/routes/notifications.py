"""
Webhook/API Notifications, Multi-language Passports, and Expiry & Recertification Alerts.
"""

from __future__ import annotations

import json
import hashlib
import hmac
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from database import get_db
from models import DPPRecord, WebhookConfig, NotificationLog

router = APIRouter()

# ──────────────────────────────────────────────
# 1. WEBHOOK CONFIGURATION
# ──────────────────────────────────────────────

@router.get("/webhooks")
def list_webhooks(db: Session = Depends(get_db)):
    hooks = db.query(WebhookConfig).order_by(WebhookConfig.created_at.desc()).all()
    return {
        "total": len(hooks),
        "items": [
            {
                "id": h.id,
                "name": h.name,
                "url": h.url,
                "events": json.loads(h.events) if h.events else [],
                "active": h.active,
                "secret": h.secret[:8] + "..." if h.secret else None,
                "channel": h.channel,
                "created_at": str(h.created_at),
                "last_triggered": str(h.last_triggered) if h.last_triggered else None,
                "trigger_count": h.trigger_count,
            }
            for h in hooks
        ],
    }


@router.post("/webhooks")
def create_webhook(payload: dict = Body(...), db: Session = Depends(get_db)):
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(400, "URL is required")

    events = payload.get("events", ["passport.created"])
    name = payload.get("name", "Webhook")
    channel = payload.get("channel", "webhook")  # webhook, slack, email

    secret = hashlib.sha256(os.urandom(32)).hexdigest()[:32]

    hook = WebhookConfig(
        name=name,
        url=url,
        events=json.dumps(events),
        secret=secret,
        channel=channel,
        active=True,
    )
    db.add(hook)
    db.commit()
    db.refresh(hook)

    return {
        "status": "created",
        "id": hook.id,
        "name": hook.name,
        "secret": secret,
        "events": events,
    }


@router.patch("/webhooks/{hook_id}")
def update_webhook(hook_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    hook = db.query(WebhookConfig).filter(WebhookConfig.id == hook_id).first()
    if not hook:
        raise HTTPException(404, "Webhook not found")

    if "name" in payload:
        hook.name = payload["name"]
    if "url" in payload:
        hook.url = payload["url"]
    if "events" in payload:
        hook.events = json.dumps(payload["events"])
    if "active" in payload:
        hook.active = payload["active"]
    if "channel" in payload:
        hook.channel = payload["channel"]

    db.commit()
    return {"status": "updated", "id": hook.id}


@router.delete("/webhooks/{hook_id}")
def delete_webhook(hook_id: int, db: Session = Depends(get_db)):
    hook = db.query(WebhookConfig).filter(WebhookConfig.id == hook_id).first()
    if not hook:
        raise HTTPException(404, "Webhook not found")
    db.delete(hook)
    db.commit()
    return {"status": "deleted", "id": hook_id}


@router.post("/webhooks/{hook_id}/test")
def test_webhook(hook_id: int, db: Session = Depends(get_db)):
    hook = db.query(WebhookConfig).filter(WebhookConfig.id == hook_id).first()
    if not hook:
        raise HTTPException(404, "Webhook not found")

    test_payload = {
        "event": "test.ping",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "Test notification from DPP Forge",
            "webhook_id": hook.id,
            "webhook_name": hook.name,
        },
    }

    result = _dispatch_webhook(hook, test_payload, db)
    return {"status": "sent" if result else "failed", "payload": test_payload}


@router.get("/logs")
def notification_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = (
        db.query(NotificationLog)
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "total": len(logs),
        "items": [
            {
                "id": l.id,
                "event": l.event,
                "channel": l.channel,
                "status": l.status,
                "payload_preview": l.payload_preview,
                "response_code": l.response_code,
                "created_at": str(l.created_at),
            }
            for l in logs
        ],
    }


VALID_EVENTS = [
    "passport.created",
    "passport.updated",
    "passport.deleted",
    "manufacturer.stage_changed",
    "certificate.expiring",
    "certificate.expired",
]


@router.get("/events")
def list_events():
    return {
        "events": [
            {"id": "passport.created", "label": "Passport Created", "description": "When a new DPP is saved"},
            {"id": "passport.updated", "label": "Passport Updated", "description": "When a passport is modified"},
            {"id": "passport.deleted", "label": "Passport Deleted", "description": "When a passport is removed"},
            {"id": "manufacturer.stage_changed", "label": "Manufacturer Stage Change", "description": "When a manufacturer moves pipeline stages"},
            {"id": "certificate.expiring", "label": "Certificate Expiring", "description": "30 days before a test certificate expires"},
            {"id": "certificate.expired", "label": "Certificate Expired", "description": "When a test certificate has expired"},
        ]
    }


def _dispatch_webhook(hook: WebhookConfig, payload: dict, db: Session) -> bool:
    import urllib.request

    body = json.dumps(payload).encode("utf-8")
    signature = hmac.new(
        (hook.secret or "").encode(), body, hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-DPP-Forge-Signature": signature,
        "X-DPP-Forge-Event": payload.get("event", "unknown"),
    }

    if hook.channel == "slack":
        body = json.dumps(_format_slack_payload(payload)).encode("utf-8")

    log = NotificationLog(
        event=payload.get("event", "unknown"),
        channel=hook.channel or "webhook",
        payload_preview=json.dumps(payload)[:500],
        webhook_id=hook.id,
    )

    try:
        req = urllib.request.Request(hook.url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            log.status = "success"
            log.response_code = resp.status
    except Exception as e:
        log.status = "failed"
        log.response_code = 0
        log.payload_preview += f" | Error: {str(e)[:200]}"

    hook.last_triggered = datetime.now(timezone.utc)
    hook.trigger_count = (hook.trigger_count or 0) + 1
    db.add(log)
    db.commit()

    return log.status == "success"


def _format_slack_payload(payload: dict) -> dict:
    event = payload.get("event", "unknown")
    data = payload.get("data", {})

    EMOJI = {
        "passport.created": ":new:",
        "passport.updated": ":pencil2:",
        "passport.deleted": ":wastebasket:",
        "manufacturer.stage_changed": ":arrow_right:",
        "certificate.expiring": ":warning:",
        "certificate.expired": ":red_circle:",
        "test.ping": ":robot_face:",
    }

    emoji = EMOJI.get(event, ":bell:")
    title = event.replace(".", " ").replace("_", " ").title()

    fields = []
    for key, val in data.items():
        if isinstance(val, (str, int, float)):
            fields.append(f"*{key.replace('_', ' ').title()}:* {val}")

    text = f"{emoji} *DPP Forge — {title}*\n" + "\n".join(fields)
    return {"text": text}


def fire_event(event: str, data: dict, db: Session):
    hooks = db.query(WebhookConfig).filter(WebhookConfig.active == True).all()
    payload = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }
    for hook in hooks:
        events = json.loads(hook.events) if hook.events else []
        if event in events or "*" in events:
            try:
                _dispatch_webhook(hook, payload, db)
            except Exception:
                pass


# ──────────────────────────────────────────────
# 2. MULTI-LANGUAGE PASSPORTS
# ──────────────────────────────────────────────

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ar": "Arabic",
    "fil": "Filipino",
    "de": "German",
    "fr": "French",
}

FIELD_TRANSLATIONS = {
    "hi": {
        "product_name": "उत्पाद का नाम", "manufacturer": "निर्माता", "category": "श्रेणी",
        "description": "विवरण", "batch_number": "बैच संख्या", "origin_country": "मूल देश",
        "document_type": "दस्तावेज़ प्रकार", "confidence_score": "विश्वास स्कोर",
        "technical_properties": "तकनीकी गुण", "standards_compliance": "मानक अनुपालन",
        "sustainability": "स्थिरता", "recycled_content": "पुनर्नवीनीकृत सामग्री",
        "carbon_footprint": "कार्बन पदचिह्न", "packaging_and_storage": "पैकेजिंग और भंडारण",
        "digital_product_passport": "डिजिटल उत्पाद पासपोर्ट",
        "batch_info": "बैच जानकारी", "production_date": "उत्पादन तिथि",
        "shelf_life": "शेल्फ जीवन", "value": "मूल्य", "unit": "इकाई",
        "test_method": "परीक्षण विधि",
    },
    "ar": {
        "product_name": "اسم المنتج", "manufacturer": "الشركة المصنعة", "category": "الفئة",
        "description": "الوصف", "batch_number": "رقم الدفعة", "origin_country": "بلد المنشأ",
        "document_type": "نوع المستند", "confidence_score": "درجة الثقة",
        "technical_properties": "الخصائص التقنية", "standards_compliance": "الامتثال للمعايير",
        "sustainability": "الاستدامة", "recycled_content": "المحتوى المعاد تدويره",
        "carbon_footprint": "البصمة الكربونية", "packaging_and_storage": "التعبئة والتخزين",
        "digital_product_passport": "جواز المنتج الرقمي",
        "batch_info": "معلومات الدفعة", "production_date": "تاريخ الإنتاج",
        "shelf_life": "مدة الصلاحية", "value": "القيمة", "unit": "الوحدة",
        "test_method": "طريقة الاختبار",
    },
    "fil": {
        "product_name": "Pangalan ng Produkto", "manufacturer": "Tagagawa", "category": "Kategorya",
        "description": "Paglalarawan", "batch_number": "Numero ng Batch", "origin_country": "Bansang Pinagmulan",
        "document_type": "Uri ng Dokumento", "confidence_score": "Marka ng Kumpiyansa",
        "technical_properties": "Teknikal na Katangian", "standards_compliance": "Pagsunod sa Pamantayan",
        "sustainability": "Pagpapanatili", "recycled_content": "Nilalaman ng Recycle",
        "carbon_footprint": "Carbon Footprint", "packaging_and_storage": "Packaging at Imbakan",
        "digital_product_passport": "Digital na Pasaporte ng Produkto",
        "batch_info": "Impormasyon ng Batch", "production_date": "Petsa ng Produksyon",
        "shelf_life": "Shelf Life", "value": "Halaga", "unit": "Yunit",
        "test_method": "Paraan ng Pagsubok",
    },
    "de": {
        "product_name": "Produktname", "manufacturer": "Hersteller", "category": "Kategorie",
        "description": "Beschreibung", "batch_number": "Chargennummer", "origin_country": "Herkunftsland",
        "document_type": "Dokumenttyp", "confidence_score": "Vertrauenswert",
        "technical_properties": "Technische Eigenschaften", "standards_compliance": "Normenkonformität",
        "sustainability": "Nachhaltigkeit", "recycled_content": "Recyclinganteil",
        "carbon_footprint": "CO₂-Fußabdruck", "packaging_and_storage": "Verpackung und Lagerung",
        "digital_product_passport": "Digitaler Produktpass",
        "batch_info": "Chargeninformationen", "production_date": "Produktionsdatum",
        "shelf_life": "Haltbarkeit", "value": "Wert", "unit": "Einheit",
        "test_method": "Prüfverfahren",
    },
    "fr": {
        "product_name": "Nom du produit", "manufacturer": "Fabricant", "category": "Catégorie",
        "description": "Description", "batch_number": "Numéro de lot", "origin_country": "Pays d'origine",
        "document_type": "Type de document", "confidence_score": "Score de confiance",
        "technical_properties": "Propriétés techniques", "standards_compliance": "Conformité aux normes",
        "sustainability": "Durabilité", "recycled_content": "Contenu recyclé",
        "carbon_footprint": "Empreinte carbone", "packaging_and_storage": "Emballage et stockage",
        "digital_product_passport": "Passeport numérique du produit",
        "batch_info": "Informations sur le lot", "production_date": "Date de production",
        "shelf_life": "Durée de conservation", "value": "Valeur", "unit": "Unité",
        "test_method": "Méthode d'essai",
    },
}


@router.get("/languages")
def list_languages():
    return {"languages": [{"code": k, "name": v} for k, v in SUPPORTED_LANGUAGES.items()]}


@router.get("/{record_id}/translate/{lang}")
def translate_passport(record_id: int, lang: str, db: Session = Depends(get_db)):
    if lang not in SUPPORTED_LANGUAGES and lang != "en":
        raise HTTPException(400, f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}")

    record = db.query(DPPRecord).filter(DPPRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Passport not found")

    dpp = json.loads(record.dpp_json)

    if lang == "en":
        return {
            "language": {"code": "en", "name": "English", "direction": "ltr"},
            "passport": dpp,
            "field_labels": {},
        }

    translations = FIELD_TRANSLATIONS.get(lang, {})
    direction = "rtl" if lang == "ar" else "ltr"

    translated_dpp = _translate_dpp(dpp, translations)
    translated_dpp["_language"] = {"code": lang, "name": SUPPORTED_LANGUAGES[lang], "direction": direction}

    return {
        "language": {"code": lang, "name": SUPPORTED_LANGUAGES[lang], "direction": direction},
        "passport": translated_dpp,
        "field_labels": translations,
    }


def _translate_dpp(dpp: dict, translations: dict) -> dict:
    result = {}
    for key, value in dpp.items():
        translated_key = translations.get(key, key)
        if isinstance(value, dict):
            result[translated_key] = _translate_dpp(value, translations)
        elif isinstance(value, list):
            result[translated_key] = value
        else:
            result[translated_key] = value
    return result


# ──────────────────────────────────────────────
# 3. EXPIRY & RECERTIFICATION ALERTS
# ──────────────────────────────────────────────

@router.get("/expiry-alerts")
def get_expiry_alerts(days: int = 30, db: Session = Depends(get_db)):
    records = db.query(DPPRecord).all()
    now = datetime.now(timezone.utc)
    threshold = now + timedelta(days=days)

    alerts = []
    stats = {"expiring_soon": 0, "expired": 0, "valid": 0, "no_date": 0}

    for record in records:
        try:
            dpp = json.loads(record.dpp_json)
        except Exception:
            continue

        certs = _extract_certificates(dpp, record)

        for cert in certs:
            expiry = cert.get("expiry_date")
            if not expiry:
                stats["no_date"] += 1
                continue

            try:
                exp_dt = _parse_date(expiry)
            except Exception:
                stats["no_date"] += 1
                continue

            days_until = (exp_dt - now).days
            if days_until < 0:
                status = "expired"
                stats["expired"] += 1
                urgency = "critical"
            elif days_until <= days:
                status = "expiring"
                stats["expiring_soon"] += 1
                urgency = "warning" if days_until > 7 else "urgent"
            else:
                status = "valid"
                stats["valid"] += 1
                urgency = "ok"
                continue

            alerts.append({
                "passport_id": record.passport_id,
                "product_name": record.product_name,
                "manufacturer": record.manufacturer,
                "record_id": record.id,
                "certificate": cert.get("name", "Unknown"),
                "certificate_type": cert.get("type", "standard"),
                "expiry_date": expiry,
                "days_until_expiry": days_until,
                "status": status,
                "urgency": urgency,
                "recommendation": _get_recommendation(status, days_until, cert.get("name", "")),
            })

    alerts.sort(key=lambda a: a["days_until_expiry"])

    return {
        "scan_date": now.isoformat(),
        "threshold_days": days,
        "stats": stats,
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


@router.get("/expiry-dashboard")
def expiry_dashboard(db: Session = Depends(get_db)):
    records = db.query(DPPRecord).all()
    now = datetime.now(timezone.utc)

    timeline = {
        "overdue": [],
        "this_week": [],
        "this_month": [],
        "next_3_months": [],
    }

    for record in records:
        try:
            dpp = json.loads(record.dpp_json)
        except Exception:
            continue

        certs = _extract_certificates(dpp, record)
        for cert in certs:
            expiry = cert.get("expiry_date")
            if not expiry:
                continue
            try:
                exp_dt = _parse_date(expiry)
            except Exception:
                continue

            days_until = (exp_dt - now).days
            entry = {
                "passport_id": record.passport_id,
                "product_name": record.product_name,
                "certificate": cert.get("name", "Unknown"),
                "expiry_date": expiry,
                "days_until": days_until,
                "record_id": record.id,
            }

            if days_until < 0:
                timeline["overdue"].append(entry)
            elif days_until <= 7:
                timeline["this_week"].append(entry)
            elif days_until <= 30:
                timeline["this_month"].append(entry)
            elif days_until <= 90:
                timeline["next_3_months"].append(entry)

    for key in timeline:
        timeline[key].sort(key=lambda x: x["days_until"])

    total_alerts = sum(len(v) for v in timeline.values())

    return {
        "scan_date": now.isoformat(),
        "total_alerts": total_alerts,
        "headline": _build_headline(timeline),
        "timeline": timeline,
    }


def _extract_certificates(dpp: dict, record: DPPRecord) -> list:
    certs = []

    standards = dpp.get("standards_compliance", [])
    if isinstance(standards, list):
        for std in standards:
            if isinstance(std, str):
                certs.append({
                    "name": std,
                    "type": "standard",
                    "expiry_date": _infer_expiry(record.created_at),
                })
            elif isinstance(std, dict):
                certs.append({
                    "name": std.get("name", std.get("standard", "Unknown")),
                    "type": "standard",
                    "expiry_date": std.get("expiry_date", std.get("valid_until", _infer_expiry(record.created_at))),
                })

    shelf_life = dpp.get("packaging_and_storage", {}).get("shelf_life", {})
    if shelf_life and shelf_life.get("value"):
        months = shelf_life.get("value", 12)
        if isinstance(months, (int, float)) and record.created_at:
            exp = record.created_at + timedelta(days=int(months * 30.44))
            certs.append({
                "name": "Product Shelf Life",
                "type": "shelf_life",
                "expiry_date": exp.strftime("%Y-%m-%d"),
            })

    batch_info = dpp.get("batch_info", {})
    prod_date_str = batch_info.get("production_date", "")
    if prod_date_str:
        try:
            prod_dt = _parse_date(prod_date_str)
            cert_expiry = prod_dt + timedelta(days=365)
            certs.append({
                "name": "Annual Recertification",
                "type": "recertification",
                "expiry_date": cert_expiry.strftime("%Y-%m-%d"),
            })
        except Exception:
            pass

    return certs


def _infer_expiry(created_at) -> str:
    if not created_at:
        return ""
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except Exception:
            return ""
    expiry = created_at + timedelta(days=365)
    return expiry.strftime("%Y-%m-%d")


def _parse_date(s: str) -> datetime:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {s}")


def _get_recommendation(status: str, days: int, cert_name: str) -> str:
    if status == "expired":
        return f"URGENT: {cert_name} has expired. Initiate recertification immediately."
    if days <= 7:
        return f"CRITICAL: {cert_name} expires in {days} days. Submit renewal application now."
    if days <= 14:
        return f"HIGH: {cert_name} expires in {days} days. Begin recertification process."
    return f"NOTICE: {cert_name} expires in {days} days. Schedule recertification."


def _build_headline(timeline: dict) -> str:
    overdue = len(timeline["overdue"])
    week = len(timeline["this_week"])
    month = len(timeline["this_month"])

    parts = []
    if overdue:
        parts.append(f"{overdue} expired")
    if week:
        parts.append(f"{week} expire this week")
    if month:
        parts.append(f"{month} expire this month")

    if not parts:
        return "All certificates are up to date."
    return ", ".join(parts) + "."
