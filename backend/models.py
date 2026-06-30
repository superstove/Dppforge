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
    requested_documents = Column(Text, default="[]")
    permissions = Column(Text, default="[]")
    submitted_documents = Column(Text, default="[]")
    authority_scope = Column(Text, default="")
    authority_status = Column(String, default="pending")
    revision_number = Column(Integer, default=0)
    status = Column(String, default="submitted")  # submitted, approved, rejected
    reviewer = Column(String, default="")
    review_notes = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class ManufacturerDocumentRequest(Base):
    __tablename__ = "manufacturer_document_requests"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    product_scope = Column(String, default="")
    requested_documents = Column(Text, default="[]")
    message = Column(Text, default="")
    due_date = Column(String, default="")
    status = Column(String, default="open")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ManufacturerUpload(Base):
    __tablename__ = "manufacturer_uploads"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False, index=True)
    document_request_id = Column(Integer, ForeignKey("manufacturer_document_requests.id"), nullable=True, index=True)
    document_type = Column(String, default="")
    title = Column(String, default="")
    file_name = Column(String, default="")
    file_size = Column(Integer, default=0)
    file_hash = Column(String, default="")
    product_scope = Column(String, default="")
    rights_status = Column(String, default="internal_review")
    review_status = Column(String, default="pending")
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=_utcnow)


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


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    passport_id = Column(String, index=True)
    document_type = Column(String, index=True)
    title = Column(String, default="")
    issuer = Column(String, default="")
    revision = Column(String, default="")
    issue_date = Column(String, default="")
    expiry_date = Column(String, default="")
    file_name = Column(String, default="")
    file_size = Column(Integer, default=0)
    file_hash = Column(String, default="")
    rights_status = Column(String, default="internal_review")
    review_status = Column(String, default="pending")
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=_utcnow)


class FieldEvidence(Base):
    __tablename__ = "field_evidence"

    id = Column(Integer, primary_key=True, index=True)
    passport_id = Column(String, index=True)
    source_document_id = Column(Integer, ForeignKey("source_documents.id"), nullable=True, index=True)
    field_path = Column(String, index=True)
    page = Column(String, default="")
    section = Column(String, default="")
    quote = Column(Text, default="")
    extraction_method = Column(String, default="ai")
    ai_confidence = Column(Float, default=0.0)
    reviewer_status = Column(String, default="pending")
    reviewer = Column(String, default="")
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class QualityRecord(Base):
    __tablename__ = "quality_records"

    id = Column(Integer, primary_key=True, index=True)
    dpp_record_id = Column(Integer, ForeignKey("dpp_records.id"), nullable=False, index=True)
    batch_number = Column(String, default="", index=True)
    lot_number = Column(String, default="")
    serial_number = Column(String, default="")
    status = Column(String, default="pending")
    tested_by = Column(String, default="")
    test_date = Column(String, default="")
    results_json = Column(Text, default="[]")
    attachments_json = Column(Text, default="[]")
    notes = Column(Text, default="")
    disposition = Column(String, default="")
    created_at = Column(DateTime, default=_utcnow)


class DPPRevision(Base):
    __tablename__ = "dpp_revisions"

    id = Column(Integer, primary_key=True, index=True)
    dpp_record_id = Column(Integer, ForeignKey("dpp_records.id"), nullable=False, index=True)
    revision_number = Column(Integer, default=1)
    changed_fields = Column(Text, default="[]")
    previous_values = Column(Text, default="{}")
    new_values = Column(Text, default="{}")
    changed_by = Column(String, default="")
    change_reason = Column(String, default="")
    created_at = Column(DateTime, default=_utcnow)


class MarketTarget(Base):
    __tablename__ = "market_targets"

    id = Column(Integer, primary_key=True, index=True)
    sector = Column(String, default="construction", index=True)
    category = Column(String, default="", index=True)
    subcategory = Column(String, default="")
    region = Column(String, default="global", index=True)
    key_products = Column(Text, default="[]")
    required_documents = Column(Text, default="[]")
    required_standards = Column(Text, default="[]")
    required_certifications = Column(Text, default="[]")
    priority = Column(String, default="medium")
    expert_validation_status = Column(String, default="requires_expert_review")
    created_at = Column(DateTime, default=_utcnow)
