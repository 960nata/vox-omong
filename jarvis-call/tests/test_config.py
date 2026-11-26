import config


def test_owner_dinormalkan():
    assert config.OWNER_NUMBERS == ["6281234567890", "6281299990000"]


def test_is_owner_terima_format_bebas():
    assert config.is_owner("+62 812-3456-7890") is True
    assert config.is_owner("6281234567890") is True


def test_bukan_owner_ditolak():
    assert config.is_owner("6289999999999") is False
    assert config.is_owner("") is False


def test_notify_target_default_ke_penelpon(monkeypatch):
    monkeypatch.setattr(config, "NOTIFY_NUMBER", None)
    assert config.notify_target("+62 812-3456-7890") == "6281234567890"


def test_notify_target_bisa_dipaksa_ke_satu_nomor(monkeypatch):
    monkeypatch.setattr(config, "NOTIFY_NUMBER", "6280000000000")
    assert config.notify_target("6281234567890") == "6280000000000"


def test_flag_parser():
    assert config._flag("TIDAK_ADA", True) is True
    assert config._flag("TIDAK_ADA", False) is False


def test_startup_warning_saat_app_secret_kosong(monkeypatch):
    monkeypatch.setattr(config, "WHATSAPP_APP_SECRET", None)
    pesan = " ".join(config.startup_warnings())
    assert "WHATSAPP_APP_SECRET" in pesan
