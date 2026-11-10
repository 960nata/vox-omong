import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { injectVoxRuntime } from "@/lib/voxRuntime";

const PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function starterHtml(projectId: string) {
  const name = projectId.replace(/-/g, " ");
  const ideas = [
    "Bikinin landing page untuk kedai kopi",
    "Buat dashboard penjualan toko online",
    "Bikin game tebak angka",
    "Buat aplikasi to-do list",
  ];
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} · Preview</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#08080a;color:#f5f5fa;font-family:system-ui,sans-serif;background-image:radial-gradient(60vmax 40vmax at 20% 0,rgba(200,255,46,.25),transparent),radial-gradient(40vmax 30vmax at 90% 100%,rgba(255,91,46,.18),transparent)}
  .card{max-width:460px;text-align:center}
  .orb{width:56px;height:56px;margin:0 auto 22px;border:1.5px solid #c8ff2e;border-radius:50%;box-shadow:0 0 0 8px #c8ff2e14;animation:f 2.4s ease-in-out infinite}
  @keyframes f{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.06)}}
  @media (prefers-reduced-motion:reduce){.orb{width:56px;height:56px;margin:0 auto 22px;border:1.5px solid #c8ff2e;border-radius:50%;box-shadow:0 0 0 8px #c8ff2e14;animation:f 2.4s ease-in-out infinite}}
  h1{font-size:30px;line-height:1.1;margin:0 0 8px;letter-spacing:-.02em}
  p{color:#84848f;margin:0 0 18px;line-height:1.6}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  li{padding:7px 12px;border-radius:4px;background:#111115;border:1px solid #34343f;font-size:13px}
</style></head>
<body><div class="card"><div class="orb"></div>
<h1>Belum ada website di sini</h1>
<p>Minta AI bikinin lewat chat atau suara. Hasilnya langsung muncul di panel ini.</p>
<ul>${ideas.map((i) => `<li>"${i}"</li>`).join("")}</ul>
</div></body></html>`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawProject = searchParams.get("projectId") || "default-workspace";
    const projectId = sanitizeSlug(rawProject) || "default-workspace";

    const projectDir = path.join(PROJECTS_BASE, projectId);
    const htmlPath = path.join(projectDir, "index.html");

    const starter = starterHtml(projectId);
    // Origin buram (sandbox): halaman buatan AI tidak bisa membaca storage/cookie app ini atau memanggil API-nya
    // sebagai same-origin. frame-ancestors: hanya app ini yang boleh membingkai preview.
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    try {
      const htmlContent = await fs.readFile(htmlPath, "utf-8");
      // Kartu "STUDIO PRO-INTERFACE" lama dari versi palsu sebelumnya → tampilkan halaman awal
      const isLegacyPlaceholder =
        htmlContent.includes("STUDIO PRO-INTERFACE") ||
        htmlContent.includes("Ruang kerja proyek pengguna siap digunakan") ||
        htmlContent.includes("Project Workspace Active & Ready");
      if (isLegacyPlaceholder) return new NextResponse(starter, { headers });
      // Website hasil AI mendapat backend mini (window.VOX); file lain disajikan apa adanya
      const origin = new URL(req.url).origin;
      const served = htmlContent.includes("<!-- vox-ai:generated -->") ? injectVoxRuntime(htmlContent, projectId, origin) : htmlContent;
      return new NextResponse(served, { headers });
    } catch {
      await fs.mkdir(projectDir, { recursive: true });
      return new NextResponse(starter, { headers });
    }
  } catch (err: any) {
    return new NextResponse(`<html><body><h3>Preview Error</h3><p>${err.message}</p></body></html>`, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(req: Request) {
  try {
    const { projectId = "default-workspace", html } = await req.json();
    if (!html || typeof html !== "string") {
      return NextResponse.json({ success: false, error: "HTML content required" }, { status: 400 });
    }

    const safeId = sanitizeSlug(projectId) || "default-workspace";
    const projectDir = path.join(PROJECTS_BASE, safeId);
    const htmlPath = path.join(projectDir, "index.html");

    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(htmlPath, html, "utf-8");

    return NextResponse.json({
      success: true,
      message: "Preview project berhasil diperbarui!",
      url: `/api/preview?projectId=${safeId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
