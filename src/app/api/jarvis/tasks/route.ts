import { NextResponse } from "next/server";
import { checkAuth, listTasks, startTask } from "@/lib/jarvisTasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { instruction, projectId?, source? } → mulai tugas, langsung balik { id, status }
export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const instruction = String(body?.instruction ?? "").trim();
  if (!instruction) {
    return NextResponse.json({ error: "instruction wajib diisi" }, { status: 400 });
  }

  const task = startTask(instruction, body?.projectId, body?.source ?? "api");
  return NextResponse.json({ id: task.id, status: task.status }, { status: 202 });
}

// GET → 20 tugas terakhir
export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ tasks: listTasks().slice(0, 20) });
}
