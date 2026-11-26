import jarvis_api


def test_error_code_dibaca():
    assert jarvis_api._error_code({"error": {"code": 131047}}) == 131047
    assert jarvis_api._error_code({"error": {"message": "x"}}) is None
    assert jarvis_api._error_code({}) is None


def test_graph_url_pakai_versi_dan_phone_id():
    url = jarvis_api._graph_url()
    assert url.endswith("/123456/messages")
    assert "graph.facebook.com" in url


def test_mock_siklus_tugas():
    started = jarvis_api._mock_start("bikin landing page")
    tid = started["id"]
    assert started["status"] == "queued"
    assert jarvis_api._mock_get(tid)["status"] in ("running", "done")
    jarvis_api._mock_cancel(tid)
    assert jarvis_api._mock_get(tid)["status"] == "cancelled"


def test_mock_task_gak_ada():
    assert jarvis_api._mock_get("entah")["status"] == "error"
