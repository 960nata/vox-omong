import { NextRequest, NextResponse } from "next/server";
import { deleteMemory, listMemories, memoryPrompt, saveMemory, searchMemories } from "@/lib/engine";
import { allowEngineRequest } from "@/lib/engine/guard";

export const runtime = "nodejs";

const denied = () => NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent") ?? undefined;
  const query = searchParams.get("q");

  if (query && agent) {
    return NextResponse.json({
      success: true,
      memories: await searchMemories(agent, query),
      prompt: await memoryPrompt(agent, query),
    });
  }
  return NextResponse.json({ success: true, memories: await listMemories(agent) });
}

export async function POST(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  try {
    const body = await req.json();
    const action = String(body?.action ?? "save");

    if (action === "delete") {
      return NextResponse.json({ success: await deleteMemory(String(body.id ?? "")) });
    }
    if (action === "save") {
      const memory = await saveMemory({
        id: body.id,
        agent: String(body.agent ?? "").trim(),
        text: String(body.text ?? ""),
        alwaysInPrompt: body.alwaysInPrompt,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
      });
      return NextResponse.json({ success: true, memory });
    }
    return NextResponse.json({ success: false, error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
