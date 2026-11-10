import fs from "fs/promises";
import path from "path";
import { callLLM, parseJsonLoose } from "./codeAgent";
import { PROJECTS_BASE } from "./projects";
import { loadSkill, skillSections } from "./skillLoader";

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
  return /\b(?:review|cek|periksa|audit|nilai|kritik)\s+(?:ui|ux|desain|design|tampilan|aksesibilitas|accessibility)(?:\s+(?:website|web|situs|halaman|project|proyek)(?:\s*ini|nya)?)?\b|\breview\s+(?:website|web|situs|halaman)(?:\s*ini|nya)?\b/i.test(msg);
}

export async function reviewProjectUi(projectId: string, apiKey?: string): Promise<{ reply: string; spoken: string }> {
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(projectId)) throw new Error("Project tidak valid.");
  let html = "";
  try {
    html = await fs.readFile(path.join(PROJECTS_BASE, projectId, "index.html"), "utf-8");
  } catch {
    return { reply: `Project ${projectId} belum punya website untuk direview. Bikin dulu, misalnya "buatin website kafe".`, spoken: "Belum ada website untuk direview." };
  }
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
  });
  const j = parseJsonLoose<{ findings?: { line?: number; quote?: string; problem?: string; fix?: string }[]; good?: string[] }>(r.text);
  if (!j || !Array.isArray(j.findings)) {
    console.warn("uiReview: balasan model bukan JSON yang valid:", r.model, r.text.slice(0, 300));
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
    reply: `Review UI project ${projectId} (Web Interface Guidelines dari Vercel):\n\n${body}${good.length ? `\n\nYang sudah bagus:\n${good.map((g) => `• ${g}`).join("\n")}` : ""}${dropped > 0 ? `\n\n(${dropped} temuan lain kubuang karena tidak cocok dengan kode aslinya.)` : ""}`,
    spoken: verified.length ? `Ada ${verified.length} hal yang bisa diperbaiki. Detailnya di chat.` : "Gak ada masalah yang pasti. Detailnya di chat.",
  };
}
