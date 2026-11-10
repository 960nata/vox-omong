import fs from "fs/promises";
import path from "path";
import { callLLM, detectCodeIntent, extractBrand, parseJsonLoose } from "./codeAgent";
import { loadSkill } from "./skillLoader";

/**
 * Tanya dulu sebelum membuat website kalau permintaannya masih kabur.
 * Brief yang menunggu jawaban disimpan per percakapan (.data/briefs.json).
 */

const FILE = path.join(process.cwd(), ".data", "briefs.json");
const TTL_MS = 30 * 60 * 1000;

interface Pending {
  request: string;
  projectId: string;
  askedAt: number;
  /** Rekomendasi jawaban dari ronde pertanyaan (gaya grill-me); dipakai bila user bilang "ya" / tidak menjawab. */
  recommended?: string;
}

async function readAll(): Promise<Record<string, Pending>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8")) as Record<string, Pending>;
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, Pending>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 1), "utf-8");
}

export async function saveBrief(conversationId: string, p: Omit<Pending, "askedAt">) {
  const all = await readAll();
  const now = Date.now();
  for (const k of Object.keys(all)) if (now - all[k].askedAt > TTL_MS) delete all[k];
  all[conversationId] = { ...p, askedAt: now };
  await writeAll(all);
}

/** Ambil sekaligus hapus brief yang sedang menunggu jawaban (kalau masih berlaku). */
export async function takeBrief(conversationId: string): Promise<Pending | null> {
  const all = await readAll();
  const p = all[conversationId];
  if (!p) return null;
  delete all[conversationId];
  await writeAll(all);
  return Date.now() - p.askedAt <= TTL_MS ? p : null;
}

export const AUTO_WORDS = /\b(terserah|otomatis|bebas|langsung (?:aja|saja|bikin|buat)|gak usah tanya|nggak usah tanya|ga usah tanya|tanpa tanya|cariin sendiri|carikan sendiri|kamu aja|kamu saja|up to you|skip)\b/i;

const STYLE_ANY = /\b(mewah|luxury|elegan|premium|gelap|dark|terang|berani|brutal|bold|colorful|futuristik|hologram|cyber|neon|tech|lucu|playful|ceria|lembut|pastel|hangat|natural|organik|editorial|klasik|vintage|retro|minimal|minimalis|modern|bersih|simple|rapi)\b/i;
const SECTION_WORDS = /\b(menu|katalog|produk|galeri|testimoni|ulasan|harga|paket|faq|video|youtube|form|reservasi|booking|daftar|pendaftaran|lokasi|kontak|jadwal|tentang)\b/gi;

/** Seberapa rinci permintaannya (0 = sangat kabur). */
export function specificity(request: string): number {
  let s = 0;
  if (extractBrand(request)) s += 2;
  if (STYLE_ANY.test(request)) s += 1;
  const sections = new Set((request.match(SECTION_WORDS) || []).map((x) => x.toLowerCase()));
  s += sections.size >= 2 ? 2 : sections.size;
  if (request.trim().split(/\s+/).length >= 16) s += 1;
  return s;
}

export const needsBrief = (request: string) => specificity(request) < 3 && !AUTO_WORDS.test(request);

/** Pesan baru yang jelas-jelas permintaan lain, bukan jawaban brief. */
export function looksLikeNewRequest(msg: string): boolean {
  return msg.trim().split(/\s+/).length >= 8 && detectCodeIntent(msg, false) === "create";
}

const GOAL: Record<string, string> = {
  kuliner: "pesan lewat keranjang, reservasi meja, atau cuma profil dan menu",
  toko: "jualan online dengan keranjang, atau katalog biasa",
  edukasi: "pendaftaran kelas, penjualan paket, atau profil lembaga",
  event: "pendaftaran peserta, penjualan tiket, atau informasi acara",
  portfolio: "pamer karya, cari klien, atau CV online",
  saas: "daftar/coba gratis, atau penjelasan produk",
  profil: "dapat konsultasi, tampil terpercaya, atau katalog layanan",
  umum: "jualan, reservasi, pendaftaran, atau profil",
};

export function briefMessage(kind: string): { text: string; spoken: string; suggestions: string[] } {
  const goal = GOAL[kind] || GOAL.umum;
  const text = `Sebelum aku bikin, biar hasilnya pas, jawab singkat ya (boleh satu kalimat aja):

1. Nama usaha atau brand-nya apa? (kalau belum ada, aku usulin)
2. Tujuan utama halamannya: ${goal}?
3. Gayanya mau yang mana: hangat & natural, modern minimalis, gelap & mewah, berani & colorful, atau futuristik?
4. Bagian apa aja yang kamu mau: menu/produk, galeri, harga/paket, testimoni, FAQ, video YouTube, form, lokasi?

Kalau males jawab, bilang "terserah" atau "otomatis". Aku cariin sendiri yang paling cocok.`;
  return {
    text,
    spoken: "Sebelum aku bikin, boleh jawab dulu? Nama usahanya apa, tujuannya apa, dan gayanya mau yang hangat, minimalis, atau gelap mewah? Atau bilang terserah, nanti aku cariin sendiri.",
    suggestions: ["Terserah, cariin otomatis", "Gaya hangat & natural", "Gaya gelap & mewah", "Gaya modern minimalis", "Gaya berani & colorful"],
  };
}

// ---------------------------------------------------------------- pertanyaan gaya grill-me

/** "ya", "oke setuju", "gas" = terima semua rekomendasi. */
export const ACCEPT_ALL = /^(?:\s*(?:ya|iya|yes|yap|ok|oke|okey|setuju|gas|lanjut|boleh|sip|siap|mantap|pakai rekomendasi(?:nya)?|sesuai rekomendasi)\b[\s,.!]*){1,4}$/i;

interface GrillQ {
  title: string;
  question: string;
  recommend: string;
}

/**
 * Satu ronde pertanyaan yang disusun model dengan metode skill "grilling" (Matt Pocock, MIT):
 * tanya hanya keputusan yang bisa dijawab sekarang, beri rekomendasi tiap pertanyaan,
 * dan susun supaya "ya" berarti menerima rekomendasi. Gagal/lambat → null (pakai pertanyaan statis).
 */
export async function grillQuestions(request: string, kind: string, apiKey?: string): Promise<{ text: string; spoken: string; suggestions: string[]; recommended: string } | null> {
  const method = loadSkill("grilling");
  if (!method) return null;
  try {
    const r = await callLLM({
      system: "Kamu konsultan website yang mewawancarai pelanggan sebelum mulai bekerja.",
      prompt: `METODE (skill "grilling", bahasa Inggris):
${method}

ADAPTASI UNTUK APLIKASI INI (wajib):
- Hanya SATU ronde, maksimal 3 pertanyaan, bahasa Indonesia santai, tiap pertanyaan ≤ 25 kata (akan dibacakan lewat suara).
- Tanyakan hanya KEPUTUSAN pelanggan yang benar-benar mengubah hasil (nama usaha bila belum ada, tujuan utama halaman, nuansa/gaya, bagian penting). Jangan tanya hal teknis (font, warna hex, framework).
- Jangan tanya hal yang sudah jelas di permintaan.
- Tiap pertanyaan punya rekomendasi jawaban yang spesifik untuk usaha ini.
- Tidak ada sub-agent; kamu tidak bisa memeriksa apa pun, jadi jangan menjanjikan pengecekan.

PERMINTAAN PELANGGAN: ${request}
JENIS SITUS (tebakan sistem): ${kind}

Balas HANYA JSON: {"brand":"rekomendasi nama usaha (kosong bila nama sudah disebut di permintaan)","questions":[{"title":"≤4 kata","question":"…","recommend":"…"}]}`,
      apiKey,
      maxTokens: 700,
      timeoutMs: 15_000,
    });
    const j = parseJsonLoose<{ brand?: string; questions?: GrillQ[] }>(r.text);
    const qs = (j?.questions || []).filter((q) => q && q.question && q.recommend).slice(0, 3);
    if (!qs.length) return null;
    const clean = (x: string) => String(x).replace(/\s+/g, " ").trim().slice(0, 240);
    const text = `Sebelum aku bikin, ${qs.length} hal dulu biar hasilnya pas:\n\n${qs
      .map((q, i) => `❓ **Q${i + 1} · ${clean(q.title || "Pertanyaan")}**: ${clean(q.question)}\n➡️ Rekomendasiku: ${clean(q.recommend)}`)
      .join("\n\n")}\n\nBalas "ya" untuk pakai semua rekomendasiku, atau jawab yang mau kamu ubah saja.`;
    // Nama brand ditaruh paling depan & label lain huruf kecil, supaya extractBrand mengambil nama yang benar.
    const brand = clean(j?.brand || "");
    const rest = qs.filter((q) => !brand || !clean(q.recommend).includes(brand)).map((q) => `${clean(q.title || q.question).toLowerCase()}: ${clean(q.recommend)}`);
    const recommended = [brand ? `nama usaha: ${brand}` : "", ...rest].filter(Boolean).join("; ");
    return {
      text,
      spoken: `Sebelum aku bikin. ${qs.map((q) => clean(q.question)).join(" ")} Bilang ya kalau setuju sama rekomendasiku.`,
      suggestions: ["Ya, pakai rekomendasimu", "Terserah, cariin otomatis"],
      recommended,
    };
  } catch {
    return null;
  }
}
