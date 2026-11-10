"""Client ke API Next.js (Jarvis) + kirim chat WhatsApp.

Kontrak API Next.js (lihat folder nextjs/):
  POST {JARVIS_API_URL}/api/jarvis/tasks      body {"instruction": str, "projectId"?: str, "source": "wa-call"}
       → {"id": str, "status": "queued"|"running"}
  GET  {JARVIS_API_URL}/api/jarvis/tasks/{id}
       → {"id", "status": "queued"|"running"|"done"|"error",
          "progress": 0-100, "step": str, "files": [str], "components": [str],
          "summary": str, "previewUrl": str|null, "error": str|null}
Header auth: Authorization: Bearer {JARVIS_API_SECRET}
"""

import asyncio
import time
import uuid

import aiohttp
from loguru import logger

import config


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if config.JARVIS_API_SECRET:
        h["Authorization"] = f"Bearer {config.JARVIS_API_SECRET}"
    return h


# ---------------------------------------------------------------- mock mode
_mock_tasks: dict[str, dict] = {}


def _mock_start(instruction: str, project: str | None = None) -> dict:
    tid = "mock-" + uuid.uuid4().hex[:6]
    _mock_tasks[tid] = {"instruction": instruction, "t0": time.time()}
    return {"id": tid, "status": "queued"}


def _mock_get(tid: str) -> dict:
    t = _mock_tasks.get(tid)
    if not t:
        return {"id": tid, "status": "error", "error": "task gak ketemu"}
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
            "files": ["/.data/user_projects/default-workspace/index.html"],
            "components": ["Navbar", "Hero", "Fitur", "Pricing", "Footer"],
            "summary": f"(simulasi) Selesai mengerjakan: {t['instruction']}",
            "error": None,
        }
    return {"id": tid, "status": "running", "progress": progress, "step": step, "files": []}


# ---------------------------------------------------------------- real API
async def start_task(
    session: aiohttp.ClientSession, instruction: str, project: str | None = None
) -> dict:
    if config.JARVIS_MOCK:
        return _mock_start(instruction, project)
    payload = {"instruction": instruction, "source": "wa-call"}
    if project:
        payload["projectId"] = project
    url = f"{config.JARVIS_API_URL}/api/jarvis/tasks"
    async with session.post(
        url,
        json=payload,
        headers=_headers(),
        timeout=aiohttp.ClientTimeout(total=20),
    ) as r:
        data = await r.json(content_type=None)
        if r.status >= 400:
            raise RuntimeError(f"Jarvis API {r.status}: {data}")
        return data


async def get_task(session: aiohttp.ClientSession, task_id: str) -> dict:
    if config.JARVIS_MOCK:
        return _mock_get(task_id)
    url = f"{config.JARVIS_API_URL}/api/jarvis/tasks/{task_id}"
    async with session.get(
        url, headers=_headers(), timeout=aiohttp.ClientTimeout(total=15)
    ) as r:
        data = await r.json(content_type=None)
        if r.status >= 400:
            raise RuntimeError(f"Jarvis API {r.status}: {data}")
        return data


async def send_whatsapp_text(session: aiohttp.ClientSession, to: str, text: str) -> bool:
    """Kirim chat teks biasa. Catatan: Meta cuma ngizinin teks bebas di dalam
    jendela 24 jam sejak kamu terakhir chat/nelpon nomor bot."""
    url = (
        f"https://graph.facebook.com/{config.GRAPH_API_VERSION}/"
        f"{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text[:4000]},
    }
    for attempt in range(3):
        try:
            async with session.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {config.WHATSAPP_TOKEN}"},
                timeout=aiohttp.ClientTimeout(total=15),
            ) as r:
                data = await r.json(content_type=None)
                if r.status < 400:
                    return True
                logger.error(f"Gagal kirim chat WA ({r.status}): {data}")
                return False
        except Exception as e:
            logger.warning(f"Kirim chat WA error (percobaan {attempt + 1}): {e}")
            await asyncio.sleep(2)
    return False
