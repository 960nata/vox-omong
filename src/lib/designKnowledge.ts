/**
 * Pengetahuan desain untuk code agent: pasangan font, palet, pola halaman, resep animasi, dan aturan dasar.
 * Prinsipnya dirangkum dari skill `frontend-design` (Anthropic) dan skill `refactoring-ui`
 * (edisonmbli/refactoring-ui-skill, turunan dari buku Refactoring UI), ditulis ulang dengan kata sendiri.
 */

// ---------------------------------------------------------------- fonts

/** Font Google yang dipakai: nilai = spesifikasi bobot untuk URL css2 ("" = hanya satu bobot). */
const GF: Record<string, string> = {
  Fraunces: "wght@400;600;700",
  "Instrument Sans": "wght@400;500;600;700",
  "Space Grotesk": "wght@400;500;700",
  "IBM Plex Sans": "wght@400;500;600",
  "JetBrains Mono": "wght@400;500",
  "Cormorant Garamond": "wght@500;600;700",
  Jost: "wght@400;500;600",
  "Bricolage Grotesque": "wght@500;700;800",
  "DM Sans": "wght@400;500;700",
  "Archivo Black": "",
  "Space Mono": "wght@400;700",
  "DM Serif Display": "",
  "Playfair Display": "wght@500;700;800",
  "Source Sans 3": "wght@400;600",
  "Young Serif": "",
  "Inter Tight": "wght@400;500;700",
  Manrope: "wght@400;500;700;800",
  Sora: "wght@400;600;700",
  "Chakra Petch": "wght@400;500;600;700",
  Outfit: "wght@400;500;600;700",
  Syne: "wght@500;700;800",
  Unbounded: "wght@500;700",
  Newsreader: "wght@400;500;600",
  Figtree: "wght@400;500;600;700",
  "Plus Jakarta Sans": "wght@400;500;700;800",
  Lexend: "wght@400;500;600",
  Anton: "",
  Epilogue: "wght@400;500;700;800",
  "Libre Baskerville": "wght@400;700",
  Caveat: "wght@500;700",
  Nunito: "wght@400;600;700",
  Fredoka: "wght@400;500;600;700",
  Gloock: "",
  Lora: "wght@400;500;600;700",
};

export interface FontPairing {
  id: string;
  moods: string[];
  display: string;
  body: string;
  mono?: string;
  note: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  { id: "editorial", moods: ["editorial", "elegan", "berita", "majalah", "budaya"], display: "Fraunces", body: "Instrument Sans", note: "Judul serif besar berkarakter, isi sans bersih. Pakai italic untuk satu kata kunci di judul." },
  { id: "tech", moods: ["tech", "startup", "saas", "ai", "digital", "futuristik"], display: "Space Grotesk", body: "IBM Plex Sans", mono: "JetBrains Mono", note: "Tegas dan teknis. Mono untuk label, angka, dan kode kecil." },
  { id: "luxury", moods: ["mewah", "luxury", "fashion", "hotel", "perhiasan", "spa"], display: "Cormorant Garamond", body: "Jost", note: "Serif tipis untuk judul besar dengan tracking longgar pada label huruf kapital kecil." },
  { id: "playful", moods: ["fun", "anak", "kreatif", "game", "makanan", "playful"], display: "Bricolage Grotesque", body: "DM Sans", note: "Hangat dan sedikit nakal. Judul tebal, bentuk membulat." },
  { id: "brutal", moods: ["brutal", "berani", "musik", "streetwear", "poster"], display: "Archivo Black", body: "Space Mono", note: "Blok teks raksasa, kontras tinggi, tepi keras." },
  { id: "warm", moods: ["kafe", "kopi", "restoran", "organik", "bakery", "hangat"], display: "DM Serif Display", body: "DM Sans", note: "Ramah dan lezat. Judul serif tebal, isi sans netral." },
  { id: "classic", moods: ["hukum", "konsultan", "keuangan", "klasik", "pendidikan", "kampus"], display: "Playfair Display", body: "Source Sans 3", note: "Terpercaya. Hindari terlalu banyak bobot judul." },
  { id: "nusantara", moods: ["nusantara", "budaya", "wisata", "tradisi", "batik", "indonesia"], display: "Young Serif", body: "Instrument Sans", note: "Serif berkarakter hangat; cocok dengan ornamen geometris dan palet tanah." },
  { id: "swiss", moods: ["minimal", "swiss", "arsitektur", "desain", "portfolio", "korporat"], display: "Inter Tight", body: "Inter Tight", mono: "JetBrains Mono", note: "Satu keluarga, kontras lewat ukuran dan bobot. Grid ketat, angka besar." },
  { id: "geometric", moods: ["modern", "produk", "app", "fintech", "kesehatan"], display: "Manrope", body: "Manrope", note: "Geometris ramah; bobot 800 untuk judul, 500 untuk isi." },
  { id: "hologram", moods: ["hologram", "sci-fi", "cyber", "neon", "game", "gelap"], display: "Chakra Petch", body: "Sora", mono: "JetBrains Mono", note: "Sudut terpotong ala HUD. Huruf kapital + tracking lebar untuk label." },
  { id: "bold-display", moods: ["event", "festival", "agency", "kampanye", "olahraga"], display: "Unbounded", body: "Outfit", note: "Lebar dan padat. Pakai hanya untuk judul pendek." },
  { id: "story", moods: ["blog", "cerita", "jurnal", "buku", "penulis"], display: "Newsreader", body: "Figtree", note: "Nyaman dibaca lama. Lebar baris 60–70 karakter." },
  { id: "vintage", moods: ["vintage", "jadul", "klasik", "tempo dulu", "kedai tua", "majalah lama"], display: "Playfair Display", body: "Lora", mono: "Space Mono", note: "Nuansa majalah dan kedai tua: judul serif tebal dengan italic aksen, isi serif nyaman dibaca." },
  { id: "retro", moods: ["retro", "vintage", "70an", "kerajinan", "kedai"], display: "Gloock", body: "Outfit", note: "Serif tebal retro; pasangkan palet mustard-coklat." },
  { id: "friendly", moods: ["edukasi", "komunitas", "anak", "relawan", "sekolah"], display: "Fredoka", body: "Nunito", note: "Bulat dan ramah; jaga ukuran isi ≥ 17px." },
  { id: "creative", moods: ["agency", "studio", "kreatif", "seni", "fotografi"], display: "Syne", body: "Epilogue", note: "Aneh tapi rapi. Syne 800 untuk judul, Epilogue untuk isi." },
];

export function googleFontsLink(...families: (string | undefined)[]): string {
  const uniq = [...new Set(families.filter(Boolean) as string[])];
  const parts = uniq.map((f) => {
    const spec = GF[f];
    const name = f.replace(/ /g, "+");
    return spec ? `family=${name}:${spec}` : `family=${name}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

// ---------------------------------------------------------------- palettes

export interface Palette {
  id: string;
  name: string;
  moods: string[];
  dark: boolean;
  colors: Record<string, string>;
}

export const PALETTES: Palette[] = [
  { id: "senja", name: "Senja Kopi", moods: ["kopi", "kafe", "hangat", "restoran", "bakery"], dark: false, colors: { kertas: "#F6EFE4", tinta: "#2A1B12", aksen: "#C2571A", sekunder: "#6B8E5A", lembut: "#E8D9C3" } },
  { id: "laut", name: "Laut Dangkal", moods: ["wisata", "spa", "kesehatan", "bersih", "pantai"], dark: false, colors: { kertas: "#F3FAF9", tinta: "#0E2F33", aksen: "#0E8F8B", sekunder: "#F2A65A", lembut: "#CFEBE8" } },
  { id: "tengah-malam", name: "Tengah Malam", moods: ["tech", "ai", "futuristik", "gelap", "game", "hologram"], dark: true, colors: { kertas: "#070B14", tinta: "#E6F1FF", aksen: "#5CF2D6", sekunder: "#7C6CFF", lembut: "#121A2B" } },
  { id: "tinta-emas", name: "Tinta & Emas", moods: ["mewah", "luxury", "fashion", "hotel", "perhiasan"], dark: true, colors: { kertas: "#0F0D0A", tinta: "#F4EBDD", aksen: "#C9A45C", sekunder: "#8A6A3B", lembut: "#1B1712" } },
  { id: "kertas-koran", name: "Kertas Koran", moods: ["editorial", "berita", "blog", "majalah", "jurnal"], dark: false, colors: { kertas: "#F4F0E8", tinta: "#1A1A1A", aksen: "#C8102E", sekunder: "#2B4C7E", lembut: "#E4DDCF" } },
  { id: "buah", name: "Pasar Buah", moods: ["fun", "anak", "makanan", "playful", "kreatif"], dark: false, colors: { kertas: "#FFF8EC", tinta: "#241A3A", aksen: "#FF5A36", sekunder: "#FFC93C", lembut: "#FFE3B8" } },
  { id: "indigo-tanah", name: "Indigo & Tanah", moods: ["nusantara", "budaya", "batik", "tradisi", "wisata"], dark: false, colors: { kertas: "#F6EEDF", tinta: "#1B2A4A", aksen: "#B8431E", sekunder: "#D9A441", lembut: "#E9DCC2" } },
  { id: "hutan", name: "Hutan Pagi", moods: ["organik", "alam", "lingkungan", "wellness", "pertanian"], dark: false, colors: { kertas: "#F2F5EC", tinta: "#16301F", aksen: "#2F7D4F", sekunder: "#D98E2B", lembut: "#DDE7CF" } },
  { id: "swiss", name: "Swiss Biru", moods: ["minimal", "korporat", "keuangan", "arsitektur", "portfolio", "swiss"], dark: false, colors: { kertas: "#FFFFFF", tinta: "#0B0B0C", aksen: "#1F4BFF", sekunder: "#8A8A90", lembut: "#F0F0F2" } },
  { id: "sunset", name: "Sunset Pop", moods: ["event", "festival", "musik", "kampanye", "olahraga"], dark: false, colors: { kertas: "#FFF1E6", tinta: "#1F0F24", aksen: "#FF4F5E", sekunder: "#6C3BFF", lembut: "#FFD9BF" } },
  { id: "vintage-kafe", name: "Kedai Tua", moods: ["vintage", "jadul", "klasik", "tempo dulu", "kedai tua", "retro"], dark: false, colors: { kertas: "#F1E6D0", tinta: "#3A2A1D", aksen: "#B5541C", sekunder: "#C9962B", lembut: "#E6D6B8" } },
  { id: "telor-asin", name: "Telor Asin", moods: ["modern", "app", "produk", "kesehatan", "studio"], dark: false, colors: { kertas: "#DDF0EC", tinta: "#11302C", aksen: "#23786E", sekunder: "#D4771F", lembut: "#F3FAF8" } },
  { id: "arang-lime", name: "Arang & Lime", moods: ["agency", "studio", "seni", "berani", "kreatif", "brutal"], dark: true, colors: { kertas: "#101010", tinta: "#F2F2EC", aksen: "#C8FF3D", sekunder: "#FF6B3D", lembut: "#1C1C1C" } },
];

// ---------------------------------------------------------------- page patterns

export interface PagePattern {
  kind: string;
  match: RegExp;
  sections: string[];
  signature: string;
}

export const PAGE_PATTERNS: PagePattern[] = [
  {
    kind: "kuliner",
    match: /\b(kopi|kafe|cafe|restoran|resto|warung|bakery|roti|kue|katering|makanan|minuman|menu)\b/i,
    sections: ["Hero dengan foto besar + jam buka + tombol pesan", "Menu unggulan (kartu foto + harga, filter kategori)", "Cerita tempat / bahan", "Galeri foto masonry", "Testimoni singkat", "Lokasi + jam + peta ilustrasi + form reservasi", "Footer"],
    signature: "Menu interaktif dengan filter kategori dan keranjang kecil yang menjumlah total.",
  },
  {
    kind: "toko",
    match: /\b(toko|shop|store|jual|produk|katalog|fashion|baju|sepatu|kosmetik)\b/i,
    sections: ["Hero kampanye + CTA", "Kategori", "Grid produk (foto, harga, tombol tambah)", "Keunggulan (gratis ongkir, garansi)", "Testimoni", "Form newsletter", "Footer"],
    signature: "Keranjang slide-over yang jalan: tambah, kurangi, total, simpan di localStorage.",
  },
  {
    kind: "portfolio",
    match: /\b(portfolio|portofolio|fotografer|desainer|ilustrator|arsitek|freelance|cv|personal)\b/i,
    sections: ["Hero nama + peran dalam tipografi besar", "Karya terpilih (grid asimetris, hover reveal)", "Tentang + keahlian", "Proses kerja", "Kontak (form tersimpan)", "Footer"],
    signature: "Daftar proyek dengan pratinjau gambar yang mengikuti kursor.",
  },
  {
    kind: "dashboard",
    match: /\b(dashboard|admin|analitik|analytics|laporan|monitoring|statistik)\b/i,
    sections: ["Sidebar + header pencarian", "Kartu KPI dengan sparkline", "Grafik utama (SVG/canvas, tooltip)", "Tabel dengan sort + filter + pencarian", "Panel aktivitas / notifikasi", "Mode terang/gelap"],
    signature: "Grafik interaktif buatan sendiri (tanpa library) dengan tooltip dan rentang waktu yang bisa diganti.",
  },
  {
    kind: "aplikasi",
    match: /\b(game|permainan|kalkulator|todo|to-do|timer|stopwatch|quiz|kuis|aplikasi|app|tracker|catatan|notes|planner)\b/i,
    sections: ["Layar utama langsung berfungsi (bukan landing)", "Kontrol utama besar & jelas", "Status/riwayat tersimpan di localStorage", "Pengaturan kecil", "Umpan balik animasi saat berhasil/gagal"],
    signature: "Satu interaksi inti yang terasa enak: bunyi/animasi kecil, tombol yang punya bobot, keadaan kosong yang mengundang.",
  },
  {
    kind: "edukasi",
    match: /\b(kursus|les|belajar|sekolah|kampus|kelas|bootcamp|pelatihan|edukasi|tutor)\b/i,
    sections: ["Hero janji hasil + CTA daftar", "Materi / kurikulum (accordion)", "Pengajar", "Jadwal & harga paket", "Cerita alumni", "FAQ", "Form daftar (tersimpan)"],
    signature: "Kurikulum accordion + kalkulator paket yang menampilkan harga langsung.",
  },
  {
    kind: "event",
    match: /\b(event|acara|festival|konser|seminar|webinar|undangan|pernikahan|wedding|reuni)\b/i,
    sections: ["Hero tanggal besar + hitung mundur", "Rundown", "Pembicara / pengisi acara", "Lokasi", "Tiket / RSVP (form tersimpan)", "Sponsor", "Footer"],
    signature: "Hitung mundur hidup + RSVP yang menyimpan nama dan jumlah tamu.",
  },
  {
    kind: "saas",
    match: /\b(startup|saas|software|platform|fintech|ai|produk digital|aplikasi mobile)\b/i,
    sections: ["Hero janji + demo produk interaktif", "Logo/bukti sosial", "3 manfaat dengan visual", "Cara kerja (langkah)", "Harga dengan toggle bulanan/tahunan", "FAQ", "CTA akhir"],
    signature: "Demo produk kecil di hero yang benar-benar bisa dicoba.",
  },
  {
    kind: "profil",
    match: /\b(company profile|profil perusahaan|perusahaan|umkm|jasa|kontraktor|klinik|bengkel|salon|studio|konsultan)\b/i,
    sections: ["Hero + nilai jual", "Layanan (kartu)", "Angka/pencapaian", "Tim", "Galeri / proyek", "Testimoni", "Kontak + form (tersimpan)"],
    signature: "Angka pencapaian yang menghitung naik saat terlihat di layar.",
  },
];

const DEFAULT_PATTERN: PagePattern = {
  kind: "umum",
  match: /./,
  sections: ["Hero dengan satu janji kuat + CTA utama", "Bukti/angka", "Manfaat utama", "Cara kerja", "Testimoni", "FAQ", "CTA akhir + footer"],
  signature: "Satu elemen visual yang diingat orang (ilustrasi, tipografi raksasa, atau interaksi kecil).",
};

export function detectKind(request: string): PagePattern {
  return PAGE_PATTERNS.find((p) => p.match.test(request)) || DEFAULT_PATTERN;
}

// ---------------------------------------------------------------- rules & recipes

export const DESIGN_RULES = `
TIPOGRAFI
- Pakai skala ukuran tetap, jangan campur ukuran acak: 12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48 · 60 · 72 px. Teks isi 16–18px.
- Judul besar: line-height 1.05–1.15 dan letter-spacing sedikit negatif (-0.01 s/d -0.03em). Isi: line-height 1.55–1.7.
- Lebar baris isi 45–75 karakter (max-width ≈ 65ch). Paragraf panjang rata kiri, jangan di-center.
- Hierarki dibuat dengan kombinasi ukuran + bobot + warna (teks sekunder lebih pudar), bukan ukuran saja.
- Maksimal 2 keluarga font + 1 mono. Pakai hanya 2–3 bobot. Huruf kapital kecil (label) diberi tracking 0.08–0.2em.
SPASI & TATA LETAK
- Skala spasi kelipatan 4px: 4 8 12 16 24 32 48 64 96 128. Antar section 96–128px di desktop, 56–72px di HP.
- Mulai dari terlalu lega lalu kurangi; grup elemen yang berhubungan lebih rapat daripada jarak antar grup.
- Satu aksi utama per layar. Tombol: primer (terisi), sekunder (garis), tersier (teks) — jangan semuanya terisi.
- Pakai grid yang jelas; sengaja satu elemen "memecah" grid supaya tidak terasa template.
WARNA & PERMUKAAN
- Aturan 60/30/10: latar dominan, permukaan pendukung, aksen hanya untuk hal terpenting.
- Jangan hitam murni di atas putih murni; pakai tinta yang diwarnai (mis. #1A1A1A atau gelap kehijauan). Abu-abu diberi sedikit rona palet.
- Kontras teks isi ≥ 4.5:1, teks besar ≥ 3:1. Teks di atas foto selalu diberi overlay gradasi.
- Bayangan berlapis & lembut (dua lapis: dekat-tajam + jauh-kabur), radius konsisten (satu keluarga: 8/12/20 atau 0).
- Mode gelap: jangan sekadar membalik warna; turunkan kejenuhan aksen dan pakai permukaan bertingkat.
GAMBAR
- Rasio gambar konsisten dalam satu grid; object-fit: cover; tambahkan sudut/overlay agar gambar menyatu dengan palet.
- Satu foto hero yang kuat lebih baik daripada banyak foto sedang. Jangan menempatkan foto stok generik tanpa konteks.
KEADAAN & KUALITAS
- Semua elemen interaktif punya hover, focus-visible (outline jelas), active, dan disabled.
- Keadaan kosong, loading, dan error dirancang (teks yang memberi arah, bukan "Tidak ada data").
- Responsif 360px → 1440px; target sentuh ≥ 44px; tidak ada scroll horizontal.
- Hormati prefers-reduced-motion. Gunakan <button> untuk aksi, <a> untuk navigasi; label form terhubung ke input.`;

export const MOTION_RECIPES = `
RESEP ANIMASI (pilih 3–4 yang cocok, jangan semuanya):
- Reveal saat scroll: IntersectionObserver menambah kelas .in (opacity 0→1, translateY 24→0, 600ms cubic-bezier(.2,.8,.2,1)); beri stagger 60–90ms antar anak.
- Hero masuk berurutan: judul per baris/kata (mask overflow:hidden + translateY 100%→0), lalu subjudul, lalu tombol.
- Angka menghitung naik (requestAnimationFrame, easeOutCubic, 1.2s) saat terlihat.
- Marquee tipis untuk logo/kata kunci (animation linear infinite, pause saat hover).
- Kartu miring 3D mengikuti kursor (perspective 800px, max 6°) hanya di perangkat dengan hover.
- Tombol magnetik / garis bawah yang menyapu pada tautan; kursor kustom hanya bila memperkuat konsep.
- Progress bar scroll di atas halaman; navbar yang menyusut/blur setelah scroll.
- Transisi tema terang/gelap dengan View Transitions API bila tersedia.
- Parallax halus pada foto hero (translateY 0–40px) memakai transform, bukan top.
- Semua animasi dibungkus @media (prefers-reduced-motion: no-preference).`;

// ---------------------------------------------------------------- planner

export interface DesignPlan {
  kind: string;
  sections: string[];
  signature: string;
  pairing: FontPairing;
  palette: Palette;
  fontsLink: string;
}

function score(moods: string[], text: string) {
  return moods.reduce((n, m) => n + (text.includes(m) ? 1 : 0), 0);
}

function pickBest<T extends { moods: string[] }>(items: T[], text: string, avoid?: (item: T) => boolean): T {
  const t = text.toLowerCase();
  const scored = items
    .filter((i) => !avoid?.(i))
    .map((i) => ({ i, s: score(i.moods, t) + Math.random() * 0.9 }))
    .sort((a, b) => b.s - a.s);
  return scored[0].i;
}

/** Pilih pola halaman, pasangan font, dan palet yang cocok dengan permintaan + arah desain. */
export function planDesign(request: string, direction: string): DesignPlan {
  const text = `${request} ${direction}`.toLowerCase();
  const pattern = detectKind(request);
  const wantsDark = /\b(gelap|dark|malam|neon|hologram|futuristik|cyber)\b/.test(text);
  const wantsLight = /\b(terang|light|putih|bersih)\b/.test(text);
  const pairing = pickBest(FONT_PAIRINGS, text);
  const palette = pickBest(PALETTES, text, (p) => (wantsDark && !p.dark) || (wantsLight && p.dark));
  return {
    kind: pattern.kind,
    sections: pattern.sections,
    signature: pattern.signature,
    pairing,
    palette,
    fontsLink: googleFontsLink(pairing.display, pairing.body, pairing.mono),
  };
}

export function describePlan(plan: DesignPlan): string {
  const c = Object.entries(plan.palette.colors)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
  return `RENCANA DESAIN (ikuti, boleh disempurnakan sedikit):
- Jenis halaman: ${plan.kind}
- Font: judul "${plan.pairing.display}", isi "${plan.pairing.body}"${plan.pairing.mono ? `, label/angka "${plan.pairing.mono}"` : ""}. ${plan.pairing.note}
  Muat dengan: <link href="${plan.fontsLink}" rel="stylesheet">
- Palet "${plan.palette.name}" (${plan.palette.dark ? "gelap" : "terang"}): ${c}. Definisikan sebagai CSS variables di :root.
- Bagian halaman yang disarankan: ${plan.sections.map((s, i) => `${i + 1}) ${s}`).join("; ")}
- Elemen khas yang membuat halaman diingat: ${plan.signature}`;
}
