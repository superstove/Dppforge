from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import relationship

from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    country = Column(String, default="")
    website = Column(String, default="")
    contact_email = Column(String, default="")
    contact_phone = Column(String, default="")
    contact_person = Column(String, default="")
    crm_stage = Column(String, default="target")  # target → engaged → onboarded → active
    notes = Column(Text, default="")
    categories = Column(Text, default="")  # comma-separated
    products_count = Column(Integer, default=0)
    onboarded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    activities = relationship("CRMActivity", back_populates="manufacturer", cascade="all, delete-orphan")
    passports = relationship("DPPRecord", back_populates="manufacturer_ref")


class CRMActivity(Base):
    __tablename__ = "crm_activities"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    activity_type = Column(String, nullable=False)  # email, call, meeting, note, stage_change
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    manufacturer = relationship("Manufacturer", back_populates="activities")


class ManufacturerClaim(Base):
    __tablename__ = "manufacturer_claims"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    claimant_name = Column(String, default="")
    claimant_email = Column(String, default="")
    role = Column(String, default="")
    rights_basis = Column(Text, default="")
    requested_scope = Column(Text, default="")
    status = Column(String, default="submitted")  # submitted, approved, rejected
    reviewer = Column(String, default="")
    review_notes = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Webhook")
    url = Column(String, nullable=False)
    events = Column(Text, default="[]")
    secret = Column(String, default="")
    channel = Column(String, default="webhook")
    active = Column(Integer, default=1)
    trigger_count = Column(Integer, default=0)
    last_triggered = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    event = Column(String, nullable=False)
    channel = Column(String, default="webhook")
    status = Column(String, default="pending")
    payload_preview = Column(Text, default="")
    response_code = Column(Integer, default=0)
    webhook_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class DPPRecord(Base):
    __tablename__ = "dpp_records"

    id = Column(Integer, primary_key=True, index=True)
    passport_id = Column(String, unique=True, index=True)
    product_name = Column(String, nullable=False)
    manufacturer = Column(String, nullable=False)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=True, index=True)
    category = Column(String, default="")
    batch_number = Column(String, default="")
    origin_country = Column(String, default="India")
    conversion_method = Column(String, default="manual")
    document_type = Column(String, default="tds")  # tds, epd, dop, test_report
    carbon_footprint = Column(Float, default=0.0)
    standards_count = Column(Integer, default=0)
    properties_count = Column(Integer, default=0)
    confidence_score = Column(Float, default=0.0)  # 0-100 overall extraction confidence
    confidence_details = Column(Text, default="{}")  # per-field confidence JSON
    qr_code_path = Column(String, default="")
    qr_code_data = Column(LargeBinary, nullable=True)
    dpp_json = Column(Text, nullable=False)
    status = Column(String, default="active")
    verified_by = Column(String, default="")
    verified_at = Column(DateTime, nullable=True)
    source_file_name = Column(String, default="")
    extraction_notes = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    manufacturer_ref = relationship("Manufacturer", back_populates="passports")
