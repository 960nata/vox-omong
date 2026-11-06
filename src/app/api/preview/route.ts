import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawProject = searchParams.get("projectId") || "default-workspace";
    const projectId = sanitizeSlug(rawProject) || "default-workspace";

    const projectDir = path.join(PROJECTS_BASE, projectId);
    const htmlPath = path.join(projectDir, "index.html");

    // Check if index.html exists in user project
    try {
      const htmlContent = await fs.readFile(htmlPath, "utf-8");
      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } catch {
      // If index.html doesn't exist yet, generate starter template
      const projectName = projectId.replace(/-/g, " ").toUpperCase();
      const fallbackHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0b0d13] text-[#f3f4f6] font-sans min-h-screen flex items-center justify-center p-6">
  <div class="max-w-lg w-full bg-[#151821] border border-[#262c3a] rounded-[6px] p-6 shadow-2xl text-center space-y-4">
    <div class="w-12 h-12 rounded-[4px] bg-[#221c18] border border-[#ea580c]/50 text-[#f97316] flex items-center justify-center mx-auto text-xl font-bold font-mono">
      &lt;/&gt;
    </div>
    <div>
      <h2 class="text-lg font-bold font-mono text-[#f3f4f6] tracking-wide">${projectName}</h2>
      <p class="text-xs text-[#9ca3af] mt-1.5 leading-relaxed">
        Ruang kerja proyek pengguna siap digunakan. Minta Voice AI untuk membuatkan website atau salin kode ke <code class="text-[#38bdf8]">index.html</code>.
      </p>
    </div>
    <div class="p-3 bg-[#0d0f14] rounded-[4px] border border-[#232938] text-xs font-mono text-left space-y-1">
      <div class="text-[#717b8f]">💡 Tips Voice Command:</div>
      <div class="text-[#ea580c]">&bull; "Buatkan landing page modern untuk ${projectName}"</div>
      <div class="text-[#38bdf8]">&bull; "Buat komponen kartu login di project ini"</div>
    </div>
  </div>
</body>
</html>`;

      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(htmlPath, fallbackHtml, "utf-8");

      return new NextResponse(fallbackHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
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
