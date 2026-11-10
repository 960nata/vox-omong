import fs from "fs/promises";
import path from "path";
import { searchPhotos, searchVideos, trackPhotoUse, describeMedia, type MediaPack, type Photo, type Video } from "./media";
import { DESIGN_RULES, MOTION_RECIPES, planDesign, describePlan, type DesignPlan } from "./designKnowledge";
import { designBrief, topUxRules } from "./uiuxKnowledge";
import { loadSkill, skillSections } from "./skillLoader";
import { VOX_PROMPT } from "./voxRuntime";
import { repairInlineScripts } from "./jsRepair";

/**
 * Code agent: menghasilkan / mengedit website satu-file (HTML + Tailwind CDN + JS)
 * pakai LLM sungguhan, lalu menyimpannya ke project user agar tampil di Preview.
 */

const USER_PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");
export const GENERATED_MARKER = "<!-- vox-ai:generated -->";

export function sanitizeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "default-workspace"
  );
}

// ---------------------------------------------------------------- intent

const DOC_WORDS = /\b(ppt|pptx|powerpoint|slide|presentasi|pitch deck|invoice|tagihan|faktur|kwitansi|excel|spreadsheet|csv|pdf|surat|proposal|laporan|dokumen|makalah|artikel|esai|kontrak|cv|resume)\b/i;
const MAKE_WORDS = /\b(buat|bikin|buatin|bikinin|buatkan|bikinkan|generate|create|make|build|rancang|desain(?:kan)?|coding(?:in)?|kodein)\b/i;
const WEB_WORDS =
  /\b(web|website|situs|landing|landing ?page|halaman|page|dashboard|html|aplikasi|app|kalkulator|calculator|game|permainan|form|formulir|portfolio|portofolio|toko|shop|ui|tampilan|komponen|component|todo|to-do|kuis|quiz|timer|stopwatch|jam|galeri|gallery|blog|profil|company profile|undangan|menu)\b/i;
const EDIT_WORDS =
  /\b(ubah|ganti|gantiin|tambah|tambahin|tambahkan|hapus|buang|perbaiki|benerin|betulin|edit|update|revisi|perbesar|perkecil|warna(?:nya)?|font(?:nya)?|section|bagian|tombol(?:nya)?|jadiin|jadikan|bikin(?:in)? (?:lebih|jadi)|kurang|kurangi|pindah(?:in|kan)?|rapihin|rapikan|percantik)\b/i;

export type CodeIntent = "create" | "edit" | null;

export function detectCodeIntent(message: string, hasGeneratedSite: boolean): CodeIntent {
  const m = message.toLowerCase();
  if (DOC_WORDS.test(m)) return null;
  if (MAKE_WORDS.test(m) && WEB_WORDS.test(m)) {
    // "bikin lebih gelap" pada situs yang sudah ada = edit
    if (hasGeneratedSite && EDIT_WORDS.test(m) && !/\b(baru|lain|new)\b/.test(m) && !/\b(website|landing|aplikasi|app|game|dashboard)\b/.test(m)) {
      return "edit";
    }
    return "create";
  }
  if (hasGeneratedSite && EDIT_WORDS.test(m)) return "edit";
  // perintah singkat untuk tampilan: "mode gelap", "jadi terang", "gaya mewah", "tema hijau" (pendek supaya tidak salah tangkap obrolan biasa)
  if (hasGeneratedSite && m.trim().split(/\s+/).length <= 7 && /\b(gelap|terang|dark|light|mode|tema|gaya|nuansa|tampilan)\b/.test(m)) return "edit";
  return null;
}

// ---------------------------------------------------------------- project io

export async function readProjectHtml(projectId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(USER_PROJECTS_BASE, sanitizeSlug(projectId), "index.html"), "utf-8");
  } catch {
    return null;
  }
}

export async function hasGeneratedSite(projectId: string): Promise<boolean> {
  const html = await readProjectHtml(projectId);
  return !!html && html.includes(GENERATED_MARKER);
}

export async function writeProjectHtml(projectId: string, html: string) {
  const dir = path.join(USER_PROJECTS_BASE, sanitizeSlug(projectId));
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  // simpan versi sebelumnya supaya bisa dibatalkan
  try {
    const prev = await fs.readFile(file, "utf-8");
    await fs.writeFile(path.join(dir, "index.prev.html"), prev, "utf-8");
  } catch {}
  await fs.writeFile(file, html, "utf-8");
}

// ---------------------------------------------------------------- llm

const LLM_CACHE = new Map<string, { text: string; model: string; t: number }>();

export async function callLLM({
  system,
  prompt,
  apiKey,
  maxTokens,
  prefer,
  timeoutMs,
  json,
  temperature,
  fast,
}: {
  /** Minta keluaran JSON murni (mode JSON asli di Gemini). */
  json?: boolean;
  /** 0-1. Default 0.6 (0.2 bila json). Rendah = lebih patuh format. */
  temperature?: number;
  /** Tugas kecil: matikan "thinking" Gemini supaya cepat dan hemat token. */
  fast?: boolean;
  system: string;
  prompt: string;
  apiKey?: string;
  maxTokens: number;
  /** Batas waktu total per panggilan (ms). Panggilan yang lewat dianggap gagal. */
  timeoutMs?: number;
  /** Provider gateway yang didahulukan untuk peran ini (mis. ["gemini"]). Diabaikan bila gateway belum mendukung. */
  prefer?: string[];
}): Promise<{ text: string; model: string }> {
  const key = apiKey || process.env.AI_GATEWAY_KEY || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) || "";
  const errors: string[] = [];
  const temp = temperature ?? (json ? 0.2 : 0.6);
  const cacheKey = temp <= 0.3 ? `${maxTokens}|${system}|${prompt}` : "";
  if (cacheKey) {
    const hit = LLM_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.t < 10 * 60_000) return { text: hit.text, model: hit.model };
  }
  const done = (text: string, model: string) => {
    if (cacheKey) {
      LLM_CACHE.set(cacheKey, { text, model, t: Date.now() });
      if (LLM_CACHE.size > 80) LLM_CACHE.delete(LLM_CACHE.keys().next().value as string);
    }
    return { text, model };
  };

  // 1. Google Gemini (dipakai kalau ada key AIzaSy… — paling bagus untuk kode panjang)
  const geminiKey = key.startsWith("AIzaSy") ? key : (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (geminiKey) {
    // Kena limit (429) atau server sibuk (500/503): tunggu sebentar lalu coba sekali lagi
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: temp,
                maxOutputTokens: fast ? Math.max(maxTokens, 1024) : Math.max(maxTokens, 16000),
                ...(json ? { responseMimeType: "application/json" } : {}),
                ...(fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
              },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = (data.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
          if (text.trim()) return done(text, "gemini-2.5-flash");
          errors.push("Gemini: respons kosong");
          break;
        }
        errors.push(`Gemini ${res.status}`);
        if (attempt === 0 && [429, 500, 503].includes(res.status)) {
          await new Promise((r) => setTimeout(r, res.status === 429 ? 2500 : 1200));
          continue;
        }
        break;
      } catch (err) {
        errors.push(`Gemini: ${(err as Error).message}`);
        break;
      }
    }
  }

  // 2. AI Gateway (aigw_…) — gateway melakukan failover antar model; coba ulang sekali bila 5xx
  const gwKey = key.startsWith("aigw_") ? key : process.env.AI_GATEWAY_KEY;
  if (gwKey) {
    const url = process.env.AI_GATEWAY_URL || "https://aiinvestdesk.com/api/v1/ai/gateway";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${gwKey}` },
          body: JSON.stringify({
            agent: "custom",
            // `system` & `prefer` dipakai gateway versi baru; prompt tetap memuat system untuk versi lama
            system,
            prefer,
            prompt: `${system}\n\n=====\n\n${prompt}${json ? "\n\nBalas HANYA JSON valid. Tanpa teks lain, tanpa pagar kode." : ""}`,
            temperature: temperature ?? (json ? 0.2 : 0.55),
            json,
            maxTokens,
          }),
        });
        if (res.ok) {
          const out = await res.json();
          const text = out?.data?.response || (typeof out?.data === "string" ? out.data : "");
          if (text && typeof text === "string") return done(text, out?.meta?.model || "ai-gateway");
          errors.push("Gateway: respons kosong");
        } else {
          errors.push(`Gateway ${res.status}`);
          if (res.status < 500) break;
        }
      } catch (err) {
        errors.push(`Gateway: ${(err as Error).message}`);
      }
    }
  }

  throw new Error(errors.length ? errors.join(" · ") : "Belum ada API key AI. Isi di Pengaturan atau .env");
}

// ---------------------------------------------------------------- prompts

const SYSTEM_PROMPT = `Kamu adalah front-end engineer + desainer senior yang membangun website lengkap (tampilan + interaksi + data tersimpan). Tugasmu menulis SATU file HTML lengkap yang langsung jalan di browser.

ATURAN TOPIK (paling penting):
- Topik, nama brand, dan seluruh konten HANYA berasal dari PERMINTAAN USER.
- Abaikan identitas/brand/persona lain dari instruksi sistem mana pun (misalnya "AI Investdesk", platform investasi, saham) kecuali user sendiri memintanya.

ATURAN TEKNIS (wajib):
- Output HANYA satu blok \`\`\`html ... \`\`\` berisi dokumen utuh dari <!DOCTYPE html> sampai </html>. Tanpa penjelasan di luar blok.
- Baris pertama di dalam <head> adalah komentar: <!-- SUMMARY: (1 kalimat Bahasa Indonesia santai, apa yang dibuat/diubah) -->
- Pakai Tailwind lewat <script src="https://cdn.tailwindcss.com"></script> untuk utilitas, tapi warna, font, dan token utama didefinisikan sebagai CSS variables di :root (jangan hanya kelas Tailwind bawaan yang seragam).
- Muat font dengan <link> Google Fonts sesuai rencana desain. Semua JavaScript inline di <script> di akhir body, vanilla JS, tanpa framework, tanpa build step.
- Gambar: pakai FOTO NYATA yang diberikan di bagian aset (URL persis). Bila tidak ada aset, pakai https://picsum.photos/seed/<kata-unik>/<lebar>/<tinggi>, SVG, atau gradien inline. Ikon: SVG inline dengan stroke konsisten.
- Responsif dari 360px sampai desktop. Tidak boleh ada scroll horizontal.
- Semua tombol, menu, form, tab, modal, filter, dan keranjang harus BENAR-BENAR berfungsi dengan JS (bukan hiasan).
- Jangan potong kode, jangan pakai placeholder "...". Tulis lengkap. Isi konten realistis sesuai topik dalam Bahasa Indonesia kecuali diminta lain; jangan mengarang testimoni dengan nama orang sungguhan atau angka klaim yang menyesatkan.

${VOX_PROMPT}

ATURAN DESAIN:
- Buat terlihat seperti produk nyata yang dirancang dengan sengaja, bukan template generik. Hindari tampilan "AI default": gradasi ungu-biru, kartu abu seragam, ikon emoji sebagai dekorasi, hero dengan tiga kartu fitur di bawahnya tanpa ide.
- Ikuti RENCANA DESAIN yang diberikan (font, palet, bagian halaman, elemen khas) dan buat SATU elemen khas yang benar-benar diingat.
${DESIGN_RULES}
${MOTION_RECIPES}`;

// Skill frontend-design (Anthropic, Apache-2.0) + bagian frontend-ui-engineering (Addy Osmani, MIT).
// Brief/rencana desain dari user tetap menang; skill ini mengarahkan pilihan yang dibiarkan bebas.
const SKILL_GUIDE = [
  loadSkill("frontend-design"),
  skillSections("frontend-ui-engineering", ["Avoid the AI Aesthetic", "Meaningful Empty and Error States"]),
]
  .filter(Boolean)
  .join("\n\n");
const GEN_SYSTEM = SKILL_GUIDE ? `${SYSTEM_PROMPT}\n\nPANDUAN SKILL (bahasa Inggris; ikuti bila tidak bertentangan dengan rencana desain & permintaan user):\n${SKILL_GUIDE}` : SYSTEM_PROMPT;

// Arah desain yang dirotasi supaya setiap hasil terasa beda (kecuali user menyebut gaya sendiri)
const DESIGN_DIRECTIONS = [
  "Editorial majalah: tipografi serif besar dan dramatis, grid asimetris, banyak ruang putih, aksen satu warna tegas.",
  "Neo-brutalism: blok warna cerah, border hitam tebal, bayangan offset keras, font grotesk tebal, terasa berani dan playful.",
  "Soft pastel organik: bentuk blob, sudut sangat membulat, gradasi lembut, ilustrasi SVG sederhana, terasa ramah.",
  "Dark luxury: latar hampir hitam, aksen emas/tembaga, serif elegan, garis tipis, animasi reveal yang pelan.",
  "Swiss minimal: grid ketat, sans-serif tegas, hitam-putih dengan satu warna aksen primer, angka besar sebagai elemen visual.",
  "Retro 70-an: palet oranye-coklat-mustard, font display bulat, bentuk melengkung, tekstur grain halus.",
  "Futuristik tech: latar gelap, aksen neon, grid/garis koordinat, font mono untuk detail, efek glow secukupnya.",
  "Nusantara modern: motif geometris terinspirasi batik/tenun sebagai ornamen, palet indigo-terakota-krem, serif berkarakter.",
  "Kertas & kolase: latar seperti kertas, elemen sedikit miring, stiker/label, font tulisan tangan untuk aksen.",
  "Glass & gradient cerah: gradien mesh berwarna, kartu kaca blur, sans-serif modern, nuansa produk SaaS premium.",
];

const STYLE_HINT = /\b(gelap|dark|terang|light|minimal|minimalis|elegan|mewah|luxury|retro|vintage|brutal|neon|pastel|warna|tema|style|gaya|nuansa)\b/i;

function pickDirection(request: string) {
  return STYLE_HINT.test(request)
    ? "Ikuti gaya yang diminta user."
    : DESIGN_DIRECTIONS[Math.floor(Math.random() * DESIGN_DIRECTIONS.length)];
}

function buildCreatePrompt(request: string, context: string, direction: string) {
  return `${context ? `KONTEKS PERCAKAPAN:\n${context}\n\n` : ""}PERMINTAAN USER:\n${request}\n\nARAH DESAIN UNTUK HASIL INI:\n${direction}\n\nBuat website-nya sekarang.`;
}

function buildEditPrompt(request: string, html: string) {
  return `Ini file index.html yang sekarang:\n\n\`\`\`html\n${html}\n\`\`\`\n\nPERMINTAAN PERUBAHAN DARI USER:\n${request}\n\nTerapkan perubahan itu. Pertahankan semua bagian lain yang tidak diminta untuk diubah. Kembalikan file HTML LENGKAP yang sudah diperbarui (bukan potongan), dengan komentar SUMMARY baru yang menjelaskan apa yang diubah.`;
}

// ---------------------------------------------------------------- parse

/** Ambil HTML dari balasan model. `complete` = sudah sampai </html>. */
function extractHtml(text: string): { html: string; complete: boolean } | null {
  const fenced = text.match(/```(?:html)?\s*\n([\s\S]*?)(?:```|$)/i);
  let html = fenced ? fenced[1] : text;
  const start = html.search(/<!DOCTYPE html|<html/i);
  if (start === -1) return null;
  html = html.slice(start).trimEnd();
  const end = html.search(/<\/html>/i);
  if (end !== -1) return { html: html.slice(0, end + 7), complete: true };
  return { html, complete: false };
}

function closeHtml(html: string) {
  if (!/<\/body>/i.test(html)) html += "\n</body>";
  return html + "\n</html>";
}

/** Gabungkan lanjutan, buang bagian yang tumpang tindih dengan akhir potongan sebelumnya. */
function joinContinuation(prev: string, next: string) {
  let cont = next.replace(/^\s*```(?:html)?[ \t]*\n?/i, "").replace(/\n?```[\s\S]*$/, "");
  const tail = prev.slice(-400);
  for (let len = Math.min(400, cont.length); len >= 20; len--) {
    if (tail.endsWith(cont.slice(0, len))) {
      cont = cont.slice(len);
      break;
    }
  }
  return prev + cont;
}

function extractSummary(html: string): string {
  const m = html.match(/<!--\s*SUMMARY:\s*([\s\S]*?)-->/i);
  return m ? m[1].trim() : "";
}

/** Pada edit, model sering lupa memperbarui komentar SUMMARY. Kalau sama dengan versi lama, pakai catatan mekanis dari langkah developer. */
function freshSummary(html: string, previous: string | null, editing: boolean, meeting: { role: string; note: string }[]): string {
  const now = extractSummary(html);
  if (!editing) return now;
  if (now && (!previous || now !== extractSummary(previous))) return now;
  const dev = meeting.find((m) => m.role === "developer");
  return dev ? `${dev.note}.` : "Perubahan diterapkan.";
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : "Website";
}

function withMarker(html: string) {
  if (html.includes(GENERATED_MARKER)) return html;
  return html.replace(/<head([^>]*)>/i, `<head$1>\n  ${GENERATED_MARKER}`);
}

// ---------------------------------------------------------------- main

export interface MeetingTurn {
  role: "arsitek" | "aset" | "developer" | "reviewer" | "revisi";
  agent: string;
  model: string;
  note: string;
  durationMs: number;
}

export interface WebsiteBuildResult {
  html: string;
  title: string;
  summary: string;
  model: string;
  mode: "create" | "edit";
  previewUrl: string;
  projectId: string;
  lines: number;
  previousLines: number;
  durationMs: number;
  meeting: MeetingTurn[];
  score?: number;
  /** Temuan yang diukur mesin (bukan klaim model) dan belum beres. */
  warnings: string[];
}

/** Satu putaran menulis HTML lengkap (dengan lanjutan otomatis bila terpotong). */
/** Tiap peran rapat didahulukan ke provider berbeda supaya saling melengkapi. */
export const ROLE_PREFER: Record<string, string[]> = {
  arsitek: ["groq", "cerebras", "openrouter"],
  developer: ["gemini", "openrouter"],
  reviewer: ["openrouter", "nvidia", "groq"],
  revisi: ["gemini", "openrouter"],
};

// Gateway memutus permintaan > ~60 detik, jadi output diminta per potongan lalu disambung
const CHUNK_TOKENS = 4000;

async function writeHtml(prompt: string, apiKey?: string, prefer = ROLE_PREFER.developer): Promise<{ html: string; model: string }> {
  let { text, model } = await callLLM({ system: GEN_SYSTEM, prompt, apiKey, maxTokens: CHUNK_TOKENS, prefer });
  let parsed = extractHtml(text);
  if (!parsed) {
    ({ text, model } = await callLLM({
      system: GEN_SYSTEM,
      prompt: `${prompt}\n\nPENTING: balas HANYA dengan satu blok \`\`\`html berisi dokumen HTML lengkap.`,
      apiKey,
      maxTokens: CHUNK_TOKENS,
      prefer,
    }));
    parsed = extractHtml(text);
  }
  if (!parsed) throw new Error("AI tidak mengembalikan kode HTML yang valid. Coba ulangi dengan permintaan yang lebih jelas.");

  let html = parsed.html;
  let complete = parsed.complete;
  for (let round = 0; round < 6 && !complete; round++) {
    const cont = await callLLM({
      system: "Kamu melanjutkan penulisan sebuah file HTML yang terpotong. Balas HANYA dengan kode lanjutannya, tanpa penjelasan, tanpa ``` dan tanpa mengulang bagian yang sudah ada.",
      prompt: `Ini bagian AKHIR dari file yang terpotong:\n\n${html.slice(-2500)}\n\nLanjutkan PERSIS dari karakter terakhir di atas sampai file selesai dengan </html>.`,
      apiKey,
      maxTokens: CHUNK_TOKENS,
      prefer,
    });
    html = joinContinuation(html, cont.text);
    const end = html.search(/<\/html>/i);
    if (end !== -1) {
      html = html.slice(0, end + 7);
      complete = true;
    }
  }
  if (!complete) html = closeHtml(html);
  return { html, model };
}

export function parseJsonLoose<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// Konten bawaan gateway yang kadang bocor ke hasil model
const LEAK = /investdesk|platform investasi|investasi cerdas/i;
function isOffTopic(html: string, request: string) {
  return LEAK.test(html) && !LEAK.test(request) && !/invest|saham|reksa/i.test(request);
}

/** Perintah eksplisit "ganti X jadi Y" diterapkan langsung ke semua kemunculan (termasuk slug, mis. email/domain). */
/** "ganti warna jadi hijau", "ubah font ke serif": perintah gaya/struktur, BUKAN ganti kata di isi halaman. */
const NOT_A_RENAME = /^(?:semua\s+)?(?:warna|color|colou?r|font|huruf|tipografi|tema|theme|gaya|style|latar|background|bg|mode|tampilan|foto|gambar|image|video|ukuran|size|layout|tata\s*letak|desain|design|judul|tombol|button|aksen|accent|palet|palette|nuansa|section|bagian|menu\s+navigasi|logo)\b/i;

export function applyDirectRenames(html: string, request: string) {
  const re = /(?:ganti|ubah|rename|replace)\s+(?:semua\s+)?(?:nama\s+|tulisan\s+|teks\s+|kata\s+)?["'“]?(.+?)["'”]?\s+(?:jadi|menjadi|ke|dengan|with|to)\s+["'“]?(.+?)["'”]?(?=\s+(?:dan|terus|lalu|serta|and)\s|[.,;!]|$)/gi;
  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  let out = html;
  const done: string[] = [];
  for (const m of request.matchAll(re)) {
    const from = m[1].trim();
    const to = m[2].trim();
    if (from.length < 3 || !to || NOT_A_RENAME.test(from) || !new RegExp(escape(from), "i").test(out)) continue;
    out = out.replace(new RegExp(escape(from), "gi"), to);
    if (slug(from).length >= 4 && slug(from) !== from.toLowerCase()) out = out.replace(new RegExp(escape(slug(from)), "gi"), slug(to));
    done.push(`"${from}" → "${to}"`);
  }
  return { html: out, done };
}

// Kata khas persona gateway (platform investasi). \binvest… menangkap investasi/investor/investing/InvestDesk; "invest<span" menangkap logo yang dipecah tag.
export const LEAK_LINE = /\binvest(?:asi|or|ing|ment|desk)?\b|invest\s*<span|saham|reksa ?dana|dividen|\bcuan\b|portofolio|\btrading\b/i;

/** Baris yang tampil di halaman dan membawa teks nyasar (komentar HTML tidak dihitung). */
export function leakLines(html: string): string[] {
  return html.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("<!--") && LEAK_LINE.test(l));
}

/** Baris yang membawa teks nyasar dari persona gateway: minta model menulis ulang teksnya saja (output kecil). */
async function scrubLeaks(html: string, request: string, apiKey?: string): Promise<{ html: string; replaced: number; remaining: number }> {
  if (LEAK_LINE.test(request)) return { html, replaced: 0, remaining: 0 };
  const hits = [...new Set(leakLines(html).filter((l) => l.length > 3 && l.length < 400))].slice(0, 8);
  if (!hits.length) return { html, replaced: 0, remaining: 0 };
  const { text } = await callLLM({
    system: "Kamu editor teks website. Balas HANYA JSON valid.",
    prompt: `Website ini tentang: "${request}". Baris HTML berikut berisi teks yang SALAH TOPIK (nyasar dari topik investasi). Tulis ulang HANYA teksnya supaya sesuai topik website; pertahankan semua tag, atribut, kelas, dan struktur persis sama.
Skema: {"ganti":[{"cari":"<baris asli persis>","ganti":"<baris baru>"}]}

${hits.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
    apiKey,
    maxTokens: 1200,
    timeoutMs: 40_000,
    prefer: ROLE_PREFER.developer,
  });
  const parsed = parseJsonLoose<{ ganti?: { cari: string; ganti: string }[] }>(text);
  const { html: out, applied } = applyPatches(html, parsed?.ganti || []);
  const remaining = leakLines(out).length;
  return { html: out, replaced: applied, remaining };
}

// ---- Peserta rapat

// ---- Sisipan deterministik: hal yang bisa dibuat kode tidak boleh bergantung pada model
const esc = (x: string) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function onColor(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.58 ? "#0b0b0b" : "#ffffff";
}

function videoSection(v: Video, accent: string): string {
  return `
<section id="vox-video" aria-label="Video">
<style>
#vox-video{padding:clamp(56px,9vw,120px) clamp(16px,5vw,64px);max-width:1100px;margin:0 auto;color:inherit;font-family:inherit}
#vox-video h2{font-size:clamp(28px,4vw,44px);line-height:1.1;letter-spacing:-.02em;margin:0 0 8px;font-weight:700}
#vox-video .sub{opacity:.7;margin:0 0 24px;max-width:60ch}
#vox-video .frame{position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;background:#000;box-shadow:0 30px 60px -30px rgba(0,0,0,.55)}
#vox-video .frame img,#vox-video .frame iframe{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0}
#vox-video .play{position:absolute;inset:0;width:100%;display:grid;place-items:center;border:0;cursor:pointer;background:linear-gradient(to top,rgba(0,0,0,.5),rgba(0,0,0,.05))}
#vox-video .play span{width:78px;height:78px;border-radius:50%;background:${accent};color:${onColor(accent)};display:grid;place-items:center;transition:transform .25s ease}
#vox-video .play:hover span,#vox-video .play:focus-visible span{transform:scale(1.1)}
#vox-video .credit{font-size:13px;opacity:.65;margin-top:12px}
#vox-video .credit a{color:inherit;text-underline-offset:3px}
</style>
<h2>Tonton ceritanya</h2>
<p class="sub">${esc(v.title)}</p>
<div class="frame" id="vox-video-frame" data-embed="${esc(v.embed)}" data-title="${esc(v.title)}">
<img src="${esc(v.thumb)}" alt="Thumbnail video: ${esc(v.title)}" loading="lazy">
<button class="play" type="button" aria-label="Putar video"><span><svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></button>
</div>
<p class="credit">Video: ${esc(v.title)} · ${esc(v.channel)} di YouTube · <a href="${esc(v.watch)}" target="_blank" rel="noopener">Buka di YouTube</a></p>
<script>
(function(){var f=document.getElementById('vox-video-frame');if(!f)return;var b=f.querySelector('.play');
b.addEventListener('click',function(){var i=document.createElement('iframe');i.src=f.dataset.embed+'?autoplay=1&rel=0';i.title=f.dataset.title;
i.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');i.setAttribute('allowfullscreen','');f.innerHTML='';f.appendChild(i);});})();
</script>
</section>`;
}

type FormKind = { coll: string; title: string; sub: string; button: string; fields: string };

function formKind(request: string): FormKind {
  const field = (name: string, label: string, type = "text", extra = "") =>
    `<label><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
  if (/\b(reservasi|booking|pesan meja|meja)\b/i.test(request)) {
    return {
      coll: "reservasi",
      title: "Reservasi meja",
      sub: "Isi data singkat, kami konfirmasi lewat WhatsApp.",
      button: "Kirim reservasi",
      fields: [field("nama", "Nama", "text", "required autocomplete=\"name\""), field("whatsapp", "WhatsApp", "tel", "required autocomplete=\"tel\""), field("tanggal", "Tanggal", "date", "required"), field("jam", "Jam", "time", "required"), field("jumlah", "Jumlah orang", "number", "min=\"1\" max=\"30\" value=\"2\" required"), `<label class="wide"><span>Catatan (opsional)</span><textarea name="catatan" rows="3"></textarea></label>`].join(""),
    };
  }
  if (/\b(daftar|pendaftaran|rsvp|registrasi)\b/i.test(request)) {
    return {
      coll: "pendaftaran",
      title: "Daftar sekarang",
      sub: "Isi data di bawah, kami hubungi dalam 1×24 jam.",
      button: "Kirim pendaftaran",
      fields: [field("nama", "Nama lengkap", "text", "required autocomplete=\"name\""), field("email", "Email", "email", "required autocomplete=\"email\""), field("whatsapp", "WhatsApp", "tel", "autocomplete=\"tel\""), `<label class="wide"><span>Catatan (opsional)</span><textarea name="catatan" rows="3"></textarea></label>`].join(""),
    };
  }
  return {
    coll: "pesan-kontak",
    title: "Hubungi kami",
    sub: "Tulis pesanmu, kami balas secepatnya.",
    button: "Kirim pesan",
    fields: [field("nama", "Nama", "text", "required autocomplete=\"name\""), field("email", "Email", "email", "required autocomplete=\"email\""), `<label class="wide"><span>Pesan</span><textarea name="pesan" rows="4" required></textarea></label>`].join(""),
  };
}

function formSection(request: string, accent: string): string {
  const k = formKind(request);
  return `
<section id="vox-form-sec" aria-label="${esc(k.title)}">
<style>
#vox-form-sec{padding:clamp(56px,9vw,120px) clamp(16px,5vw,64px);max-width:760px;margin:0 auto;color:inherit;font-family:inherit}
#vox-form-sec h2{font-size:clamp(28px,4vw,44px);line-height:1.1;letter-spacing:-.02em;margin:0 0 8px;font-weight:700}
#vox-form-sec .sub{opacity:.7;margin:0 0 28px}
#vox-form{display:grid;grid-template-columns:1fr 1fr;gap:16px}
#vox-form label{display:grid;gap:6px;font-size:14px;font-weight:600}
#vox-form .wide{grid-column:1/-1}
#vox-form input,#vox-form textarea{font:inherit;color:inherit;background:color-mix(in srgb,currentColor 6%,transparent);border:1.5px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:12px;padding:12px 14px;min-height:46px;transition:border-color .2s,box-shadow .2s}
#vox-form input:focus,#vox-form textarea:focus{outline:0;border-color:${accent};box-shadow:0 0 0 4px color-mix(in srgb,${accent} 25%,transparent)}
#vox-form button{grid-column:1/-1;font:inherit;font-weight:700;border:0;cursor:pointer;border-radius:999px;padding:14px 26px;background:${accent};color:${onColor(accent)};transition:transform .2s,opacity .2s}
#vox-form button:hover{transform:translateY(-1px)}#vox-form button:disabled{opacity:.6;cursor:wait}
#vox-form-ok{margin-top:18px;padding:14px 16px;border-radius:12px;background:color-mix(in srgb,${accent} 16%,transparent);font-weight:600}
@media(max-width:560px){#vox-form{grid-template-columns:1fr}}
</style>
<h2>${esc(k.title)}</h2>
<p class="sub">${esc(k.sub)}</p>
<form id="vox-form" data-vox="1">${k.fields}<button type="submit">${esc(k.button)}</button></form>
<p id="vox-form-ok" role="status" hidden>Terkirim! Terima kasih, datamu sudah kami terima.</p>
<script>
(function(){var f=document.getElementById('vox-form'),ok=document.getElementById('vox-form-ok');if(!f)return;
var save=(window.VOX&&VOX.save)?VOX.save.bind(VOX):function(){return Promise.resolve({ok:true})};
f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button[type=submit]'),t=b.textContent;b.disabled=true;b.textContent='Mengirim…';
var d={};new FormData(f).forEach(function(v,k){if(typeof v==='string')d[k]=v;});
save(${JSON.stringify(k.coll)},d).then(function(){ok.hidden=false;f.reset();}).catch(function(){alert('Gagal mengirim. Coba lagi sebentar.');}).then(function(){b.disabled=false;b.textContent=t;});});})();
</script>
</section>`;
}

const WIRE_FORMS = `<script>
(function(){if(window.__voxWired)return;window.__voxWired=1;
document.querySelectorAll('form:not([data-vox])').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();
var d={};new FormData(f).forEach(function(v,k){if(typeof v==='string')d[k]=v;});var c=String(f.id||f.getAttribute('name')||'form').slice(0,32);
var s=(window.VOX&&VOX.save)?VOX.save(c,d):Promise.resolve();
s.then(function(){f.reset();var m=document.createElement('p');m.textContent='Terkirim. Terima kasih!';m.setAttribute('role','status');m.style.cssText='margin-top:12px;font-weight:600';f.appendChild(m);setTimeout(function(){m.remove()},5000);});});});})();
</script>`;

function insertBeforeFooter(html: string, block: string) {
  const idx = html.search(/<footer[\s>]/i);
  if (idx !== -1) return html.slice(0, idx) + block + "\n" + html.slice(idx);
  const end = html.toLowerCase().lastIndexOf("</body>");
  return end !== -1 ? html.slice(0, end) + block + "\n" + html.slice(end) : html + block;
}

/** Model sering mengarang URL Unsplash dari ingatan (bisa 404). Ganti dengan foto yang benar-benar kita cari. */
function replaceForeignPhotos(html: string, pack: MediaPack): { html: string; replaced: number } {
  if (!pack.all.length) return { html, replaced: 0 };
  const ours = new Set(pack.all.map((p) => p.url.split("?")[0]));
  const found = [...new Set(html.match(/https:\/\/images\.unsplash\.com\/[^\s"'<>)\\]+/g) || [])];
  const foreign = found.filter((u) => !ours.has(u.split("?")[0]));
  let out = html;
  foreign.forEach((u, i) => {
    out = out.split(u).join(pack.all[i % pack.all.length].url);
  });
  return { html: out, replaced: foreign.length };
}

/** Sisipkan yang pasti bisa dibuat kode: section video, form tersimpan, atau penyambung form yang sudah ada. */
function autoFixContract(html: string, request: string, pack: MediaPack, plan: DesignPlan | null): { html: string; applied: string[] } {
  const accent = plan?.palette.colors.aksen || "#23786e";
  const low = html.toLowerCase();
  const applied: string[] = [];
  let out = html;

  const swapped = replaceForeignPhotos(out, pack);
  if (swapped.replaced) {
    out = swapped.html;
    applied.push(`${swapped.replaced} URL foto karangan model diganti foto Unsplash asli`);
  }
  if (pack.videos.length && !/youtube(?:-nocookie)?\.com\/embed|ytimg\.com/.test(low)) {
    out = insertBeforeFooter(out, videoSection(pack.videos[0], accent));
    applied.push(`section video YouTube ("${pack.videos[0].title.slice(0, 40)}")`);
  }
  const hasForm = /<form[\s>]/i.test(out);
  if (!hasForm && WANTS_FORM.test(request)) {
    out = insertBeforeFooter(out, formSection(request, accent));
    applied.push(`form ${formKind(request).coll} yang tersimpan lewat VOX`);
  } else if (hasForm && !/VOX\.save/.test(out) && !/addEventListener\(\s*['"]submit['"]|onsubmit\s*=|\.onsubmit|fetch\(/.test(out)) {
    const end = out.toLowerCase().lastIndexOf("</body>");
    out = end !== -1 ? out.slice(0, end) + WIRE_FORMS + "\n" + out.slice(end) : out + WIRE_FORMS;
    applied.push("penyambung form agar datanya tersimpan");
  }
  return { html: out, applied };
}

// ---- Pemeriksa kontrak: hal yang bisa dicek mesin, tidak perlu menunggu penilaian model
const WANTS_FORM = /\b(form|formulir|reservasi|booking|pendaftaran|daftar|rsvp|kontak|pemesanan|ulasan)\b/i;
const BRAND_STOP = new Set(["YouTube", "Unsplash", "Tailwind", "React", "Google", "Instagram", "WhatsApp", "Next", "Vercel", "GitHub", "Indonesia", "Bahasa"]);

/** Nama brand dari permintaan: rangkaian kata berhuruf kapital pertama (bukan kata pertama kalimat). */
export function extractBrand(request: string): string | null {
  const words = request.trim().split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    if (!/^[A-Z][\p{L}\p{N}&'-]*$/u.test(words[i]) || BRAND_STOP.has(words[i])) continue;
    const seq = [words[i]];
    while (i + 1 < words.length && /^[A-Z][\p{L}\p{N}&'-]*$/u.test(words[i + 1]) && seq.length < 4) seq.push(words[++i]);
    const brand = seq.join(" ").replace(/[.,;:!?]+$/, "");
    if (brand.length >= 3) return brand;
  }
  return null;
}

function contractIssues(html: string, request: string, pack: MediaPack): string[] {
  const issues: string[] = [];
  const low = html.toLowerCase();
  const brand = extractBrand(request);
  if (brand && !low.includes(brand.toLowerCase())) {
    issues.push(`Nama brand "${brand}" belum muncul. Ganti nama brand/tempat lain yang salah dengan "${brand}" di navbar, judul halaman, hero, dan footer.`);
  }
  if (pack.videos.length && !/youtube(?:-nocookie)?\.com\/embed|ytimg\.com/.test(low)) {
    const v = pack.videos[0];
    issues.push(`Belum ada video YouTube. Tambahkan satu section video (sebelum </main> atau </footer>) berupa facade: kartu thumbnail ${v.thumb} + tombol play; saat diklik diganti iframe https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0 (allowfullscreen). Judul "${v.title}", channel "${v.channel}".`);
  }
  if (pack.all.length >= 2 && !pack.all.some((p) => html.includes(p.url.split("?")[0]))) {
    issues.push(`Foto yang disediakan belum dipakai. Pakai URL foto itu untuk hero dan galeri: ${pack.all.slice(0, 3).map((p) => p.url).join(" , ")}`);
  }
  const hasForm = /<form[\s>]/i.test(html);
  if (hasForm && !/VOX\.save/.test(html)) {
    issues.push("Ada <form> tetapi datanya belum disimpan. Pasang submit handler: e.preventDefault(); await VOX.save('<nama-koleksi>', Object.fromEntries(new FormData(form))); lalu tampilkan keadaan sukses dan kosongkan form.");
  } else if (!hasForm && WANTS_FORM.test(request)) {
    issues.push("Permintaan menyebut form (reservasi/daftar/kontak) tetapi belum ada <form>. Tambahkan form lengkap dengan validasi dan VOX.save.");
  }
  return issues;
}

const EDIT_FILLER = /\b(tambah(?:kan|in)?|ganti(?:in)?|ubah|pasang(?:kan|in)?|masukin|masukkan|buat(?:kan|in)?|bikin(?:in|kan)?|dong|ya|yang|di|ke|dengan|pakai|pake|untuk|buat|website|situs|halaman|bagian|section|gambar|foto|video|youtube|yt|konten|tentang|soal|dari)\b/gi;

/** Kata kunci pencarian cadangan bila arsitek tidak memberi query. */
function fallbackQuery(request: string) {
  const q = request.replace(EDIT_FILLER, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
  return q || request.slice(0, 40);
}

const WANTS_VIDEO = /\b(youtube|yt|video|vlog|tutorial|channel|klip)\b/i;

async function gatherMedia(request: string, brief: Record<string, unknown> | null): Promise<MediaPack> {
  const raw = Array.isArray(brief?.gambar) ? (brief!.gambar as { untuk?: unknown; query?: unknown }[]) : [];
  let slots = raw
    .map((g) => ({ slot: String(g?.untuk || "gambar").slice(0, 24), query: String(g?.query || "").trim() }))
    .filter((g) => g.query.length > 2)
    .slice(0, 4); // batasi: kuota Unsplash hanya 50/jam
  if (!slots.length) slots = [{ slot: "hero", query: fallbackQuery(request) }];

  const photos = await Promise.all(
    slots.map(async (q) => ({ slot: q.slot, photos: await searchPhotos(q.query, /hero|utama|header/i.test(q.slot) ? 2 : 3) }))
  );
  const videoQuery = typeof brief?.video === "string" && brief.video.trim() ? brief.video.trim() : WANTS_VIDEO.test(request) ? fallbackQuery(request) : "";
  const videos = videoQuery ? await searchVideos(videoQuery, 3) : [];
  return { photos, videos, all: photos.flatMap((p) => p.photos as Photo[]) };
}

async function architectBrief(request: string, context: string, direction: string, planText: string, apiKey?: string) {
  const { text, model } = await callLLM({
    system:
      "Kamu Arsitek Desain senior. Tugasmu menyusun brief singkat yang tajam untuk developer, BUKAN menulis kode. Balas HANYA JSON valid.",
    prompt: `${context ? `Konteks:\n${context}\n\n` : ""}Permintaan user: "${request}"
Arah desain awal: ${direction}

${planText}

Skema JSON:
{
  "konsep": string (1 kalimat ide besar visual),
  "nama_brand": string (nama brand/produk yang dipakai di halaman),
  "sections": [{ "nama": string, "isi": string (konten spesifik & realistis: judul, teks, harga, daftar) }] (4-8 section),
  "interaksi": string[] (3-5 interaksi JS yang benar-benar berfungsi),
  "data_tersimpan": string[] (form/fitur yang menyimpan data lewat VOX.save, mis. "pesan-kontak", "reservasi"),
  "elemen_khas": string (satu hal unik yang bikin halaman ini diingat),
  "gambar": [{ "untuk": string (mis. "hero", "menu", "tentang"), "query": string (kata kunci pencarian foto dalam BAHASA INGGRIS, 2-4 kata, konkret) }] (3-5 item),
  "video": string | null (kata kunci pencarian video YouTube hanya bila halaman memang butuh video, mis. tutorial/profil; kalau tidak, null)
}`,
    apiKey,
    maxTokens: 2000,
    prefer: ROLE_PREFER.arsitek,
  });
  return { brief: parseJsonLoose<Record<string, unknown>>(text), raw: text, model };
}

type Review = { skor: number; masalah: { poin: string; prioritas: "tinggi" | "sedang" | "rendah" }[]; pujian?: string };

async function reviewHtml(request: string, html: string, apiKey?: string) {
  const { text, model } = await callLLM({
    system:
      "Kamu Reviewer QA front-end yang jujur dan spesifik. Nilai hasil kerja developer. Cari bug JS, elemen yang tidak berfungsi, layout rusak di HP, kontras buruk, konten generik/placeholder, dan bagian yang tidak sesuai permintaan. Balas HANYA JSON valid.",
    prompt: `Permintaan user: "${request}"

Kode yang dinilai:
\`\`\`html
${html.length > 40000 ? html.slice(0, 40000) + "\n<!-- (dipotong untuk review) -->" : html}
\`\`\`

Skema JSON:
{ "skor": number (1-10), "pujian": string (1 kalimat), "masalah": [{ "poin": string (spesifik & bisa ditindaklanjuti), "prioritas": "tinggi" | "sedang" | "rendah" }] (maks 5) }`,
    apiKey,
    maxTokens: 1500,
    prefer: ROLE_PREFER.reviewer,
  });
  return { review: parseJsonLoose<Review>(text), model };
}

type PatchReply = {
  tanggapan?: { poin: number; keputusan: string; alasan?: string }[];
  patch?: { cari: string; ganti: string }[];
};

/** Terapkan patch cari→ganti. Hanya patch yang potongannya ditemukan persis yang dipakai. */
function applyPatches(html: string, patches: { cari: string; ganti: string }[] = []) {
  let out = html;
  let applied = 0;
  for (const p of patches) {
    if (!p || typeof p.cari !== "string" || typeof p.ganti !== "string" || p.cari.length < 3) continue;
    if (out.includes(p.cari)) {
      // teks pendek satu baris (mis. nama brand) diganti di semua tempat
      const short = !p.cari.includes("\n") && p.cari.length <= 80;
      out = short ? out.split(p.cari).join(p.ganti) : out.replace(p.cari, p.ganti);
      applied++;
    } else {
      // toleransi spasi/indentasi
      const norm = p.cari.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const re = new RegExp(norm);
      if (re.test(out)) {
        out = out.replace(re, p.ganti.trim());
        applied++;
      }
    }
  }
  return { html: out, applied };
}

const PATCH_SYSTEM =
  "Kamu developer front-end yang teliti. Kamu mengubah file lewat patch kecil, bukan menulis ulang file. Balas HANYA JSON valid.";

const PATCH_SCHEMA = `Skema JSON balasan:
{
  "tanggapan": [{ "poin": number, "keputusan": "terima" | "tolak", "alasan": string }],
  "patch": [{ "cari": string (potongan kode PERSIS dari file, 1-15 baris, harus unik), "ganti": string (kode penggantinya) }]
}
Untuk menambah bagian baru, "cari" sebuah penanda yang ada (mis. "</footer>" atau "</main>") dan "ganti" dengan bagian baru + penanda itu.`;

async function patchHtml(html: string, instruction: string, apiKey?: string, prefer = ROLE_PREFER.revisi, maxTokens = 2000) {
  const { text, model } = await callLLM({
    system: PATCH_SYSTEM,
    prompt: `${instruction}\n\nFile index.html saat ini:\n\`\`\`html\n${html}\n\`\`\`\n\n${PATCH_SCHEMA}\nBatasi maksimal 8 patch yang paling penting.`,
    apiKey,
    // patch itu kecil; output pendek + batas waktu supaya model yang lambat/tak berguna tidak menahan build
    maxTokens,
    timeoutMs: 40_000,
    prefer,
  });
  const reply = parseJsonLoose<PatchReply>(text) || {};
  const { html: patched, applied } = applyPatches(html, reply.patch);
  return { html: patched, applied, total: reply.patch?.length || 0, tanggapan: reply.tanggapan || [], model };
}

export async function buildWebsite({
  request,
  mode,
  projectId,
  apiKey,
  history = [],
  onProgress,
}: {
  request: string;
  mode: "create" | "edit";
  projectId: string;
  apiKey?: string;
  history?: { role: string; content: string }[];
  onProgress?: (turn: MeetingTurn) => void;
}): Promise<WebsiteBuildResult> {
  const started = Date.now();
  const safeProj = sanitizeSlug(projectId);
  const current = await readProjectHtml(safeProj);
  const editing = mode === "edit" && !!current;
  const meeting: MeetingTurn[] = [];
  const warnings: string[] = [];
  const log = (turn: MeetingTurn) => {
    meeting.push(turn);
    onProgress?.(turn);
  };

  const context = history
    .slice(-4)
    .map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content.slice(0, 300)}`)
    .join("\n");

  // 1. Arsitek menyusun brief (hanya untuk website baru)
  let prompt: string;
  let mediaPack: MediaPack = { photos: [], videos: [], all: [] };
  let designPlan: DesignPlan | null = null;
  if (editing) {
    if (/\b(gambar|foto|image|video|youtube|yt)\b/i.test(request)) {
      mediaPack = await gatherMedia(request, null);
    }
    prompt = `${buildEditPrompt(request, applyDirectRenames(current!, request).html)}${mediaPack.all.length || mediaPack.videos.length ? `\n\n${describeMedia(mediaPack)}` : ""}`;
  } else {
    const direction = pickDirection(request);
    const plan = planDesign(request, direction);
    designPlan = plan;
    const uupm = designBrief(request);
    const planText = `${describePlan(plan)}${uupm ? `\n\n${uupm}` : ""}\n\nATURAN UX WAJIB:\n${topUxRules(8).map((r) => `- ${r}`).join("\n")}`;
    let t0 = Date.now();
    let briefText = "";
    let brief: Record<string, unknown> | null = null;
    try {
      const a = await architectBrief(request, context, direction, planText, apiKey);
      brief = a.brief;
      if (a.brief) {
        briefText = JSON.stringify(a.brief, null, 2);
        log({
          role: "arsitek",
          agent: "Arsitek Desain",
          model: a.model,
          note: `${String(a.brief.konsep || "Brief desain disusun")} · font ${plan.pairing.display}/${plan.pairing.body} · palet ${plan.palette.name}`,
          durationMs: Date.now() - t0,
        });
      }
    } catch (err) {
      log({ role: "arsitek", agent: "Arsitek Desain", model: "-", note: `Absen (${(err as Error).message}), developer jalan sendiri`, durationMs: Date.now() - t0 });
    }

    // Cari foto (Unsplash) & video (YouTube) sungguhan sesuai brief
    t0 = Date.now();
    mediaPack = await gatherMedia(request, brief);
    const nPhotos = mediaPack.all.length;
    log({
      role: "aset",
      agent: "Pencari Aset",
      model: "unsplash + youtube",
      note: nPhotos || mediaPack.videos.length
        ? `${nPhotos} foto Unsplash${mediaPack.videos.length ? ` · ${mediaPack.videos.length} video YouTube (${mediaPack.videos.map((v) => v.title.slice(0, 28)).join(", ")})` : ""}`
        : "Tidak ada aset (key belum diisi atau kuota habis), pakai gambar cadangan",
      durationMs: Date.now() - t0,
    });

    prompt = [
      buildCreatePrompt(request, context, direction),
      planText,
      briefText ? `BRIEF DARI ARSITEK DESAIN (ikuti, boleh kamu sempurnakan):\n${briefText}` : "",
      describeMedia(mediaPack),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // 2. Developer menulis kode (edit: lewat patch dulu, tulis ulang hanya jika patch gagal)
  let t1 = Date.now();
  let html = "";
  let model = "";
  let base = current;
  if (editing) {
    const renamed = applyDirectRenames(current!, request);
    if (renamed.done.length) {
      base = renamed.html;
      log({ role: "developer", agent: "Developer", model: "otomatis", note: `Ganti langsung di semua tempat: ${renamed.done.join(", ")}`, durationMs: 0 });
    }
    try {
      const mediaText = mediaPack.all.length || mediaPack.videos.length ? `\n\n${describeMedia(mediaPack)}` : "";
      const p = await patchHtml(base!, `PERMINTAAN PERUBAHAN DARI USER: "${request}"\nTerapkan perubahan itu dan perbarui komentar <!-- SUMMARY: ... --> dengan ringkasan perubahan.${mediaText}`, apiKey);
      if (p.applied > 0) {
        html = p.html;
        model = p.model;
        log({ role: "developer", agent: "Developer", model, note: `Menerapkan ${p.applied}/${p.total} patch sesuai permintaan`, durationMs: Date.now() - t1 });
      } else if (base !== current) {
        html = base!; // rename langsung sudah cukup
        model = "otomatis";
      }
    } catch {
      /* jatuh ke tulis ulang */
    }
  }
  if (!html) {
    t1 = Date.now();
    let w = await writeHtml(prompt, apiKey);
    if (isOffTopic(w.html, request)) {
      log({ role: "developer", agent: "Developer", model: w.model, note: "Hasil keluar topik (konten brand lain bocor), ditulis ulang", durationMs: Date.now() - t1 });
      t1 = Date.now();
      w = await writeHtml(`${prompt}\n\nPERINGATAN: percobaan sebelumnya keluar topik. Website ini HANYA tentang: "${request}". Jangan sebut Investdesk/investasi.`, apiKey);
    }
    html = w.html;
    model = w.model;
    log({
      role: "developer",
      agent: "Developer",
      model,
      note: `${editing ? "Menulis ulang file dengan perubahan" : "Menulis website"}: ${html.split("\n").length} baris`,
      durationMs: Date.now() - t1,
    });
  }

  // 2a. Pemeriksa sintaks JS: satu salah ketik mematikan seluruh blok <script>
  const repairJs = () => {
    const r = repairInlineScripts(html);
    if (!r.fixed.length && !r.failed.length) return;
    html = r.html;
    const parts: string[] = [];
    if (r.fixed.length) parts.push(`${r.fixed.length} script rusak diperbaiki otomatis (${[...new Set(r.fixed)].join(", ")})`);
    if (r.failed.length) {
      parts.push(`${r.failed.length} script masih error: ${r.failed.join("; ")}`);
      warnings.push(`${r.failed.length} blok JavaScript masih error sehingga sebagian interaksi mungkin tidak jalan.`);
    }
    log({ role: "revisi", agent: "Pemeriksa Sintaks JS", model: "otomatis", note: parts.join(" · "), durationMs: 0 });
  };
  repairJs();

  // 2b. Pemeriksa kontrak (otomatis, tanpa model): aset terpakai, form tersimpan, brand benar
  if (!editing) {
    const fixed = autoFixContract(html, request, mediaPack, designPlan);
    if (fixed.applied.length) {
      html = fixed.html;
      log({ role: "revisi", agent: "Pemeriksa Kontrak", model: "otomatis", note: `Menyisipkan langsung dari kode: ${fixed.applied.join(" · ")}`, durationMs: 0 });
    }
    const left = contractIssues(html, request, mediaPack);
    if (left.length) {
      log({ role: "revisi", agent: "Pemeriksa Kontrak", model: "otomatis", note: `Masih tersisa: ${left.map((x) => x.split(".")[0].slice(0, 70)).join(" · ")} (diteruskan ke reviewer)`, durationMs: 0 });
      left.forEach((x) => warnings.push(x.split(".")[0] + "."));
    }
  }

  // 3. Reviewer menilai, 4. developer menanggapi & merevisi bila perlu
  let score: number | undefined;
  try {
    t1 = Date.now();
    const { review, model: rModel } = await reviewHtml(request, html, apiKey);
    if (!review || typeof review.skor !== "number") {
      log({ role: "reviewer", agent: "Reviewer QA", model: rModel, note: "Balasan reviewer tidak bisa dibaca, penilaian dilewati", durationMs: Date.now() - t1 });
    }
    if (review && typeof review.skor === "number") {
      score = review.skor;
      const issues = (review.masalah || []).filter((m) => m && m.poin);
      log({
        role: "reviewer",
        agent: "Reviewer QA",
        model: rModel,
        note: `Skor ${review.skor}/10. ${issues.length ? issues.map((m) => m.poin).slice(0, 3).join(" · ") : review.pujian || "Tidak ada masalah."}`,
        durationMs: Date.now() - t1,
      });

      const htmlBeforeRevision = html;
      const serious = issues.some((m) => m.prioritas === "tinggi") || review.skor < 8;
      const list = issues.map((m, k) => `${k + 1}. [${m.prioritas}] ${m.poin}`).join("\n");
      if (issues.length && (review.skor <= 4 || isOffTopic(html, request))) {
        // Hasil jauh dari harapan → developer menulis ulang dengan catatan reviewer
        t1 = Date.now();
        try {
          const w = await writeHtml(
            `${prompt}\n\nCATATAN REVIEWER DARI PERCOBAAN SEBELUMNYA (skor ${review.skor}/10), WAJIB diperbaiki:\n${list}\n\nWebsite ini HANYA tentang: "${request}".`,
            apiKey
          );
          if (!isOffTopic(w.html, request)) html = w.html;
          log({ role: "revisi", agent: "Developer", model: w.model, note: `Menerima semua catatan reviewer dan menulis ulang halaman (${w.html.split("\n").length} baris)`, durationMs: Date.now() - t1 });
        } catch (err) {
          log({ role: "revisi", agent: "Developer", model: "-", note: `Tulis ulang gagal (${(err as Error).message})`, durationMs: Date.now() - t1 });
        }
      } else if (issues.length && serious) {
        t1 = Date.now();
        try {
          const p = await patchHtml(
            html,
            `Kamu developer yang menulis kode ini untuk permintaan: "${request}".
Reviewer QA memberi skor ${review.skor}/10 dengan catatan:
${list}

Ini rapat kerja, kalian saling melengkapi. Untuk tiap poin putuskan "terima" atau "tolak" beserta alasan singkat.
- Poin tentang ketidaksesuaian dengan permintaan user, bug, atau fitur yang tidak berfungsi WAJIB diterima.
- Kamu hanya boleh menolak poin selera/gaya yang menurutmu justru melemahkan desain, dan jelaskan alasannya.
Lalu buat patch untuk semua poin yang kamu terima.`,
            apiKey
          );
          const tanggapan = p.tanggapan
            .map((x) => `${x.poin}=${x.keputusan}${x.keputusan === "tolak" && x.alasan ? ` (${x.alasan})` : ""}`)
            .join("; ");
          if (p.applied > 0) html = p.html;
          log({
            role: "revisi",
            agent: "Developer",
            model: p.model,
            note: `${tanggapan ? `Tanggapan: ${tanggapan}. ` : ""}${p.total ? `${p.applied}/${p.total} perbaikan diterapkan` : "Tidak ada patch yang dikirim, versi sekarang dipertahankan"}`,
            durationMs: Date.now() - t1,
          });
        } catch (err) {
          log({ role: "revisi", agent: "Developer", model: "-", note: `Revisi gagal (${(err as Error).message}), versi awal dipakai`, durationMs: Date.now() - t1 });
        }
      }

      // Nilai ulang setelah revisi supaya skor yang dilaporkan jujur; revisi yang justru lebih buruk dibatalkan
      if (html !== htmlBeforeRevision) {
        try {
          const t2 = Date.now();
          const again = await reviewHtml(request, html, apiKey);
          if (again.review && typeof again.review.skor === "number") {
            if (again.review.skor < review.skor) {
              html = htmlBeforeRevision;
              log({ role: "reviewer", agent: "Reviewer QA", model: again.model, note: `Nilai ulang ${again.review.skor}/10, lebih rendah dari sebelumnya (${review.skor}/10). Revisi dibatalkan, versi sebelumnya dipakai`, durationMs: Date.now() - t2 });
            } else {
              score = again.review.skor;
              const left = (again.review.masalah || []).filter((m) => m && m.poin).slice(0, 2).map((m) => m.poin);
              log({ role: "reviewer", agent: "Reviewer QA", model: again.model, note: `Nilai ulang setelah revisi: ${again.review.skor}/10${left.length ? `. Sisa catatan: ${left.join(" · ")}` : ""}`, durationMs: Date.now() - t2 });
            }
          }
        } catch {
          /* skor awal dipertahankan */
        }
      }
    }
  } catch (err) {
    log({ role: "reviewer", agent: "Reviewer QA", model: "-", note: `Review dilewati (${(err as Error).message})`, durationMs: 0 });
  }

  // Bocoran teks dari persona gateway (mis. "Investasi Cerdas") dibersihkan sebelum disimpan
  if (!LEAK_LINE.test(request) && leakLines(html).length > 0) {
    t1 = Date.now();
    try {
      const r = await scrubLeaks(html, request, apiKey);
      if (r.replaced > 0) html = r.html;
      log({
        role: "revisi",
        agent: "Pembersih Konten",
        model: r.replaced ? "model" : "-",
        note: r.replaced
          ? `${r.replaced} baris teks nyasar (topik investasi) ditulis ulang${r.remaining ? `; ${r.remaining} baris masih tersisa, bilang "perbaiki teks yang nyasar" untuk membereskan` : ""}`
          : "Ada teks nyasar bertopik investasi tetapi belum berhasil dibersihkan. Pasang patch gateway atau isi GEMINI_API_KEY agar tidak terulang",
        durationMs: Date.now() - t1,
      });
    } catch (err) {
      log({ role: "revisi", agent: "Pembersih Konten", model: "-", note: `Gagal membersihkan teks nyasar (${(err as Error).message})`, durationMs: Date.now() - t1 });
    }
  }
  if (!LEAK_LINE.test(request)) {
    const leftLeak = leakLines(html).length;
    if (leftLeak > 0) warnings.push(`Masih ada ${leftLeak} baris teks nyasar bertopik investasi (bocoran persona gateway). Isi GEMINI_API_KEY atau pasang patch gateway supaya tidak terulang.`);
  }
  repairJs(); // revisi bisa menambah error baru
  html = withMarker(html);
  await writeProjectHtml(safeProj, html);
  trackPhotoUse(mediaPack.all, html).catch(() => {});

  return {
    html,
    title: extractTitle(html),
    summary: freshSummary(html, current, editing, meeting),
    model,
    mode: editing ? "edit" : "create",
    previewUrl: `/api/preview?projectId=${encodeURIComponent(safeProj)}&t=${Date.now()}`,
    projectId: safeProj,
    lines: html.split("\n").length,
    previousLines: current ? current.split("\n").length : 0,
    durationMs: Date.now() - started,
    meeting,
    score,
    warnings,
  };
}

/** Kembalikan index.html ke versi sebelum perubahan terakhir. */
export async function restorePreviousWebsite(projectId: string): Promise<{ html: string; previewUrl: string } | null> {
  const dir = path.join(USER_PROJECTS_BASE, sanitizeSlug(projectId));
  try {
    const prev = await fs.readFile(path.join(dir, "index.prev.html"), "utf-8");
    const cur = await fs.readFile(path.join(dir, "index.html"), "utf-8").catch(() => "");
    await fs.writeFile(path.join(dir, "index.html"), prev, "utf-8");
    if (cur) await fs.writeFile(path.join(dir, "index.prev.html"), cur, "utf-8");
    return { html: prev, previewUrl: `/api/preview?projectId=${encodeURIComponent(sanitizeSlug(projectId))}&t=${Date.now()}` };
  } catch {
    return null;
  }
}
