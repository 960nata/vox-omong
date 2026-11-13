import { NextResponse } from "next/server";
import path from "path";
import { searchProjectCode } from "@/lib/localCodeSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECTS = path.join(process.cwd(), ".data", "user_projects");

function safeSlug(s: string) {
  return String(s || "").replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-").slice(0, 80) || "default-workspace";
}

// GET /api/codesearch?q=fungsi+deploy&projectId=default-workspace&max=8
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").slice(0, 300).trim();
  const projectId = safeSlug(url.searchParams.get("projectId") || "default-workspace");
  const max = Math.min(Number(url.searchParams.get("max") || "8"), 20);

  if (!q) return NextResponse.json({ ok: false, error: "Parameter `q` wajib diisi" }, { status: 400 });

  const projectDir = path.join(PROJECTS, projectId);
  try {
    const result = await searchProjectCode(q, projectDir, max);
    return NextResponse.json({ ok: true, query: q, projectId, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Gagal mengindeks kode" }, { status: 500 });
  }
}

// POST /api/codesearch — same but query in body (for longer queries from chat)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const q = String(body?.q || body?.query || "").slice(0, 300).trim();
    const projectId = safeSlug(body?.projectId || "default-workspace");
    const max = Math.min(Number(body?.max || 8), 20);

    if (!q) return NextResponse.json({ ok: false, error: "Field `q` atau `query` wajib diisi" }, { status: 400 });

    const projectDir = path.join(PROJECTS, projectId);
    const result = await searchProjectCode(q, projectDir, max);
    return NextResponse.json({ ok: true, query: q, projectId, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Gagal mengindeks kode" }, { status: 500 });
  }
}
