import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { projectDir } from "@/lib/projectDir";
import { createSession, listSessions } from "@/lib/terminal/sessions";
import { resolveInRoots } from "@/lib/terminal/roots";
import { audit } from "@/lib/terminal/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Folder awal sesi: path absolut di folder kerja, atau subfolder dari proyek aktif (sandbox). */
async function startDir(projectId?: string, cwd?: string): Promise<string> {
  if (cwd && path.isAbsolute(cwd)) {
    const inRoot = await resolveInRoots(cwd);
    if (!inRoot) throw new Error("Folder itu belum termasuk folder kerja. Tambahkan dulu di daftar folder kerja.");
    return inRoot;
  }
  const base = await fs.realpath(await projectDir(projectId));
  if (!cwd) return base;
  const target = await fs.realpath(path.resolve(base, cwd)).catch(() => null);
  if (!target || (target !== base && !target.startsWith(base + path.sep))) throw new Error("Folder harus berada di dalam proyek aktif.");
  return target;
}

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") || undefined;
  return NextResponse.json({ success: true, sessions: listSessions(projectId) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
    const cwd = typeof body.cwd === "string" ? body.cwd : undefined;
    const dir = await startDir(projectId, cwd);
    if (!(await fs.stat(dir)).isDirectory()) throw new Error("Bukan folder.");
    const session = createSession({ cwd: dir, projectId, cols: body.cols, rows: body.rows });
    await audit({ origin: "session", command: "(buka terminal interaktif)", cwd: dir, tier: "ask", allowed: true });
    return NextResponse.json({ success: true, session });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gagal membuka terminal." }, { status: 400 });
  }
}
