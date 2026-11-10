/**
 * Tema desain bersama untuk slide (preview, PPTX, video) dan dokumen.
 * Font PPTX memakai font sistem agar file terbuka rapi di PowerPoint / Keynote / Google Slides.
 */
export interface DeckTheme {
  id: string;
  name: string;
  bg: string; // hex tanpa #
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  displayFont: string; // untuk PPTX
  bodyFont: string;
  cssDisplay: string; // untuk preview HTML / canvas
  cssBody: string;
  titleCase?: "upper" | "normal";
  /** ornamen khas tema */
  motif: Motif;
}

export type Motif = "bar" | "circle" | "grid" | "rule" | "blob" | "dots" | "frame";
export type FontKey = "serif" | "elegant" | "modern" | "bold" | "humanist";

export const DECK_THEMES: DeckTheme[] = [
  {
    id: "telor-asin",
    name: "Telor Asin",
    bg: "D6ECE7", surface: "F3FAF8", text: "11302C", muted: "557771", accent: "D4771F", accent2: "23786E",
    displayFont: "Georgia", bodyFont: "Calibri",
    cssDisplay: "Georgia, 'Times New Roman', serif", cssBody: "Calibri, 'Segoe UI', sans-serif",
    motif: "dots",
  },
  {
    id: "midnight-neon",
    name: "Midnight Neon",
    bg: "0F1024", surface: "1B1D3A", text: "F4F1FF", muted: "A6A3C9", accent: "7CF29C", accent2: "FF6AD5",
    displayFont: "Arial Black", bodyFont: "Calibri",
    cssDisplay: "'Arial Black', Arial, sans-serif", cssBody: "Calibri, 'Segoe UI', sans-serif",
    titleCase: "upper", motif: "grid",
  },
  {
    id: "kertas-koran",
    name: "Kertas Koran",
    bg: "F3EFE6", surface: "FFFFFF", text: "1B1B1B", muted: "6B6459", accent: "C8102E", accent2: "1B1B1B",
    displayFont: "Georgia", bodyFont: "Georgia",
    cssDisplay: "Georgia, serif", cssBody: "Georgia, serif",
    motif: "rule",
  },
  {
    id: "sunset-pop",
    name: "Sunset Pop",
    bg: "FF6B35", surface: "FFE8D9", text: "1A0F0A", muted: "5C2B14", accent: "FFE066", accent2: "2D1E2F",
    displayFont: "Impact", bodyFont: "Trebuchet MS",
    cssDisplay: "Impact, 'Arial Narrow', sans-serif", cssBody: "'Trebuchet MS', sans-serif",
    titleCase: "upper", motif: "circle",
  },
  {
    id: "hutan-tenang",
    name: "Hutan Tenang",
    bg: "1E3A2F", surface: "284A3C", text: "EDE6D6", muted: "B5BFA8", accent: "E9C46A", accent2: "F4A261",
    displayFont: "Palatino Linotype", bodyFont: "Calibri",
    cssDisplay: "'Palatino Linotype', Palatino, serif", cssBody: "Calibri, 'Segoe UI', sans-serif",
    motif: "blob",
  },
  {
    id: "swiss-mono",
    name: "Swiss Mono",
    bg: "FFFFFF", surface: "F2F2F2", text: "111111", muted: "6E6E6E", accent: "0047FF", accent2: "111111",
    displayFont: "Arial Black", bodyFont: "Arial",
    cssDisplay: "'Arial Black', Arial, sans-serif", cssBody: "Arial, Helvetica, sans-serif",
    motif: "bar",
  },
  {
    id: "batik-indigo",
    name: "Batik Indigo",
    bg: "1B2A4A", surface: "24375F", text: "F5EBDD", muted: "BBB3A6", accent: "D9A441", accent2: "C1440E",
    displayFont: "Georgia", bodyFont: "Verdana",
    cssDisplay: "Georgia, serif", cssBody: "Verdana, sans-serif",
    motif: "frame",
  },
  // --- 10 tema dari skill theme-factory (Anthropic, Apache-2.0; skills/theme-factory/themes).
  // Warna utama dari sumber; surface/text/muted yang tidak ada di sumber diturunkan dari paletnya.
  // Font DejaVu/FreeSans/FreeSerif dipetakan ke font sistem yang mirip supaya PPTX terbuka rapi.
  {
    id: "arctic-frost",
    name: "Arctic Frost",
    bg: "FAFAFA", surface: "D4E4F7", text: "1F2D3D", muted: "5B6B7D", accent: "4A6FA5", accent2: "C0C0C0",
    displayFont: "Verdana", bodyFont: "Verdana",
    cssDisplay: "Verdana, 'DejaVu Sans', sans-serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "rule",
  },
  {
    id: "botanical-garden",
    name: "Botanical Garden",
    bg: "F5F3ED", surface: "FFFFFF", text: "2A3B2F", muted: "6B7A6E", accent: "4A7C59", accent2: "B7472A",
    displayFont: "Georgia", bodyFont: "Verdana",
    cssDisplay: "Georgia, 'DejaVu Serif', serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "blob",
  },
  {
    id: "desert-rose",
    name: "Desert Rose",
    bg: "E8D5C4", surface: "F3E7DC", text: "5D2E46", muted: "8A6A6A", accent: "B87D6D", accent2: "D4A5A5",
    displayFont: "Arial", bodyFont: "Arial",
    cssDisplay: "Arial, 'FreeSans', Helvetica, sans-serif", cssBody: "Arial, 'FreeSans', Helvetica, sans-serif",
    motif: "circle",
  },
  {
    id: "forest-canopy",
    name: "Forest Canopy",
    bg: "FAF9F6", surface: "EEF0E6", text: "2D4A2B", muted: "7D8471", accent: "7D8471", accent2: "A4AC86",
    displayFont: "Times New Roman", bodyFont: "Arial",
    cssDisplay: "'Times New Roman', 'FreeSerif', serif", cssBody: "Arial, 'FreeSans', Helvetica, sans-serif",
    motif: "frame",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    bg: "D4B896", surface: "E6D3B6", text: "4A403A", muted: "6E5F52", accent: "F4A900", accent2: "C1666B",
    displayFont: "Arial", bodyFont: "Arial",
    cssDisplay: "Arial, 'FreeSans', Helvetica, sans-serif", cssBody: "Arial, 'FreeSans', Helvetica, sans-serif",
    motif: "circle",
  },
  {
    id: "midnight-galaxy",
    name: "Midnight Galaxy",
    bg: "2B1E3E", surface: "3A2C55", text: "E6E6FA", muted: "A490C2", accent: "A490C2", accent2: "4A4E8F",
    displayFont: "Arial", bodyFont: "Arial",
    cssDisplay: "Arial, 'FreeSans', Helvetica, sans-serif", cssBody: "Arial, 'FreeSans', Helvetica, sans-serif",
    motif: "dots",
  },
  {
    id: "modern-minimalist",
    name: "Modern Minimalist",
    bg: "FFFFFF", surface: "EFEFEF", text: "36454F", muted: "708090", accent: "36454F", accent2: "708090",
    displayFont: "Verdana", bodyFont: "Verdana",
    cssDisplay: "Verdana, 'DejaVu Sans', sans-serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "bar",
  },
  {
    id: "ocean-depths",
    name: "Ocean Depths",
    bg: "1A2332", surface: "24324A", text: "F1FAEE", muted: "A8DADC", accent: "2D8B8B", accent2: "A8DADC",
    displayFont: "Verdana", bodyFont: "Verdana",
    cssDisplay: "Verdana, 'DejaVu Sans', sans-serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "rule",
  },
  {
    id: "sunset-boulevard",
    name: "Sunset Boulevard",
    bg: "E9C46A", surface: "F3DC9E", text: "264653", muted: "4F6D6A", accent: "E76F51", accent2: "F4A261",
    displayFont: "Georgia", bodyFont: "Verdana",
    cssDisplay: "Georgia, 'DejaVu Serif', serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "circle",
  },
  {
    id: "tech-innovation",
    name: "Tech Innovation",
    bg: "1E1E1E", surface: "2A2A2A", text: "FFFFFF", muted: "A0A0A0", accent: "0066FF", accent2: "00FFFF",
    displayFont: "Verdana", bodyFont: "Verdana",
    cssDisplay: "Verdana, 'DejaVu Sans', sans-serif", cssBody: "Verdana, 'DejaVu Sans', sans-serif",
    motif: "grid",
  },
];

const KEYWORDS: Record<string, string[]> = {
  "midnight-neon": ["tech", "teknologi", "startup", "ai", "crypto", "game", "gaming", "digital", "saas"],
  "kertas-koran": ["berita", "laporan", "riset", "penelitian", "jurnal", "sejarah", "editorial", "akademik"],
  "sunset-pop": ["promo", "marketing", "kreatif", "event", "festival", "anak", "fun", "musik", "food", "makanan"],
  "hutan-tenang": ["alam", "lingkungan", "hijau", "pertanian", "kesehatan", "wellness", "kopi", "teh", "organik"],
  "swiss-mono": ["bisnis", "corporate", "keuangan", "finance", "strategi", "konsultan", "arsitektur", "desain"],
  "batik-indigo": ["budaya", "indonesia", "tradisi", "pariwisata", "wisata", "batik", "seni"],
  "arctic-frost": ["kesehatan", "medis", "farmasi", "klinik", "teknologi bersih", "musim dingin"],
  "botanical-garden": ["taman", "tanaman", "bunga", "kuliner", "resep", "organik"],
  "desert-rose": ["fashion", "kecantikan", "pernikahan", "wedding", "desain interior", "butik"],
  "forest-canopy": ["lingkungan", "keberlanjutan", "sustainability", "kehutanan", "outdoor"],
  "golden-hour": ["restoran", "hospitality", "hotel", "musim gugur", "kerajinan", "artisan"],
  "midnight-galaxy": ["hiburan", "gaming", "astronomi", "luar angkasa", "fantasi", "kreatif"],
  "modern-minimalist": ["profesional", "presentasi bisnis", "arsitektur", "data", "rapat"],
  "ocean-depths": ["maritim", "laut", "konsultan", "korporat", "logistik", "pelayaran"],
  "sunset-boulevard": ["perjalanan", "travel", "liburan", "musim panas", "acara", "event"],
  "tech-innovation": ["inovasi", "software", "cloud", "aplikasi", "developer", "teknologi informasi"],
};

export function pickTheme(topic: string, explicit?: string): DeckTheme {
  if (explicit) {
    const byId = DECK_THEMES.find((t) => t.id === explicit || t.name.toLowerCase() === explicit.toLowerCase());
    if (byId) return byId;
  }
  const t = topic.toLowerCase();
  const byName = DECK_THEMES.find((th) => t.includes(th.name.toLowerCase()) || t.includes(th.id));
  if (byName) return byName;
  const matches = Object.entries(KEYWORDS)
    .filter(([, words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t)))
    .map(([id]) => id);
  // Pemilihan otomatis tidak pernah memilih tema bermotif kotak-kotak (grid); tema itu cuma dipakai kalau user menyebut namanya.
  const noGrid = (id: string) => DECK_THEMES.find((th) => th.id === id)?.motif !== "grid";
  const allowed = matches.filter(noGrid);
  const pool = allowed.length ? allowed : DECK_THEMES.filter((th) => th.motif !== "grid").map((th) => th.id);
  const id = pool[Math.floor(Math.random() * pool.length)];
  return DECK_THEMES.find((th) => th.id === id)!;
}

/** Pasangan font aman (ada di Windows/macOS) untuk palet buatan AI. */
const FONT_SETS: Record<FontKey, Pick<DeckTheme, "displayFont" | "bodyFont" | "cssDisplay" | "cssBody"> & { titleCase?: "upper" }> = {
  serif: { displayFont: "Georgia", bodyFont: "Calibri", cssDisplay: "Georgia, 'Times New Roman', serif", cssBody: "Calibri, 'Segoe UI', sans-serif" },
  elegant: { displayFont: "Palatino Linotype", bodyFont: "Calibri", cssDisplay: "'Palatino Linotype', Palatino, Georgia, serif", cssBody: "Calibri, 'Segoe UI', sans-serif" },
  modern: { displayFont: "Trebuchet MS", bodyFont: "Calibri", cssDisplay: "'Trebuchet MS', 'Segoe UI', sans-serif", cssBody: "Calibri, 'Segoe UI', sans-serif" },
  bold: { displayFont: "Arial Black", bodyFont: "Calibri", cssDisplay: "'Arial Black', Arial, sans-serif", cssBody: "Calibri, 'Segoe UI', sans-serif", titleCase: "upper" },
  humanist: { displayFont: "Calibri", bodyFont: "Calibri", cssDisplay: "Calibri, 'Segoe UI', sans-serif", cssBody: "Calibri, 'Segoe UI', sans-serif" },
};

export interface AiPaletteSpec {
  bg: string; surface: string; text: string; muted: string; accent: string; accent2: string;
  font: FontKey; motif: Motif; name: string;
}

/** id tema untuk palet buatan AI: "ai:BG,SURFACE,TEXT,MUTED,ACCENT,ACCENT2,font,motif,Nama_Palet" */
export function aiThemeId(p: AiPaletteSpec): string {
  return `ai:${[p.bg, p.surface, p.text, p.muted, p.accent, p.accent2, p.font, p.motif, p.name.replace(/ /g, "_")].join(",")}`;
}

const AI_ID = /^ai:([0-9A-F]{6}),([0-9A-F]{6}),([0-9A-F]{6}),([0-9A-F]{6}),([0-9A-F]{6}),([0-9A-F]{6}),(serif|elegant|modern|bold|humanist),(bar|circle|grid|rule|blob|dots|frame),([\p{L}\p{N}_]{1,40})$/u;

function parseAiTheme(id: string): DeckTheme | null {
  const m = id.match(AI_ID);
  if (!m) return null;
  const f = FONT_SETS[m[7] as FontKey];
  return {
    id,
    name: m[9].replace(/_/g, " "),
    bg: m[1], surface: m[2], text: m[3], muted: m[4], accent: m[5], accent2: m[6],
    displayFont: f.displayFont, bodyFont: f.bodyFont, cssDisplay: f.cssDisplay, cssBody: f.cssBody,
    titleCase: f.titleCase,
    motif: m[8] as Motif,
  };
}

/** True kalau user menyebut nama/ID tema katalog secara eksplisit ("pakai tema Kertas Koran"). */
export function namesCatalogTheme(request: string): boolean {
  const t = request.toLowerCase();
  return DECK_THEMES.some((th) => t.includes(th.name.toLowerCase()) || t.includes(th.id));
}

export function getTheme(id?: string): DeckTheme {
  if (id?.startsWith("ai:")) {
    const ai = parseAiTheme(id);
    if (ai) return ai;
  }
  return DECK_THEMES.find((t) => t.id === id) || DECK_THEMES[0];
}
