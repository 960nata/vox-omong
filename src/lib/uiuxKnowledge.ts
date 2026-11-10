import data from "./uiux/uupm.json";

/**
 * Pengetahuan UI/UX dari "UI UX Pro Max" (nextlevelbuilder/ui-ux-pro-max-skill, lisensi MIT,
 * lihat src/lib/uiux/LICENSE-ui-ux-pro-max.txt): 192 jenis produk dengan gaya, pola landing,
 * palet, efek & anti-pattern; pasangan font; pola landing; aturan UX; aturan per stack.
 * Data dikonversi ke uiux/uupm.json; modul ini mencocokkan permintaan berbahasa Indonesia.
 */

export interface UProduct {
  type: string;
  kw: string[];
  style: string;
  landing: string;
  colorFocus: string;
  consider: string;
  effects: string;
  avoid: string;
  typeMood: string;
  colors: { primary: string; secondary: string; accent: string; bg: string; fg: string; muted: string; border: string } | null;
}
interface ULanding {
  name: string;
  order: string;
  cta: string;
  effects: string;
  conversion: string;
}
interface UUx {
  cat: string;
  issue: string;
  do: string;
  dont: string;
  sev: string;
}
interface UStackRule {
  cat: string;
  rule: string;
  do: string;
  dont: string;
  sev: string;
}

const D = data as unknown as {
  products: UProduct[];
  typography: { name: string; heading: string; body: string; mood: string[]; bestFor: string }[];
  landing: ULanding[];
  ux: UUx[];
  stacks: Record<string, UStackRule[]>;
};

/** Kata Indonesia → kata kunci Inggris di data. */
const ID_EN: [RegExp, string[]][] = [
  [/\b(kopi|kafe|cafe|coffee)\b/, ["cafe", "coffee"]],
  [/\b(roti|bakery|kue|toko kue|pastry)\b/, ["bakery", "pastry"]],
  [/\b(restoran|rumah makan|warung|resto|kuliner|makanan|catering|katering)\b/, ["restaurant", "food"]],
  [/\b(toko online|olshop|e-?commerce|jualan|toko|belanja|produk)\b/, ["e-commerce", "shop", "store"]],
  [/\b(baju|pakaian|fashion|butik|hijab|kaos|sepatu)\b/, ["fashion", "clothing", "e-commerce"]],
  [/\b(mewah|luxury|premium|eksklusif)\b/, ["luxury", "premium"]],
  [/\b(klinik)\b/, ["clinic"]],
  [/\b(dokter|rumah sakit|kesehatan|puskesmas)\b/, ["medical", "healthcare"]],
  [/\b(gigi|dental)\b/, ["dental", "dentist"]],
  [/\b(apotek|farmasi)\b/, ["pharmacy"]],
  [/\b(hewan|pet|kucing|anjing|vet)\b/, ["pet", "veterinary"]],
  [/\b(sekolah|kursus|les|belajar|edukasi|pendidikan|kampus)\b/, ["education", "course", "learning"]],
  [/\b(salon|spa|kecantikan|barbershop|pangkas|skincare|kosmetik)\b/, ["beauty", "spa", "salon", "wellness"]],
  [/\b(gym|fitness|olahraga|yoga)\b/, ["fitness", "gym"]],
  [/\b(properti|rumah dijual|kontrakan|kos|apartemen|real estate)\b/, ["real estate", "property"]],
  [/\b(wisata|travel|tour|liburan|pariwisata)\b/, ["travel", "tourism"]],
  [/\b(hotel|villa|penginapan|homestay|resort)\b/, ["hotel", "hospitality"]],
  [/\b(nikah|pernikahan|wedding|undangan)\b/, ["wedding"]],
  [/\b(acara|event|konser|festival|seminar|konferensi)\b/, ["event", "conference"]],
  [/\b(hukum|pengacara|notaris|advokat)\b/, ["legal", "law"]],
  [/\b(asuransi)\b/, ["insurance"]],
  [/\b(bank|keuangan|finansial|koperasi)\b/, ["finance", "banking"]],
  [/\b(kripto|crypto|fintech|dompet digital)\b/, ["fintech", "crypto"]],
  [/\b(portofolio|portfolio|cv|pribadi)\b/, ["portfolio", "personal"]],
  [/\b(agensi|agency|studio kreatif|desain)\b/, ["agency", "creative"]],
  [/\b(foto|fotografer|fotografi)\b/, ["photography"]],
  [/\b(saas|aplikasi|software|startup)\b/, ["saas", "software", "app"]],
  [/\b(ai|chatbot|asisten)\b/, ["ai", "chatbot"]],
  [/\b(dashboard|admin|analitik)\b/, ["dashboard", "analytics"]],
  [/\b(game|gaming)\b/, ["gaming", "game"]],
  [/\b(musik|band|lagu)\b/, ["music"]],
  [/\b(berita|media|portal)\b/, ["news", "media"]],
  [/\b(blog|jurnal|majalah)\b/, ["blog", "magazine"]],
  [/\b(masjid|gereja|pesantren|religi|ibadah)\b/, ["church", "religious"]],
  [/\b(yayasan|donasi|amal|sosial|relawan)\b/, ["non-profit", "charity"]],
  [/\b(lowongan|loker|rekrutmen|karir)\b/, ["job", "recruitment"]],
  [/\b(kirim|ekspedisi|kurir|logistik)\b/, ["logistics", "delivery"]],
  [/\b(tani|pertanian|kebun|peternakan)\b/, ["agriculture", "farm"]],
  [/\b(konstruksi|kontraktor|arsitek|interior|bangunan)\b/, ["construction", "architecture", "interior"]],
  [/\b(mobil|motor|bengkel|dealer|otomotif)\b/, ["automotive", "car"]],
  [/\b(bunga|florist|tanaman)\b/, ["florist", "plant"]],
  [/\b(coworking|ruang kerja)\b/, ["coworking"]],
  [/\b(tukang|servis|service|perbaikan|reparasi)\b/, ["repair", "maintenance", "handyman"]],
  [/\b(ac|pendingin)\b/, ["hvac"]],
  [/\b(listrik|kelistrikan)\b/, ["electrician", "wiring"]],
  [/\b(ledeng|pipa|saluran)\b/, ["plumber", "leak"]],
  [/\b(anak|daycare|penitipan)\b/, ["childcare", "kids"]],
  [/\b(lansia|panti)\b/, ["senior care"]],
  [/\b(museum|galeri|pameran|seni)\b/, ["museum", "gallery", "art"]],
  [/\b(bioskop|teater)\b/, ["cinema", "theater"]],
  [/\b(podcast)\b/, ["podcast"]],
  [/\b(komunitas|member|klub)\b/, ["community", "membership", "club"]],
  [/\b(tiket)\b/, ["ticketing", "tickets"]],
  [/\b(booking|reservasi|janji temu)\b/, ["booking", "appointment"]],
  [/\b(invoice|tagihan)\b/, ["invoice", "billing"]],
  [/\b(stok|inventaris|gudang)\b/, ["inventory", "stock"]],
];

function terms(text: string): string[] {
  const low = text.toLowerCase();
  const out = new Set<string>();
  for (const [re, en] of ID_EN) if (re.test(low)) en.forEach((w) => out.add(w));
  for (const w of low.match(/[a-z][a-z-]{2,}/g) || []) out.add(w);
  return [...out];
}

/** Seberapa langka sebuah kata kunci di seluruh kategori: kata spesifik ("dental") lebih berbobot dari kata umum ("clinic"). */
const DF = new Map<string, number>();
for (const p of D.products) for (const k of new Set(p.kw.flatMap((x) => x.split(/\s+/)))) DF.set(k, (DF.get(k) || 0) + 1);
const idf = (w: string) => Math.log((D.products.length + 1) / ((DF.get(w) || 0) + 1));

/** Jenis produk paling cocok untuk permintaan (atau null bila tidak ada yang meyakinkan). */
export function matchProduct(text: string): { product: UProduct; score: number } | null {
  const t = terms(text);
  if (!t.length) return null;
  let best: { product: UProduct; score: number } | null = null;
  for (const p of D.products) {
    const name = p.type.toLowerCase();
    let score = 0;
    for (const w of t) {
      const wt = idf(w);
      if (p.kw.includes(w)) score += 2 * wt;
      else if (p.kw.some((k) => k.split(/\s+/).includes(w))) score += wt;
      if (new RegExp(`\\b${w.replace(/[^a-z-]/g, "")}\\b`).test(name)) score += 1.5 * wt;
    }
    if (score > (best?.score || 0)) best = { product: p, score };
  }
  return best && best.score >= 4 ? best : null;
}

function landingFor(p: UProduct): ULanding | undefined {
  const first = p.landing.split(/[+,/]/)[0].trim().toLowerCase();
  return D.landing.find((l) => l.name.toLowerCase() === p.landing.toLowerCase()) || D.landing.find((l) => l.name.toLowerCase().startsWith(first));
}

/** Aturan UX prioritas tinggi untuk web (ringkas, untuk prompt). */
export function topUxRules(n = 8): string[] {
  return D.ux
    .filter((u) => /high|critical/i.test(u.sev))
    .slice(0, n)
    .map((u) => `${u.issue}: ${u.do}${u.dont ? ` (hindari: ${u.dont})` : ""}`);
}

/** Ringkasan arahan desain untuk prompt LLM. Kosong bila tidak ada kecocokan. */
export function designBrief(text: string): string {
  const m = matchProduct(text);
  if (!m) return "";
  const p = m.product;
  const l = landingFor(p);
  return [
    `ARAHAN DESAIN (UI UX Pro Max, kategori "${p.type}"):`,
    `- Gaya utama: ${p.style}. Fokus warna: ${p.colorFocus}.`,
    l ? `- Pola halaman: ${l.name} → ${l.order}. CTA utama: ${l.cta}.` : `- Pola halaman: ${p.landing}.`,
    p.consider ? `- Perhatikan: ${p.consider}` : "",
    p.effects ? `- Efek yang cocok: ${p.effects}` : "",
    p.avoid ? `- Hindari: ${p.avoid}` : "",
    l?.conversion ? `- Konversi: ${l.conversion}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Palet terang dari data untuk jenis produk (dipakai bila palet kurasi kita tidak cocok dengan topik). */
export function productPalette(text: string): { name: string; bg: string; ink: string; accent: string; accent2: string } | null {
  const m = matchProduct(text);
  const c = m?.product.colors;
  if (!m || !c) return null;
  return { name: m.product.type, bg: c.bg, ink: c.fg, accent: c.primary, accent2: c.accent };
}

/** Aturan stack (react, nextjs, html-tailwind, shadcn) prioritas tinggi, untuk prompt kode. */
export function stackRules(stack: "react" | "nextjs" | "html-tailwind" | "shadcn", n = 10): string[] {
  return (D.stacks[stack] || [])
    .filter((r) => /high|critical/i.test(r.sev))
    .slice(0, n)
    .map((r) => `${r.rule}: ${r.do}${r.dont ? ` (hindari: ${r.dont})` : ""}`);
}

/** Jawaban chat untuk "saran desain untuk …". */
export function designAdvice(text: string): string | null {
  const m = matchProduct(text);
  if (!m) return null;
  const p = m.product;
  const l = landingFor(p);
  const c = p.colors;
  const font = D.typography.find((f) => f.mood.some((x) => p.typeMood.toLowerCase().includes(x))) || null;
  return [
    `Saran desain untuk kategori ${p.type}:`,
    `• Gaya: ${p.style}`,
    l ? `• Urutan bagian: ${l.order}\n• CTA: ${l.cta}` : `• Pola halaman: ${p.landing}`,
    c ? `• Palet: utama ${c.primary}, aksen ${c.accent}, latar ${c.bg}, teks ${c.fg} (${p.colorFocus})` : "",
    font ? `• Font: ${font.heading} untuk judul, ${font.body} untuk isi` : "",
    p.effects ? `• Efek: ${p.effects}` : "",
    p.avoid ? `• Hindari: ${p.avoid}` : "",
    p.consider ? `• Catatan: ${p.consider}` : "",
    `\nBilang "buatin website …" dan arahan ini otomatis dipakai.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function detectDesignAdvice(msg: string): string | null {
  const m = msg.trim().match(/^(?:tolong\s+)?(?:saran|rekomendasi|ide)\s+(?:desain|ui|ux|tampilan|warna)\s+(?:untuk|buat|website|web)?\s*(.{3,})$/i);
  return m ? m[1] : null;
}
