import { parseLoose } from "./jsonLoose";

/**
 * Router maksud: menangkap permintaan KERJA yang tidak dikenali pola-pola lama di chat route,
 * supaya tidak jatuh jadi obrolan biasa. Urutannya:
 *   1. Gerbang murah (tanpa LLM): obrolan, pertanyaan, dan perintah yang sudah punya jalur sendiri dilewati.
 *   2. Satu panggilan LLM kecil yang memilih: "agent" (tugas multi-langkah pakai alat),
 *      "coding" (ubah kode proyek aktif), atau "chat".
 * Gagal memanggil model = "chat" (alur lama tetap jalan).
 */
export type Intent = "agent" | "coding" | "chat";
export interface Routed { intent: Intent; reason: string; via: "gate" | "model" }

const TASK_VERB = /\b(bikin(?:in)?|buat(?:in|kan)?|kerjain|kerjakan|selesai(?:in|kan)|perbaiki|benerin|betulin|fix|cek|periksa|analisis|analisa|audit|install|pasang|jalan(?:in|kan)|run|cari(?:in|kan)?|riset|teliti|rapi(?:in|kan)|hapus|pindah(?:in|kan)?|tambah(?:in|kan)?|ubah|ganti|update|setup|siapkan|deploy|tes|test|uji|refactor|rename|generate|create|build|write|tulis(?:kan)?|susun|rangkum|ringkas|bandingkan|hitung|convert|konversi|ekstrak|kumpulkan|scrape)\b/i;
const QUESTION = /^(?:apa(?:kah)?|kenapa|mengapa|gimana|bagaimana|siapa|kapan|di\s?mana|berapa|emang|emangnya|what|why|how|who|when|where|is|are|can|does|do)\b/i;
const SMALL_TALK = /^(?:hai|halo|hello|hi|pagi|siang|sore|malam|makasih|terima kasih|thanks|ok(?:e|ay)?|sip|mantap|gas(?:ken)?|lanjut(?:kan)?|ya|iya|tidak|nggak|gak)\b[\s\S]{0,25}$/i;

/** Perlu ditanyakan ke model? Hanya pesan yang terlihat seperti tugas dan belum punya jalur. */
export function looksLikeUnroutedTask(message: string, hasOwnRoute: boolean): boolean {
  const m = message.trim();
  if (hasOwnRoute || m.length < 15 || m.length > 2000) return false;
  if (SMALL_TALK.test(m)) return false;
  if (/\?\s*$/.test(m) && !/\b(tolong|coba|bisa\s+(?:tolong|bantu|bikin|buat|cek))\b/i.test(m)) return false;
  if (QUESTION.test(m) && !TASK_VERB.test(m.split(/\s+/).slice(2).join(" "))) return false;
  return TASK_VERB.test(m);
}

const SYSTEM = `Kamu pemilah maksud untuk asisten AI. Pilih SATU jalur untuk pesan user. Balas JSON saja: {"intent":"agent|coding|chat","reason":"<maks 12 kata>"}

- "coding": user minta mengubah/memperbaiki/menambah KODE di proyek yang sedang dibuka (bug, fitur, refactor, tes gagal, build error).
- "agent": tugas nyata yang butuh beberapa langkah atau alat: baca/tulis file, jalankan perintah terminal, riset web lalu menghasilkan sesuatu, cek repo GitHub, gabungan beberapa hal.
- "chat": pertanyaan, penjelasan, opini, curhat, atau permintaan teks pendek yang bisa langsung dijawab tanpa alat.

Ragu antara chat dan agent, pilih "chat". Jangan menebak tugas yang tidak diminta.`;

export type Classifier = (system: string, prompt: string) => Promise<string>;

export async function routeIntent(message: string, opts: { hasOwnRoute: boolean; hasProjectCode?: boolean; classify: Classifier }): Promise<Routed> {
  if (!looksLikeUnroutedTask(message, opts.hasOwnRoute)) return { intent: "chat", reason: "bukan tugas tanpa jalur", via: "gate" };
  try {
    const text = await opts.classify(SYSTEM, `Proyek aktif punya kode: ${opts.hasProjectCode ? "ya" : "tidak"}\nPesan user: """${message.slice(0, 800)}"""`);
    const parsed = parseLoose<{ intent?: string; reason?: string }>(text);
    const intent = parsed?.intent === "agent" || parsed?.intent === "coding" ? parsed.intent : "chat";
    if (intent === "coding" && !opts.hasProjectCode) return { intent: "agent", reason: "belum ada kode proyek; dikerjakan agent umum", via: "model" };
    return { intent, reason: String(parsed?.reason || "").slice(0, 120), via: "model" };
  } catch {
    return { intent: "chat", reason: "pemilah gagal", via: "gate" };
  }
}
