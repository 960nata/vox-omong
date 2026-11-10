"""Pipeline suara per telpon: audio WA ⇄ Gemini Live, plus tool buat nyuruh Jarvis."""

import asyncio
import json
from typing import Awaitable, Callable

from loguru import logger
from pipecat.adapters.llm.schemas.direct_function import tool_options
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import EndWorkerFrame, LLMMessagesAppendFrame, LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transcriptions.language import Language
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

import config
from tasks import CallSession, TaskWatcher

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
- tutup_telpon: pakai kalau user pamit atau minta tutup. Pamit singkat dulu, lalu panggil tool ini.

Kalau ada pesan diawali [NOTIFIKASI SISTEM], itu kabar dari sistem (bukan omongan user).
Sampaikan isinya ke user dengan natural dan singkat.
"""


async def run_bot(
    webrtc_connection,
    caller: str,
    watcher: TaskWatcher,
    hangup: Callable[[], Awaitable[None]],
):
    """hangup(): nutup telpon di sisi WhatsApp (dipakai kalau AI yang nutup)."""
    call = CallSession(caller=caller)
    watcher.attach_call(call)

    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_out_10ms_chunks=2,
        ),
    )

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
            await params.result_callback(
                {"ok": False, "error": f"Gagal menghubungi Jarvis di laptop: {e}"}
            )

    async def cek_progress(params: FunctionCallParams):
        st = await watcher.status(params.arguments.get("task_id"))
        if not st:
            await params.result_callback({"pesan": "Belum ada tugas yang dikerjain."})
        else:
            await params.result_callback({"tugas": st})

    async def tutup_telpon(params: FunctionCallParams):
        await params.result_callback({"ok": True})
        await asyncio.sleep(2.5)  # kasih waktu kalimat pamitnya keputar
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

    pipeline = Pipeline([transport.input(), user_agg, llm, transport.output(), assistant_agg])
    worker = PipelineWorker(pipeline, params=PipelineParams(enable_metrics=True))
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    async def speak(text: str):
        await worker.queue_frames(
            [LLMMessagesAppendFrame(messages=[{"role": "user", "content": text}], run_llm=True)]
        )

    call.speak = speak

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
        ended_by_us = call.active  # kalau user yang nutup, active udah False
        call.active = False
        if ended_by_us:
            try:
                await hangup()
            except Exception as e:
                logger.warning(f"Gagal nutup telpon di WA: {e}")
