import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Pengaman CSRF untuk API yang mengubah sesuatu (terminal, file, git, vercel, upload, chat, …).
 * Website hasil AI disajikan dengan CSP sandbox (origin buram), dan situs lain di browser kamu
 * juga bisa menembak http://localhost — dua-duanya harus ditolak. Browser modern mengirim
 * Sec-Fetch-Site; kalau tidak ada, dicek lewat header Origin.
 *
 * Dikecualikan:
 *  - /api/data/*   : backend mini untuk website hasil AI; memang lintas-origin (dibatasi ukuran & jumlah).
 *  - /api/jarvis/* dan /api/wa/* : dipanggil service lain (Python / bridge WA) dan dilindungi bearer secret.
 */
const OPEN_PREFIXES = ["/api/data/", "/api/jarvis/", "/api/wa/"];

export function proxy(req: NextRequest) {
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return deny();

  const origin = req.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === req.headers.get("host");
    } catch {}
    if (!sameHost) return deny();
  }
  return NextResponse.next();
}

function deny() {
  return NextResponse.json({ success: false, error: "Permintaan lintas-origin ditolak." }, { status: 403 });
}

export const config = {
  matcher: "/api/:path*",
};
