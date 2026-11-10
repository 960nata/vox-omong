"""Server webhook WhatsApp: terima telpon, cek whitelist, sambungin ke bot.

Jalankan:  python server.py --port 7860
Webhook URL di Meta:  https://<domain-cloudflared>/whatsapp
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import sys
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp
import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
from loguru import logger
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.whatsapp.api import (
    WhatsAppApi,
    WhatsAppConnectCall,
    WhatsAppConnectCallValue,
    WhatsAppWebhookRequest,
)
from pipecat.transports.whatsapp.client import WhatsAppClient

import config
from bot import run_bot
from tasks import TaskWatcher

wa_client: Optional[WhatsAppClient] = None
wa_api: Optional[WhatsAppApi] = None
watcher: Optional[TaskWatcher] = None
http: Optional[aiohttp.ClientSession] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global wa_client, wa_api, watcher, http
    async with aiohttp.ClientSession() as session:
        http = session
        # Tanda tangan webhook dicek sendiri di bawah (sebelum parsing), jadi
        # whatsapp_secret gak perlu dioper ke client Pipecat.
        wa_client = WhatsAppClient(
            whatsapp_token=config.WHATSAPP_TOKEN,
            phone_number_id=config.WHATSAPP_PHONE_NUMBER_ID,
            session=session,
        )
        wa_api = WhatsAppApi(config.WHATSAPP_TOKEN, config.WHATSAPP_PHONE_NUMBER_ID, session)
        watcher = TaskWatcher(session)
        logger.info(
            f"Siap. Owner: {config.OWNER_NUMBERS} | mock={config.JARVIS_MOCK} | "
            f"jarvis={config.JARVIS_API_URL}"
        )
        try:
            yield
        finally:
            await wa_client.terminate_all_calls()


app = FastAPI(title="Jarvis WA Call", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ok": True, "tasks": len(watcher.tasks) if watcher else 0}


@app.get("/whatsapp")
async def verify(request: Request):
    params = dict(request.query_params)
    try:
        result = await wa_client.handle_verify_webhook_request(
            params=params, expected_verification_token=config.WHATSAPP_WEBHOOK_VERIFICATION_TOKEN
        )
        logger.info("Verifikasi webhook OK")
        return PlainTextResponse(str(result))
    except ValueError:
        raise HTTPException(status_code=403, detail="Verification failed")


def _signature_ok(raw: bytes, header: Optional[str]) -> bool:
    if not config.WHATSAPP_APP_SECRET:
        return True
    if not header:
        return False
    expected = hmac.new(config.WHATSAPP_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("sha256=")[-1])


async def _forward(raw: bytes, signature: Optional[str]):
    if not config.FORWARD_WEBHOOK_URL:
        return
    headers = {"Content-Type": "application/json"}
    if signature:
        headers["X-Hub-Signature-256"] = signature
    try:
        async with http.post(
            config.FORWARD_WEBHOOK_URL,
            data=raw,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as r:
            logger.debug(f"Webhook diteruskan ke bot chat → {r.status}")
    except Exception as e:
        logger.warning(f"Gagal meneruskan webhook: {e}")


@app.post("/whatsapp")
async def webhook(request: Request, background: BackgroundTasks):
    raw = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")
    if not _signature_ok(raw, sig):
        logger.warning("Tanda tangan webhook gak valid — ditolak")
        raise HTTPException(status_code=401, detail="bad signature")

    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json")

    fields = {c.get("field") for e in data.get("entry", []) for c in e.get("changes", [])}

    # Event selain telpon (chat, status pesan, dll) → terusin ke bot chat Next.js
    if fields != {"calls"}:
        background.add_task(_forward, raw, sig)
        return {"status": "forwarded"}

    try:
        body = WhatsAppWebhookRequest.model_validate(data)
    except Exception:
        # contoh: event status panggilan (ringing/accepted) yang gak perlu diproses
        logger.debug(f"Event calls diabaikan: {data}")
        return {"status": "ignored"}

    # Whitelist: tolak telpon dari nomor selain owner
    for entry in body.entry:
        for change in entry.changes:
            if isinstance(change.value, WhatsAppConnectCallValue):
                for c in change.value.calls:
                    if c.event == "connect" and not config.is_owner(c.from_):
                        logger.warning(f"Telpon dari {c.from_} DITOLAK (bukan owner)")
                        await wa_api.reject_call_to_whatsapp(c.id)
                        return {"status": "rejected"}

    async def on_connection(connection: SmallWebRTCConnection, call: WhatsAppConnectCall):
        async def hangup():
            await wa_api.terminate_call_to_whatsapp(call.id)

        background.add_task(run_bot, connection, call.from_, watcher, hangup)

    try:
        await wa_client.handle_webhook_request(body, on_connection)
    except ValueError as e:
        logger.debug(f"Webhook calls tanpa event yang didukung: {e}")
    except Exception as e:
        logger.exception(f"Error proses telpon: {e}")
        raise HTTPException(status_code=500, detail="internal error")
    return {"status": "ok"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=7860)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logger.remove()
    logger.add(sys.stderr, level="TRACE" if args.verbose else "INFO")
    try:
        asyncio.run(uvicorn.Server(uvicorn.Config(app, host=args.host, port=args.port)).serve())
    except KeyboardInterrupt:
        pass
