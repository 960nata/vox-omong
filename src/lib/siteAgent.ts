import fs from "fs/promises";
import path from "path";
import {
  callLLM,
  extractBrand,
  GENERATED_MARKER,
  LEAK_LINE,
  leakLines,
  parseJsonLoose,
  ROLE_PREFER,
  sanitizeSlug,
  writeProjectHtml,
  applyDirectRenames,
  type MeetingTurn,
  type WebsiteBuildResult,
} from "./codeAgent";
import { aiSiteTheme } from "./siteDesign";
import { detectKind, FONT_PAIRINGS, googleFontsLink, PALETTES, type Palette } from "./designKnowledge";
import { searchPhotos, searchVideos, trackPhotoUse, type Photo } from "./media";
import { designBrief, productPalette } from "./uiuxKnowledge";
import { skillSection } from "./skillLoader";
import {
  ICON_NAMES,
  mix,
  renderSite,
  type Cta,
  type FormSpec,
  type RadiusKey,
  type Section,
  type SiteMedia,
  type SiteSpec,
  type SiteTheme,
  type StyleKey,
} from "./siteComposer";

/**
 * Agen website berbasis komponen. Model hanya menulis ISI (JSON pendek); tampilan dirakit dari
 * komponen yang sudah didesain (siteComposer). Spesifikasi disimpan (site.spec.json) supaya
 * edit berikutnya bekerja pada data, bukan menambal HTML.
 */

const PROJECTS = path.join(process.cwd(), ".data", "user_projects");

// ---------------------------------------------------------------- jenis & rencana bagian

const APP_KINDS = new Set(["aplikasi", "dashboard"]);
export const isSiteKind = (kind: string) => !APP_KINDS.has(kind);

type SType = Section["type"];

export function sectionPlan(kind: string, request: string): SType[] {
  const r = request.toLowerCase();
  const base: Record<string, SType[]> = {
    kuliner: ["hero", "marquee", "about", "products", "gallery", "testimonials", "contact", "cta"],
    toko: ["hero", "marquee", "features", "products", "about", "testimonials", "faq", "contact", "cta"],
    portfolio: ["hero", "about", "features", "gallery", "steps", "testimonials", "contact", "cta"],
    edukasi: ["hero", "stats", "features", "steps", "pricing", "testimonials", "faq", "contact", "cta"],
    event: ["hero", "stats", "steps", "features", "pricing", "faq", "contact", "cta"],
    saas: ["hero", "marquee", "features", "steps", "pricing", "testimonials", "faq", "cta"],
    profil: ["hero", "stats", "features", "about", "gallery", "testimonials", "faq", "contact", "cta"],
    umum: ["hero", "marquee", "features", "about", "gallery", "testimonials", "faq", "contact", "cta"],
  };
  const plan = [...(base[kind] || base.umum)];
  const add = (t: SType, before: SType = "cta") => {
    if (plan.includes(t)) return;
    const i = plan.indexOf(before);
    plan.splice(i === -1 ? plan.length : i, 0, t);
  };
  const drop = (t: SType) => {
    const i = plan.indexOf(t);
    if (i !== -1) plan.splice(i, 1);
  };
  if (/\b(youtube|yt|video|vlog|tutorial)\b/.test(r)) add("video", "testimonials");
  if (/\b(galeri|gallery|foto)\b/.test(r)) add("gallery", "testimonials");
  if (/\b(harga|paket|pricing|tarif)\b/.test(r)) add("pricing", "faq");
  if (/\b(faq|pertanyaan)\b/.test(r)) add("faq", "contact");
  if (/\b(testimoni|ulasan|review)\b/.test(r)) add("testimonials", "faq");
  if (/\b(menu|katalog|produk|daftar harga)\b/.test(r)) add("products", "gallery");
  if (/\b(form|reservasi|booking|pendaftaran|daftar|kontak|lokasi|alamat)\b/.test(r)) add("contact");
  if (/\b(tanpa|jangan)\s+(?:ada\s+)?(?:faq|galeri|testimoni|harga|video)\b/.test(r)) {
    if (/tanpa\s+(?:ada\s+)?faq/.test(r)) drop("faq");
    if (/tanpa\s+(?:ada\s+)?galeri/.test(r)) drop("gallery");
    if (/tanpa\s+(?:ada\s+)?testimoni/.test(r)) drop("testimonials");
  }
  return plan;
}

// ---------------------------------------------------------------- tema

const STYLE_WORDS: [RegExp, StyleKey][] = [
  [/\b(mewah|luxury|elegan|premium|eksklusif|gelap|dark)\b/i, "luxury"],
  [/\b(berani|brutal|bold|colorful|ramai|nyentrik|poster)\b/i, "bold"],
  [/\b(futuristik|hologram|cyber|neon|tech|teknologi|sci-?fi)\b/i, "tech"],
  [/\b(lucu|fun|ceria|anak|playful|kreatif)\b/i, "playful"],
  [/\b(lembut|pastel|soft|hangat|natural|organik|cozy|nyaman)\b/i, "soft"],
  [/\b(vintage|retro|jadul|tempo dulu|kedai tua|antik|klasik)\b/i, "vintage"],
  [/\b(editorial|majalah|koran)\b/i, "editorial"],
  [/\b(minimal|minimalis|modern|bersih|simple|clean|rapi)\b/i, "clean"],
];

const KIND_STYLE: Record<string, StyleKey> = {
  kuliner: "soft",
  toko: "clean",
  portfolio: "editorial",
  edukasi: "playful",
  event: "bold",
  saas: "clean",
  profil: "clean",
  umum: "editorial",
};

const STYLE_PAIRINGS: Record<StyleKey, string[]> = {
  luxury: ["luxury", "editorial"],
  bold: ["brutal", "bold-display", "creative"],
  tech: ["tech", "hologram"],
  playful: ["playful", "friendly"],
  soft: ["warm", "geometric", "story"],
  editorial: ["editorial", "classic", "story", "nusantara"],
  clean: ["swiss", "geometric", "creative"],
  vintage: ["vintage", "classic"],
};

const STYLE_PALETTES: Record<StyleKey, string[]> = {
  luxury: ["tinta-emas"],
  bold: ["sunset", "buah", "arang-lime"],
  tech: ["tengah-malam", "arang-lime"],
  playful: ["buah", "sunset", "laut"],
  soft: ["senja", "hutan", "laut", "telor-asin"],
  editorial: ["kertas-koran", "indigo-tanah", "senja"],
  clean: ["swiss", "telor-asin", "laut"],
  vintage: ["vintage-kafe"],
};

const STYLE_RADIUS: Record<StyleKey, RadiusKey> = { luxury: "sharp", bold: "sharp", tech: "soft", playful: "round", soft: "soft", editorial: "soft", clean: "soft", vintage: "sharp" };

function shortModelName(m: string) {
  if (!m || m === "-") return "—";
  return m.replace(/^@cf\//, "").split("/").pop()!.replace(/-instruct.*|-fp8.*|:free$/g, "");
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickStyle(text: string, kind: string): StyleKey {
  for (const [re, key] of STYLE_WORDS) if (re.test(text)) return key;
  return KIND_STYLE[kind] || "editorial";
}

export function buildTheme(text: string, kind: string, brand: string, forceStyle?: StyleKey, forceDark?: boolean): SiteTheme {
  const style = forceStyle || pickStyle(text, kind);
  const seed = hash(brand || text);
  const low = text.toLowerCase();

  // palet: kata kunci topik dulu (kopi → senja, wisata → laut, …), lalu daftar palet gaya
  let candidates = STYLE_PALETTES[style];
  // Gaya yang disebut jelas oleh user (atau dipaksa) menang atas tebakan topik. Kata dicocokkan utuh ("ai" tidak boleh cocok di "kayak AI banget" untuk palet teknologi).
  const explicitStyle = !!forceStyle || STYLE_WORDS.some(([re]) => re.test(text));
  const wordHit = (m: string) => new RegExp(`(^|[^\\p{L}])${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(low);
  const byMood = PALETTES.filter((p) => p.moods.some(wordHit));
  const topic = byMood.map((p) => p.id);
  const both = candidates.filter((id) => topic.includes(id));
  if (both.length) candidates = both; // cocok gaya DAN topik (mis. soft + kopi → senja)
  else if (!explicitStyle && topic.length && style !== "luxury" && style !== "tech") candidates = topic;
  let palette: Palette | undefined = PALETTES.find((p) => p.id === candidates[seed % candidates.length]);
  if (forceDark !== undefined) {
    // hormati pilihan gaya: ambil dari kandidat gaya/topik yang cocok dengan terang/gelap; baru bila kosong, dari semua palet
    const fit = candidates.map((id) => PALETTES.find((p) => p.id === id)).filter((p): p is Palette => !!p && p.dark === forceDark);
    const pool = fit.length ? fit : PALETTES.filter((p) => p.dark === forceDark);
    palette = pool[seed % pool.length];
  }
  palette = palette || PALETTES[0];

  const pairingIds = STYLE_PAIRINGS[style];
  const pairing = FONT_PAIRINGS.find((f) => f.id === pairingIds[seed % pairingIds.length]) || FONT_PAIRINGS[0];

  // Topik tidak dikenali palet kurasi kita dan user tidak menyebut gaya/gelap: pakai palet per jenis produk
  // dari UI UX Pro Max (192 kategori, kontras sudah dicek di sumbernya).
  if (!explicitStyle && !topic.length && forceDark === undefined) {
    const up = productPalette(text);
    if (up) {
      return {
        style,
        radius: STYLE_RADIUS[style],
        dark: false,
        display: pairing.display,
        body: pairing.body,
        mono: pairing.mono,
        fontsLink: googleFontsLink(pairing.display, pairing.body, pairing.mono),
        colors: { bg: up.bg, ink: up.ink, accent: up.accent, accent2: up.accent2 },
      };
    }
  }
  const c = palette.colors;
  return {
    style,
    radius: STYLE_RADIUS[style],
    dark: palette.dark,
    display: pairing.display,
    body: pairing.body,
    mono: pairing.mono,
    fontsLink: googleFontsLink(pairing.display, pairing.body, pairing.mono),
    colors: { bg: c.kertas, ink: c.tinta, accent: c.aksen, accent2: c.sekunder, surface: palette.dark ? c.lembut : undefined },
  };
}

// ---------------------------------------------------------------- konten cadangan

export interface Ctx {
  brand: string;
  kind: string;
  city: string;
  request: string;
}

interface KindDef {
  eyebrow: string;
  heroTitle: (b: string) => string;
  heroSub: (c: Ctx) => string;
  cta: string;
  cta2: string;
  marquee: string[];
  features: { icon: string; title: string; text: string }[];
  productsTitle: string;
  productsSub: string;
  products: { name: string; desc: string; price: number; category: string; tag?: string }[];
  about: { title: string; text: string[]; points: string[] };
  steps: { title: string; text: string }[];
  stats: { value: string; label: string }[];
  faq: { q: string; a: string }[];
  pricing: { name: string; price: string; period?: string; features: string[]; highlight?: boolean }[];
  images: Record<string, string>;
  form: FormSpec["kind"];
  ctaTitle: string;
  ctaText: string;
  ctaBtn: string;
  testimonials: { quote: string; name: string; role: string }[];
}

const T_GENERIC = (what: string): KindDef["testimonials"] => [
  { quote: `Pelayanannya ramah dan hasilnya sesuai harapan. ${what} yang bikin betah balik lagi.`, name: "Rina Putri", role: "Pelanggan" },
  { quote: "Responsnya cepat, detailnya rapi, dan harganya masuk akal. Sudah rekomendasikan ke teman-teman.", name: "Dimas Pratama", role: "Pelanggan" },
  { quote: "Kualitasnya konsisten dari awal sampai sekarang. Salah satu tempat favorit saya.", name: "Sari Wulandari", role: "Pelanggan" },
];

const KD: Record<string, KindDef> = {
  kuliner: {
    eyebrow: "Dibuat dengan sepenuh hati",
    heroTitle: (b) => `Rasa yang bikin *betah* di ${b}`,
    heroSub: (c) => `Bahan pilihan, racikan konsisten, dan suasana yang bikin kamu pengen duduk lebih lama${c.city ? ` di ${c.city}` : ""}.`,
    cta: "Lihat menu",
    cta2: "Reservasi meja",
    marquee: ["Dibuat segar setiap hari", "Bahan pilihan", "Racikan khas", "Suasana nyaman", "Pesan antar tersedia", "Ramah untuk semua"],
    features: [
      { icon: "leaf", title: "Bahan pilihan", text: "Kami memilih bahan terbaik dari pemasok yang dipercaya, segar setiap hari." },
      { icon: "cup", title: "Racikan khas", text: "Resep yang dikembangkan berulang kali sampai rasanya pas dan konsisten." },
      { icon: "heart", title: "Suasana hangat", text: "Tempat yang nyaman untuk bekerja, ngobrol, atau sekadar istirahat sejenak." },
    ],
    productsTitle: "Menu *andalan* kami",
    productsSub: "Pilih favoritmu, tambahkan ke keranjang, dan pesan dalam hitungan detik.",
    products: [
      { name: "Signature Latte", desc: "Espresso halus dengan susu creamy dan sentuhan gula aren.", price: 28000, category: "Minuman", tag: "Favorit" },
      { name: "Es Kopi Susu", desc: "Perpaduan klasik yang segar, manis pas, dan menyegarkan.", price: 24000, category: "Minuman" },
      { name: "Manual Brew", desc: "Seduhan tangan dari biji pilihan, aroma dan rasa lebih jernih.", price: 30000, category: "Minuman" },
      { name: "Croissant Mentega", desc: "Berlapis renyah di luar, lembut dan harum di dalam.", price: 26000, category: "Makanan" },
      { name: "Roti Bakar Cokelat", desc: "Roti tebal panggang dengan cokelat leleh dan taburan kacang.", price: 22000, category: "Makanan", tag: "Baru" },
      { name: "Nasi Ayam Sambal Matah", desc: "Ayam bakar bumbu rempah, sambal matah segar, dan nasi hangat.", price: 38000, category: "Makanan" },
    ],
    about: {
      title: "Cerita di balik *setiap sajian*",
      text: ["Kami memulai dari dapur kecil dengan satu keyakinan: makanan dan minuman yang enak lahir dari kesabaran, bahan yang jujur, dan perhatian pada detail.", "Hari ini, tempat ini menjadi ruang bertemu bagi teman, keluarga, dan siapa pun yang ingin menikmati hari dengan lebih pelan."],
      points: ["Bahan segar dan diolah setiap hari", "Resep dikembangkan sendiri", "Pelayanan ramah dan cepat"],
    },
    steps: [],
    stats: [],
    faq: [],
    pricing: [],
    images: { hero: "specialty coffee shop", about: "barista pouring coffee", menu: "coffee and pastry", gallery: "cafe interior coffee" },
    form: "reservasi",
    ctaTitle: "Yuk, mampir dan *cicipi sendiri*",
    ctaText: "Pesan meja dulu atau langsung datang. Kami siap menyambutmu.",
    ctaBtn: "Reservasi sekarang",
    testimonials: T_GENERIC("Rasanya"),
  },
  toko: {
    eyebrow: "Pilihan terbaik untukmu",
    heroTitle: (b) => `Temukan yang kamu cari di *${b}*`,
    heroSub: () => "Produk pilihan dengan kualitas terjaga, harga jelas, dan pengiriman yang bisa diandalkan.",
    cta: "Belanja sekarang",
    cta2: "Tentang kami",
    marquee: ["Kualitas terjaga", "Gratis ongkir area tertentu", "Garansi kepuasan", "Pembayaran mudah", "Dikirim cepat"],
    features: [
      { icon: "shield", title: "Kualitas terjaga", text: "Setiap produk dicek sebelum dikirim supaya sampai dalam kondisi terbaik." },
      { icon: "truck", title: "Pengiriman cepat", text: "Dikemas rapi dan dikirim secepatnya ke seluruh Indonesia." },
      { icon: "chat", title: "Layanan responsif", text: "Ada pertanyaan? Tim kami siap membantu lewat WhatsApp." },
    ],
    productsTitle: "Produk *pilihan*",
    productsSub: "Koleksi yang paling sering dicari pelanggan kami.",
    products: [
      { name: "Produk Unggulan", desc: "Pilihan terlaris dengan kualitas terbaik di kelasnya.", price: 129000, category: "Terlaris", tag: "Terlaris" },
      { name: "Edisi Spesial", desc: "Desain terbatas dengan detail yang lebih istimewa.", price: 189000, category: "Spesial" },
      { name: "Paket Hemat", desc: "Kombinasi produk favorit dengan harga lebih bersahabat.", price: 99000, category: "Terlaris", tag: "Hemat" },
      { name: "Koleksi Klasik", desc: "Model abadi yang cocok untuk berbagai kesempatan.", price: 149000, category: "Klasik" },
      { name: "Koleksi Terbaru", desc: "Rilisan terbaru dengan sentuhan segar.", price: 169000, category: "Spesial", tag: "Baru" },
      { name: "Aksesori Pelengkap", desc: "Pelengkap sempurna untuk melengkapi pilihanmu.", price: 59000, category: "Klasik" },
    ],
    about: {
      title: "Dibuat dan dipilih *dengan teliti*",
      text: ["Kami percaya belanja itu harus menyenangkan: produknya jelas, harganya jujur, dan layanannya bisa dipercaya.", "Setiap koleksi kami pilih langsung, kami cek kualitasnya, lalu kami kemas dengan rapi sebelum sampai ke tanganmu."],
      points: ["Dicek satu per satu sebelum dikirim", "Harga jelas tanpa biaya tersembunyi", "Bantuan lewat WhatsApp"],
    },
    steps: [],
    stats: [],
    faq: [
      { q: "Berapa lama pengirimannya?", a: "Pesanan diproses di hari yang sama bila masuk sebelum jam 15.00. Estimasi tiba 1–4 hari kerja tergantung kota tujuan." },
      { q: "Apakah bisa tukar atau retur?", a: "Bisa. Hubungi kami maksimal 3 hari setelah barang diterima dengan foto kondisi barang, nanti kami bantu prosesnya." },
      { q: "Metode pembayaran apa saja yang tersedia?", a: "Transfer bank, e-wallet, dan QRIS. Detailnya kami kirim setelah pesananmu masuk." },
      { q: "Apakah stoknya selalu tersedia?", a: "Stok diperbarui rutin. Kalau ada yang habis, kami kabari dan tawarkan alternatif terdekat." },
    ],
    pricing: [],
    images: { hero: "online shop products", about: "small business packaging", menu: "product flatlay", gallery: "lifestyle products" },
    form: "kontak",
    ctaTitle: "Belum yakin? *Tanya kami dulu*",
    ctaText: "Kami senang membantu kamu memilih yang paling cocok.",
    ctaBtn: "Hubungi kami",
    testimonials: T_GENERIC("Barangnya"),
  },
  edukasi: {
    eyebrow: "Belajar jadi lebih mudah",
    heroTitle: (b) => `Belajar bareng *${b}*, hasilnya terasa`,
    heroSub: () => "Kelas terstruktur, pengajar berpengalaman, dan latihan nyata supaya kemajuanmu terlihat dari minggu ke minggu.",
    cta: "Daftar sekarang",
    cta2: "Lihat paket",
    marquee: [],
    features: [
      { icon: "users", title: "Kelas kecil", text: "Jumlah peserta dibatasi supaya setiap orang dapat perhatian." },
      { icon: "book", title: "Materi terstruktur", text: "Dari dasar sampai mahir, dengan target jelas di setiap pertemuan." },
      { icon: "bolt", title: "Praktik langsung", text: "Latihan nyata dan umpan balik cepat dari pengajar." },
    ],
    productsTitle: "Program",
    productsSub: "",
    products: [],
    about: { title: "Cara belajar yang *masuk akal*", text: ["Kami merancang kelas dari kebutuhan peserta: apa yang ingin dicapai, berapa waktu yang ada, dan bagaimana cara belajar yang cocok.", "Hasilnya, kamu tahu apa yang dipelajari hari ini dan untuk apa."], points: ["Tes awal untuk menentukan level", "Rekaman kelas untuk diulang", "Konsultasi di luar jam kelas"] },
    steps: [
      { title: "Tes level", text: "Kami mengukur kemampuan awalmu supaya ditempatkan di kelas yang tepat." },
      { title: "Belajar terarah", text: "Ikuti jadwal kelas dengan materi dan latihan yang sudah disusun." },
      { title: "Evaluasi berkala", text: "Pantau perkembanganmu lewat evaluasi dan umpan balik pengajar." },
      { title: "Capai targetmu", text: "Naik level sampai target tercapai, lalu lanjutkan sesuai kebutuhan." },
    ],
    stats: [
      { value: "1.200+", label: "Peserta pernah belajar" },
      { value: "4,8", label: "Rata-rata penilaian kelas" },
      { value: "12", label: "Pengajar berpengalaman" },
    ],
    faq: [
      { q: "Apakah cocok untuk pemula?", a: "Cocok. Ada tes awal singkat sehingga kamu ditempatkan di level yang sesuai." },
      { q: "Bagaimana kalau berhalangan hadir?", a: "Setiap sesi direkam, dan kamu bisa menjadwalkan ulang sesuai ketentuan paket." },
      { q: "Berapa lama sampai terlihat hasilnya?", a: "Umumnya perubahan terasa setelah 4–6 pertemuan bila rutin berlatih." },
      { q: "Bisa bayar dengan cicilan?", a: "Bisa untuk paket tertentu. Hubungi kami untuk detailnya." },
    ],
    pricing: [
      { name: "Dasar", price: "Rp 350.000", period: "/bulan", features: ["4 pertemuan kelas", "Materi digital", "Grup diskusi"] },
      { name: "Intensif", price: "Rp 650.000", period: "/bulan", features: ["8 pertemuan kelas", "Evaluasi mingguan", "Konsultasi pribadi", "Rekaman kelas"], highlight: true },
      { name: "Privat", price: "Rp 1.200.000", period: "/bulan", features: ["Jadwal fleksibel", "Pengajar pribadi", "Materi khusus targetmu"] },
    ],
    images: { hero: "students learning online", about: "classroom teacher", menu: "study desk", gallery: "students group study" },
    form: "daftar",
    ctaTitle: "Mulai langkah pertamamu *hari ini*",
    ctaText: "Daftar dan ikuti tes level gratis. Tanpa komitmen.",
    ctaBtn: "Daftar sekarang",
    testimonials: T_GENERIC("Cara belajarnya"),
  },
  profil: {
    eyebrow: "Mitra yang bisa diandalkan",
    heroTitle: (b) => `*${b}*: kerja rapi, hasil terasa`,
    heroSub: () => "Kami mengerjakan setiap proyek dengan standar jelas, komunikasi terbuka, dan hasil yang bisa dipertanggungjawabkan.",
    cta: "Konsultasi gratis",
    cta2: "Lihat layanan",
    marquee: ["Terpercaya", "Tepat waktu", "Harga transparan", "Garansi pekerjaan", "Tim berpengalaman"],
    features: [
      { icon: "shield", title: "Standar jelas", text: "Setiap pekerjaan mengikuti prosedur dan pemeriksaan kualitas yang tertulis." },
      { icon: "clock", title: "Tepat waktu", text: "Jadwal disepakati di awal dan kami kabari bila ada perubahan." },
      { icon: "users", title: "Tim berpengalaman", text: "Dikerjakan orang-orang yang sudah terbiasa dengan kebutuhan seperti milikmu." },
    ],
    productsTitle: "Layanan",
    productsSub: "",
    products: [],
    about: { title: "Kami bekerja *seperti yang kami janjikan*", text: ["Kami memulai dari satu prinsip sederhana: kerjakan dengan benar, jelaskan dengan jujur, dan selesaikan sesuai kesepakatan.", "Itulah yang membuat pelanggan kami kembali dan merekomendasikan kami."], points: ["Penawaran tertulis dan transparan", "Progres dilaporkan berkala", "Garansi pekerjaan"] },
    steps: [
      { title: "Konsultasi", text: "Ceritakan kebutuhanmu, kami dengarkan dan beri masukan." },
      { title: "Penawaran", text: "Kami kirim rincian pekerjaan, waktu, dan biaya yang jelas." },
      { title: "Pengerjaan", text: "Tim bekerja sesuai jadwal dengan laporan progres." },
      { title: "Serah terima", text: "Kamu cek hasilnya, kami rapikan sampai sesuai." },
    ],
    stats: [
      { value: "300+", label: "Proyek selesai" },
      { value: "98%", label: "Pelanggan puas" },
      { value: "10", label: "Tahun pengalaman" },
    ],
    faq: [
      { q: "Bagaimana cara memulai?", a: "Hubungi kami lewat form atau WhatsApp. Kami jadwalkan konsultasi singkat tanpa biaya." },
      { q: "Berapa lama pengerjaannya?", a: "Tergantung lingkup. Estimasi waktu kami cantumkan di penawaran sebelum pekerjaan dimulai." },
      { q: "Apakah ada garansi?", a: "Ada. Pekerjaan bergaransi sesuai ketentuan yang tertulis di penawaran." },
    ],
    pricing: [],
    images: { hero: "professional team working", about: "team meeting office", menu: "workspace", gallery: "project work site" },
    form: "kontak",
    ctaTitle: "Siap membahas *kebutuhanmu*?",
    ctaText: "Konsultasi pertama gratis dan tanpa kewajiban.",
    ctaBtn: "Hubungi kami",
    testimonials: T_GENERIC("Hasil kerjanya"),
  },
};
KD.portfolio = { ...KD.profil, eyebrow: "Karya terpilih", heroTitle: (b) => `Halo, saya *${b}*`, heroSub: () => "Saya mengubah ide menjadi karya yang rapi, hidup, dan sesuai tujuan klien.", cta: "Lihat karya", cta2: "Hubungi saya", images: { hero: "creative designer portrait", about: "designer workspace", menu: "design work", gallery: "design portfolio" }, ctaTitle: "Punya proyek? *Mari ngobrol*", ctaText: "Ceritakan idemu, kita cari cara terbaik mewujudkannya." };
KD.event = { ...KD.edukasi, eyebrow: "Jangan sampai ketinggalan", heroTitle: (b) => `*${b}*: satu hari yang bakal kamu ingat`, heroSub: () => "Pembicara, pengalaman, dan orang-orang baru dalam satu acara.", cta: "Amankan tiketmu", cta2: "Lihat rundown", images: { hero: "conference stage audience", about: "event crowd", menu: "event speakers", gallery: "event moments" }, ctaTitle: "Kursi terbatas, *daftar sekarang*", ctaText: "Pendaftaran gratis untuk 100 peserta pertama.", ctaBtn: "Daftar sekarang" };
KD.saas = { ...KD.profil, eyebrow: "Platform modern", heroTitle: (b) => `Kerja lebih ringan dengan *${b}*`, heroSub: () => "Satu tempat untuk mengatur pekerjaan tim, tanpa ribet dan tanpa pelatihan panjang.", cta: "Coba gratis", cta2: "Lihat cara kerja", images: { hero: "team using laptop dashboard", about: "startup office", menu: "software interface", gallery: "team collaboration" }, pricing: KD.edukasi.pricing, ctaTitle: "Mulai *gratis* hari ini", ctaText: "Tanpa kartu kredit. Batalkan kapan saja.", ctaBtn: "Coba gratis" };
KD.umum = { ...KD.profil };

function kdOf(kind: string): KindDef {
  return KD[kind] || KD.umum;
}

const IMG_KEYS = ["hero", "about", "menu", "gallery"] as const;

function defaultSection(type: SType, c: Ctx): Section | null {
  const base = kdOf(c.kind);
  // bagian yang tidak didefinisikan untuk jenis ini memakai isi umum (mis. FAQ untuk kafe)
  const k: KindDef = {
    ...base,
    steps: base.steps.length ? base.steps : KD.profil.steps,
    stats: base.stats.length ? base.stats : KD.profil.stats,
    faq: base.faq.length ? base.faq : KD.profil.faq,
    pricing: base.pricing.length ? base.pricing : KD.edukasi.pricing,
    marquee: base.marquee.length ? base.marquee : KD.profil.marquee,
  };
  switch (type) {
    case "hero":
      return { type, variant: (["split", "full", "center", "split"] as const)[hash(`${c.brand}|${c.kind}|${c.request}`) % 4], eyebrow: k.eyebrow, title: k.heroTitle(c.brand), subtitle: k.heroSub(c), cta: { label: k.cta, href: k.products.length ? "#" : "#kontak" }, cta2: { label: k.cta2, href: "#" }, image: "hero", badge: "Dipercaya pelanggan", badgeNote: "Dinilai ramah dan konsisten" };
    case "marquee":
      return k.marquee.length ? { type, items: k.marquee } : null;
    case "features":
      return { type, eyebrow: "Kenapa kami", title: `Kenapa memilih *${c.brand}*`, subtitle: "Tiga hal yang selalu kami jaga.", items: k.features };
    case "products":
      return k.products.length ? { type, eyebrow: c.kind === "kuliner" ? "Menu" : "Katalog", title: k.productsTitle, subtitle: k.productsSub, cart: true, items: k.products.map((p) => ({ ...p, image: "menu" })) } : null;
    case "gallery":
      return { type, eyebrow: "Galeri", title: "Sekilas *suasananya*", subtitle: "Momen dan detail yang membuat kami berbeda.", image: "gallery" };
    case "about":
      return { type, eyebrow: "Tentang kami", title: k.about.title, text: k.about.text, image: "about", points: k.about.points };
    case "steps":
      return k.steps.length ? { type, eyebrow: "Cara kerja", title: "Langkahnya *sederhana*", subtitle: "Dari awal sampai selesai, kamu selalu tahu posisimu.", items: k.steps } : null;
    case "stats":
      return k.stats.length ? { type, items: k.stats } : null;
    case "testimonials":
      return { type, eyebrow: "Kata mereka", title: "Apa kata *pelanggan*", items: k.testimonials };
    case "pricing":
      return k.pricing.length ? { type, eyebrow: "Paket", title: "Pilih yang *paling pas*", subtitle: "Harga jelas, tanpa biaya tersembunyi.", plans: k.pricing.map((p) => ({ ...p, cta: "Pilih paket" })) } : null;
    case "faq":
      return k.faq.length ? { type, eyebrow: "FAQ", title: "Pertanyaan yang *sering muncul*", items: k.faq } : null;
    case "video":
      return { type, eyebrow: "Video", title: "Tonton *ceritanya*", subtitle: "Cuplikan singkat supaya kamu kebayang suasananya." };
    case "contact":
      return {
        type,
        eyebrow: "Kontak",
        title: k.form === "reservasi" ? "Reservasi & *lokasi*" : "Mari *terhubung*",
        subtitle: "Isi formulir atau datang langsung. Kami balas secepatnya.",
        address: c.city ? `Alamat lengkap, ${c.city}` : "Alamat lengkap tempat kamu",
        hours: [
          { day: "Senin – Jumat", time: "09.00 – 21.00" },
          { day: "Sabtu – Minggu", time: "08.00 – 22.00" },
        ],
        form: { kind: k.form },
      };
    case "form":
      return { type, title: "Hubungi *kami*", form: { kind: k.form } };
    case "cta":
      return { type, title: k.ctaTitle, text: k.ctaText, cta: { label: k.ctaBtn, href: "#kontak" } };
  }
  return null;
}

// ---------------------------------------------------------------- normalisasi JSON model

const S = (v: unknown, max = 200): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const A = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const O = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function cta(v: unknown, fb?: Cta): Cta | undefined {
  const o = O(v);
  const label = S(o.label, 40);
  if (!label) return fb;
  let href = S(o.href, 80);
  if (!/^(#|https?:\/\/|mailto:|tel:)/.test(href)) href = fb?.href || "#kontak";
  return { label, href };
}

function priceNum(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === "string") {
    const digits = v.replace(/[^\d]/g, "");
    if (digits) {
      let n = parseInt(digits, 10);
      if (/rb|k\b/i.test(v) && n < 1000) n *= 1000;
      return n > 0 ? n : undefined;
    }
  }
  return undefined;
}

function sanitize(type: SType, raw: Record<string, unknown>, d: Section | null, leak: (s: string) => boolean): Section | null {
  const clean = (v: unknown, max: number, fb = ""): string => {
    const t = S(v, max);
    return t && !leak(t) ? t : fb;
  };
  const items = <T,>(arr: unknown, map: (o: Record<string, unknown>) => T | null, fb: T[], min: number, max: number): T[] => {
    const out = A(arr).map((x) => map(O(x))).filter(Boolean) as T[];
    const merged = out.length >= min ? out : [...out, ...fb.slice(out.length)];
    return merged.slice(0, max);
  };
  switch (type) {
    case "hero": {
      const fb = d as Extract<Section, { type: "hero" }>;
      return {
        type,
        variant: raw.variant === "full" || raw.variant === "center" ? raw.variant : fb.variant,
        eyebrow: clean(raw.eyebrow, 60, fb.eyebrow),
        title: clean(raw.title, 90, fb.title),
        subtitle: clean(raw.subtitle, 220, fb.subtitle),
        cta: cta(raw.cta, fb.cta),
        cta2: cta(raw.cta2, fb.cta2),
        image: "hero",
        badge: clean(raw.badge, 40, fb.badge),
        badgeNote: clean(raw.badgeNote, 50, fb.badgeNote),
        stats: items(raw.stats, (o) => (S(o.value, 12) && S(o.label, 36) ? { value: S(o.value, 12), label: S(o.label, 36) } : null), [], 0, 3),
      };
    }
    case "marquee": {
      const list = A(raw.items).map((x) => clean(x, 40)).filter(Boolean);
      const fb = (d as Extract<Section, { type: "marquee" }> | null)?.items || [];
      return { type, items: (list.length >= 3 ? list : fb).slice(0, 8) };
    }
    case "features": {
      const fb = d as Extract<Section, { type: "features" }>;
      return {
        type,
        eyebrow: clean(raw.eyebrow, 40, fb.eyebrow),
        title: clean(raw.title, 80, fb.title),
        subtitle: clean(raw.subtitle, 180, fb.subtitle),
        items: items(raw.items, (o) => (clean(o.title, 50) && clean(o.text, 200) ? { icon: ICON_NAMES.includes(S(o.icon, 20)) ? S(o.icon, 20) : "sparkle", title: clean(o.title, 50), text: clean(o.text, 200) } : null), fb.items, 3, 6),
      };
    }
    case "products": {
      const fb = d as Extract<Section, { type: "products" }>;
      return {
        type,
        eyebrow: clean(raw.eyebrow, 40, fb.eyebrow),
        title: clean(raw.title, 80, fb.title),
        subtitle: clean(raw.subtitle, 180, fb.subtitle),
        cart: raw.cart === false ? false : true,
        items: items(
          raw.items,
          (o) => (clean(o.name, 60) ? { name: clean(o.name, 60), desc: clean(o.desc, 140), price: priceNum(o.price), category: clean(o.category, 24), image: "menu", tag: clean(o.tag, 16) } : null),
          fb.items,
          4,
          12
        ),
      };
    }
    case "gallery": {
      const fb = d as Extract<Section, { type: "gallery" }>;
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), subtitle: clean(raw.subtitle, 160, fb.subtitle), image: "gallery" };
    }
    case "about": {
      const fb = d as Extract<Section, { type: "about" }>;
      const text = A(raw.text).map((x) => clean(x, 420)).filter(Boolean);
      const points = A(raw.points).map((x) => clean(x, 90)).filter(Boolean);
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 90, fb.title), text: (text.length ? text : fb.text).slice(0, 3), image: "about", points: (points.length >= 2 ? points : fb.points || []).slice(0, 4), flip: raw.flip === true };
    }
    case "steps": {
      const fb = d as Extract<Section, { type: "steps" }>;
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), subtitle: clean(raw.subtitle, 160, fb.subtitle), items: items(raw.items, (o) => (clean(o.title, 40) && clean(o.text, 170) ? { title: clean(o.title, 40), text: clean(o.text, 170) } : null), fb.items, 3, 5) };
    }
    case "stats": {
      const fb = d as Extract<Section, { type: "stats" }>;
      return { type, items: items(raw.items, (o) => (S(o.value, 14) && clean(o.label, 40) ? { value: S(o.value, 14), label: clean(o.label, 40) } : null), fb.items, 3, 4) };
    }
    case "testimonials": {
      const fb = d as Extract<Section, { type: "testimonials" }>;
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), items: items(raw.items, (o) => (clean(o.quote, 230) && clean(o.name, 40) ? { quote: clean(o.quote, 230), name: clean(o.name, 40), role: clean(o.role, 40) } : null), fb.items, 3, 6) };
    }
    case "pricing": {
      const fb = d as Extract<Section, { type: "pricing" }>;
      const plans = items(
        raw.plans,
        (o) => (clean(o.name, 30) && S(o.price, 24) ? { name: clean(o.name, 30), price: S(o.price, 24), period: S(o.period, 14), features: A(o.features).map((x) => clean(x, 70)).filter(Boolean).slice(0, 7), highlight: o.highlight === true, cta: clean(o.cta, 24) } : null),
        fb.plans,
        2,
        4
      ).filter((p) => p.features.length);
      const final = plans.length >= 2 ? plans : fb.plans;
      if (!final.some((p) => p.highlight) && final.length >= 3) final[1] = { ...final[1], highlight: true };
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), subtitle: clean(raw.subtitle, 160, fb.subtitle), plans: final };
    }
    case "faq": {
      const fb = d as Extract<Section, { type: "faq" }>;
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), items: items(raw.items, (o) => (clean(o.q, 110) && clean(o.a, 380) ? { q: clean(o.q, 110), a: clean(o.a, 380) } : null), fb.items, 3, 8) };
    }
    case "video": {
      const fb = d as Extract<Section, { type: "video" }>;
      return { type, eyebrow: clean(raw.eyebrow, 40, fb.eyebrow), title: clean(raw.title, 80, fb.title), subtitle: clean(raw.subtitle, 160, fb.subtitle) };
    }
    case "contact": {
      const fb = d as Extract<Section, { type: "contact" }>;
      const hours = A(raw.hours).map((x) => O(x)).filter((o) => S(o.day, 24) && S(o.time, 24)).map((o) => ({ day: S(o.day, 24), time: S(o.time, 24) })).slice(0, 5);
      const formKind = S(O(raw.form).kind, 12);
      const kinds: FormSpec["kind"][] = ["reservasi", "kontak", "daftar", "pesan"];
      return {
        type,
        eyebrow: clean(raw.eyebrow, 40, fb.eyebrow),
        title: clean(raw.title, 80, fb.title),
        subtitle: clean(raw.subtitle, 170, fb.subtitle),
        address: clean(raw.address, 140, fb.address),
        hours: hours.length ? hours : fb.hours,
        phone: S(raw.phone, 30) || undefined,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S(raw.email, 80)) ? S(raw.email, 80) : undefined,
        form: { kind: (kinds as string[]).includes(formKind) ? (formKind as FormSpec["kind"]) : fb.form?.kind || "kontak" },
      };
    }
    case "form":
      return d;
    case "cta": {
      const fb = d as Extract<Section, { type: "cta" }>;
      return { type, title: clean(raw.title, 80, fb.title), text: clean(raw.text, 170, fb.text), cta: cta(raw.cta, fb.cta) || fb.cta };
    }
  }
  return d;
}

/** Penanda aksen *kata* hanya berlaku di judul; di bidang lain (marquee, deskripsi, dll.) tanda bintang dibuang. */
function stripStars(node: unknown, key = ""): void {
  if (Array.isArray(node)) {
    node.forEach((x, i) => {
      if (typeof x === "string") node[i] = x.replace(/\*/g, "");
      else stripStars(x);
    });
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (typeof o[k] === "string") {
        if (k !== "title") o[k] = (o[k] as string).replace(/\*/g, "");
      } else stripStars(o[k], k);
    }
  }
  void key;
}

export function normalizeSpec(raw: unknown, c: Ctx, plan: SType[], theme: SiteTheme): { spec: SiteSpec; usedFallback: string[] } {
  const r = O(raw);
  const leakOn = !LEAK_LINE.test(c.request);
  const leak = (s: string) => leakOn && LEAK_LINE.test(s);
  const brand = (S(r.brand, 40) && !leak(S(r.brand, 40)) ? S(r.brand, 40) : "") || c.brand;
  const ctx = { ...c, brand };
  const rawSections = A(r.sections).map((x) => O(x));
  const used = new Set<number>();
  const usedFallback: string[] = [];
  const sections: Section[] = [];

  for (const type of plan) {
    const def = defaultSection(type, ctx);
    const idx = rawSections.findIndex((s, i) => !used.has(i) && s.type === type);
    if (idx === -1) {
      if (def) {
        sections.push(def);
        usedFallback.push(type);
      }
      continue;
    }
    used.add(idx);
    const base = def || ({ type } as Section);
    const sec = sanitize(type, rawSections[idx], base, leak);
    if (sec) stripStars(sec);
    if (sec) {
      // model kadang menyalin pilihan dari contoh skema mentah-mentah (mis. eyebrow "Menu/Katalog")
      const fbEyebrow = (base as { eyebrow?: string }).eyebrow;
      const e = (sec as { eyebrow?: string }).eyebrow;
      if (e && (/[\/|]/.test(e) || /^(…|label kecil|judul)/i.test(e))) (sec as { eyebrow?: string }).eyebrow = fbEyebrow;
      sections.push(sec);
    }
  }

  // gabungkan form yang berdiri sendiri ke kontak
  const hasContact = sections.some((s) => s.type === "contact");
  const cleaned = sections.filter((s) => !(s.type === "form" && hasContact));

  const defImages = kdOf(c.kind).images;
  const imgRaw = O(r.images);
  const images: Record<string, string> = {};
  for (const k of IMG_KEYS) {
    const q = S(imgRaw[k], 60).replace(/[^\p{L}\p{N}\s-]/gu, "");
    images[k] = q && /^[\x20-\x7E]+$/.test(q) && !leak(q) ? q : defImages[k] || defImages.hero;
  }

  const tagline = S(r.tagline, 70);
  const desc = S(r.description, 200);
  const wa = S(r.whatsapp, 20).replace(/\D/g, "");
  return {
    spec: {
      brand,
      tagline: tagline && !leak(tagline) ? tagline : undefined,
      description: desc && !leak(desc) ? desc : undefined,
      kind: c.kind,
      whatsapp: /^62\d{8,13}$/.test(wa) ? wa : undefined,
      theme,
      images,
      sections: cleaned,
    },
    usedFallback,
  };
}

// ---------------------------------------------------------------- prompt model

const SCHEMA: Record<SType, string> = {
  hero: '{"type":"hero","eyebrow":"label kecil","title":"judul kuat ≤9 kata, bungkus 1-2 kata dengan *bintang*","subtitle":"1-2 kalimat","cta":{"label":"…","href":"#kontak"},"cta2":{"label":"…","href":"#tentang"},"badge":"mis. Dinilai 4,9 oleh pelanggan","badgeNote":"…"}',
  marquee: '{"type":"marquee","items":["6 frasa pendek khas usaha ini"]}',
  features: '{"type":"features","eyebrow":"…","title":"…","subtitle":"…","items":[{"icon":"<ikon>","title":"…","text":"…"} ×3-6]}',
  products: '{"type":"products","eyebrow":"Menu/Katalog","title":"…","subtitle":"…","items":[{"name":"…","desc":"≤14 kata","price":28000,"category":"…","tag":"Favorit|Baru|(kosong)"} ×6-9 dengan 2-3 kategori]}',
  gallery: '{"type":"gallery","eyebrow":"Galeri","title":"…","subtitle":"…"}',
  about: '{"type":"about","eyebrow":"Tentang kami","title":"…","text":["paragraf 1","paragraf 2"],"points":["3-4 poin singkat"]}',
  steps: '{"type":"steps","eyebrow":"Cara kerja","title":"…","subtitle":"…","items":[{"title":"…","text":"…"} ×3-4]}',
  stats: '{"type":"stats","items":[{"value":"1.200+","label":"…"} ×3]}',
  testimonials: '{"type":"testimonials","eyebrow":"…","title":"…","items":[{"quote":"…","name":"nama depan + belakang fiktif","role":"…"} ×3]}',
  pricing: '{"type":"pricing","eyebrow":"Paket","title":"…","subtitle":"…","plans":[{"name":"…","price":"Rp 150.000","period":"/bulan","features":["…"],"highlight":false,"cta":"Pilih paket"} ×3, satu highlight:true]}',
  faq: '{"type":"faq","eyebrow":"FAQ","title":"…","items":[{"q":"…","a":"…"} ×4-5]}',
  video: '{"type":"video","eyebrow":"Video","title":"…","subtitle":"…"}',
  contact: '{"type":"contact","eyebrow":"Kontak","title":"…","subtitle":"…","address":"alamat realistis","hours":[{"day":"Senin – Jumat","time":"09.00 – 21.00"} ×2-3],"phone":"","email":"","form":{"kind":"reservasi|kontak|daftar|pesan"}}',
  form: '{"type":"form","title":"…","form":{"kind":"kontak"}}',
  cta: '{"type":"cta","title":"…","text":"…","cta":{"label":"…","href":"#kontak"}}',
};


// ---------------------------------------------------------------- pengontrol mutu isi (deterministik)

const FILLER = /\b(berkualitas|terbaik|terpercaya|profesional|nikmati|terjangkau|berpengalaman|memuaskan|solusi|unggulan)\b/gi;
const wc = (t?: string) => (t || "").trim().split(/\s+/).filter(Boolean).length;
const dupes = (list: string[]) => list.length - new Set(list.map((x) => x.toLowerCase().trim())).size;
const fillerRatio = (t: string) => (wc(t) ? ((t.match(FILLER) || []).length / wc(t)) : 0);

export interface QualityResult {
  score: number;
  issues: string[];
}

/** Nilai satu bagian 0–100 dari ciri yang bisa diukur mesin: panjang, kekhasan, duplikat, kata klise. */
export function scoreSection(sec: Section): QualityResult {
  let score = 100;
  const issues: string[] = [];
  const pen = (n: number, msg: string) => {
    score -= n;
    issues.push(msg);
  };
  switch (sec.type) {
    case "hero": {
      if (wc(sec.title) < 3) pen(25, "judul hero terlalu pendek (minimal 3 kata)");
      if (wc(sec.title) > 12) pen(15, "judul hero terlalu panjang (maks 10 kata)");
      if (wc(sec.subtitle) < 10) pen(25, "subjudul hero kurang dari 10 kata; jelaskan nilai khas usaha ini");
      if (fillerRatio(`${sec.title} ${sec.subtitle || ""}`) > 0.18) pen(15, "terlalu banyak kata klise (berkualitas/terbaik/terpercaya); ganti dengan hal konkret");
      break;
    }
    case "products": {
      const short = sec.items.filter((i) => wc(i.desc) < 6);
      if (short.length) pen(Math.min(40, short.length * 8), `${short.length} deskripsi item kurang dari 6 kata (mis. "${short[0].desc || short[0].name}"); tulis 8–14 kata: bahan, rasa/cara penyajian`);
      const d = dupes(sec.items.map((i) => i.desc || ""));
      if (d) pen(15, "ada deskripsi item yang sama; setiap item harus beda");
      if (sec.items.some((i) => /^(produk|menu|item|barang)\s*\d*$/i.test(i.name))) pen(25, "nama item generik (Produk 1, Menu 2); beri nama yang spesifik");
      const prices = sec.items.map((i) => i.price).filter(Boolean);
      if (prices.length > 2 && new Set(prices).size === 1) pen(10, "semua harga sama; variasikan sesuai item");
      if (fillerRatio(sec.items.map((i) => i.desc || "").join(" ")) > 0.15) pen(15, "deskripsi item penuh kata klise; ganti dengan detail rasa/bahan");
      break;
    }
    case "about": {
      const short = sec.text.filter((t) => wc(t) < 18);
      if (short.length) pen(Math.min(40, short.length * 20), "paragraf tentang kurang dari 18 kata; ceritakan asal-usul atau kekhasan yang spesifik");
      if ((sec.points?.length || 0) < 3) pen(10, "poin keunggulan kurang dari 3");
      break;
    }
    case "features": {
      const short = sec.items.filter((i) => wc(i.text) < 8);
      if (short.length) pen(Math.min(40, short.length * 10), `${short.length} keunggulan terlalu singkat (minimal 8 kata)`);
      if (dupes(sec.items.map((i) => i.title))) pen(15, "judul keunggulan ada yang sama");
      if (fillerRatio(sec.items.map((i) => i.text).join(" ")) > 0.15) pen(15, "teks keunggulan terlalu klise");
      break;
    }
    case "testimonials": {
      const short = sec.items.filter((i) => wc(i.quote) < 10);
      if (short.length) pen(Math.min(40, short.length * 15), "kutipan testimoni kurang dari 10 kata; buat terdengar seperti pelanggan sungguhan dengan detail");
      if (dupes(sec.items.map((i) => i.quote))) pen(20, "ada testimoni yang sama");
      break;
    }
    case "faq": {
      const short = sec.items.filter((i) => wc(i.a) < 10);
      if (short.length) pen(Math.min(40, short.length * 12), "jawaban FAQ kurang dari 10 kata; jawab lengkap dan spesifik");
      break;
    }
    case "steps": {
      const short = sec.items.filter((i) => wc(i.text) < 8);
      if (short.length) pen(Math.min(40, short.length * 12), "deskripsi langkah kurang dari 8 kata");
      break;
    }
    case "pricing": {
      if (sec.plans.some((p) => p.features.length < 3)) pen(25, "ada paket dengan fitur kurang dari 3");
      break;
    }
    default:
      break;
  }
  return { score: Math.max(0, score), issues };
}

const QUALITY_BAR = 70;

// ---------------------------------------------------------------- penulisan per bagian (paralel, model berbeda)

/** Tiap bagian diberi preferensi provider berbeda supaya beban tersebar dan model saling melengkapi. */
const SECTION_PREFER: string[][] = [
  ["deepseek", "groq", "cheap"],
  ["claude-haiku-5.5", "deepseek"],
  ["cheap", "deepseek"],
  ["deepseek", "claude-haiku-5.5"],
  ["cheap", "groq"],
  ["deepseek", "cheap"],
];

const SECTION_TOKENS: Record<SType, number> = {
  hero: 450,
  marquee: 200,
  features: 650,
  products: 1100,
  gallery: 260,
  about: 520,
  steps: 560,
  stats: 260,
  testimonials: 650,
  pricing: 800,
  faq: 800,
  video: 260,
  contact: 560,
  form: 200,
  cta: 260,
};

interface Meta {
  brand?: string;
  tagline?: string;
  description?: string;
  whatsapp?: string;
  images?: Record<string, string>;
  videoQuery?: string;
}

/** Panduan menulis teks antarmuka dari skill frontend-design (Anthropic, Apache-2.0). */
const WRITING_GUIDE = skillSection("frontend-design", "More on writing in design").replace(/^##.*\n/, "").trim();

/** Arahan desain ringkas untuk penulis section (pola konversi & yang dihindari), di-cache per permintaan. */
const briefCache = new Map<string, string>();
function sectionBrief(request: string): string {
  if (!briefCache.has(request)) {
    const b = designBrief(request)
      .split("\n")
      .filter((l) => /Perhatikan|Hindari|Konversi/.test(l))
      .join("\n");
    if (briefCache.size > 50) briefCache.clear();
    briefCache.set(request, b ? `${b}\n` : "");
  }
  return briefCache.get(request)!;
}

async function writeMeta(request: string, answers: string, c: Ctx, apiKey?: string): Promise<{ meta: Meta; model: string }> {
  const r = await callLLM({
    system: "Kamu penulis konten website yang teliti. Balas HANYA JSON valid.",
    prompt: `Tulis data dasar sebuah website sebagai JSON.
PERMINTAAN: ${request}
${answers ? `JAWABAN PELANGGAN (utamakan): ${answers}\n` : ""}${c.brand ? `NAMA BRAND (pakai persis): ${c.brand}\n` : "NAMA BRAND: belum ada, buat nama yang cocok, singkat, dan mudah diingat.\n"}${c.city ? `KOTA: ${c.city}\n` : ""}JENIS: ${c.kind}
${designBrief(request)}

Skema: {"brand":"…","tagline":"≤8 kata","description":"1-2 kalimat","whatsapp":"62812… atau kosong","images":{"hero":"kata kunci foto BAHASA INGGRIS 2-4 kata, visual & konkret","about":"…","menu":"…","gallery":"…"},"videoQuery":"kata kunci video YouTube atau kosong"}
Jangan menyebut investasi/saham. Hanya JSON.`,
    apiKey,
    maxTokens: 500,
    timeoutMs: 30_000,
    prefer: SECTION_PREFER[0],
  });
  return { meta: O(parseJsonLoose<unknown>(r.text)) as Meta, model: r.model };
}

async function writeSection(type: SType, request: string, answers: string, c: Ctx, meta: Meta, idx: number, apiKey?: string, feedback?: string): Promise<{ raw: Record<string, unknown> | null; model: string }> {
  try {
    const r = await callLLM({
      system: "Kamu penulis konten website. Balas HANYA satu objek JSON valid.",
      prompt: `Tulis SATU bagian "${type}" untuk website "${meta.brand || c.brand}"${meta.tagline ? ` (${meta.tagline})` : ""}, jenis ${c.kind}${c.city ? `, kota ${c.city}` : ""}.
Permintaan awal: ${request}
${answers ? `Jawaban pelanggan: ${answers}\n` : ""}${sectionBrief(request)}Bahasa Indonesia yang hangat dan profesional, spesifik untuk usaha ini (bukan kalimat generik). Judul pendek; boleh bungkus 1-2 kata kunci judul dengan *bintang* untuk aksen warna.

Skema (hanya objek ini):
${SCHEMA[type]}

${WRITING_GUIDE ? `Panduan menulis (bahasa Inggris, terapkan dalam bahasa Indonesia): ${WRITING_GUIDE}\n\n` : ""}Aturan: ikon yang boleh: ${ICON_NAMES.join(", ")}. Harga angka rupiah wajar. Jangan klaim palsu (penghargaan/sertifikasi/angka muluk). Testimoni & statistik adalah contoh isian. Jangan menyebut investasi/saham.${feedback ? `\n\nPERCOBAAN SEBELUMNYA DITOLAK KARENA: ${feedback}\nTulis ulang dengan lebih spesifik dan hidup: sebut bahan, rasa, cara, angka, atau detail nyata. Hindari kata klise (berkualitas, terbaik, terpercaya, profesional).` : ""}`,
      apiKey,
      maxTokens: SECTION_TOKENS[type],
      timeoutMs: 40_000,
      prefer: SECTION_PREFER[idx % SECTION_PREFER.length],
    });
    const obj = parseJsonLoose<unknown>(r.text);
    return { raw: obj ? { ...O(obj), type } : null, model: r.model };
  } catch {
    return { raw: null, model: "-" };
  }
}

/** Jalankan tugas paralel dengan batas konkurensi supaya gateway tidak kewalahan. */
async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// ---------------------------------------------------------------- foto & video

async function gatherMedia(spec: SiteSpec, wantVideo: boolean, videoQuery: string): Promise<SiteMedia> {
  const hero = spec.sections.find((s) => s.type === "hero") as Extract<Section, { type: "hero" }> | undefined;
  const heroOrient = hero?.variant === "full" ? "landscape" : "portrait";
  const jobs: [string, string, number, "landscape" | "portrait" | "squarish"][] = [
    ["hero", spec.images.hero, 3, heroOrient],
    ["about", spec.images.about, 2, "portrait"],
    ["menu", spec.images.menu, 6, "landscape"],
    ["gallery", spec.images.gallery, 9, "landscape"],
  ];
  const photos: Record<string, Photo[]> = {};
  await Promise.all(
    jobs.map(async ([key, q, n, o]) => {
      photos[key] = await searchPhotos(q, n, o);
    })
  );
  // kalau satu kunci kosong (kuota/tidak ada hasil), pinjam foto dari kunci lain
  const all = Object.values(photos).flat();
  for (const key of Object.keys(photos)) if (!photos[key].length && all.length) photos[key] = all.slice(0, 4);
  let video;
  if (wantVideo) video = (await searchVideos(videoQuery, 3))[0];
  return { photos, video };
}

// ---------------------------------------------------------------- simpan / baca

export interface SiteFile {
  version: 1;
  request: string;
  ctx: Ctx;
  plan: SType[];
  spec: SiteSpec;
  media: SiteMedia;
}

const specPath = (id: string) => path.join(PROJECTS, sanitizeSlug(id), "site.spec.json");
const prevSpecPath = (id: string) => path.join(PROJECTS, sanitizeSlug(id), "site.spec.prev.json");

export async function readSiteFile(projectId: string): Promise<SiteFile | null> {
  try {
    return JSON.parse(await fs.readFile(specPath(projectId), "utf-8")) as SiteFile;
  } catch {
    return null;
  }
}

export async function hasSite(projectId: string) {
  return (await readSiteFile(projectId)) !== null;
}

/** Samakan spesifikasi dengan index.html setelah "undo": tukar spec sekarang dengan versi sebelumnya. */
export async function swapPrevSpec(projectId: string) {
  try {
    const prev = await fs.readFile(prevSpecPath(projectId), "utf-8");
    const cur = await fs.readFile(specPath(projectId), "utf-8").catch(() => "");
    await fs.writeFile(specPath(projectId), prev, "utf-8");
    if (cur) await fs.writeFile(prevSpecPath(projectId), cur, "utf-8");
  } catch {
    /* tidak ada versi sebelumnya */
  }
}

async function saveAll(projectId: string, file: SiteFile, html: string) {
  try {
    await fs.copyFile(specPath(projectId), prevSpecPath(projectId));
  } catch {
    /* belum ada spec lama */
  }
  await writeProjectHtml(projectId, html);
  await fs.writeFile(specPath(projectId), JSON.stringify(file, null, 1), "utf-8");
}

export function extractCity(request: string): string {
  const m = request.match(/\b(?:di|daerah|kota)\s+([A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+)?)/u);
  return m ? m[1] : "";
}

function loreWarnings(spec: SiteSpec, html: string, usedFallback: string[], photoCount: number): string[] {
  const w: string[] = [];
  const hasSample = spec.sections.some((s) => ["testimonials", "stats", "pricing", "contact"].includes(s.type));
  if (hasSample) w.push("Testimoni, angka statistik, harga, jam buka, dan alamat adalah contoh isian. Ganti dengan data asli sebelum dipublikasikan.");
  if (!photoCount) w.push("Foto belum tersedia (kuota Unsplash habis atau key belum diisi), jadi bagian foto memakai latar warna.");
  if (usedFallback.length >= 4) w.push(`Model hanya menghasilkan sebagian isi, jadi bagian ${usedFallback.join(", ")} memakai teks bawaan. Minta "perbaiki teks ..." untuk menyesuaikan.`);
  const leaks = leakLines(html).length;
  if (leaks) w.push(`Masih ada ${leaks} baris teks nyasar bertopik investasi.`);
  return w;
}

// ---------------------------------------------------------------- build

export async function buildSite({
  request,
  answers = "",
  projectId,
  apiKey,
  forceStyle,
  forceDark,
  onProgress,
}: {
  request: string;
  answers?: string;
  projectId: string;
  apiKey?: string;
  /** Gaya yang sudah dipahami dari maksud user; menang atas tebakan dari kata-kata di teks. */
  forceStyle?: StyleKey | null;
  forceDark?: boolean | null;
  onProgress?: (t: MeetingTurn) => void;
}): Promise<WebsiteBuildResult> {
  const started = Date.now();
  const safe = sanitizeSlug(projectId);
  const meeting: MeetingTurn[] = [];
  const log = (t: MeetingTurn) => {
    meeting.push(t);
    onProgress?.(t);
  };

  const full = `${request} ${answers}`.trim();
  let kind = detectKind(full).kind;
  if (APP_KINDS.has(kind)) kind = "umum";
  // Jawaban brief sering diawali nama ("Senja Seduh di Bandung…"); extractBrand melewati kata pertama, jadi diberi kata pengantar
  const cleanedAnswers = answers.replace(/(^|\s)\d[.)]\s*/g, " ").trim();
  const brand = extractBrand(request) || cleanedAnswers.match(/nama usaha:\s*([^;\n()]{2,60})/i)?.[1].trim() || extractBrand(`x ${cleanedAnswers}`) || "";
  const c: Ctx = { brand, kind, city: extractCity(full), request: full };
  const plan = sectionPlan(kind, full);
  const baseTheme = buildTheme(full, kind, brand, forceStyle || undefined, forceDark ?? undefined);
  // Arah visual khusus brand ini dari AI (palet, font, gaya) + cek kontras; gagal = tema dasar
  const theme = await aiSiteTheme({ text: full, kind, brand, base: baseTheme, lockStyle: !!forceStyle || STYLE_WORDS.some(([re]) => re.test(full)), lockDark: forceDark !== undefined && forceDark !== null });

  // 1. Penulis konten: data dasar dulu, lalu tiap bagian ditulis paralel (model berbeda), tiap bagian ringan
  let t0 = Date.now();
  let meta: Meta = {};
  let metaModel = "-";
  try {
    const m = await writeMeta(request, answers, c, apiKey);
    meta = m.meta;
    metaModel = m.model;
  } catch {
    /* lanjut dengan data bawaan */
  }
  const brandNow = (S(meta.brand, 40) && !LEAK_LINE.test(S(meta.brand, 40)) ? S(meta.brand, 40) : "") || c.brand;
  const cNow: Ctx = { ...c, brand: brandNow };
  const written = await pool(plan, 5, (type, i) => writeSection(type, request, answers, cNow, meta, i, apiKey));
  const raw: Record<string, unknown> = { ...meta, sections: written.map((w) => w.raw).filter(Boolean) };
  const { spec, usedFallback } = normalizeSpec(raw, c, plan, theme);
  const byModel = new Map<string, string[]>();
  written.forEach((w, i) => {
    if (!w.raw) return;
    const key = shortModelName(w.model);
    byModel.set(key, [...(byModel.get(key) || []), plan[i]]);
  });
  const modelsNote = [...byModel.entries()].map(([m, types]) => `${m}: ${types.join(", ")}`).join(" · ");
  const model = [...byModel.keys()][0] || metaModel;
  log({
    role: "arsitek",
    agent: "Penulis Konten",
    model: [...byModel.keys()].join(" + ") || metaModel,
    note: `${plan.length - usedFallback.length}/${plan.length} bagian ditulis paralel oleh ${byModel.size || 1} model (${modelsNote || "tidak ada"})${usedFallback.length ? `; ${usedFallback.join(", ")} memakai teks bawaan` : ""} · gaya ${theme.style} · font ${theme.display}/${theme.body}`,
    durationMs: Date.now() - t0,
  });
  const videoQuery = S(meta.videoQuery, 80) || "";

  // 1b. Pengontrol mutu: nilai tiap bagian; yang lemah ditulis ulang dengan catatan spesifik, pakai yang lebih baik
  t0 = Date.now();
  const scoreOf = () => {
    const m = new Map<string, QualityResult>();
    for (const sec of spec.sections) if (!usedFallback.includes(sec.type)) m.set(sec.type, scoreSection(sec));
    return m;
  };
  let scores = scoreOf();
  const avgOf = (m: Map<string, QualityResult>) => (m.size ? [...m.values()].reduce((a, b) => a + b.score, 0) / m.size : 100);
  const before = avgOf(scores);
  const weak = [...scores.entries()].filter(([, q]) => q.score < QUALITY_BAR);
  const fixed: string[] = [];
  if (weak.length) {
    const retried = await pool(weak, 4, async ([type, q]) => {
      const i = plan.indexOf(type as SType);
      const r = await writeSection(type as SType, request, answers, cNow, meta, i + 1, apiKey, q.issues.join("; "));
      return { type: type as SType, q, r };
    });
    for (const { type, q, r } of retried) {
      if (!r.raw) continue;
      const cand = normalizeSpec({ ...meta, sections: [r.raw] }, c, [type], theme).spec.sections[0];
      if (!cand) continue;
      const cs = scoreSection(cand);
      if (cs.score > q.score) {
        const at = spec.sections.findIndex((x) => x.type === type);
        if (at !== -1) spec.sections[at] = cand;
        fixed.push(`${type} (${q.score}→${cs.score}: ${q.issues[0].slice(0, 60)})`);
      }
    }
    scores = scoreOf();
  }
  const after = avgOf(scores);
  const stillWeak = [...scores.entries()].filter(([, q]) => q.score < QUALITY_BAR).map(([t]) => t);
  log({
    role: "reviewer",
    agent: "Pengontrol Mutu",
    model: fixed.length ? "model (tulis ulang)" : "otomatis",
    note: `Mutu isi ${Math.round(before)} → ${Math.round(after)}/100${weak.length ? `. ${weak.length} bagian lemah, ${fixed.length} berhasil diperbaiki${fixed.length ? `: ${fixed.join("; ")}` : ""}` : ". Semua bagian lolos ambang"}${stillWeak.length ? `. Masih lemah: ${stillWeak.join(", ")}` : ""}`,
    durationMs: Date.now() - t0,
  });
  const qualityScore = Math.round(after) / 10;

  // 2. Foto & video sungguhan
  t0 = Date.now();
  const wantVideo = spec.sections.some((s) => s.type === "video");
  const media = await gatherMedia(spec, wantVideo, videoQuery || `${spec.brand} ${kind === "kuliner" ? "cara seduh kopi" : kind}`.trim());
  if (wantVideo && !media.video) spec.sections = spec.sections.filter((s) => s.type !== "video");
  const nPhotos = new Set(Object.values(media.photos).flat().map((p) => p.id)).size;
  log({ role: "aset", agent: "Pencari Aset", model: "unsplash + youtube", note: `${nPhotos} foto Unsplash${media.video ? ` · video "${media.video.title.slice(0, 40)}"` : ""}`, durationMs: Date.now() - t0 });

  // 3. Perakit: komponen siap pakai
  t0 = Date.now();
  const html = renderSite(spec, media);
  log({ role: "developer", agent: "Perakit Halaman", model: "komponen", note: `Merakit ${spec.sections.length} bagian dari komponen siap pakai: ${spec.sections.map((s) => s.type).join(", ")}`, durationMs: Date.now() - t0 });

  await saveAll(safe, { version: 1, request: full, ctx: c, plan, spec, media }, html);
  trackPhotoUse(Object.values(media.photos).flat(), html).catch(() => {});

  return {
    html,
    title: `${spec.brand}${spec.tagline ? ` — ${spec.tagline}` : ""}`,
    summary: `Website ${spec.brand}: ${spec.sections.map((s) => s.type).join(", ")}.`,
    model,
    mode: "create",
    previewUrl: `/api/preview?projectId=${encodeURIComponent(safe)}&t=${Date.now()}`,
    projectId: safe,
    lines: html.split("\n").length,
    previousLines: 0,
    durationMs: Date.now() - started,
    meeting,
    score: qualityScore,
    warnings: [...loreWarnings(spec, html, usedFallback, nPhotos), ...(stillWeak.length ? [`Isi bagian ${stillWeak.join(", ")} masih tipis. Minta "perbaiki teks ${stillWeak[0]}" atau isi key Gemini supaya lebih tajam.`] : [])],
  };
}

// ---------------------------------------------------------------- edit

const COLORS: Record<string, [string, string]> = {
  merah: ["#D7263D", "#F46036"],
  biru: ["#1F4BFF", "#00B4D8"],
  hijau: ["#2F7D4F", "#D98E2B"],
  kuning: ["#F2B705", "#E4572E"],
  oranye: ["#E8590C", "#FFB703"],
  orange: ["#E8590C", "#FFB703"],
  ungu: ["#6C3BFF", "#FF5A99"],
  pink: ["#E8478B", "#7C3AED"],
  coklat: ["#8B5A2B", "#D4A373"],
  cokelat: ["#8B5A2B", "#D4A373"],
  emas: ["#C9A45C", "#8A6A3B"],
  tosca: ["#0E8F8B", "#F2A65A"],
  teal: ["#0E8F8B", "#F2A65A"],
  hitam: ["#111111", "#555555"],
};

const SECTION_NAMES: Record<string, SType> = {
  faq: "faq",
  galeri: "gallery",
  foto: "gallery",
  testimoni: "testimonials",
  ulasan: "testimonials",
  harga: "pricing",
  paket: "pricing",
  video: "video",
  statistik: "stats",
  angka: "stats",
  langkah: "steps",
  "cara kerja": "steps",
  kontak: "contact",
  marquee: "marquee",
  menu: "products",
  produk: "products",
  katalog: "products",
  fitur: "features",
  keunggulan: "features",
  tentang: "about",
};

function sectionTarget(request: string): SType | null {
  const m = request.toLowerCase().match(/\b(cara kerja|faq|galeri|foto|testimoni|ulasan|harga|paket|video|statistik|angka|langkah|kontak|marquee|menu|produk|katalog|fitur|keunggulan|tentang)\b/);
  return m ? SECTION_NAMES[m[1]] || null : null;
}

// ---------------------------------------------------------------- pemahaman maksud

export interface EditOps {
  action: "edit" | "rebuild" | "undo" | "chat";
  style?: StyleKey | null;
  dark?: boolean | null;
  accent?: string | null;
  addSections?: SType[];
  removeSections?: SType[];
  contentInstruction?: string;
  wantsStack?: string | null;
  summary?: string;
}

const STYLE_KEYS: StyleKey[] = ["editorial", "bold", "soft", "luxury", "tech", "playful", "clean", "vintage"];
const SECTION_TYPES: SType[] = ["marquee", "features", "products", "gallery", "about", "steps", "stats", "testimonials", "pricing", "faq", "video", "contact"];

/**
 * Baca pesan user bersama riwayat chat, lalu terjemahkan jadi aksi terstruktur.
 * Menangani kalimat berantakan ("palet kurang suka, kayak AI banget, pengen vintage"),
 * konfirmasi singkat ("gas kerjakan", "mana hasilnya"), dan "rombak total".
 */
export async function understandSiteMessage(message: string, history: { role: string; content: string }[], file: SiteFile, apiKey?: string): Promise<EditOps | null> {
  const recent = history
    .slice(-7, -1)
    .map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content.replace(/\s+/g, " ").slice(0, 260)}`)
    .join("\n");
  const sp = file.spec;
  try {
    const r = await callLLM({
      system: "Kamu penerjemah maksud untuk asisten pembuat website. Balas HANYA JSON valid.",
      prompt: `Website sudah ada: "${sp.brand}" (jenis ${file.ctx.kind}, gaya ${sp.theme.style}, ${sp.theme.dark ? "gelap" : "terang"}, bagian: ${sp.sections.map((x) => x.type).join(", ")}).

RIWAYAT CHAT (terbaru di bawah):
${recent || "(kosong)"}

PESAN BARU DARI USER: "${message.slice(0, 700)}"

Tentukan tindakan yang diminta. Balas HANYA JSON:
{"action":"edit|rebuild|undo|chat","style":"${STYLE_KEYS.join("|")}|null","dark":true|false|null,"accent":"nama warna Indonesia atau #hex atau null","addSections":[],"removeSections":[],"contentInstruction":"perubahan teks/isi/nama yang diminta, atau kosong","wantsStack":"nextjs|react|laravel|flutter|go|php|null","summary":"1 kalimat: apa yang kamu pahami"}

Aturan:
- "rombak total / ulang dari awal / ganti total / desain ulang" → action "rebuild" (isi style bila disebut).
- Tidak suka warna/palet/gaya, bilang "terlalu AI/kaku/polos", atau minta gaya tertentu (vintage, mewah, minimalis, ceria, futuristik, dst.) → "edit" dengan style yang paling cocok. "gelap"/"terang" → isi dark.
- Minta tambah/hapus bagian → addSections / removeSections (nilai dari: ${SECTION_TYPES.join(", ")}).
- Minta ganti teks, isi, nama, harga → contentInstruction.
- Jawaban singkat ("gas", "kerjakan", "lanjut", "ya", "oke", "mana hasilnya", "bikin sekarang") setelah rencana perubahan dibahas di riwayat → lakukan perubahan yang dibahas itu (isi sama seperti permintaan tersebut), bukan "chat".
- "balikin / undo / batalkan" → "undo".
- Pertanyaan atau obrolan yang tidak meminta mengubah website → "chat".
- Jika user menyebut stack lain (next.js, react, laravel, flutter, go, php), isi wantsStack; tetap tentukan action untuk bagian desainnya.`,
      apiKey,
      maxTokens: 200,
      timeoutMs: 15_000,
      fast: true,
      prefer: ["cheap", "deepseek", "groq"],
    });
    const o = O(parseJsonLoose<unknown>(r.text));
    const action = S(o.action, 10);
    if (!["edit", "rebuild", "undo", "chat"].includes(action)) return null;
    const style = STYLE_KEYS.includes(S(o.style, 12) as StyleKey) ? (S(o.style, 12) as StyleKey) : null;
    const types = (v: unknown) => A(v).map((x) => S(x, 20) as SType).filter((x) => SECTION_TYPES.includes(x));
    return {
      action: action as EditOps["action"],
      style,
      dark: typeof o.dark === "boolean" ? o.dark : null,
      accent: S(o.accent, 20) && S(o.accent, 20) !== "null" ? S(o.accent, 20).toLowerCase() : null,
      addSections: types(o.addSections),
      removeSections: types(o.removeSections),
      contentInstruction: S(o.contentInstruction, 400),
      wantsStack: S(o.wantsStack, 12) && S(o.wantsStack, 12) !== "null" ? S(o.wantsStack, 12).toLowerCase() : null,
      summary: S(o.summary, 200),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- edit

export async function editSite({
  request,
  projectId,
  apiKey,
  ops,
  onProgress,
}: {
  request: string;
  projectId: string;
  apiKey?: string;
  ops?: EditOps | null;
  onProgress?: (t: MeetingTurn) => void;
}): Promise<WebsiteBuildResult> {
  const started = Date.now();
  const safe = sanitizeSlug(projectId);
  const file = await readSiteFile(safe);
  if (!file) throw new Error("Belum ada website berbasis komponen di project ini");
  const meeting: MeetingTurn[] = [];
  const log = (t: MeetingTurn) => {
    meeting.push(t);
    onProgress?.(t);
  };
  const before = file.spec.sections.length;
  const r = request.toLowerCase();
  let spec: SiteSpec = JSON.parse(JSON.stringify(file.spec));
  let media: SiteMedia = file.media;
  const applied: string[] = [];
  let model = "otomatis";

  // a. warna aksen (nama, atau #hex dari pemahaman maksud)
  let accentName: string | null = null;
  if (ops?.accent) {
    if (/^#[0-9a-f]{6}$/.test(ops.accent)) {
      spec.theme = { ...spec.theme, colors: { ...spec.theme.colors, accent: ops.accent, accent2: mix(ops.accent, spec.theme.colors.ink, 0.35) } };
      accentName = ops.accent;
    } else if (COLORS[ops.accent]) accentName = ops.accent;
  }
  const color = accentName ? null : (ops ? null : r.match(/\b(?:warna|tema|jadi|ganti(?:in)?|ubah)\b[^.]*?\b(merah|biru|hijau|kuning|oranye|orange|ungu|pink|coklat|cokelat|emas|tosca|teal|hitam)\b/));
  const colorKey = accentName && COLORS[accentName] ? accentName : color && COLORS[color[1]] ? color[1] : null;
  if (colorKey) {
    const [a, a2] = COLORS[colorKey];
    spec.theme = { ...spec.theme, colors: { ...spec.theme.colors, accent: a, accent2: a2 } };
  }
  if (colorKey || (accentName && /^#/.test(accentName))) applied.push(`warna aksen jadi ${colorKey || accentName}`);

  // b. gaya (rombak tampilan: palet + font + bentuk) dan terang/gelap
  const styleWord = ops ? ops.style : (STYLE_WORDS.find(([re]) => re.test(r) && /\b(gaya|style|stylenya|tampilan|nuansa|vibe)\b/.test(r)) || [])[1] || null;
  const wantDark = ops ? ops.dark === true : /\b(mode\s+)?(gelap|dark)\b/.test(r) && !/\b(jangan|bukan)\s+gelap\b/.test(r);
  const wantLight = ops ? ops.dark === false : /\b(mode\s+)?(terang|light)\b/.test(r);
  if (styleWord) {
    const forceDark = wantDark ? true : wantLight ? false : undefined;
    const t = buildTheme(`${file.request} ${request} ${ops?.summary || ""}`, file.ctx.kind, spec.brand, styleWord, forceDark);
    spec.theme = colorKey ? { ...t, colors: { ...t.colors, accent: spec.theme.colors.accent, accent2: spec.theme.colors.accent2 } } : t;
    applied.push(`gaya ${styleWord} (palet dan font diganti: ${t.display}/${t.body})`);
  } else if ((wantDark && !spec.theme.dark) || (wantLight && spec.theme.dark)) {
    const t = buildTheme(file.request, file.ctx.kind, spec.brand, spec.theme.style, wantDark);
    spec.theme = colorKey ? { ...t, colors: { ...t.colors, accent: spec.theme.colors.accent, accent2: spec.theme.colors.accent2 } } : t;
    applied.push(wantDark ? "mode gelap" : "mode terang");
  }

  // c. hapus / tambah bagian
  const toAdd: SType[] = ops ? ops.addSections || [] : [];
  const toRemove: SType[] = ops ? ops.removeSections || [] : [];
  if (!ops) {
    const target = sectionTarget(request);
    if (target && /\b(hapus|buang|hilangkan|tanpa)\b/.test(r)) toRemove.push(target);
    else if (target && /\b(tambah(?:kan|in)?|pasang(?:kan|in)?|masukin|masukkan|bikin(?:in)?|buat(?:kan|in)?)\b/.test(r)) toAdd.push(target);
  }
  for (const t of toRemove) {
    const n = spec.sections.length;
    spec.sections = spec.sections.filter((x) => x.type !== t);
    if (spec.sections.length < n) applied.push(`bagian ${t} dihapus`);
  }
  for (const t of toAdd) {
    if (spec.sections.some((x) => x.type === t)) continue;
    const def = defaultSection(t, { ...file.ctx, brand: spec.brand });
    if (!def) continue;
    const ci = spec.sections.findIndex((x) => x.type === "cta");
    spec.sections.splice(ci === -1 ? spec.sections.length : ci, 0, def);
    applied.push(`bagian ${t} ditambahkan`);
    if (t === "video") {
      const v = (await searchVideos(`${spec.brand} ${file.ctx.kind}`, 3))[0];
      if (v) media = { ...media, video: v };
      else spec.sections = spec.sections.filter((x) => x.type !== "video");
    }
  }

  // d. ganti X jadi Y
  const renamed = applyDirectRenames(JSON.stringify(spec), request);
  if (renamed.done.length) {
    try {
      spec = JSON.parse(renamed.html) as SiteSpec;
      applied.push(`ganti ${renamed.done.join(", ")}`);
    } catch {
      /* abaikan */
    }
  }

  // e. perubahan isi/teks: model menulis ulang JSON isi (bukan HTML)
  const instruction = ops ? ops.contentInstruction || "" : applied.length ? "" : request;
  if (instruction) {
    const t0 = Date.now();
    try {
      const res = await callLLM({
        system: "Kamu editor konten website. Balas HANYA JSON valid.",
        prompt: `Ini isi website saat ini (JSON):\n${JSON.stringify({ brand: spec.brand, tagline: spec.tagline, sections: spec.sections })}\n\nPERMINTAAN PERUBAHAN: ${instruction}\n\nTerapkan perubahan itu. Pertahankan struktur, tipe bagian, dan semua bagian yang tidak diminta berubah. Balas objek JSON lengkap {"brand","tagline","sections":[…]} dengan skema yang sama. Jangan menyebut investasi/saham.`,
        apiKey,
        maxTokens: 3600,
        timeoutMs: 55_000,
        prefer: ROLE_PREFER.developer,
      });
      model = res.model;
      const parsed = parseJsonLoose<unknown>(res.text);
      if (parsed) {
        const { spec: ns } = normalizeSpec(parsed, file.ctx, file.plan.filter((t) => spec.sections.some((x) => x.type === t)), spec.theme);
        spec = { ...ns, theme: spec.theme, images: spec.images, whatsapp: ns.whatsapp || spec.whatsapp };
        applied.push("isi halaman diperbarui sesuai permintaan");
      }
    } catch (err) {
      log({ role: "revisi", agent: "Editor Konten", model: "-", note: `Gagal (${(err as Error).message})`, durationMs: Date.now() - t0 });
    }
  }

  if (!applied.length) throw new Error('Aku belum paham bagian mana yang harus diubah. Coba sebut lebih jelas, mis. "gaya vintage", "ganti warna jadi hijau", atau "tambah bagian FAQ".');

  log({ role: "developer", agent: model === "otomatis" ? "Editor Otomatis" : "Editor Konten", model, note: `${ops?.summary ? `Dipahami: ${ops.summary} → ` : ""}${applied.join(" · ")}`, durationMs: Date.now() - started });
  const html = renderSite(spec, media);
  const prev = (await fs.readFile(path.join(PROJECTS, safe, "index.html"), "utf-8").catch(() => "")) || "";
  await saveAll(safe, { ...file, spec, media }, html);
  return {
    html,
    title: `${spec.brand}${spec.tagline ? ` — ${spec.tagline}` : ""}`,
    summary: `${applied.join("; ")}.`,
    model,
    mode: "edit",
    previewUrl: `/api/preview?projectId=${encodeURIComponent(safe)}&t=${Date.now()}`,
    projectId: safe,
    lines: html.split("\n").length,
    previousLines: prev ? prev.split("\n").length : before,
    durationMs: Date.now() - started,
    meeting,
    warnings: [],
  };
}

export { GENERATED_MARKER, mix };
