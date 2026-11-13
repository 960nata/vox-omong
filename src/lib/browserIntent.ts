export interface BrowserTask { task: string; startUrl: string; scrape?: boolean; close?: boolean }

const JOBS = /\b(lowongan|loker|job(?:s|street)?|linkedin|linkedln|linkdel|karier|career|lamar|melamar|lamaran|rekrutmen)\b/i;
const ACTION = /\b(buka(?:in|kan)?|kunjungi|cari(?:kan|in)?|search|klik|click|ketik|type|isi|scroll|baca|ambil|cek|temukan|find|bandingkan|compare|scrap(?:e|ing)?|ekstrak|kumpulkan|lanjut(?:kan)?|lamar|melamar|daftar|register|udah|sudah|beres|done|next|teruskan)\b/i;

const EXCLUDED_FILE_EXTENSIONS = /\.(js|ts|jsx|tsx|json|css|scss|html|htm|py|md|txt|sh|bash|zsh|png|jpg|jpeg|gif|svg|webp|ico|mp3|mp4|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|tar|gz|bz2|7z|rar|lock|env|yml|yaml|xml|c|cpp|h|hpp|java|kt|swift|go|rs|rb|php|sql|vue|svelte|astro|wasm|map|bak|tmp|log|conf|ini|cfg)$/i;
const WEB_TLDS = /^(com|org|net|id|co|io|ai|dev|app|edu|gov|xyz|biz|info|site|online|me|tv|cc|tech|store|agency|cloud|link)$/i;

/** Ekstrak URL web nyata, abaikan nama file kode seperti index.js atau package.json */
export function extractWebUrl(text: string): string | null {
  // 1. Explicit protocol
  const protocolMatch = text.match(/\bhttps?:\/\/[^\s<>'"]+/i);
  if (protocolMatch) return protocolMatch[0].replace(/[.,!?;]+$/, "");

  // 2. www. prefix
  const wwwMatch = text.match(/\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<>'"]*/i);
  if (wwwMatch) return `https://${wwwMatch[0].replace(/[.,!?;]+$/, "")}`;

  // 3. localhost / 127.0.0.1
  const localMatch = text.match(/\b(?:localhost|127\.0\.0\.1)(?::\d{2,5})?(?:\/[^\s<>'"]*)?/i);
  if (localMatch) return `http://${localMatch[0].replace(/[.,!?;]+$/, "")}`;

  // 4. Naked domain like detik.com, kompas.id, github.com (bukan index.js)
  const domainMatch = text.match(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,}))(?::\d{2,5})?(?:\/[^\s<>'"]*)?/i);
  if (domainMatch) {
    const rawMatch = domainMatch[0].replace(/[.,!?;]+$/, "");
    const tld = domainMatch[2].toLowerCase();

    // Pastikan bukan ekstensi file kode atau aset
    if (EXCLUDED_FILE_EXTENSIONS.test(rawMatch) || EXCLUDED_FILE_EXTENSIONS.test("." + tld)) {
      return null;
    }
    // Hanya izinkan TLD web umum untuk naked domain
    if (WEB_TLDS.test(tld)) {
      return `https://${rawMatch}`;
    }
  }

  return null;
}

/** Mendeteksi akses web dan follow-up browser sebelum alur website/skill dipilih. */
export function detectBrowserTask(message: string, currentUrl?: string): BrowserTask | null {
  const m = message.trim();
  if (!m || m.length > 6000) return null;
  if (currentUrl && /^(?:tolong\s+)?(?:tutup|stop|hentikan)\s+(?:sesi\s+)?browser[.!?]*$/i.test(m)) return { task: m, startUrl: currentUrl, close: true };
  // Draf/revisi dokumen dan membangun situs lowongan tetap masuk mesin pembuatnya.
  if (/\b(?:buat(?:kan|in)?|bikin(?:in)?|bangun|desain)\s+(?:sebuah\s+)?(?:website|web|situs|aplikasi|app|landing|portal|dokumen|surat|cv|resume|draf|draft|loker|lowongan)\b/i.test(m)) return null;

  // Pertanyaan percakapan santai / konsultasi / tanya cara tidak boleh langsung buka browser otomatis
  const isConversationalQuestion = /\b(?:gimana|bagaimana|cara(?:nya)?|bisa\s+gak|tanya|konsultasi|saran|rekomendasi|strategi|kenapa)\b/i.test(m);
  const url = extractWebUrl(m);
  if (!url && isConversationalQuestion && !currentUrl) return null;

  const scrape = /\b(scrap(?:e|ing)?|ekstrak|kumpulkan|ambil\s+data)\b/i.test(m);
  const browse = /\b(browser|browsing|situs|halaman|website|google|youtube)\b/i.test(m);
  const job = JOBS.test(m);
  const follow = Boolean(
    currentUrl &&
    /^(?:(?:oke|ok|ya|iya|tolong|cuy|bro|udah|sudah)[,\s]+)*(?:lanjut(?:kan)?(?:\s+browser)?|udah\s+(?:selesai|beres|lolos)|sudah\s+(?:selesai|beres|lolos)|beres|done|next|teruskan|klik|click|scroll|ketik|isi|pilih|baca|ambil|scrap(?:e|ing)?|ekstrak|cek|lamar|melamar|kembali|lihat\s+detail)\b/i.test(m)
  );

  if (!ACTION.test(m) && !follow) return null;
  
  if (!url && !browse && !job && !follow) return null;
  if (url) return { task: m, startUrl: url, scrape: scrape || (job && /\b(cari(?:kan|in)?|ambil|kumpulkan)\b/i.test(m)) };
  if (follow) return { task: m, startUrl: currentUrl!, scrape: true };

  // Bersihkan filler kata ganti/obrolan santai sebelum dilempar ke query pencarian
  const sanitized = m.replace(/\b(?:bro|cuy|gw|gue|aku|saya|mau|tolong|coba|dong|sih|nih|deh|ya|bisa|gak|nggak|gimana|ghimana|daftarin|cari(?:kan|in)?)\b/gi, "").trim();
  if (job && sanitized.length < 3) return null; // Jika cuma kata santai tanpa posisi spesifik, serahkan ke respon chat

  const site = /linkedin|linkedln|linkdel/i.test(m) ? "site:linkedin.com/jobs" : /jobstreet/i.test(m) ? "site:jobstreet.co.id OR site:id.jobstreet.com" : /youtube/i.test(m) ? "site:youtube.com" : "";
  const query = `${site} ${sanitized || m}`.trim();
  return { task: m, startUrl: `https://www.google.com/search?${new URLSearchParams({ q: query })}`, scrape: scrape || (job && /\b(cari(?:kan|in)?|ambil|kumpulkan)\b/i.test(m)) };
}
