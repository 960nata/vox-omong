import { NextResponse } from "next/server";
import { listRoots, saveRoots } from "@/lib/terminal/roots";
import { readAudit } from "@/lib/terminal/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daftar folder kerja + (opsional) jejak audit terakhir. */
export async function GET(req: Request) {
  const withAudit = new URL(req.url).searchParams.get("audit") === "1";
  return NextResponse.json({ success: true, roots: await listRoots(), ...(withAudit ? { audit: await readAudit(100) } : {}) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body?.roots) || body.roots.some((r: unknown) => typeof r !== "string") || body.roots.length > 20) throw new Error("roots harus daftar path (maks 20).");
    return NextResponse.json({ success: true, roots: await saveRoots(body.roots) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Gagal menyimpan." }, { status: 400 });
  }
}
