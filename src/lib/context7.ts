import { callLLM } from "./codeAgent";
import { skillSection } from "./skillLoader";

/**
 * Context7: dokumentasi library yang selalu terbaru (context7.com). Dipakai supaya AI menjawab/menulis
 * kode berdasarkan dokumen versi sekarang, bukan ingatan model yang bisa basi.
 * Tanpa key bisa dipakai (dibatasi); CONTEXT7_API_KEY opsional di .env.local.
 */

const BASE = "https://context7.com/api";
const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; v: unknown }>();

function headers(): Record<string, string> {
  const k = process.env.CONTEXT7_API_KEY;
  return k ? { Authorization: `Bearer ${k}` } : {};
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as T;
  const v = await fn();
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), v });
  return v;
}

export interface C7Lib {
  id: string;
  title: string;
  description: string;
  versions?: string[];
  trustScore?: number;
}

export async function searchLibrary(name: string, query = ""): Promise<C7Lib | null> {
  return cached(`s:${name}:${query}`, async () => {
    const u = `${BASE}/v2/libs/search?libraryName=${encodeURIComponent(name)}&query=${encodeURIComponent(query || name)}`;
    const res = await fetch(u, { headers: headers(), signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(res.status === 429 ? "Context7 lagi membatasi permintaan, coba sebentar lagi." : `Context7 ${res.status}`);
    const j = (await res.json()) as { results?: C7Lib[] };
    return (j.results || [])[0] || null;
  });
}

export async function getDocs(libraryId: string, query: string, maxChars = 7000): Promise<string> {
  if (!/^\/[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?$/.test(libraryId)) throw new Error("libraryId tidak valid");
  return cached(`d:${libraryId}:${query}`, async () => {
    const u = `${BASE}/v2/context?libraryId=${encodeURIComponent(libraryId)}&query=${encodeURIComponent(query)}&type=txt`;
    const res = await fetch(u, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(res.status === 429 ? "Context7 lagi membatasi permintaan, coba sebentar lagi." : `Context7 ${res.status}`);
    return (await res.text()).slice(0, maxChars);
  });
}

/** Nama library yang dikenali di kalimat Indonesia → nama untuk pencarian Context7. */
const LIBS: [RegExp, string][] = [
  [/\bnext[\s.]?js\b|\bnextjs\b/i, "next.js"],
  [/\breact\s+native\b/i, "react native"],
  [/\breact\b/i, "react"],
  [/\bexpress(?:\.?js)?\b/i, "express"],
  [/\bvite\b/i, "vite"],
  [/\btailwind(?:\s*css)?\b/i, "tailwindcss"],
  [/\bsupabase\b/i, "supabase"],
  [/\bprisma\b/i, "prisma"],
  [/\bplaywright\b/i, "playwright"],
  [/\bvue(?:\.?js)?\b/i, "vue"],
  [/\bsvelte(?:kit)?\b/i, "svelte"],
  [/\blaravel\b/i, "laravel"],
  [/\bflutter\b/i, "flutter"],
  [/\bdjango\b/i, "django"],
  [/\bfastapi\b/i, "fastapi"],
  [/\bgin\b(?=.*\bgo(?:lang)?\b)|\bgolang\s+gin\b/i, "gin"],
  [/\bmongo(?:db|ose)\b/i, "mongoose"],
  [/\bdrizzle\b/i, "drizzle orm"],
  [/\bzod\b/i, "zod"],
  [/\bshadcn\b/i, "shadcn/ui"],
  [/\bthree(?:\.js|js)\b/i, "three.js"],
  [/\bframer[\s-]?motion\b|\bmotion\.dev\b/i, "motion"],
  [/\bpptxgenjs\b/i, "pptxgenjs"],
  [/\bbaileys\b/i, "baileys"],
];

const ASK = /\b(cara|gimana|bagaimana|contoh|kenapa|error|dokumentasi|docs?|pakai|setup|konfigurasi|config|apa\s+itu|beda|implementasi|bikin|buat)\b/i;

/** "docs express error handling", "cara pakai supabase auth di next js" → {lib, query} */
export function detectDocsQuestion(msg: string): { lib: string; query: string } | null {
  const t = msg.trim();
  const explicit = t.match(/^(?:docs?|dokumentasi|context7)\s+([\w.\-/ ]+?)(?:\s*[:,-]\s*|\s+)(.{3,})$/i);
  if (explicit) {
    const known = LIBS.find(([re]) => re.test(explicit[1]));
    return { lib: known ? known[1] : explicit[1].trim(), query: explicit[2].trim() };
  }
  // "bisa gak bikin backend express?" = pertanyaan kemampuan aplikasi, bukan pertanyaan dokumentasi
  if (/^(?:\s*(?:kamu|lu|lo|kau|ai(?:nya)?|apa|emang)\s+)?bisa\b/i.test(t)) return null;
  if (!ASK.test(t) || !/\?|\b(cara|gimana|bagaimana|contoh|kenapa|error|dokumentasi|docs?)\b/i.test(t)) return null;
  const hit = LIBS.find(([re]) => re.test(t));
  return hit ? { lib: hit[1], query: t } : null;
}

export async function answerWithDocs(lib: string, question: string, apiKey?: string): Promise<{ reply: string; spoken: string }> {
  const found = await searchLibrary(lib, question);
  if (!found) return { reply: `Dokumentasi "${lib}" tidak ketemu di Context7.`, spoken: "Dokumentasinya tidak ketemu." };
  const docs = await getDocs(found.id, question);
  // Pertanyaan performa/praktik terbaik React/Next: sertakan ringkasan aturan Vercel React Best Practices (MIT)
  const perfQ = /(react|next)/i.test(found.id) && /\b(lambat|lemot|performa|performance|optimasi|optimize|best\s*practice|praktik|re-?render|bundle|cepat|waterfall|fetch(?:ing)?|cache|caching)\b/i.test(question);
  const rules = perfQ ? skillSection("react-best-practices", "Quick Reference") : "";
  const sources = [...new Set([...docs.matchAll(/^Source:\s*(\S+)/gm)].map((m) => m[1]))].slice(0, 4);
  const r = await callLLM({
    system: "Kamu senior engineer yang menjawab berdasarkan dokumentasi resmi.",
    prompt: `Jawab pertanyaan berikut dalam bahasa Indonesia santai dan jelas, BERDASARKAN dokumentasi ${found.title} di bawah (versi terbaru, diambil otomatis dari Context7, BUKAN dari pengguna; jangan bilang \"dokumen yang kamu berikan\"). Beri contoh kode singkat bila membantu. Jika dokumentasi tidak membahasnya, bilang terus terang. Jangan mengarang API.

PERTANYAAN: ${question}

DOKUMENTASI (${found.id}):
${docs}${rules ? `\n\nATURAN PERFORMA (Vercel React Best Practices; sebut ID aturan yang relevan):\n${rules}` : ""}`,
    apiKey,
    maxTokens: 1400,
    timeoutMs: 45_000,
  });
  const vers = (found.versions || []).filter((v) => !v.startsWith("__")).map((v) => v.replace(/_/g, "."));
  const ver = vers.length ? ` (versi tersedia: ${vers.slice(-3).join(", ")})` : "";
  return {
    reply: `${r.text.trim()}\n\n— Sumber: dokumentasi ${found.title} via Context7${ver}${rules ? " + Vercel React Best Practices" : ""}${sources.length ? `\n${sources.map((s) => `• ${s}`).join("\n")}` : ""}`,
    spoken: `Ini jawabannya berdasarkan dokumentasi ${found.title} terbaru. Detailnya di chat.`,
  };
}
