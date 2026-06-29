import os
from urllib.parse import urlparse

from fastapi import Request


def _is_local_url(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host in {"localhost", "127.0.0.1", "::1", "testserver"}


def public_app_base_url(request: Request | None = None) -> str:
    configured = (
        os.getenv("PUBLIC_APP_URL")
        or os.getenv("APP_URL")
        or os.getenv("RENDER_EXTERNAL_URL")
        or os.getenv("CONSTRUCTASK_VERIFY_URL")
        or ""
    ).strip()
    request_base = str(request.base_url).rstrip("/") if request else ""

    if configured:
        configured = configured.rstrip("/")
        if not (_is_local_url(configured) and request_base and not _is_local_url(request_base)):
            return configured

    if request_base:
        return request_base

    return "http://localhost:3000"


def dpp_verification_url(passport_ref: str | int, request: Request | None = None) -> str:
    return f"{public_app_base_url(request)}/?passport={passport_ref}"
