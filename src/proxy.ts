import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasStudioSession, isLoopbackRequest } from "@/lib/studioAuth";

/**
 * Pengaman API VOX. Aturannya dibalik: SEMUA /api/* dijaga, kecuali daftar kecil di bawah.
 * (Chat bisa menjalankan terminal, upload menulis file, teams menjalankan agent, jadi daftar
 * "route sensitif" tidak pernah lengkap.)
 *
 * 1. Akses:
 *    - STUDIO_PIN diset: wajib sesi/PIN valid (401 jika gagal).
 *    - STUDIO_PIN kosong: hanya dari komputer ini (localhost). Header Host bisa dipalsukan dari
 *      jaringan, karena itu server dev/start hanya listen di 127.0.0.1; mode jaringan
 *      (`npm run dev:lan`, VOX_ALLOW_LAN=1) menolak semua API sampai STUDIO_PIN diisi.
 * 2. Pengaman CSRF untuk mutasi (POST, PUT, DELETE, PATCH).
 *
 * Dikecualikan:
 *  - /api/auth/pin : pintu login itu sendiri.
 *  - /api/data/*   : backend mini untuk website hasil AI; memang lintas-origin (dibatasi ukuran & jumlah).
 *  - /api/jarvis/* dan /api/wa/* : dipanggil service lain (Python / bridge WA) dan dilindungi bearer secret.
 *  - GET /api/preview : website hasil AI di iframe sandbox (origin buram, cookie tidak ikut).
 */
const OPEN_PREFIXES = ["/api/data/", "/api/jarvis/", "/api/wa/"];

function isPublic(pathname: string, method: string) {
  if (pathname === "/api/auth/pin") return true;
  if (OPEN_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return (method === "GET" || method === "HEAD") && (pathname === "/api/preview" || pathname.startsWith("/api/preview/"));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // 1. Semua API selain pengecualian wajib PIN, atau (tanpa PIN) hanya dari komputer ini
  if (method !== "OPTIONS" && !isPublic(pathname, method)) {
    const pinConfigured = Boolean(process.env.STUDIO_PIN?.trim());
    if (pinConfigured) {
      if (!hasStudioSession(req)) {
        return NextResponse.json({ success: false, error: "Akses ditolak: masukkan PIN Studio dulu." }, { status: 401 });
      }
    } else if (process.env.VOX_ALLOW_LAN === "1" || !isLoopbackRequest(req)) {
      return NextResponse.json(
        { success: false, error: "Akses dari jaringan ditolak: isi STUDIO_PIN di .env.local dulu, lalu jalankan ulang server." },
        { status: 403 }
      );
    }
  }

  // 2. Metode baca aman (kecuali yang sudah dicek di atas)
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
