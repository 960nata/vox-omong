"""Env palsu supaya config.py bisa diimpor tanpa .env sungguhan."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("GOOGLE_API_KEY", "test-key")
os.environ.setdefault("WHATSAPP_TOKEN", "test-token")
os.environ.setdefault("WHATSAPP_PHONE_NUMBER_ID", "123456")
os.environ.setdefault("WHATSAPP_WEBHOOK_VERIFICATION_TOKEN", "verify-me")
os.environ.setdefault("WHATSAPP_APP_SECRET", "rahasia")
os.environ.setdefault("OWNER_NUMBERS", "6281234567890, +62 812-9999-0000")
os.environ.setdefault("JARVIS_MOCK", "1")
