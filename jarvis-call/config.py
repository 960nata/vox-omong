"""Konfigurasi dari .env — semua setting ada di sini biar gampang dicek."""

import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _required(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        raise RuntimeError(f"Env {name} belum diisi (cek file .env)")
    return val


def _flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _num(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


# --- Gemini ---
GOOGLE_API_KEY = _required("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip() or None  # kosong = default Pipecat
GEMINI_VOICE = os.getenv("GEMINI_VOICE", "Puck")

# --- WhatsApp Cloud API ---
WHATSAPP_TOKEN = _required("WHATSAPP_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = _required("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_WEBHOOK_VERIFICATION_TOKEN = _required("WHATSAPP_WEBHOOK_VERIFICATION_TOKEN")
# App Secret dari Meta (App settings → Basic). Dipakai buat verifikasi tanda tangan webhook.
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "").strip() or None
# Tanpa app secret webhook terbuka buat siapa saja. Default: tolak (fail-closed).
# Isi WHATSAPP_ALLOW_UNSIGNED=1 cuma buat uji coba sesaat.
WHATSAPP_ALLOW_UNSIGNED = _flag("WHATSAPP_ALLOW_UNSIGNED", False)
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")

# Template HSM buat notifikasi di luar jendela 24 jam (opsional, harus sudah
# disetujui Meta). Isi nama template-nya; body-nya mesti punya 1 variabel {{1}}.
WHATSAPP_TEMPLATE_NAME = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip() or None
WHATSAPP_TEMPLATE_LANG = os.getenv("WHATSAPP_TEMPLATE_LANG", "id").strip() or "id"

# Nomor yang boleh nelpon bot, format internasional tanpa + (contoh 6281234567890).
# Pisahkan pakai koma kalau lebih dari satu.
OWNER_NUMBERS = [_digits(n) for n in _required("OWNER_NUMBERS").split(",") if _digits(n)]
# Default: notifikasi chat dikirim ke nomor yang nelpon. Isi ini kalau mau semua
# notifikasi selalu masuk ke satu nomor tertentu.
NOTIFY_NUMBER = _digits(os.getenv("NOTIFY_NUMBER", "")) or None

# Kalau webhook WA kamu juga dipakai bot chat (Next.js), event selain "calls"
# diteruskan ke URL ini apa adanya (body + header tanda tangan ikut dikirim).
FORWARD_WEBHOOK_URL = os.getenv("FORWARD_WEBHOOK_URL", "").strip() or None

# --- Jarvis (Next.js) ---
JARVIS_API_URL = os.getenv("JARVIS_API_URL", "http://localhost:3000").rstrip("/")
JARVIS_API_SECRET = os.getenv("JARVIS_API_SECRET", "")
# 1 = gak manggil Next.js, tugasnya disimulasikan (buat ngetes telpon dulu)
JARVIS_MOCK = _flag("JARVIS_MOCK", False)
POLL_INTERVAL_SECS = _num("POLL_INTERVAL_SECS", 5)
# Tugas yang lewat batas ini dianggap mogok dan dilaporkan gagal.
TASK_TIMEOUT_SECS = _num("TASK_TIMEOUT_SECS", 1200)
# Batas tugas yang boleh jalan bareng (biar laptop & kuota LLM gak kebakar).
MAX_CONCURRENT_TASKS = int(_num("MAX_CONCURRENT_TASKS", 2))
# Batas durasi satu telpon (detik). 0 = tanpa batas. Gemini Live itu per menit.
MAX_CALL_SECS = _num("MAX_CALL_SECS", 900)

# --- Penyimpanan lokal ---
STATE_FILE = BASE_DIR / ".jarvis-state.json"  # tugas yang masih jalan, biar tahan restart
TRANSCRIPT_DIR = BASE_DIR / ".transcripts"
SAVE_TRANSCRIPT = _flag("SAVE_TRANSCRIPT", True)

ASSISTANT_NAME = os.getenv("ASSISTANT_NAME", "Jarvis")
OWNER_NAME = os.getenv("OWNER_NAME", "Bos")


def is_owner(wa_id: str) -> bool:
    return _digits(wa_id) in OWNER_NUMBERS


def notify_target(caller: str) -> str:
    """Nomor penerima notifikasi chat untuk tugas dari `caller`."""
    return NOTIFY_NUMBER or _digits(caller)


def startup_warnings() -> list[str]:
    out = []
    if not WHATSAPP_APP_SECRET:
        out.append(
            "WHATSAPP_APP_SECRET KOSONG — tanda tangan webhook tidak bisa dicek. "
            + (
                "WHATSAPP_ALLOW_UNSIGNED=1 aktif, jadi SIAPA PUN yang tahu URL webhook bisa "
                "mengirim event palsu. Jangan dipakai lama."
                if WHATSAPP_ALLOW_UNSIGNED
                else "Semua POST /whatsapp akan ditolak 401 sampai diisi."
            )
        )
    if not JARVIS_API_SECRET and not JARVIS_MOCK:
        out.append("JARVIS_API_SECRET kosong — API Next.js akan menolak semua request.")
    return out
