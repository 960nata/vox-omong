/**
 * Alur percakapan untuk presentasi (PPT): kapan sebuah pesan dianggap lanjutan dari deck
 * yang baru dibuat, berapa slide yang diminta, dan apakah user menolak motif tertentu.
 * Fungsi murni supaya gampang dites.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  hasSlides?: boolean;
  hasDoc?: boolean;
}

/** Kata yang jelas menunjuk ke website / aplikasi, bukan deck. */
const WEB_EXPLICIT = /\b(website|web|situs|landing(?:\s*page)?|html|dashboard|aplikasi|app|game|kalkulator|toko online|company profile)\b/i;
/** "bukan website", "jangan website": website disebut untuk MENOLAK, bukan untuk diminta. */
const WEB_NEGATED = /\b(bukan|jangan|ga\s+usah|gak\s+usah|nggak\s+usah|tanpa)\b[^.!?\n]{0,25}\b(website|web|situs|landing|html)/i;
/** Jenis dokumen lain yang punya alur sendiri. */
const OTHER_DOC = /\b(invoice|tagihan|faktur|kwitansi|excel|spreadsheet|xlsx|csv|pdf|surat|proposal|laporan|makalah|esai|kontrak|cv|resume)\b/i;
const DECK_WORDS = /\b(ppt|pptx|powerpoint|slide|slides|presentasi|pitch\s*deck|deck)\b/i;
/** Kata yang lazim dipakai untuk merevisi deck yang sudah ada. */
const REVISE_WORDS =
  /\b(gambar|foto|image|ilustrasi|visual|flat|polos|membosankan|monoton|kurang|kurangi|tambah|tambahin|tambahkan|lebih|banyak|sedikit|ganti|ubah|revisi|perbaiki|tema|warna|background|latar|font|desain|menarik|berkesan|jelek|panjang|pendek|ringkas|materi|ulang|referensi|kotak|grid|animasi)\b/i;

export function isWebExplicit(message: string): boolean {
  return WEB_EXPLICIT.test(message) && !WEB_NEGATED.test(message);
}

/**
 * Apakah pesan ini bagian dari alur presentasi?
 * - menyebut ppt/slide/presentasi → ya (kecuali jelas minta website/dokumen lain)
 * - tidak menyebut, tapi 4 giliran terakhir ada deck dan pesan terdengar seperti revisi → ya
 */
export function isDeckMessage(message: string, recent: ChatTurn[]): boolean {
  const m = message.trim();
  if (!m) return false;
  if (isWebExplicit(m) && !DECK_WORDS.test(m)) return false;
  if (OTHER_DOC.test(m) && !DECK_WORDS.test(m)) return false;
  if (DECK_WORDS.test(m)) return true;
  const lastDeckIdx = [...recent.slice(-4)].reverse().findIndex((t) => t.role === "assistant" && t.hasSlides);
  if (lastDeckIdx === -1) return false;
  return REVISE_WORDS.test(m);
}

export const MIN_SLIDES = 7;

/** "15 slide", "bikin 12 halaman", "jadi 10 slide" → 15 / 12 / 10 (maks 20). */
export function parseSlideCount(message: string): number | null {
  const m = message.toLowerCase();
  const a = m.match(/\b(\d{1,2})\s*(?:slide|slides|halaman|lembar)\b/);
  const b = m.match(/\b(?:slide|slides|halaman|jumlah)\s*(?:jadi|sebanyak|sekitar|menjadi)?\s*(\d{1,2})\b/);
  const n = Number((a || b)?.[1]);
  if (!Number.isFinite(n) || n < 1) return null;
  // minimal 7 slide, maksimal 20
  return Math.min(Math.max(n, MIN_SLIDES), 20);
}

/** Apakah user bilang tidak suka motif kotak-kotak / grid? */
export function wantsNoGrid(message: string): boolean {
  return /\b(kotak[\s-]?kotak|grid|garis[\s-]?garis|kisi)\b/i.test(message) && /\b(gak|ga|nggak|tidak|jangan|kurang|bosan|benci|gua kurang suka|gw kurang suka)\b/i.test(message);
}

/** Pesan seperti "kurang"/"terlalu sedikit" tanpa angka = minta deck lebih panjang. */
export function wantsLongerDeck(message: string): boolean {
  return /\b(kurang\s+(?:banyak|panjang)|(?:cuma|cuman|hanya)\s+\d+\s*slide|kurang\s+\d*\s*slide|slide(?:nya)?\s+(?:kurang|sedikit)|materi(?:nya)?\s+kurang|tambah(?:in|kan)?\s+(?:slide|halaman))\b/i.test(message);
}

/** Pesan yang minta tema baru ("ganti tema", "pakai tema X")? Kalau tidak, tema deck lama dipertahankan. */
export function wantsNewTheme(message: string): boolean {
  return /\b(ganti|ubah|pakai|pake|coba)\s+(?:tema|theme|warna|desain|gaya|template)\b|\btema\s+(?:lain|baru)\b/i.test(message);
}

const DOC_REVISE =
  /\b(tambah(?:in|kan)?|kurang(?:i)?|lebih|ganti|ubah|revisi|perbaiki|panjang(?:in|kan)?|pendek(?:in|kan)?|ringkas|detail|bagian|bab|paragraf|bahasa|formal|santai|resmi|contoh|data|angka|sumber|judul|rapi(?:in|kan)?|lengkap(?:i|in|kan)?|kembangkan|perdalam|tulis ulang)\b/i;

/** Pesan lanjutan atas dokumen terakhir ("tambahin bagian risiko", "bahasanya lebih formal") tanpa menyebut kata dokumen lagi. */
export function isDocFollowUp(message: string, recent: ChatTurn[]): boolean {
  const m = message.trim();
  if (!m || DECK_WORDS.test(m) || OTHER_DOC.test(m)) return false;
  if (isWebExplicit(m)) return false;
  const hasDoc = recent.slice(-4).some((t) => t.role === "assistant" && t.hasDoc);
  return hasDoc && DOC_REVISE.test(m);
}
