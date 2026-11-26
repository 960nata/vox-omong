"""Pantau tugas yang lagi dikerjain Jarvis, lalu kabarin hasilnya.

- Kalau telpon masih nyambung → AI ngomong langsung ("udah beres, bos...").
- Kalau telpon udah ditutup → dikirim lewat chat WA ke nomor yang nelpon.
- Tugas yang masih jalan disimpan ke config.STATE_FILE, jadi kalau service ini
  restart pemantauannya dilanjut, bukan hilang.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

import aiohttp
from loguru import logger

import config
import jarvis_api

MAX_TRACKED = 40  # tugas lama yang sudah selesai dibuang biar memori gak numpuk


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
    started_at: float = field(default_factory=time.time)
    cancelling: bool = False


class TaskWatcher:
    def __init__(self, session: aiohttp.ClientSession):
        self._http = session
        self.tasks: dict[str, TrackedTask] = {}
        self._loops: dict[str, asyncio.Task] = {}

    # ---- dipanggil dari tool AI ----
    @property
    def running(self) -> list[TrackedTask]:
        return [t for t in self.tasks.values() if not t.done]

    async def start(
        self, instruction: str, call: CallSession, project: Optional[str] = None
    ) -> TrackedTask:
        if len(self.running) >= config.MAX_CONCURRENT_TASKS:
            raise RuntimeError(
                f"Masih ada {len(self.running)} tugas jalan (batas {config.MAX_CONCURRENT_TASKS}). "
                "Tunggu beres atau batalin dulu salah satu."
            )
        data = await jarvis_api.start_task(self._http, instruction, project)
        t = TrackedTask(id=str(data["id"]), instruction=instruction, owner=call.caller, call=call)
        t.last = data
        self.tasks[t.id] = t
        self._loops[t.id] = asyncio.create_task(self._watch(t))
        logger.info(f"Tugas {t.id} dimulai: {instruction}")
        self._prune()
        self._save()
        return t

    async def status(self, task_id: Optional[str] = None) -> list[dict]:
        """Status terbaru (semua tugas, atau satu kalau task_id diisi)."""
        if task_id:
            t = self.tasks.get(str(task_id))
            targets = [t] if t else []
        else:
            targets = list(self.tasks.values())[-5:]
        out = []
        for t in targets:
            if not t.done:
                try:
                    t.last = await jarvis_api.get_task(self._http, t.id)
                except Exception as e:
                    logger.warning(f"Gagal ambil status {t.id}: {e}")
            out.append({"id": t.id, "instruksi": t.instruction, **_brief(t.last)})
        return out

    async def cancel(self, task_id: Optional[str] = None) -> dict:
        """Batalin satu tugas (atau yang paling baru kalau task_id kosong)."""
        if task_id and str(task_id) in self.tasks:
            target = self.tasks[str(task_id)]
        else:
            jalan = self.running
            if not jalan:
                return {"ok": False, "pesan": "Gak ada tugas yang sedang jalan."}
            target = jalan[-1]
        target.cancelling = True
        try:
            await jarvis_api.cancel_task(self._http, target.id)
        except Exception as e:
            logger.warning(f"Gagal batalin {target.id}: {e}")
            return {"ok": False, "pesan": f"Gagal batalin: {e}"}
        logger.info(f"Tugas {target.id} diminta batal")
        return {"ok": True, "task_id": target.id, "instruksi": target.instruction,
                "pesan": "Tugas diminta berhenti."}

    async def projects(self) -> list[dict]:
        try:
            return await jarvis_api.list_projects(self._http)
        except Exception as e:
            logger.warning(f"Gagal ambil daftar project: {e}")
            return []

    def attach_call(self, call: CallSession):
        """Telpon baru dari owner: tugas yang masih jalan dikabarin ke telpon ini."""
        for t in self.tasks.values():
            if not t.done and t.owner == call.caller:
                t.call = call

    # ---- persistensi ----
    def _save(self):
        data = [
            {"id": t.id, "instruction": t.instruction, "owner": t.owner, "started_at": t.started_at}
            for t in self.running
        ]
        try:
            config.STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        except Exception as e:
            logger.debug(f"Gagal nyimpen state tugas: {e}")

    def resume(self):
        """Lanjutin pemantauan tugas yang masih jalan sebelum service restart."""
        try:
            raw = json.loads(config.STATE_FILE.read_text())
        except Exception:
            return
        restored = 0
        for row in raw if isinstance(raw, list) else []:
            tid = str(row.get("id") or "")
            if not tid or tid in self.tasks:
                continue
            t = TrackedTask(
                id=tid,
                instruction=row.get("instruction") or "(tanpa keterangan)",
                owner=str(row.get("owner") or ""),
                call=None,
                started_at=float(row.get("started_at") or time.time()),
            )
            self.tasks[tid] = t
            self._loops[tid] = asyncio.create_task(self._watch(t))
            restored += 1
        if restored:
            logger.info(f"{restored} tugas dari sesi sebelumnya dipantau lagi")

    def _prune(self):
        if len(self.tasks) <= MAX_TRACKED:
            return
        selesai = [t for t in self.tasks.values() if t.done]
        for t in selesai:
            if len(self.tasks) <= MAX_TRACKED:
                break
            self.tasks.pop(t.id, None)

    # ---- loop pemantau ----
    async def _watch(self, t: TrackedTask):
        failures = 0
        while not t.done:
            await asyncio.sleep(config.POLL_INTERVAL_SECS)
            if config.TASK_TIMEOUT_SECS and time.time() - t.started_at > config.TASK_TIMEOUT_SECS:
                menit = int(config.TASK_TIMEOUT_SECS // 60)
                logger.warning(f"Tugas {t.id} lewat batas {menit} menit — dihentikan")
                try:
                    await jarvis_api.cancel_task(self._http, t.id)
                except Exception:
                    pass
                t.last = {"status": "error", "error": f"kelamaan, lewat {menit} menit"}
            else:
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
            if t.last.get("status") in ("done", "error", "cancelled"):
                t.done = True
                await self._report(t)
                self._save()
        self._loops.pop(t.id, None)

    async def _report(self, t: TrackedTask):
        d = t.last
        status = d.get("status")
        files = d.get("files") or []
        comps = d.get("components") or []
        preview = d.get("previewUrl")

        if status == "cancelled":
            voice = (
                f"[NOTIFIKASI SISTEM] Tugas '{t.instruction}' DIBATALKAN. Kabarin singkat ke user."
            )
            chat = f"🛑 *Tugas dibatalkan*\n{t.instruction}"
        elif status == "done":
            voice = (
                f"[NOTIFIKASI SISTEM] Tugas '{t.instruction}' SELESAI. "
                f"Ringkasan: {d.get('summary') or '-'}. "
                f"Jumlah file: {len(files)} ({', '.join(f.rsplit('/', 1)[-1] for f in files[:8])}). "
                f"Bagian halaman ({len(comps)}): {', '.join(comps[:8])}. "
                "Kabarin ke user secara singkat dan natural, sebut beberapa file utamanya aja."
            )
            chat = (
                f"✅ *Tugas selesai*\n{t.instruction}\n\n"
                f"{d.get('summary') or ''}\n\n"
                f"📁 File ({len(files)}):\n" + "\n".join(f"• {f}" for f in files[:30])
                + (
                    f"\n\n🧩 Bagian halaman ({len(comps)}):\n" + "\n".join(f"• {c}" for c in comps[:20])
                    if comps
                    else ""
                )
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
        to = config.notify_target(t.owner)
        if not to:
            logger.warning(f"Hasil {t.id} gak dikirim: nomor penerima kosong")
            return
        sent = await jarvis_api.send_whatsapp_text(self._http, to, chat)
        logger.info(f"Hasil {t.id} dikirim lewat chat WA: {sent}")
        if sent and preview:
            # pesan terpisah biar WhatsApp nampilin kartu pratinjau link-nya
            await jarvis_api.send_whatsapp_text(self._http, to, f"👀 Pratinjau: {preview}")


def _brief(d: dict) -> dict:
    return {
        "status": d.get("status"),
        "progress": d.get("progress"),
        "langkah": d.get("step"),
        "jumlah_file": len(d.get("files") or []),
        "file": (d.get("files") or [])[:10],
        "bagian": (d.get("components") or [])[:10],
        "ringkasan": d.get("summary"),
        "error": d.get("error"),
    }
