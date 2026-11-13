import fs from "fs/promises";
import path from "path";
import { callLLM, parseJsonLoose } from "./codeAgent";
import { PROJECTS_BASE } from "./projects";
import { loadSkill, skillSections } from "./skillLoader";
import { newGuardedContext, saveShot } from "./browser";

/**
 * Review UI/UX untuk website di project: aturan Web Interface Guidelines (Vercel, MIT)
 * + "Avoid the AI Aesthetic" dari frontend-ui-engineering (Addy Osmani, MIT).
 * Hanya membaca file; tidak mengubah apa pun.
 */

const MAX_CHARS = 30_000;

/** Ringkas HTML tapi nomor barisnya tetap nomor baris asli: isi <script> dibuang, CSS dibatasi. */
function numbered(html: string): string {
  const lines = html.split("\n");
  const out: string[] = [];
  let inScript = false;
  let scriptStart = 0;
  let cssChars = 0;
  let inStyle = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const n = i + 1;
    if (inScript) {
      if (/<\/script>/i.test(l)) {
        inScript = false;
        out.push(`${n}: … (isi script baris ${scriptStart}-${n} disingkat) </script>`);
      }
      continue;
    }
    if (/<script\b/i.test(l) && !/<\/script>/i.test(l) && !/\bsrc=/i.test(l)) {
      inScript = true;
      scriptStart = n;
      out.push(`${n}: ${l.trim().slice(0, 200)}`);
      continue;
    }
    if (/<style\b/i.test(l)) inStyle = true;
    if (inStyle) {
      cssChars += l.length;
      if (/<\/style>/i.test(l)) inStyle = false;
      if (cssChars > 12_000 && inStyle) continue;
    }
    const t = l.trim();
    if (t) out.push(`${n}: ${t.slice(0, 400)}`);
  }
  let s = out.join("\n");
  if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS) + "\n… (dipotong)";
  return s;
}

export function detectUiReview(msg: string): boolean {
  return /\b(?:review|cek|periksa|audit|nilai|kritik)\s+(?:ui|ux|desain|design|tampilan|aksesibilitas|accessibility)(?:\s+(?:website|web|situs|halaman|project|proyek)(?:\s*ini|nya)?)?\b|\b(?:review|uji|tes|cek)\s+(?:hasil\s+)?(?:website|web|situs|halaman)(?:\s*ini|nya)?\b|\bcek\s+hasil\s+kerja\b/i.test(msg);
}

async function inspectRenderedUi(projectId: string, origin: string): Promise<string> {
  const appUrl = new URL(origin);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)) {
    throw new Error("Cek browser otomatis tersedia saat aplikasi berjalan di komputer lokal.");
  }
  const ctx = await newGuardedContext();
  try {
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => { if (errors.length < 5) errors.push(error.message.slice(0, 160)); });
    await page.goto(`${origin}/api/preview?projectId=${encodeURIComponent(projectId)}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("load", { timeout: 8000 }).catch(() => undefined);
    const inspect = async (width: number, height: number) => {
      await page.setViewportSize({ width, height });
      return page.evaluate(() => ({
        title: document.title,
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length,
        missingImageAlt: Array.from(document.images).filter((img) => !img.hasAttribute("alt")).length,
        headings: document.querySelectorAll("h1").length,
      }));
    };
    const desktop = await inspect(1280, 800);
    const shot = await saveShot(page).catch(() => undefined);
    const mobile = await inspect(390, 844);
    const issues = [
      ...(desktop.horizontalOverflow ? [`Desktop melebar ${desktop.horizontalOverflow}px`] : []),
      ...(mobile.horizontalOverflow ? [`Mobile melebar ${mobile.horizontalOverflow}px`] : []),
      ...(mobile.brokenImages ? [`${mobile.brokenImages} gambar gagal dimuat`] : []),
      ...(mobile.missingImageAlt ? [`${mobile.missingImageAlt} gambar tanpa teks alternatif`] : []),
      ...(mobile.headings === 0 ? ["Tidak ada judul utama (h1)"] : []),
      ...errors.map((error) => `Error JavaScript: ${error}`),
    ];
    return `Cek browser nyata (desktop 1280px, mobile 390px): ${issues.length ? issues.join("; ") : "tidak ditemukan masalah terukur"}.${shot ? `\n\n![Hasil render desktop](${shot})` : ""}`;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function reviewProjectUi(projectId: string, apiKey?: string, origin?: string): Promise<{ reply: string; spoken: string }> {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(projectId)) throw new Error("Project tidak valid.");
  let html = "";
  try {
    html = await fs.readFile(path.join(PROJECTS_BASE, projectId, "index.html"), "utf-8");
  } catch {
    return { reply: `Project ${projectId} belum punya website untuk direview. Bikin dulu, misalnya "buatin website kafe".`, spoken: "Belum ada website untuk direview." };
  }
  const browserReport = origin ? await inspectRenderedUi(projectId, origin).catch((error) => `Cek browser belum bisa dijalankan: ${(error as Error).message}`) : "";
  const browserAvailable = browserReport.startsWith("Cek browser nyata");
  const rules = loadSkill("web-design-guidelines", "guidelines.md").replace(/^Review these files[^\n]*\n/m, "");
  const aesthetic = skillSections("frontend-ui-engineering", ["Avoid the AI Aesthetic"]);
  const r = await callLLM({
    system: "Kamu reviewer UI/UX senior. Teliti, spesifik, tanpa basa-basi.",
    prompt: `Review website berikut terhadap ATURAN di bawah. Laporkan HANYA pelanggaran nyata yang terlihat di kode (jangan menebak, jangan melaporkan hal yang sudah benar).
Website ini memakai HTML + CSS biasa (BUKAN Tailwind): saran perbaikan harus berupa CSS/HTML biasa.
Maksimal 12 temuan, urut dari yang paling berdampak bagi pengunjung. Bahasa Indonesia.

Balas HANYA JSON:
{"findings":[{"line":<nomor baris persis dari kode>,"quote":"<potongan kode PERSIS dari baris itu, 5-60 karakter>","problem":"…","fix":"…"}],"good":["maks 3 hal yang sudah bagus"]}

ATURAN (Vercel Web Interface Guidelines):
${rules}

${aesthetic ? `TAMBAHAN (hindari estetika "AI default"):\n${aesthetic}\n` : ""}
KODE (index.html, format "nomor baris: isi"; isi script disingkat):
${numbered(html)}`,
    apiKey,
    maxTokens: 1800,
    timeoutMs: 60_000,
  }).catch((error) => {
    if (browserAvailable) return null;
    throw error;
  });
  if (!r) return { reply: browserReport, spoken: "Cek browser selesai. Detailnya di chat." };
  const j = parseJsonLoose<{ findings?: { line?: number; quote?: string; problem?: string; fix?: string }[]; good?: string[] }>(r.text);
  if (!j || !Array.isArray(j.findings)) {
    console.warn("uiReview: balasan model bukan JSON yang valid:", r.model, r.text.slice(0, 300));
    if (browserAvailable) return { reply: browserReport, spoken: "Cek browser selesai. Review kode belum terbaca." };
    throw new Error("balasan model tidak terbaca, coba lagi sebentar");
  }
  // Verifikasi: kutipan harus benar-benar ada di baris yang disebut (±2 baris). Yang tidak cocok dibuang.
  const lines = html.split("\n");
  const norm = (x: string) => x.replace(/\s+/g, " ").trim().toLowerCase();
  const verified = (j?.findings || []).filter((f) => {
    const n = Number(f.line);
    const q = norm(String(f.quote || ""));
    if (!Number.isInteger(n) || n < 1 || n > lines.length || q.length < 3 || !f.problem) return false;
    return lines.slice(Math.max(0, n - 3), n + 2).some((l) => norm(l).includes(q));
  });
  const dropped = (j?.findings?.length || 0) - verified.length;
  const good = (j?.good || []).filter(Boolean).slice(0, 3);
  const body = verified.length
    ? verified.map((f) => `• baris ${f.line}: ${String(f.problem).trim()} → ${String(f.fix || "").trim()}`).join("\n")
    : "Tidak ada pelanggaran yang bisa dipastikan dari kodenya.";
  return {
    reply: `Review UI project ${projectId} (Web Interface Guidelines dari Vercel):\n\n${browserReport ? `${browserReport}\n\n` : ""}${body}${good.length ? `\n\nYang sudah bagus:\n${good.map((g) => `• ${g}`).join("\n")}` : ""}${dropped > 0 ? `\n\n(${dropped} temuan lain kubuang karena tidak cocok dengan kode aslinya.)` : ""}`,
    spoken: verified.length ? `Ada ${verified.length} hal yang bisa diperbaiki. Detailnya di chat.` : "Gak ada masalah yang pasti. Detailnya di chat.",
  };
}
