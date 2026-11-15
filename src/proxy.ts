import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasStudioSession, isLoopbackRequest } from "@/lib/studioAuth";

/**
 * Pengaman API VOX:
 * 1. Proteksi Akses Route Sensitif (terminal, fs, browser, agent, git):
 *    - Jika STUDIO_PIN diset: wajib session cookie atau header PIN valid (401 jika gagal).
 *    - Jika STUDIO_PIN belum diset: akses non-localhost (LAN / mobile / public) ditolak (403).
 * 2. Pengaman CSRF untuk mutasi (POST, PUT, DELETE, PATCH).
 *
 * Dikecualikan dari CSRF:
 *  - /api/data/*   : backend mini untuk website hasil AI; memang lintas-origin (dibatasi ukuran & jumlah).
 *  - /api/jarvis/* dan /api/wa/* : dipanggil service lain (Python / bridge WA) dan dilindungi bearer secret.
 */
const OPEN_PREFIXES = ["/api/data/", "/api/jarvis/", "/api/wa/"];
const SENSITIVE_PREFIXES = [
  "/api/terminal",
  "/api/fs",
  "/api/browser",
  "/api/agent/",
  "/api/git",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Guard route berisiko tinggi (terminal, fs, browser, agent)
  if (SENSITIVE_PREFIXES.some((p) => pathname.startsWith(p))) {
    const pinConfigured = Boolean(process.env.STUDIO_PIN?.trim());
    if (pinConfigured) {
      if (!hasStudioSession(req)) {
        return NextResponse.json(
          { success: false, error: "Akses ditolak: PIN Studio diperlukan untuk route sensitif ini." },
          { status: 401 }
        );
      }
    } else {
      // Jika PIN belum diset, larang keras akses non-loopback (remote/LAN)
      if (!isLoopbackRequest(req)) {
        return NextResponse.json(
          {
            success: false,
            error: "Akses remote/jaringan ditolak: route sensitif (terminal, fs, browser, agent) wajib mengaktifkan STUDIO_PIN di server.",
          },
          { status: 403 }
        );
      }
    }
  }

  // 2. Metode baca aman (kecuali yang sudah dicek di atas)
  const method = req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return NextResponse.next();

  // 3. CSRF Guard untuk mutasi
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
