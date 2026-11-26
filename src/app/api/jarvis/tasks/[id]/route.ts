import { NextResponse } from "next/server";
import { cancelTask, checkAuth, getTask } from "@/lib/jarvisTasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/jarvis/tasks/[id]">) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "task gak ketemu" }, { status: 404 });
  return NextResponse.json(task);
}

// DELETE → minta tugas berhenti (pembatalan kooperatif di batas langkah berikutnya)
export async function DELETE(req: Request, ctx: RouteContext<"/api/jarvis/tasks/[id]">) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const task = cancelTask(id);
  if (!task) return NextResponse.json({ error: "task gak ketemu" }, { status: 404 });
  return NextResponse.json(task);
}
