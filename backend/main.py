"""
DPP Converter — Standalone TDS-to-JSON Digital Product Passport Application

Run locally:
    python -m uvicorn main:app --reload --port 8001

Cloud (Render):
    Set DATABASE_URL env var to Supabase PostgreSQL connection string.
"""

from __future__ import annotations

import html
import json
import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from database import engine, Base, DATABASE_URL, get_db
from models import DPPRecord
from routes import analytics, compliance, converter, manufacturers, notifications, passports
from sqlalchemy.orm import Session


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Optional API key authentication. Enable by setting DPP_API_KEY env var."""

    EXEMPT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        api_key = os.getenv("DPP_API_KEY", "")
        if not api_key:
            return await call_next(request)

        path = request.url.path
        if path in self.EXEMPT_PATHS or not path.startswith("/api"):
            return await call_next(request)

        provided = (
            request.headers.get("X-API-Key", "")
            or request.query_params.get("api_key", "")
        )
        if provided != api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Set X-API-Key header."},
            )
        return await call_next(request)

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"[STARTUP] DB table creation failed: {e}")

# Add missing columns to existing tables (SQLAlchemy create_all won't do this)
if not DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import text, inspect as sa_inspect
    try:
        with engine.connect() as conn:
            inspector = sa_inspect(engine)
            existing = {c["name"] for c in inspector.get_columns("dpp_records")}
            migrations = [
                ("manufacturer_id", "ALTER TABLE dpp_records ADD COLUMN manufacturer_id INTEGER REFERENCES manufacturers(id)"),
                ("category", "ALTER TABLE dpp_records ADD COLUMN category VARCHAR DEFAULT ''"),
                ("batch_number", "ALTER TABLE dpp_records ADD COLUMN batch_number VARCHAR DEFAULT ''"),
                ("origin_country", "ALTER TABLE dpp_records ADD COLUMN origin_country VARCHAR DEFAULT 'India'"),
                ("conversion_method", "ALTER TABLE dpp_records ADD COLUMN conversion_method VARCHAR DEFAULT 'manual'"),
                ("document_type", "ALTER TABLE dpp_records ADD COLUMN document_type VARCHAR DEFAULT 'tds'"),
                ("carbon_footprint", "ALTER TABLE dpp_records ADD COLUMN carbon_footprint FLOAT DEFAULT 0.0"),
                ("standards_count", "ALTER TABLE dpp_records ADD COLUMN standards_count INTEGER DEFAULT 0"),
                ("properties_count", "ALTER TABLE dpp_records ADD COLUMN properties_count INTEGER DEFAULT 0"),
                ("confidence_score", "ALTER TABLE dpp_records ADD COLUMN confidence_score FLOAT DEFAULT 0.0"),
                ("confidence_details", "ALTER TABLE dpp_records ADD COLUMN confidence_details TEXT DEFAULT '{}'"),
                ("qr_code_path", "ALTER TABLE dpp_records ADD COLUMN qr_code_path VARCHAR DEFAULT ''"),
                ("qr_code_data", "ALTER TABLE dpp_records ADD COLUMN qr_code_data BYTEA"),
                ("dpp_json", "ALTER TABLE dpp_records ADD COLUMN dpp_json TEXT DEFAULT '{}'"),
                ("status", "ALTER TABLE dpp_records ADD COLUMN status VARCHAR DEFAULT 'active'"),
                ("verified_by", "ALTER TABLE dpp_records ADD COLUMN verified_by VARCHAR DEFAULT ''"),
                ("verified_at", "ALTER TABLE dpp_records ADD COLUMN verified_at TIMESTAMP"),
                ("source_file_name", "ALTER TABLE dpp_records ADD COLUMN source_file_name VARCHAR DEFAULT ''"),
                ("extraction_notes", "ALTER TABLE dpp_records ADD COLUMN extraction_notes TEXT DEFAULT ''"),
                ("updated_at", "ALTER TABLE dpp_records ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()"),
            ]
            for col_name, sql in migrations:
                if col_name not in existing:
                    conn.execute(text(sql))
                    print(f"[MIGRATION] Added column: dpp_records.{col_name}")
            conn.commit()
    except Exception as e:
        print(f"[MIGRATION] Column migration failed: {e}")

if os.getenv("DEMO_SEED_ENABLED", "").lower() in {"1", "true", "yes"}:
    from database import SessionLocal
    from demo_seed import seed_demo_record

    try:
        db = SessionLocal()
        seed_demo_record(db)
        db.close()
    except Exception as e:
        print(f"[STARTUP] Demo seed failed: {e}")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="DPP Converter",
    description="TDS-to-JSON Digital Product Passport Converter with QR Generation",
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
cors_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(APIKeyMiddleware)

app.include_router(converter.router, prefix="/api/convert", tags=["converter"])
app.include_router(passports.router, prefix="/api/passports", tags=["passports"])
app.include_router(manufacturers.router, prefix="/api/manufacturers", tags=["manufacturers"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health():
    db_url = os.getenv("DATABASE_URL", "sqlite")
    return {"status": "ok", "cloud": "postgresql" in db_url}


def _find_passport(db: Session, passport_ref: str) -> DPPRecord | None:
    record = None
    if passport_ref.isdigit():
        record = db.query(DPPRecord).filter(DPPRecord.id == int(passport_ref)).first()
    if not record:
        record = db.query(DPPRecord).filter(DPPRecord.passport_id == passport_ref).first()
    return record


def _render_scan_page(record: DPPRecord) -> str:
    try:
        dpp = json.loads(record.dpp_json or "{}")
    except Exception:
        dpp = {}

    product_name = html.escape(record.product_name or dpp.get("product_name") or "Digital Product Passport")
    manufacturer = html.escape(record.manufacturer or dpp.get("manufacturer") or "Unknown manufacturer")
    passport_id = html.escape(record.passport_id or dpp.get("passport_id") or "")
    category = html.escape(record.category or dpp.get("category") or "N/A")
    batch = html.escape(record.batch_number or dpp.get("batch_info", {}).get("batch_number") or "N/A")
    json_text = html.escape(json.dumps(dpp, indent=2, ensure_ascii=False))

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{product_name} - DPP</title>
  <style>
    :root {{ color-scheme: dark; font-family: Arial, sans-serif; }}
    body {{ margin: 0; background: #0a0b10; color: #e4e6ed; }}
    main {{ max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }}
    .badge {{ display: inline-block; padding: 6px 10px; border: 1px solid #22c55e55; border-radius: 999px; color: #86efac; background: #22c55e18; font-size: 13px; font-weight: 700; }}
    h1 {{ margin: 16px 0 8px; font-size: clamp(28px, 8vw, 48px); line-height: 1.05; color: white; }}
    .muted {{ color: #a0a8bf; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 22px 0; }}
    .card {{ background: #1a1d27; border: 1px solid #2e3245; border-radius: 14px; padding: 16px; }}
    .label {{ color: #8b8fa3; font-size: 12px; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }}
    pre {{ white-space: pre-wrap; word-break: break-word; background: #05060a; border: 1px solid #2e3245; border-radius: 14px; padding: 16px; overflow: auto; font-size: 12px; line-height: 1.45; }}
    a {{ color: white; }}
  </style>
</head>
<body>
  <main>
    <span class="badge">Verified DPP Record</span>
    <h1>{product_name}</h1>
    <p class="muted">{manufacturer}</p>
    <section class="grid">
      <div class="card"><div class="label">Passport ID</div><div>{passport_id}</div></div>
      <div class="card"><div class="label">Category</div><div>{category}</div></div>
      <div class="card"><div class="label">Batch</div><div>{batch}</div></div>
    </section>
    <h2>Digital Product Passport JSON</h2>
    <pre>{json_text}</pre>
  </main>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def scan_root(passport: str | None = None, db: Session = Depends(get_db)):
    if not passport:
        raise HTTPException(status_code=404, detail="Not Found")
    record = _find_passport(db, passport)
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")
    return HTMLResponse(_render_scan_page(record))


@app.get("/passport/{passport_ref}", response_class=HTMLResponse)
def scan_passport(passport_ref: str, db: Session = Depends(get_db)):
    record = _find_passport(db, passport_ref)
    if not record:
        raise HTTPException(status_code=404, detail="Passport not found")
    return HTMLResponse(_render_scan_page(record))


# Serve built frontend in production with SPA fallback
static_dir = Path(__file__).parent / "static"
if (static_dir / "index.html").exists():
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")
