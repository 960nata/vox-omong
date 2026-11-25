import { NextRequest, NextResponse } from "next/server";
import {
  answerThread,
  bootEngine,
  concurrencyOf,
  getThread,
  listThreads,
  normalizeBlock,
  setConcurrency,
  startThread,
  stopThread,
  validateAnswer,
  waitingCount,
} from "@/lib/engine";
import { allowEngineRequest } from "@/lib/engine/guard";
import type { ThreadStatus } from "@/lib/engine";

export const runtime = "nodejs";

const denied = () => NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const thread = getThread(id);
    if (!thread) return NextResponse.json({ success: false, error: "Thread tidak ketemu." }, { status: 404 });
    return NextResponse.json({ success: true, thread });
  }
  const agent = searchParams.get("agent") ?? undefined;
  const status = (searchParams.get("status") as ThreadStatus | null) ?? undefined;
  return NextResponse.json({
    success: true,
    threads: listThreads({ agent, status }),
    waiting: waitingCount(agent),
    atOnce: agent ? concurrencyOf(agent) : undefined,
  });
}

export async function POST(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  bootEngine();
  try {
    const body = await req.json();
    const action = String(body?.action ?? "start");

    switch (action) {
      case "start": {
        const agent = String(body.agent ?? "").trim();
        const prompt = String(body.prompt ?? "").trim();
        if (!agent || !prompt) {
          return NextResponse.json({ success: false, error: "`agent` dan `prompt` wajib." }, { status: 400 });
        }
        if (Number.isFinite(body.atOnce)) setConcurrency(agent, Number(body.atOnce));
        const thread = await startThread({ agent, prompt, kind: body.kind });
        return NextResponse.json({ success: true, thread });
      }
      case "answer": {
        const thread = getThread(String(body.id ?? ""));
        if (!thread) return NextResponse.json({ success: false, error: "Thread tidak ketemu." }, { status: 404 });
        if (!thread.pending) {
          return NextResponse.json({ success: false, error: "Thread ini tidak sedang menunggu." }, { status: 400 });
        }
        // Jawaban dicek dulu terhadap bloknya, biar eksekutor tidak menerima nilai ngawur.
        const block = normalizeBlock(thread.pending);
        const answer = validateAnswer(block, {
          blockId: block.id,
          ...(body.skipped ? { skipped: true as const } : { value: body.value }),
        });
        return NextResponse.json({ success: true, thread: answerThread(thread.id, answer) });
      }
      case "stop": {
        const thread = stopThread(String(body.id ?? ""));
        if (!thread) return NextResponse.json({ success: false, error: "Thread tidak ketemu." }, { status: 404 });
        return NextResponse.json({ success: true, thread });
      }
      case "at-once": {
        const agent = String(body.agent ?? "").trim();
        if (!agent || !Number.isFinite(body.atOnce)) {
          return NextResponse.json({ success: false, error: "`agent` dan `atOnce` wajib." }, { status: 400 });
        }
        setConcurrency(agent, Number(body.atOnce));
        return NextResponse.json({ success: true, agent, atOnce: concurrencyOf(agent) });
      }
      default:
        return NextResponse.json({ success: false, error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
