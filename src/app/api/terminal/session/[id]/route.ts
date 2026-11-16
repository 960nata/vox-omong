import { NextResponse } from "next/server";
import { getSession, interruptSession, killSession, subscribe, writeSession } from "@/lib/terminal/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Aliran output (Server-Sent Events). Data dikirim base64 supaya byte kontrol terminal tidak rusak. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSession(id)) return NextResponse.json({ success: false, error: "Sesi terminal tidak ditemukan." }, { status: 404 });
  const encoder = new TextEncoder();
  let stop: (() => void) | null = null;
  let ping: NodeJS.Timeout | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: string) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); } catch {}
      };
      const close = () => {
        if (ping) clearInterval(ping);
        stop?.();
        try { controller.close(); } catch {}
      };
      stop = subscribe(id, (e) => {
        if (e.type === "data") send("data", Buffer.from(e.data, "utf-8").toString("base64"));
        else { send("exit", String(e.code ?? "")); close(); }
      });
      ping = setInterval(() => send("ping", "1"), 20_000);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      if (ping) clearInterval(ping);
      stop?.();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

/** Input: { data } ketikan, atau { action: "interrupt" } untuk Ctrl-C. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ success: false, error: "Permintaan tidak valid." }, { status: 400 });
  if (body.action === "interrupt") return NextResponse.json({ success: interruptSession(id) });
  if (typeof body.data !== "string" || body.data.length > 20_000) return NextResponse.json({ success: false, error: "data wajib berupa teks (maks 20.000 karakter)." }, { status: 400 });
  const ok = writeSession(id, body.data);
  return NextResponse.json({ success: ok, ...(ok ? {} : { error: "Sesi sudah berakhir." }) }, { status: ok ? 200 : 410 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return NextResponse.json({ success: killSession(id) });
}
