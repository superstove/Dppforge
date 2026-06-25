from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, LargeBinary, String, Text

from database import Base


class DPPRecord(Base):
    __tablename__ = "dpp_records"

    id = Column(Integer, primary_key=True, index=True)
    passport_id = Column(String, unique=True, index=True)
    product_name = Column(String, nullable=False)
    manufacturer = Column(String, nullable=False)
    category = Column(String, default="")
    batch_number = Column(String, default="")
    origin_country = Column(String, default="India")
    conversion_method = Column(String, default="manual")
    carbon_footprint = Column(Float, default=0.0)
    standards_count = Column(Integer, default=0)
    properties_count = Column(Integer, default=0)
    qr_code_path = Column(String, default="")
    qr_code_data = Column(LargeBinary, nullable=True)
    dpp_json = Column(Text, nullable=False)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
