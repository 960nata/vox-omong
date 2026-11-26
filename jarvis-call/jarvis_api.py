"""Client ke API Next.js (Jarvis) + kirim chat WhatsApp.

Kontrak API Next.js (src/app/api/jarvis/):
  POST   {JARVIS_API_URL}/api/jarvis/tasks      body {"instruction": str, "projectId"?: str, "source": "wa-call"}
         → {"id": str, "status": "queued"|"running"}
  GET    {JARVIS_API_URL}/api/jarvis/tasks/{id}
         → {"id", "status": "queued"|"running"|"done"|"error"|"cancelled",
            "progress": 0-100, "step": str, "files": [str], "components": [str],
            "summary": str, "previewUrl": str|null, "error": str|null}
  DELETE {JARVIS_API_URL}/api/jarvis/tasks/{id}  → batalin tugas
  GET    {JARVIS_API_URL}/api/jarvis/projects    → {"projects": [{"id","nama","ada_website","diubah"}]}
Header auth: Authorization: Bearer {JARVIS_API_SECRET}
"""

import asyncio
import time
import uuid

import aiohttp
from loguru import logger

import config

# Kode error Meta: di luar jendela 24 jam / butuh template dulu.
REENGAGEMENT_CODES = {131047, 131026, 470}
RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504}


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if config.JARVIS_API_SECRET:
        h["Authorization"] = f"Bearer {config.JARVIS_API_SECRET}"
    return h


# ---------------------------------------------------------------- mock mode
_mock_tasks: dict[str, dict] = {}


def _mock_start(instruction: str, project: str | None = None) -> dict:
    tid = "mock-" + uuid.uuid4().hex[:6]
    _mock_tasks[tid] = {"instruction": instruction, "t0": time.time(), "cancelled": False}
    return {"id": tid, "status": "queued"}


def _mock_get(tid: str) -> dict:
    t = _mock_tasks.get(tid)
    if not t:
        return {"id": tid, "status": "error", "error": "task gak ketemu"}
    if t["cancelled"]:
        return {"id": tid, "status": "cancelled", "progress": 0, "step": "Dibatalkan", "files": []}
    elapsed = time.time() - t["t0"]
    progress = min(100, int(elapsed / 30 * 100))  # selesai dalam 30 detik
    steps = ["Analisis instruksi", "Bikin struktur file", "Nulis komponen", "Styling", "Selesai"]
    step = steps[min(len(steps) - 1, progress // 25)]
    if progress >= 100:
        return {
            "id": tid,
            "status": "done",
            "progress": 100,
            "step": step,
            "files": ["index.html", "assets/style.css"],
            "components": ["Navbar", "Hero", "Fitur", "Pricing", "Footer"],
            "summary": f"(simulasi) Selesai mengerjakan: {t['instruction']}",
            "previewUrl": "http://localhost:3000/api/preview?project=default-workspace",
            "error": None,
        }
    return {"id": tid, "status": "running", "progress": progress, "step": step, "files": []}


def _mock_cancel(tid: str) -> dict:
    t = _mock_tasks.get(tid)
    if not t:
        return {"id": tid, "status": "error", "error": "task gak ketemu"}
    t["cancelled"] = True
    return {"id": tid, "status": "cancelled"}


# ---------------------------------------------------------------- real API
async def _call(
    session: aiohttp.ClientSession, method: str, path: str, *, json_body: dict | None = None, timeout: int = 20
) -> dict:
    url = f"{config.JARVIS_API_URL}{path}"
    async with session.request(
        method,
        url,
        json=json_body,
        headers=_headers(),
        timeout=aiohttp.ClientTimeout(total=timeout),
    ) as r:
        data = await r.json(content_type=None)
        if r.status >= 400:
            raise RuntimeError(f"Jarvis API {r.status}: {data}")
        return data if isinstance(data, dict) else {"data": data}


async def start_task(
    session: aiohttp.ClientSession, instruction: str, project: str | None = None
) -> dict:
    if config.JARVIS_MOCK:
        return _mock_start(instruction, project)
    payload = {"instruction": instruction, "source": "wa-call"}
    if project:
        payload["projectId"] = project
    return await _call(session, "POST", "/api/jarvis/tasks", json_body=payload, timeout=20)


async def get_task(session: aiohttp.ClientSession, task_id: str) -> dict:
    if config.JARVIS_MOCK:
        return _mock_get(task_id)
    return await _call(session, "GET", f"/api/jarvis/tasks/{task_id}", timeout=15)


async def cancel_task(session: aiohttp.ClientSession, task_id: str) -> dict:
    if config.JARVIS_MOCK:
        return _mock_cancel(task_id)
    return await _call(session, "DELETE", f"/api/jarvis/tasks/{task_id}", timeout=15)


async def list_projects(session: aiohttp.ClientSession) -> list[dict]:
    if config.JARVIS_MOCK:
        return [{"id": "default-workspace", "nama": "Default Workspace", "ada_website": True}]
    data = await _call(session, "GET", "/api/jarvis/projects", timeout=15)
    return data.get("projects") or []


# ---------------------------------------------------------------- chat WA
def _graph_url() -> str:
    return (
        f"https://graph.facebook.com/{config.GRAPH_API_VERSION}/"
        f"{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )


def _error_code(data: dict) -> int | None:
    err = (data or {}).get("error") or {}
    for key in ("code", "error_subcode"):
        try:
            return int(err.get(key))
        except (TypeError, ValueError):
            continue
    return None


async def _post_message(session: aiohttp.ClientSession, payload: dict) -> tuple[bool, dict]:
    """Kirim satu payload Graph API. Retry buat error sesaat (429/5xx/jaringan)."""
    delay = 2.0
    last: dict = {}
    for attempt in range(4):
        try:
            async with session.post(
                _graph_url(),
                json=payload,
                headers={"Authorization": f"Bearer {config.WHATSAPP_TOKEN}"},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as r:
                data = await r.json(content_type=None)
                if r.status < 400:
                    return True, data or {}
                last = data or {}
                if r.status in RETRY_STATUSES and attempt < 3:
                    logger.warning(f"Kirim chat WA {r.status}, coba lagi dalam {delay}s: {data}")
                else:
                    logger.error(f"Gagal kirim chat WA ({r.status}): {data}")
                    return False, last
        except Exception as e:  # jaringan putus / timeout
            logger.warning(f"Kirim chat WA error (percobaan {attempt + 1}): {e}")
            last = {"error": {"message": str(e)}}
        await asyncio.sleep(delay)
        delay *= 2
    return False, last


async def send_whatsapp_text(session: aiohttp.ClientSession, to: str, text: str) -> bool:
    """Kirim chat teks biasa. Meta cuma ngizinin teks bebas di dalam jendela 24 jam
    sejak owner terakhir chat/nelpon nomor bot. Di luar jendela itu, kalau
    WHATSAPP_TEMPLATE_NAME diisi, otomatis fallback ke template."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": True, "body": text[:4000]},
    }
    ok, data = await _post_message(session, payload)
    if ok:
        return True
    if _error_code(data) in REENGAGEMENT_CODES and config.WHATSAPP_TEMPLATE_NAME:
        logger.info("Di luar jendela 24 jam → fallback ke template WA")
        return await send_whatsapp_template(session, to, text)
    return False


async def send_whatsapp_template(session: aiohttp.ClientSession, to: str, text: str) -> bool:
    """Template HSM dengan satu variabel body ({{1}}) berisi ringkasan singkat."""
    if not config.WHATSAPP_TEMPLATE_NAME:
        return False
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": config.WHATSAPP_TEMPLATE_NAME,
            "language": {"code": config.WHATSAPP_TEMPLATE_LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": text.replace("\n", " ")[:900]}],
                }
            ],
        },
    }
    ok, _ = await _post_message(session, payload)
    return ok
