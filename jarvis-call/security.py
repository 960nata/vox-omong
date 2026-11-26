"""Verifikasi tanda tangan webhook Meta. Dipisah dari server.py biar bisa dites
tanpa perlu Pipecat / FastAPI keinstall."""

import hashlib
import hmac
from typing import Optional

import config


def signature_ok(raw: bytes, header: Optional[str]) -> bool:
    """Cek X-Hub-Signature-256 dari Meta.

    Tanpa WHATSAPP_APP_SECRET webhook terbuka buat siapa saja, jadi defaultnya
    ditolak — kecuali WHATSAPP_ALLOW_UNSIGNED=1 diisi sendiri buat uji coba.
    """
    if not config.WHATSAPP_APP_SECRET:
        return config.WHATSAPP_ALLOW_UNSIGNED
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(config.WHATSAPP_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("sha256=", 1)[1].strip())


def call_fields(data: dict) -> set:
    """Kumpulan `field` di webhook (dipakai buat misahin event telpon vs chat)."""
    return {c.get("field") for e in (data or {}).get("entry", []) for c in e.get("changes", [])}
