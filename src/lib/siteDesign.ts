import { parseLoose } from "./jsonLoose";
import { callLLM } from "./codeAgent";
import { FONT_PAIRINGS, googleFontsLink } from "./designKnowledge";
import { buildThemeFromPalette } from "./claudeSkills/palette";
import { luminance } from "./claudeSkills/colorUtils";
import { loadSkill } from "./skillLoader";
import type { SiteTheme } from "./siteComposer";

/**
 * Arah visual website dari AI: palet warna, pasangan font, gaya, dan radius dipilih khusus untuk brand ini
 * (bukan dari daftar tetap), lalu kode MEMASTIKAN kontras teksnya. Tiap pembuatan diberi "arah" acak
 * sebagai titik awal supaya hasilnya tidak seragam. Gagal = tema dasar (buildTheme) tetap dipakai.
 */

const DIRECTIONS = [
  "Swiss modernist: grid tegas, tipografi besar, satu warna aksen tajam, banyak ruang kosong",
  "Editorial majalah: serif berkarakter, kontras skala huruf ekstrem, palet kertas hangat dengan satu warna berani",
  "Brutalist ramah: blok warna solid, garis tebal, huruf tebal, kontras tinggi, sedikit nakal",
  "Gelap sinematik: latar hampir hitam, satu aksen bercahaya, teks lega, kesan premium",
  "Hangat kerajinan tangan: warna tanah, tekstur kertas, huruf bersahabat, terasa buatan tangan",
  "Retro-futuristik: warna jenuh berpasangan tak biasa, bentuk membulat, ceria tapi rapi",
  "Pastel lembut modern: warna susu dan satu aksen dusty, sudut membulat, tenang",
  "Monokrom dengan satu kejutan: hitam putih bersih, satu warna aksen hanya di hal terpenting",
  "Botani/organik: hijau dan krem yang tidak klise, serif elegan, nuansa alam premium",
  "Pop berani: warna cerah berpasangan, tipografi playful, energik tapi tetap terbaca",
];


interface Raw {
  name?: string;
  bg?: string;
  surface?: string;
  text?: string;
  muted?: string;
  accent?: string;
  accent2?: string;
  pairing?: string;
  style?: string;
  radius?: string;
}

const STYLES = ["editorial", "bold", "soft", "luxury", "tech", "playful", "clean", "vintage"] as const;
const RADII = ["sharp", "soft", "round"] as const;

export async function aiSiteTheme(opts: { text: string; kind: string; brand: string; base: SiteTheme; lockStyle?: boolean; lockDark?: boolean }): Promise<SiteTheme> {
  const { text, kind, brand, base } = opts;
  const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  let guide = "";
  try {
    guide = loadSkill("frontend-design").slice(0, 2200);
  } catch {
    // tanpa panduan lokal
  }
  const pairings = FONT_PAIRINGS.map((f) => `${f.id} (${f.display} + ${f.body}; cocok: ${f.moods.slice(0, 4).join(", ")})`).join("\n");
  try {
    const { text: out } = await callLLM({
      system: "Kamu art director senior untuk website. Balas HANYA satu JSON.",
      prompt: `Tentukan arah visual website ini. Hasilnya harus punya karakter sendiri, bukan template generik.

BRIEF: "${text.slice(0, 600)}"
Jenis: ${kind}${brand ? `, brand: ${brand}` : ""}
${opts.lockStyle ? `User sudah menyebut gaya, WAJIB pakai gaya "${base.style}".\n` : `ARAH AWAL (pakai kalau user tidak menyebut gaya lain): ${direction}\n`}${opts.lockDark ? `User minta tema ${base.dark ? "GELAP" : "TERANG"}: bg harus ${base.dark ? "gelap" : "terang"}.\n` : ""}
${guide ? `PANDUAN DESAIN:\n${guide}\n` : ""}
Aturan: hindari palet klise (krem + oranye, putih + biru generik, hijau teal default) kecuali brief-nya memang menuntut. Pilih 1 warna aksen yang berani dan 1 pendamping; sisanya netral bernuansa. Teks harus kontras tinggi.

Pilihan "pairing" (pilih id yang paling pas):
${pairings}

JSON:
{"name":"nama palet","bg":"#RRGGBB","surface":"#RRGGBB","text":"#RRGGBB","muted":"#RRGGBB","accent":"#RRGGBB","accent2":"#RRGGBB","pairing":"id pairing","style":"${STYLES.join("|")}","radius":"${RADII.join("|")}"}`,
      maxTokens: 600,
      prefer: ["gemini", "openrouter"],
      json: true,
      temperature: 0.9,
      fast: true,
    });
    const raw = parseLoose<Raw>(out);
    if (!raw || typeof raw !== "object") return base;
    const pal = buildThemeFromPalette({ name: raw.name, bg: raw.bg, surface: raw.surface, text: raw.text, muted: raw.muted, accent: raw.accent, accent2: raw.accent2 });
    if (!pal) return base;
    const dark = luminance(pal.bg) < 0.25;
    if (opts.lockDark && dark !== base.dark) return base;
    const pairing = FONT_PAIRINGS.find((f) => f.id === raw.pairing);
    const style = opts.lockStyle ? base.style : (STYLES as readonly string[]).includes(raw.style || "") ? (raw.style as SiteTheme["style"]) : base.style;
    const radius = (RADII as readonly string[]).includes(raw.radius || "") ? (raw.radius as SiteTheme["radius"]) : base.radius;
    return {
      ...base,
      style,
      radius,
      dark,
      display: pairing?.display ?? base.display,
      body: pairing?.body ?? base.body,
      mono: pairing ? pairing.mono : base.mono,
      fontsLink: pairing ? googleFontsLink(pairing.display, pairing.body, pairing.mono) : base.fontsLink,
      colors: { bg: `#${pal.bg}`, ink: `#${pal.text}`, accent: `#${pal.accent}`, accent2: `#${pal.accent2}`, surface: dark ? `#${pal.surface}` : undefined },
    };
  } catch {
    return base;
  }
}
