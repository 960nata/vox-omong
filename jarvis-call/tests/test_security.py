import hashlib
import hmac

import pytest

import config
import security


def sign(body: bytes, secret: str = "rahasia") -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


BODY = b'{"entry":[{"changes":[{"field":"calls"}]}]}'


def test_signature_valid():
    assert security.signature_ok(BODY, sign(BODY)) is True


def test_signature_salah_ditolak():
    assert security.signature_ok(BODY, sign(BODY, "salah")) is False


def test_signature_header_kosong_ditolak():
    assert security.signature_ok(BODY, None) is False
    assert security.signature_ok(BODY, "") is False


def test_signature_tanpa_prefix_ditolak():
    mentah = hmac.new(b"rahasia", BODY, hashlib.sha256).hexdigest()
    assert security.signature_ok(BODY, mentah) is False


def test_body_beda_ditolak():
    assert security.signature_ok(b'{"entry":[]}', sign(BODY)) is False


def test_tanpa_app_secret_default_tolak(monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", None)
    monkeypatch.setattr(config, "WHATSAPP_ALLOW_UNSIGNED", False)
    assert security.signature_ok(BODY, sign(BODY)) is False


def test_tanpa_app_secret_bisa_dibuka_manual(monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", None)
    monkeypatch.setattr(config, "WHATSAPP_ALLOW_UNSIGNED", True)
    assert security.signature_ok(BODY, None) is True


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"entry": [{"changes": [{"field": "calls"}]}]}, {"calls"}),
        ({"entry": [{"changes": [{"field": "messages"}]}]}, {"messages"}),
        ({"entry": [{"changes": [{"field": "calls"}, {"field": "messages"}]}]}, {"calls", "messages"}),
        ({}, set()),
    ],
)
def test_call_fields(payload, expected):
    assert security.call_fields(payload) == expected
