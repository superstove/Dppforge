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

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from database import engine, Base, DATABASE_URL
from routes import analytics, compliance, converter, manufacturers, notifications, passports


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
                ("carbon_footprint", "ALTER TABLE dpp_records ADD COLUMN carbon_footprint FLOAT DEFAULT 0.0"),
                ("standards_count", "ALTER TABLE dpp_records ADD COLUMN standards_count INTEGER DEFAULT 0"),
                ("properties_count", "ALTER TABLE dpp_records ADD COLUMN properties_count INTEGER DEFAULT 0"),
                ("confidence_score", "ALTER TABLE dpp_records ADD COLUMN confidence_score FLOAT DEFAULT 0.0"),
                ("confidence_details", "ALTER TABLE dpp_records ADD COLUMN confidence_details TEXT DEFAULT '{}'"),
                ("document_type", "ALTER TABLE dpp_records ADD COLUMN document_type VARCHAR DEFAULT 'tds'"),
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
