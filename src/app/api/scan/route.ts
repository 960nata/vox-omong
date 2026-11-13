import { NextResponse } from "next/server";
import { scanWebsite } from "@/lib/websiteScanner";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ success: false, error: "URL website wajib diisi." }, { status: 400 });
    }
    for (const name of ["selector", "projectId", "request"] as const) {
      if (body[name] !== undefined && typeof body[name] !== "string") {
        return NextResponse.json({ success: false, error: `${name} harus berupa teks.` }, { status: 400 });
      }
    }
    if (body.url.length > 4000 || (body.selector?.length || 0) > 300 || (body.projectId?.length || 0) > 200 || (body.request?.length || 0) > 2000) {
      return NextResponse.json({ success: false, error: "Permintaan terlalu panjang." }, { status: 400 });
    }
    const result = await scanWebsite({ url: body.url.trim(), selector: body.selector, projectId: body.projectId, request: body.request });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Pemindaian website gagal." }, { status: 400 });
  }
}
