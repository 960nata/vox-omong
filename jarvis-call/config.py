"""Konfigurasi dari .env — semua setting ada di sini biar gampang dicek."""

import os
import re

from dotenv import load_dotenv

load_dotenv(override=True)


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _required(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        raise RuntimeError(f"Env {name} belum diisi (cek file .env)")
    return val


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
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "v23.0")

# Nomor yang boleh nelpon bot, format internasional tanpa + (contoh 6281234567890).
# Pisahkan pakai koma kalau lebih dari satu. Nomor pertama = penerima notifikasi chat.
OWNER_NUMBERS = [_digits(n) for n in _required("OWNER_NUMBERS").split(",") if _digits(n)]

# Kalau webhook WA kamu juga dipakai bot chat (Next.js), event selain "calls"
# diteruskan ke URL ini apa adanya (body + header tanda tangan ikut dikirim).
FORWARD_WEBHOOK_URL = os.getenv("FORWARD_WEBHOOK_URL", "").strip() or None

# --- Jarvis (Next.js) ---
JARVIS_API_URL = os.getenv("JARVIS_API_URL", "http://localhost:3000").rstrip("/")
JARVIS_API_SECRET = os.getenv("JARVIS_API_SECRET", "")
# 1 = gak manggil Next.js, tugasnya disimulasikan (buat ngetes telpon dulu)
JARVIS_MOCK = os.getenv("JARVIS_MOCK", "0") == "1"
POLL_INTERVAL_SECS = float(os.getenv("POLL_INTERVAL_SECS", "5"))

ASSISTANT_NAME = os.getenv("ASSISTANT_NAME", "Jarvis")
OWNER_NAME = os.getenv("OWNER_NAME", "Bos")


def is_owner(wa_id: str) -> bool:
    return _digits(wa_id) in OWNER_NUMBERS
