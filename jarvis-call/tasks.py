"""Pantau tugas yang lagi dikerjain Jarvis, lalu kabarin hasilnya.

- Kalau telpon masih nyambung → AI ngomong langsung ("udah beres, bos...").
- Kalau telpon udah ditutup → dikirim lewat chat WA ke nomor yang nelpon.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

import aiohttp
from loguru import logger

import config
import jarvis_api


@dataclass
class CallSession:
    """Satu telpon yang sedang berlangsung."""

    caller: str
    # dipasang oleh bot.py: fungsi buat nyuruh AI ngomong sesuatu di telpon
    speak: Optional[Callable[[str], Awaitable[None]]] = None
    active: bool = True

    async def notify(self, text: str) -> bool:
        """Coba sampaikan lewat suara. Return False kalau telpon udah putus."""
        if self.active and self.speak:
            try:
                await self.speak(text)
                return True
            except Exception as e:
                logger.warning(f"Gagal nyampein lewat suara: {e}")
        return False


@dataclass
class TrackedTask:
    id: str
    instruction: str
    owner: str  # nomor WA yang nyuruh
    call: Optional[CallSession]
    last: dict = field(default_factory=dict)
    done: bool = False


class TaskWatcher:
    def __init__(self, session: aiohttp.ClientSession):
        self._http = session
        self.tasks: dict[str, TrackedTask] = {}
        self._loops: dict[str, asyncio.Task] = {}

    # ---- dipanggil dari tool AI ----
    async def start(
        self, instruction: str, call: CallSession, project: Optional[str] = None
    ) -> TrackedTask:
        data = await jarvis_api.start_task(self._http, instruction, project)
        t = TrackedTask(id=str(data["id"]), instruction=instruction, owner=call.caller, call=call)
        t.last = data
        self.tasks[t.id] = t
        self._loops[t.id] = asyncio.create_task(self._watch(t))
        logger.info(f"Tugas {t.id} dimulai: {instruction}")
        return t

    async def status(self, task_id: Optional[str] = None) -> list[dict]:
        """Status terbaru (semua tugas, atau satu kalau task_id diisi)."""
        targets = [self.tasks[task_id]] if task_id in self.tasks else list(self.tasks.values())
        out = []
        for t in targets[-5:]:
            if not t.done:
                try:
                    t.last = await jarvis_api.get_task(self._http, t.id)
                except Exception as e:
                    logger.warning(f"Gagal ambil status {t.id}: {e}")
            out.append({"id": t.id, "instruksi": t.instruction, **_brief(t.last)})
        return out

    def attach_call(self, call: CallSession):
        """Telpon baru dari owner: tugas yang masih jalan dikabarin ke telpon ini."""
        for t in self.tasks.values():
            if not t.done and t.owner == call.caller:
                t.call = call

    # ---- loop pemantau ----
    async def _watch(self, t: TrackedTask):
        failures = 0
        while not t.done:
            await asyncio.sleep(config.POLL_INTERVAL_SECS)
            try:
                t.last = await jarvis_api.get_task(self._http, t.id)
                failures = 0
            except Exception as e:
                failures += 1
                logger.warning(f"Polling {t.id} gagal ({failures}x): {e}")
                if failures >= 20:
                    t.last = {"status": "error", "error": f"Jarvis API gak bisa dihubungi: {e}"}
                else:
                    continue
            if t.last.get("status") in ("done", "error"):
                t.done = True
                await self._report(t)
        self._loops.pop(t.id, None)

    async def _report(self, t: TrackedTask):
        d = t.last
        ok = d.get("status") == "done"
        files = d.get("files") or []
        comps = d.get("components") or []
        if ok:
            voice = (
                f"[NOTIFIKASI SISTEM] Tugas '{t.instruction}' SELESAI. "
                f"Ringkasan: {d.get('summary') or '-'}. "
                f"Jumlah file: {len(files)} ({', '.join(f.rsplit('/', 1)[-1] for f in files[:8])}). "
                f"Komponen ({len(comps)}): {', '.join(comps[:8])}. "
                "Kabarin ke user secara singkat dan natural, sebut beberapa file utamanya aja."
            )
            chat = (
                f"✅ *Tugas selesai*\n{t.instruction}\n\n"
                f"{d.get('summary') or ''}\n\n"
                f"📁 File ({len(files)}):\n" + "\n".join(f"• {f}" for f in files[:30])
                + (f"\n\n🧩 Komponen ({len(comps)}):\n" + "\n".join(f"• {c}" for c in comps[:20]) if comps else "")
                + (f"\n\n👀 Preview: {d['previewUrl']}" if d.get("previewUrl") else "")
            )
        else:
            voice = (
                f"[NOTIFIKASI SISTEM] Tugas '{t.instruction}' GAGAL. "
                f"Error: {d.get('error') or 'tidak diketahui'}. Kabarin ke user singkat."
            )
            chat = f"❌ *Tugas gagal*\n{t.instruction}\n\nError: {d.get('error') or '-'}"

        if t.call and await t.call.notify(voice):
            logger.info(f"Hasil {t.id} disampaikan lewat telpon")
            # tetap kirim chat juga biar ada catatan daftar file-nya
        sent = await jarvis_api.send_whatsapp_text(self._http, t.owner, chat)
        logger.info(f"Hasil {t.id} dikirim lewat chat WA: {sent}")


def _brief(d: dict) -> dict:
    return {
        "status": d.get("status"),
        "progress": d.get("progress"),
        "langkah": d.get("step"),
        "jumlah_file": len(d.get("files") or []),
        "file": (d.get("files") or [])[:10],
        "komponen": (d.get("components") or [])[:10],
        "ringkasan": d.get("summary"),
        "error": d.get("error"),
    }
