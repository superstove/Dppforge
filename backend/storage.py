"""
Storage helpers — QR images stored as binary in the database.
No external storage needed.
"""

import io
import os
from pathlib import Path


def save_qr_local(filename: str, image_bytes: bytes) -> str:
    local_dir = Path(__file__).parent / "qr_codes"
    local_dir.mkdir(exist_ok=True)
    (local_dir / filename).write_bytes(image_bytes)
    return f"/qr/{filename}"


def delete_qr_local(filename: str):
    local_path = Path(__file__).parent / "qr_codes" / filename
    if local_path.exists():
        os.remove(str(local_path))
