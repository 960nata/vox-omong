"""Pipeline suara per telpon: audio WA ⇄ Gemini Live, plus tool buat nyuruh Jarvis."""

import asyncio
import json
import time
from datetime import datetime
from typing import Awaitable, Callable

from loguru import logger
from pipecat.adapters.llm.schemas.direct_function import tool_options
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    EndWorkerFrame,
    Frame,
    LLMMessagesAppendFrame,
    LLMRunFrame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

import config
from tasks import CallSession, TaskWatcher

# Teks jawaban bot: nama frame-nya beda antar versi Pipecat, jadi opsional.
_BOT_TEXT_FRAMES: tuple[type, ...] = ()
for _mod, _name in (("pipecat.frames.frames", "TTSTextFrame"), ("pipecat.frames.frames", "LLMTextFrame")):
    try:
        _BOT_TEXT_FRAMES += (getattr(__import__(_mod, fromlist=[_name]), _name),)
    except Exception:  # versi Pipecat tanpa frame itu
        pass

SYSTEM_INSTRUCTION = f"""
Kamu adalah {config.ASSISTANT_NAME}, asisten AI pribadi {config.OWNER_NAME}, yang lagi ngobrol lewat
telpon WhatsApp. {config.OWNER_NAME} kemungkinan sedang di jalan atau nyetir.

Gaya bicara:
- Bahasa Indonesia santai (gw/lu boleh), singkat, 1-2 kalimat. Ini telpon, bukan chat.
- Jangan baca simbol, markdown, URL panjang, atau path file lengkap. Sebut nama file pendeknya aja.
- Kalau instruksi kurang jelas, tanya satu hal aja sebelum mulai.

Tool:
- kerjakan_tugas: pakai kalau user nyuruh bikin/ubah/kerjain sesuatu (landing page, fitur, fix bug,
  dll). Tulis instruksinya lengkap dan jelas dari omongan user. Setelah tool balik, bilang singkat
  kalau udah mulai dikerjain dan nanti dikabarin. Jangan nunggu, lanjut ngobrol aja.
- cek_progress: pakai kalau user nanya progress/status tugas.
- batalin_tugas: pakai kalau user minta stop/batalin/jangan diterusin tugas yang sedang jalan.
- daftar_project: pakai kalau user nanya project apa aja yang ada, atau kamu perlu mastiin nama
  project sebelum ngerjain. Sebut maksimal 5 nama aja.
- tutup_telpon: pakai kalau user pamit atau minta tutup. Pamit singkat dulu, lalu panggil tool ini.

Kalau ada pesan diawali [NOTIFIKASI SISTEM], itu kabar dari sistem (bukan omongan user).
Sampaikan isinya ke user dengan natural dan singkat.
"""


class CallMonitor(FrameProcessor):
    """Pantau siapa yang sedang ngomong + simpan transkrip.

    Dipakai supaya notifikasi sistem nggak nyelak user, dan supaya telpon baru
    ditutup setelah kalimat pamitnya kelar diputar.
    """

    def __init__(self, caller: str):
        super().__init__()
        self.user_speaking = False
        self.bot_speaking = False
        self._user_quiet = asyncio.Event()
        self._user_quiet.set()
        self._bot_quiet = asyncio.Event()
        self._bot_quiet.set()
        self._lines: list[dict] = []
        self._caller = caller
        self._bot_buffer: list[str] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, UserStartedSpeakingFrame):
            self.user_speaking = True
            self._user_quiet.clear()
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self.user_speaking = False
            self._user_quiet.set()
        elif isinstance(frame, BotStartedSpeakingFrame):
            self.bot_speaking = True
            self._bot_quiet.clear()
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.bot_speaking = False
            self._bot_quiet.set()
            self._flush_bot()
        elif isinstance(frame, TranscriptionFrame):
            text = (getattr(frame, "text", "") or "").strip()
            if text:
                self._log("user", text)
        elif _BOT_TEXT_FRAMES and isinstance(frame, _BOT_TEXT_FRAMES):
            text = getattr(frame, "text", "") or ""
            if text:
                self._bot_buffer.append(text)

        await self.push_frame(frame, direction)

    # ---- transkrip ----
    def _log(self, who: str, text: str):
        self._lines.append({"t": datetime.now().isoformat(timespec="seconds"), "who": who, "text": text})

    def _flush_bot(self):
        if self._bot_buffer:
            self._log("bot", "".join(self._bot_buffer).strip())
            self._bot_buffer = []

    def save_transcript(self):
        self._flush_bot()
        if not config.SAVE_TRANSCRIPT or not self._lines:
            return
        try:
            config.TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
            name = f"{datetime.now():%Y%m%d-%H%M%S}-{self._caller or 'unknown'}.jsonl"
            with (config.TRANSCRIPT_DIR / name).open("w", encoding="utf-8") as f:
                for row in self._lines:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
            logger.info(f"Transkrip disimpan: {name} ({len(self._lines)} baris)")
        except Exception as e:
            logger.warning(f"Gagal nyimpen transkrip: {e}")

    # ---- penantian ----
    async def wait_user_quiet(self, timeout: float = 12.0):
        """Tunggu sampai user berhenti ngomong, biar notifikasi nggak nyelak."""
        try:
            await asyncio.wait_for(self._user_quiet.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.debug("User masih ngomong, notifikasi tetap dikirim")

    async def wait_bot_quiet(self, timeout: float = 12.0):
        """Tunggu bot selesai ngomong (dipakai sebelum nutup telpon)."""
        await asyncio.sleep(0.3)  # kasih jeda biar frame 'started speaking' kebaca dulu
        try:
            await asyncio.wait_for(self._bot_quiet.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.debug("Bot belum berhenti ngomong, telpon ditutup paksa")


async def run_bot(
    webrtc_connection,
    caller: str,
    watcher: TaskWatcher,
    hangup: Callable[[], Awaitable[None]],
):
    """hangup(): nutup telpon di sisi WhatsApp (dipakai kalau AI yang nutup)."""
    call = CallSession(caller=caller)
    watcher.attach_call(call)
    started = time.time()

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_out_10ms_chunks=2,
        ),
    )
    monitor = CallMonitor(caller)

    # ---------------- tools ----------------
    @tool_options(cancel_on_interruption=False)
    async def kerjakan_tugas(params: FunctionCallParams):
        instruksi = (params.arguments.get("instruksi") or "").strip()
        if not instruksi:
            await params.result_callback({"ok": False, "error": "instruksi kosong"})
            return
        project = (params.arguments.get("project") or "").strip() or None
        try:
            t = await watcher.start(instruksi, call, project)
            await params.result_callback(
                {"ok": True, "task_id": t.id, "pesan": "Tugas sudah mulai dikerjakan di laptop."}
            )
        except Exception as e:
            logger.exception("Gagal mulai tugas")
            await params.result_callback({"ok": False, "error": str(e)})

    async def cek_progress(params: FunctionCallParams):
        st = await watcher.status(params.arguments.get("task_id"))
        if not st:
            await params.result_callback({"pesan": "Belum ada tugas yang dikerjain."})
        else:
            await params.result_callback({"tugas": st})

    @tool_options(cancel_on_interruption=False)
    async def batalin_tugas(params: FunctionCallParams):
        out = await watcher.cancel(params.arguments.get("task_id"))
        await params.result_callback(out)

    async def daftar_project(params: FunctionCallParams):
        rows = await watcher.projects()
        if not rows:
            await params.result_callback({"pesan": "Belum ada project, nanti dibikin otomatis."})
        else:
            await params.result_callback({"project": rows[:12]})

    async def tutup_telpon(params: FunctionCallParams):
        await params.result_callback({"ok": True})
        await monitor.wait_bot_quiet()  # biar kalimat pamitnya kelar diputar
        await params.llm.push_frame(EndWorkerFrame())

    tools = ToolsSchema(
        standard_tools=[
            FunctionSchema(
                name="kerjakan_tugas",
                description="Suruh Jarvis (AI coding di laptop) mengerjakan tugas, misal bikin landing page.",
                properties={
                    "instruksi": {
                        "type": "string",
                        "description": "Instruksi lengkap dan jelas dari user, dalam bahasa Indonesia.",
                    },
                    "project": {
                        "type": "string",
                        "description": "Opsional. Nama project tujuan kalau user nyebut (misal 'toko online baju'). Kosongkan kalau gak disebut.",
                    },
                },
                required=["instruksi"],
                handler=kerjakan_tugas,
            ),
            FunctionSchema(
                name="cek_progress",
                description="Cek status/progress tugas yang sedang dikerjakan.",
                properties={
                    "task_id": {
                        "type": "string",
                        "description": "Opsional. Kosongkan untuk semua tugas.",
                    }
                },
                required=[],
                handler=cek_progress,
            ),
            FunctionSchema(
                name="batalin_tugas",
                description="Batalin tugas yang sedang dikerjakan Jarvis.",
                properties={
                    "task_id": {
                        "type": "string",
                        "description": "Opsional. Kosongkan untuk membatalkan tugas terakhir.",
                    }
                },
                required=[],
                handler=batalin_tugas,
            ),
            FunctionSchema(
                name="daftar_project",
                description="Daftar project yang ada di laptop (nama + apakah sudah ada websitenya).",
                properties={},
                required=[],
                handler=daftar_project,
            ),
            FunctionSchema(
                name="tutup_telpon",
                description="Akhiri telpon setelah pamit.",
                properties={},
                required=[],
                handler=tutup_telpon,
            ),
        ]
    )

    settings = GeminiLiveLLMService.Settings(
        voice=config.GEMINI_VOICE,
        system_instruction=SYSTEM_INSTRUCTION,
        language=Language.ID_ID,
    )
    if config.GEMINI_MODEL:
        settings.model = config.GEMINI_MODEL

    llm = GeminiLiveLLMService(api_key=config.GOOGLE_API_KEY, settings=settings, tools=tools)

    context = LLMContext()
    user_agg, assistant_agg = LLMContextAggregatorPair(
        context,
        realtime_service_mode=True,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [transport.input(), monitor, user_agg, llm, transport.output(), assistant_agg]
    )
    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True))
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    async def speak(text: str):
        # Notifikasi sistem nunggu user berhenti ngomong dulu biar nggak nyelak.
        await monitor.wait_user_quiet()
        await worker.queue_frames(
            [LLMMessagesAppendFrame(messages=[{"role": "user", "content": text}], run_llm=True)]
        )

    call.speak = speak

    async def duration_guard():
        """Telpon dipotong kalau kelewat lama (Gemini Live dihitung per menit)."""
        if not config.MAX_CALL_SECS:
            return
        try:
            await asyncio.sleep(config.MAX_CALL_SECS)
        except asyncio.CancelledError:
            return
        logger.warning(f"Telpon dari {caller} lewat {config.MAX_CALL_SECS:.0f}s — ditutup otomatis")
        await worker.queue_frames(
            [
                LLMMessagesAppendFrame(
                    messages=[
                        {
                            "role": "user",
                            "content": "[NOTIFIKASI SISTEM] Batas durasi telpon tercapai. "
                            "Pamit singkat banget ke user sekarang.",
                        }
                    ],
                    run_llm=True,
                )
            ]
        )
        await monitor.wait_bot_quiet()
        await worker.queue_frames([EndWorkerFrame()])

    guard = asyncio.create_task(duration_guard())

    @transport.event_handler("on_client_connected")
    async def on_connected(_t, _c):
        logger.info(f"Telpon tersambung dari {caller}")
        running = [t for t in watcher.tasks.values() if not t.done and t.owner == caller]
        hint = ""
        if running:
            hint = f" Ada {len(running)} tugas yang masih jalan: " + json.dumps(
                [t.instruction for t in running], ensure_ascii=False
            )
        context.add_message(
            {
                "role": "developer",
                "content": "Angkat telpon dengan sapaan singkat banget (maks 1 kalimat)." + hint,
            }
        )
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(_t, _c):
        logger.info(f"Telpon dari {caller} ditutup")
        call.active = False
        await runner.cancel()

    try:
        await runner.run()
    finally:
        guard.cancel()
        ended_by_us = call.active  # kalau user yang nutup, active udah False
        call.active = False
        monitor.save_transcript()
        logger.info(f"Telpon {caller} selesai, durasi {time.time() - started:.0f}s")
        if ended_by_us:
            try:
                await hangup()
            except Exception as e:
                logger.warning(f"Gagal nutup telpon di WA: {e}")
