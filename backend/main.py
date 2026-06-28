"""
DPP Converter — Standalone TDS-to-JSON Digital Product Passport Application

Run locally:
    python -m uvicorn main:app --reload --port 8001

Cloud (Render):
    Set DATABASE_URL env var to Supabase PostgreSQL connection string.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base
from routes import converter, passports

Base.metadata.create_all(bind=engine)

if os.getenv("DEMO_SEED_ENABLED", "").lower() in {"1", "true", "yes"}:
    from database import SessionLocal
    from demo_seed import seed_demo_record

    db = SessionLocal()
    try:
        seed_demo_record(db)
    finally:
        db.close()

app = FastAPI(
    title="DPP Converter",
    description="TDS-to-JSON Digital Product Passport Converter with QR Generation",
    version="1.0.0",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(converter.router, prefix="/api/convert", tags=["converter"])
app.include_router(passports.router, prefix="/api/passports", tags=["passports"])


@app.get("/health")
def health():
    db_url = os.getenv("DATABASE_URL", "sqlite")
    return {"status": "ok", "cloud": "postgresql" in db_url}


# Serve built frontend in production
static_dir = Path(__file__).parent / "static"
if (static_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
