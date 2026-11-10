import { NextResponse } from "next/server";
import path from "path";
import { readStackConfig } from "@/lib/scaffold";
import { startStackInBackground, stackStatus, stopStack } from "@/lib/procs";
import { slugify } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dirOf = (id: string) => path.join(process.cwd(), ".data", "user_projects", slugify(id) || "default-workspace");

// GET ?projectId= → status server/web (alamat, port, log terakhir)
export async function GET(req: Request) {
  const id = slugify(new URL(req.url).searchParams.get("projectId") || "");
  const cfg = id ? await readStackConfig(dirOf(id)) : null;
  if (!cfg) return NextResponse.json({ ok: false, error: "project ini bukan proyek stack" }, { status: 404 });
  return NextResponse.json({ ok: true, config: cfg, parts: await stackStatus(id, cfg) });
}

// POST { projectId, action: "start" | "stop" }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = slugify(String(body?.projectId || ""));
  const cfg = id ? await readStackConfig(dirOf(id)) : null;
  if (!cfg) return NextResponse.json({ ok: false, error: "project ini bukan proyek stack" }, { status: 404 });
  if (body?.action === "stop") return NextResponse.json({ ok: true, stopped: stopStack(id) });
  startStackInBackground(id, cfg);
  return NextResponse.json({ ok: true, started: true }, { status: 202 });
}
