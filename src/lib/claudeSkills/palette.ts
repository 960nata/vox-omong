import { parseLoose } from "../jsonLoose";
import { callLLM } from "../codeAgent";
import { contrast, ensureContrast, fromHsl, luminance, toHsl } from "./colorUtils";
import { aiThemeId, namesCatalogTheme, pickTheme, type DeckTheme, getTheme, type FontKey, type Motif } from "./themes";

/**
 * Palet warna otomatis: AI memilih warna sesuai topik dan suasana, lalu kode MEMASTIKAN terbacanya
 * (rasio kontras WCAG) sebelum dipakai. Hasilnya dikodekan di id tema ("ai:..."), jadi semua
 * output (preview, PPTX, video, DOCX, PDF) memakai warna yang sama tanpa penyimpanan tambahan.
 */

const hexOk = (s: unknown): s is string => typeof s === "string" && /^#?[0-9a-f]{6}$/i.test(s.trim());
const norm = (s: string) => s.trim().replace(/^#/, "").toUpperCase();


const FONT_KEYS: FontKey[] = ["serif", "elegant", "modern", "bold", "humanist"];
const MOTIFS: Motif[] = ["bar", "circle", "rule", "blob", "dots", "frame"]; // "grid" tidak dipilih otomatis

export interface RawPalette {
  name?: string;
  mode?: string;
  bg?: string;
  surface?: string;
  text?: string;
  muted?: string;
  accent?: string;
  accent2?: string;
  font?: string;
  motif?: string;
}

/** Validasi + perbaikan kontras dari palet mentah (bisa dari AI). Mengembalikan null kalau tidak layak. */
export function buildThemeFromPalette(p: RawPalette): DeckTheme | null {
  if (!hexOk(p.bg) || !hexOk(p.text) || !hexOk(p.accent)) return null;
  let bg = norm(p.bg);
  let bgMoved = false;
  // Latar abu-abu tengah tidak bisa dibaca dengan teks apa pun (kontras 7:1 mustahil): dorong ke gelap atau terang
  const lb = luminance(bg);
  if (lb > 0.1 && lb < 0.36) {
    const [h, s, l] = toHsl(bg);
    const goDark = lb < 0.2;
    for (let step = 1; step <= 40; step++) {
      const c = fromHsl(h, s, Math.max(0, Math.min(1, l + (goDark ? -1 : 1) * (step / 40))));
      const lc = luminance(c);
      if (goDark ? lc <= 0.035 : lc >= 0.5) {
        bg = c;
        bgMoved = true;
        break;
      }
    }
  }
  let surface = hexOk(p.surface) && !bgMoved ? norm(p.surface) : bg;
  // permukaan kartu harus sedikit beda dari latar
  if (contrast(surface, bg) < 1.08) {
    const [h, s, l] = toHsl(bg);
    surface = fromHsl(h, s, Math.max(0, Math.min(1, l + (luminance(bg) < 0.4 ? 0.07 : -0.05))));
  }
  const text = ensureContrast(norm(p.text), [bg, surface], 7);
  const muted = ensureContrast(hexOk(p.muted) ? norm(p.muted) : text, [bg, surface], 4.5);
  const accent = ensureContrast(norm(p.accent), [bg, surface], 4.5);
  const accent2 = ensureContrast(hexOk(p.accent2) ? norm(p.accent2) : accent, [bg], 3);
  const font = FONT_KEYS.includes(p.font as FontKey) ? (p.font as FontKey) : "modern";
  const motif = MOTIFS.includes(p.motif as Motif) ? (p.motif as Motif) : "bar";
  const name = (p.name || "Palet AI").replace(/[^\p{L}\p{N} ]+/gu, "").trim().slice(0, 28) || "Palet AI";
  return getTheme(aiThemeId({ bg, surface, text, muted, accent, accent2, font, motif, name }));
}

const hexIn = (s: string) => [...new Set((s.match(/#[0-9a-f]{6}\b/gi) || []).map(norm))].slice(0, 3);

/**
 * Minta AI memilih palet untuk topik/suasana. Warna brand yang disebut user (#RRGGBB) dipakai sebagai aksen.
 * Gagal / tidak layak -> tema katalog yang paling cocok (pickTheme).
 */
export async function choosePalette(opts: { request: string; context?: string; keep?: DeckTheme | null }): Promise<DeckTheme> {
  const { request, context = "" } = opts;
  if (namesCatalogTheme(request)) return pickTheme(request);
  const brand = hexIn(request);
  try {
    const { text } = await callLLM({
      system: "Kamu art director dan color designer. Balas HANYA satu JSON.",
      prompt: `Pilih palet warna untuk materi ini (presentasi/dokumen/gambar).

PERMINTAAN: "${request.slice(0, 500)}"
${context ? `KONTEKS: ${context.slice(0, 500)}\n` : ""}${brand.length ? `WARNA BRAND dari user (wajib dipakai sebagai aksen utama): ${brand.map((b) => "#" + b).join(", ")}\n` : ""}
Panduan desain:
- Tentukan suasana dari topik & audiens (mis. finansial = tenang & tepercaya, kreatif = berani, kesehatan = bersih & hangat, teknologi = tajam, edukasi anak = ceria).
- Aturan 60-30-10: latar (bg) dominan, surface untuk kartu, aksen dipakai hemat.
- Warna harmonis (analog, komplementer, atau satu hue dengan variasi terang). Hindari pelangi, hindari neon terang di latar gelap, hindari abu-abu generik.
- Teks harus kontras tinggi dengan bg dan surface. "mode" dark atau light sesuai suasana.
- Jangan selalu hijau/biru; variasikan sesuai topik.

JSON:
{"name":"nama palet 1-3 kata","mode":"dark|light","bg":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","accent":"#RRGGBB","accent2":"#RRGGBB","font":"serif|elegant|modern|bold|humanist","motif":"bar|circle|rule|blob|dots|frame"}`,
      maxTokens: 500,
      prefer: ["gemini", "openrouter"],
      json: true,
      temperature: 0.85,
      fast: true,
    });
    const raw = parseLoose<RawPalette>(text);
    if (raw && typeof raw === "object") {
      if (brand[0]) raw.accent = brand[0];
      const theme = buildThemeFromPalette(raw);
      if (theme) return theme;
    }
  } catch {
    // jatuh ke tema katalog
  }
  return pickTheme(request);
}
