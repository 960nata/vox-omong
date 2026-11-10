import { parseLoose } from "./jsonLoose";
import { callLLM } from "./codeAgent";
import { getTheme } from "./claudeSkills/themes";
import { choosePalette } from "./claudeSkills/palette";
import { searchPhotos, trackPhotoUse } from "./media";
import { skillContextFor } from "./skillHub";
import { MIN_SLIDES, parseSlideCount, wantsLongerDeck, wantsNewTheme } from "./deckFlow";
import type { ArtifactItem, InvoiceData, LetterData, SlideDeckData, SlideImage, SlideItem, SlideLayout } from "./types";

/**
 * Skill engine: slide presentasi, invoice, spreadsheet, dan dokumen PDF
 * yang isinya ditulis AI sesuai permintaan (bukan template statis),
 * dengan tema visual yang berganti-ganti.
 */

export type SkillKind = "slides" | "invoice" | "spreadsheet" | "document";

export function detectSkill(message: string): SkillKind | null {
  const p = message.toLowerCase();
  if (/\b(ppt|pptx|powerpoint|slide|slides|presentasi|pitch ?deck|deck)\b/.test(p)) return "slides";
  if (/\b(invoice|tagihan|faktur|kwitansi|nota)\b/.test(p)) return "invoice";
  if (/\b(excel|spreadsheet|xlsx|csv|tabel)\b/.test(p)) return "spreadsheet";
  if (/\b(pdf|dokumen|laporan|proposal|surat|makalah|artikel|esai|essay|sop|kontrak|cv|resume)\b/.test(p) &&
      /\b(buat|bikin|buatin|bikinin|buatkan|tulis|tuliskan|susun|generate|create|write)\b/.test(p)) return "document";
  if (/\b(cashflow|arus kas|anggaran|budget|rekap)\b/.test(p)) return "spreadsheet";
  return null;
}

function parseJson<T>(text: string): T | null {
  const v = parseLoose<T>(text);
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/** JSON dari model: mode JSON asli + suhu rendah, diperbaiki kode bila rusak, baru minta ulang (dengan contoh salahnya). */
export async function askJson<T>(system: string, prompt: string, apiKey?: string, maxTokens = 4000): Promise<{ data: T; model: string }> {
  let { text, model } = await callLLM({ system, prompt, apiKey, maxTokens, prefer: ["gemini", "openrouter"], json: true });
  let data = parseJson<T>(text);
  if (!data) {
    ({ text, model } = await callLLM({
      system,
      prompt: `${prompt}\n\nJawaban sebelumnya BUKAN JSON valid (awalnya: ${JSON.stringify(text.slice(0, 160))}). Balas HANYA satu objek JSON valid sesuai skema, mulai dengan { dan akhiri dengan }.`,
      apiKey,
      maxTokens,
      prefer: ["gemini", "openrouter"],
      json: true,
      temperature: 0,
    }));
    data = parseJson<T>(text);
  }
  if (!data) throw new Error("AI tidak mengembalikan data yang valid");
  return { data, model };
}

const BASE_RULES =
  "Tulis dalam Bahasa Indonesia yang natural kecuali user minta bahasa lain. Isi harus spesifik untuk topik user, realistis, dan tidak generik. Balas HANYA JSON valid sesuai skema.";

// ------------------------------------------------------------------ slides

const LAYOUTS: SlideLayout[] = ["cover", "bullets", "stat", "quote", "split", "closing", "image", "steps"];

export interface SlideContext {
  /** beberapa pesan terakhir, supaya topik deck tidak hilang saat user cuma berkomentar */
  history?: { role: string; content: string }[];
  /** deck terakhir di chat ini; kalau ada, permintaan dianggap REVISI atas deck itu */
  prevDeck?: SlideDeckData;
}

/** Skill komunitas yang cocok dengan topik (dari skillHub), dipakai sebagai panduan tambahan di prompt. Gagal/tidak ada = kosong. */
async function skillGuide(request: string, history: { role: string; content: string }[] = []) {
  const userText = history.filter((m) => m.role === "user").slice(-4).map((m) => m.content).join(" ");
  try {
    const hub = await skillContextFor(`${request} ${userText}`.slice(0, 1200));
    return hub ? { name: hub.name, text: hub.context.slice(0, 7000) } : null;
  } catch {
    return null;
  }
}

function compactHistory(history: { role: string; content: string }[] = []) {
  return history
    .slice(-10)
    .map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content.replace(/\s+/g, " ").slice(0, 320)}`)
    .join("\n");
}

function compactDeck(deck: SlideDeckData) {
  return JSON.stringify({
    deckTitle: deck.deckTitle,
    slides: deck.slides.map((s) => ({
      layout: s.layout,
      kicker: s.kicker,
      title: s.title,
      subtitle: s.subtitle,
      bullets: s.bullets,
      stat: s.stat,
      quote: s.quote,
      columns: s.columns,
      imageQuery: s.imageQuery,
      speakerNotes: s.speakerNotes,
    })),
  });
}

/** Ambil foto untuk slide yang punya imageQuery (paralel, gagal = slide tanpa foto). Foto lama dipakai ulang kalau kata kuncinya sama. */
async function attachImages(slides: SlideItem[], prev?: SlideDeckData) {
  const reuse = new Map<string, SlideImage>();
  prev?.slides.forEach((s) => s.imageQuery && s.image && reuse.set(s.imageQuery.toLowerCase(), s.image));
  const used = new Set<string>();
  await Promise.all(
    slides.map(async (s) => {
      const q = s.imageQuery?.trim();
      if (!q) return;
      const old = reuse.get(q.toLowerCase());
      if (old) {
        s.image = old;
        return;
      }
      const [p] = await searchPhotos(q, 3).then((r) => r.filter((x) => !used.has(x.id)).slice(0, 1)).catch(() => []);
      if (!p) return;
      used.add(p.id);
      s.image = { url: p.url, small: p.small, alt: p.alt, author: p.author, authorUrl: p.authorUrl, color: p.color };
    })
  );
}

async function makeSlides(request: string, apiKey?: string, ctx: SlideContext = {}) {
  const prev = ctx.prevDeck;
  const asked = parseSlideCount(request);
  const longer = wantsLongerDeck(request);
  const count = Math.max(MIN_SLIDES, asked ?? (prev ? (longer ? Math.min(Math.max(prev.slides.length + 5, 12), 20) : prev.slides.length) : longer ? 14 : 10));
  const keepTheme = !!prev && !wantsNewTheme(request);
  const theme = keepTheme ? getTheme(prev!.theme) : await choosePalette({ request, context: ctx.history?.slice(-4).map((m) => m.content.slice(0, 200)).join(" ") });
  const system = `Kamu adalah penulis presentasi dan story-teller kelas dunia. ${BASE_RULES}`;
  const hist = compactHistory(ctx.history);
  const guide = await skillGuide(request, ctx.history);

  const schema = `Skema JSON:
{
  "deckTitle": string,
  "slides": [
    {
      "layout": "cover" | "bullets" | "stat" | "quote" | "split" | "closing" | "image" | "steps",
      "kicker": string (label kecil di atas judul, 1-3 kata),
      "title": string (maks 8 kata, kuat dan spesifik),
      "subtitle": string (opsional, 1 kalimat),
      "bullets": string[] (untuk "bullets" dan "image": 3-4 poin, masing-masing maks 14 kata),
      "stat": { "value": string (angka singkat misal "73%" / "Rp2,4 M" / "3x"), "label": string } (untuk "stat"),
      "quote": { "text": string, "author": string } (untuk "quote"),
      "columns": { "leftTitle": string, "left": string[], "rightTitle": string, "right": string[] } (untuk "split", 2-3 poin per sisi),
      "imageQuery": string (kata kunci pencarian foto stok dalam bahasa INGGRIS, 2-4 kata, konkret dan fotografis, misal "data center servers" / "trader looking at charts"; JANGAN kata abstrak seperti "success"),
      "speakerNotes": string (2 kalimat yang akan diucapkan presenter)
    }
  ]
}

Aturan:
- Tepat ${count} slide. Slide pertama "cover", terakhir "closing".
- Pakai layout "image" (teks + foto besar di samping) untuk sedikitnya 3 slide isi, dan isi "imageQuery" untuk cover, closing, semua slide "image", dan sedikitnya separuh slide lain. Slide "quote" dan "stat" boleh tanpa foto.
- Layout "steps" (alur/tahapan/timeline: 3-5 kotak berurutan, isi "bullets" 3-5 item, tiap item "Judul singkat: penjelasan" maks 14 kata) dipakai untuk proses, roadmap, atau langkah-langkah. Pakai sekali kalau materinya memang berurutan.
- Wajib ada minimal satu "stat", satu "split", dan satu "quote". Variasikan layout, jangan dua layout sama berurutan.
- Isi harus padat dan berbobot: setiap poin berisi fakta, angka, contoh, atau langkah konkret, bukan kalimat kosong.`;

  let prompt = prev
    ? `Ini deck presentasi yang sudah ada:
${compactDeck(prev)}

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

PERMINTAAN REVISI DARI USER: "${request}"

Revisi deck di atas sesuai permintaan, dan PERTAHANKAN topiknya (jangan ganti topik menjadi komentar user). Kembalikan deck LENGKAP yang sudah direvisi. Pertahankan isi bagus yang tidak diminta diubah.

${schema}`
    : `Buat presentasi. Topiknya diambil dari permintaan dan riwayat chat ini.

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

PERMINTAAN SEKARANG: "${request}"

Kalau permintaan sekarang cuma komentar/keluhan, topiknya adalah topik presentasi yang dibahas di riwayat chat, bukan isi komentar itu.

${schema}`;

  const maxTokens = Math.min(900 + count * 520, 9000);
  if (guide) prompt += guide.text;
  let { data, model } = await askJson<{ deckTitle: string; slides: Partial<SlideItem>[] }>(system, prompt, apiKey, maxTokens);
  // Minimal 7 slide: kalau model memberi lebih sedikit, minta sekali lagi dengan penekanan
  if ((data.slides || []).length < MIN_SLIDES) {
    ({ data, model } = await askJson<{ deckTitle: string; slides: Partial<SlideItem>[] }>(
      system,
      `${prompt}\n\nPENTING: jawabanmu sebelumnya kurang dari ${MIN_SLIDES} slide. Kembalikan TEPAT ${count} slide lengkap, tidak boleh kurang dari ${MIN_SLIDES}.`,
      apiKey,
      maxTokens
    ));
  }
  const slides: SlideItem[] = (data.slides || []).slice(0, 20).map((s, i) => ({
    slideNumber: i + 1,
    layout: LAYOUTS.includes(s.layout as SlideLayout) ? (s.layout as SlideLayout) : "bullets",
    kicker: s.kicker,
    title: s.title || `Slide ${i + 1}`,
    subtitle: s.subtitle,
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 5) : [],
    stat: s.stat,
    quote: s.quote,
    columns: s.columns,
    imageQuery: typeof s.imageQuery === "string" ? s.imageQuery.replace(/[^\w\s'-]/g, "").slice(0, 60) : undefined,
    speakerNotes: s.speakerNotes,
  }));
  if (slides.length < MIN_SLIDES) throw new Error(`Deck cuma ${slides.length} slide, minimal ${MIN_SLIDES}`);
  await attachImages(slides, prev);
  const withPhotos = slides.filter((s) => s.image).length;

  const artifact: ArtifactItem = {
    id: `art-slides-${Date.now()}`,
    type: "slides",
    title: data.deckTitle || prev?.deckTitle || "Presentasi",
    summary: `${slides.length} slide · ${withPhotos} berfoto · tema ${theme.name}`,
    slides: { deckTitle: data.deckTitle || prev?.deckTitle || "Presentasi", slides, theme: theme.id },
    status: "completed",
  };
  const photoNote = withPhotos
    ? ` ${withPhotos} slide pakai foto dari Unsplash.`
    : " Foto belum kepasang (kunci Unsplash kosong atau kuotanya habis), jadi deck-nya teks dulu.";
  return {
    reply: prev
      ? `Deck-nya udah aku revisi: ${slides.length} slide, tema ${theme.name}.${photoNote}${guide ? ` Pakai skill ${guide.name}.` : ""} Mau ganti tema, tambah slide, atau ubah bagian tertentu? Bilang aja.`
      : `Presentasi "${artifact.title}" udah jadi, ${slides.length} slide pakai tema ${theme.name}.${photoNote}${guide ? ` Pakai skill ${guide.name}.` : ""} Bisa diunduh jadi PPTX, diputar, atau diekspor jadi video. Mau lebih banyak slide, ganti tema, atau ubah isinya? Bilang aja.`,
    artifact,
    model,
  };
}

// ------------------------------------------------------------------ invoice

async function makeInvoice(request: string, apiKey?: string) {
  const guide = await skillGuide(request);
  const system = `Kamu adalah staf finance yang teliti. ${BASE_RULES}`;
  const prompt = `Buat data invoice dari permintaan ini: "${request}"
Kalau ada detail yang tidak disebut, isi dengan contoh yang masuk akal (nama usaha, klien, item jasa/produk yang relevan, harga pasar Indonesia).

Skema JSON:
{
  "companyName": string, "companyAddress": string,
  "clientName": string, "clientAddress": string,
  "items": [{ "description": string, "quantity": number, "unitPrice": number }],
  "taxRate": number (persen, default 11),
  "currency": "IDR" | "USD",
  "dueDays": number,
  "notes": string (instruksi pembayaran / ucapan terima kasih)
}${guide ? guide.text : ""}`;
  type Raw = {
    companyName: string; companyAddress: string; clientName: string; clientAddress: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    taxRate?: number; currency?: string; dueDays?: number; notes?: string;
  };
  const { data, model } = await askJson<Raw>(system, prompt, apiKey, 2500);
  const items = (data.items || []).map((it) => {
    const quantity = Number(it.quantity) || 1;
    const unitPrice = Number(it.unitPrice) || 0;
    return { description: it.description, quantity, unitPrice, total: quantity * unitPrice };
  });
  const subtotal = items.reduce((a, b) => a + b.total, 0);
  const taxRate = Number.isFinite(Number(data.taxRate)) ? Number(data.taxRate) : 11;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const now = new Date();
  const due = new Date(now.getTime() + (Number(data.dueDays) || 14) * 86400000);
  const styles: InvoiceData["style"][] = ["klasik", "modern", "bold"];
  const accents = ["#23786e", "#c8102e", "#0047ff", "#d4771f", "#1b2a4a", "#7c3aed"];

  const invoice: InvoiceData = {
    invoiceNumber: `INV/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(Math.floor(Math.random() * 900) + 100)}`,
    date: now.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    clientName: data.clientName,
    clientAddress: data.clientAddress,
    items,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    currency: data.currency === "USD" ? "USD" : "IDR",
    notes: data.notes,
    style: styles[Math.floor(Math.random() * styles.length)],
    accent: accents[Math.floor(Math.random() * accents.length)],
  };
  const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: invoice.currency, maximumFractionDigits: 0 });
  return {
    reply: `Invoice ${invoice.invoiceNumber} untuk ${invoice.clientName} udah siap. Totalnya ${fmt.format(invoice.totalAmount)} termasuk pajak ${taxRate}%. Klik cetak buat simpan jadi PDF.`,
    artifact: {
      id: `art-inv-${Date.now()}`,
      type: "invoice",
      title: `Invoice ${invoice.invoiceNumber}`,
      invoice,
      status: "completed",
    } as ArtifactItem,
    model,
  };
}

// ------------------------------------------------------------------ spreadsheet

async function makeSpreadsheet(request: string, apiKey?: string) {
  const guide = await skillGuide(request);
  const system = `Kamu adalah analis data yang rapi. ${BASE_RULES}`;
  const prompt = `Buat tabel spreadsheet untuk permintaan ini: "${request}"

Skema JSON:
{
  "title": string,
  "headers": string[] (3-7 kolom),
  "rows": (string | number)[][] (8-15 baris; angka ditulis sebagai number tanpa pemisah ribuan),
  "insight": string (1-2 kalimat temuan penting dari data)
}
Kalau relevan, baris terakhir adalah "Total".${guide ? guide.text : ""}`;
  const { data, model } = await askJson<{ title: string; headers: string[]; rows: (string | number)[][]; insight?: string }>(
    system,
    prompt,
    apiKey,
    3500
  );
  const headers = data.headers || [];
  const rows = (data.rows || []).map((r) => headers.map((_, i) => (r[i] ?? "") as string | number));
  const filename = `${(data.title || "spreadsheet").replace(/[^a-zA-Z0-9_-]+/g, "_")}.csv`;
  return {
    reply: `Tabel "${data.title}" udah jadi, ${rows.length} baris. ${data.insight || ""} Bisa diunduh jadi CSV.${guide ? ` Pakai skill ${guide.name}.` : ""}`.trim(),
    artifact: {
      id: `art-sheet-${Date.now()}`,
      type: "spreadsheet",
      title: data.title,
      summary: data.insight,
      spreadsheet: { title: data.title, filename, headers, rows },
      status: "completed",
    } as ArtifactItem,
    model,
  };
}

// ------------------------------------------------------------------ document

export interface DocContext {
  history?: { role: string; content: string }[];
  /** dokumen terakhir di chat ini; kalau ada, permintaan dianggap revisi atas dokumen itu */
  prevDoc?: { title: string; subtitle?: string; markdown: string; theme?: string; letter?: LetterData };
}

/** [[cover: ...]] / [[foto: ...]] -> gambar Markdown dari Unsplash (+ keterangan fotografer). Gagal / tanpa API key = baris dibuang. */
async function resolveDocPhotos(body: string): Promise<string> {
  const used: Awaited<ReturnType<typeof searchPhotos>> = [];
  const lines = body.split("\n");
  const out: string[] = [];
  let count = 0;
  for (const line of lines) {
    const m = line.match(/^\s*\[\[(cover|foto|photo|gambar)\s*:\s*([^\]]{2,80})\]\]\s*$/i);
    if (!m) {
      out.push(line);
      continue;
    }
    if (count >= 4) continue;
    count++;
    const isCover = m[1].toLowerCase() === "cover";
    const [photo] = await searchPhotos(m[2], 1, "landscape").catch(() => []);
    if (!photo) continue;
    used.push(photo);
    const alt = (isCover ? "cover" : photo.alt).replace(/[\[\]()\n]/g, " ").slice(0, 90);
    out.push(`![${alt}](${photo.url})`, `*Foto: ${photo.author} / Unsplash*`);
  }
  const text = out.join("\n");
  void trackPhotoUse(used, text);
  return text;
}

const LETTER_WORDS = /\b(surat|kop surat|nota dinas|undangan resmi|memo dinas)\b/i;
const NOT_LETTER = /\b(perjanjian|kontrak|cinta|spam|newsletter|kabar)\b/i;
/** Surat resmi / dinas / lamaran / undangan yang butuh kop, nomor, perihal, dan tanda tangan. */
export function isLetterRequest(request: string) {
  return LETTER_WORDS.test(request) && !NOT_LETTER.test(request);
}

function letterToText(l: LetterData) {
  return [
    l.kop?.name ? `${l.kop.name}${l.kop.unit ? ` / ${l.kop.unit}` : ""}` : "",
    `${l.tempat}, ${l.tanggal}`,
    l.nomor ? `Nomor: ${l.nomor}` : "",
    l.lampiran ? `Lampiran: ${l.lampiran}` : "",
    `Perihal: ${l.perihal}`,
    "",
    ...l.kepada,
    "",
    l.pembuka || "",
    ...l.isi.flatMap((p) => [p, ""]),
    ...(l.rincian || []).map((r) => `${r.label}: ${r.value}`),
    l.penutup || "",
    "",
    l.salamPenutup || "Hormat kami,",
    l.jabatan || "",
    l.nama,
    l.nip || "",
  ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
}

async function makeLetter(request: string, apiKey: string | undefined, ctx: DocContext) {
  const prev = ctx.prevDoc?.letter;
  const hist = compactHistory(ctx.history);
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const guide = await skillGuide(request, ctx.history);
  const system = `Kamu adalah staf tata usaha yang menguasai Pedoman Tata Naskah Dinas dan surat-menyurat resmi Indonesia. ${BASE_RULES}`;
  const prompt = `${prev ? `SURAT YANG SUDAH ADA (JSON):\n${JSON.stringify(prev)}\n\nREVISI DARI USER: "${request}"\nTerapkan revisi, pertahankan bagian lain, dan kembalikan JSON surat LENGKAP.` : `Buat surat sesuai permintaan: "${request}"`}

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

Hari ini: ${today}.

Skema JSON:
{
  "kind": "resmi" | "undangan" | "keterangan" | "lamaran" | "lainnya",
  "kop": { "name": "nama instansi/perusahaan", "unit": "unit/bagian (opsional)", "address": "alamat", "contact": "telepon, email, laman" } | null,
  "nomor": string | null, "lampiran": string | null, "perihal": string,
  "tempat": "kota penerbitan", "tanggal": "tanggal lengkap, default hari ini",
  "kepada": ["Yth. ...", "di", "Tempat"],
  "pembuka": "Dengan hormat," | "Assalamu'alaikum ..." | null,
  "isi": ["paragraf 1", "paragraf 2", ...] (2-4 paragraf, bahasa baku, kalimat efektif),
  "rincian": [{"label":"Hari/Tanggal","value":"..."}] | null (untuk undangan: hari/tanggal, waktu, tempat, acara; untuk lamaran: data diri pelamar),
  "penutup": string | null,
  "salamPenutup": "Hormat kami," | "Hormat saya," | "Wassalam," ,
  "jabatan": string | null, "nama": string, "nip": string | null,
  "tembusan": string[] | null
}
Aturan:
- "kop" HANYA untuk surat atas nama instansi/perusahaan (dinas, undangan, keterangan). Surat pribadi dan lamaran: kop = null.
- JANGAN mengarang data nyata. Nama, alamat, nomor surat, NIP, atau tanggal acara yang tidak disebut user ditulis sebagai placeholder dalam kurung siku, mis. [Nama Instansi], [Nomor Surat], [Nama Penandatangan]. Nomor surat resmi kalau tidak disebut: "[Nomor Surat]".
- Ikuti kaidah: Yth. + jabatan/nama, perihal singkat tanpa titik, isi memakai bahasa baku, penutup sopan ("Demikian ... atas perhatian dan kerja samanya, kami ucapkan terima kasih.").${guide ? guide.text : ""}`;
  const { data, model } = await askJson<LetterData>(system, prompt, apiKey, 3500);
  const clean = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  const arr = (x: unknown) => (Array.isArray(x) ? x.map(clean).filter(Boolean) : []);
  const letter: LetterData = {
    kind: (["resmi", "undangan", "keterangan", "lamaran", "lainnya"] as const).includes(data.kind) ? data.kind : "resmi",
    kop: data.kop && clean(data.kop.name) ? { name: clean(data.kop.name), unit: clean(data.kop.unit) || undefined, address: clean(data.kop.address) || undefined, contact: clean(data.kop.contact) || undefined } : undefined,
    nomor: clean(data.nomor) || undefined,
    lampiran: clean(data.lampiran) || undefined,
    perihal: clean(data.perihal) || "Surat",
    tempat: clean(data.tempat) || "[Kota]",
    tanggal: clean(data.tanggal) || today,
    kepada: arr(data.kepada).length ? arr(data.kepada) : ["Yth. [Nama Penerima]", "di", "Tempat"],
    pembuka: clean(data.pembuka) || undefined,
    isi: arr(data.isi),
    rincian: Array.isArray(data.rincian) ? data.rincian.map((r) => ({ label: clean(r?.label), value: clean(r?.value) })).filter((r) => r.label && r.value) : undefined,
    penutup: clean(data.penutup) || undefined,
    salamPenutup: clean(data.salamPenutup) || undefined,
    jabatan: clean(data.jabatan) || undefined,
    nama: clean(data.nama) || "[Nama Penandatangan]",
    nip: clean(data.nip) || undefined,
    tembusan: arr(data.tembusan).length ? arr(data.tembusan) : undefined,
  };
  if (!letter.isi.length) throw new Error("Isi surat kosong");
  const placeholders = (JSON.stringify(letter).match(/\[[^\]]{2,40}\]/g) || []).length;
  return {
    reply: `Surat "${letter.perihal}" ${prev ? "udah aku revisi" : "udah aku buat"}${letter.kop ? " lengkap dengan kop" : ""}.${placeholders ? ` Ada ${placeholders} bagian dalam [kurung siku] yang belum kamu sebutin (nama, nomor, dll.); kasih tahu isinya dan aku isi.` : ""}${guide ? ` Pakai skill ${guide.name}.` : ""} Bisa diunduh jadi Word (.docx) atau dicetak jadi PDF.`,
    artifact: {
      id: `art-letter-${Date.now()}`,
      type: "pdf_document",
      title: letter.perihal,
      summary: letter.kop?.name || "Surat",
      pdfTitle: `${letter.perihal.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60)}.pdf`,
      pdfContent: letterToText(letter),
      pdfPages: 1,
      letter,
      status: "completed",
    } as ArtifactItem,
    model,
  };
}

async function makeDocument(request: string, apiKey?: string, ctx: DocContext = {}) {
  if (ctx.prevDoc?.letter ? !/\b(laporan|artikel|proposal|makalah)\b/i.test(request) : isLetterRequest(request)) return makeLetter(request, apiKey, ctx);
  const prev = ctx.prevDoc;
  const hist = compactHistory(ctx.history);
  const guide = await skillGuide(request, ctx.history);
  // Markdown biasa (bukan JSON) — teks panjang ber-baris-baru sering merusak JSON
  const { text, model } = await callLLM({
    system: `Kamu adalah penulis profesional. Tulis dalam Bahasa Indonesia yang natural kecuali user minta bahasa lain. Isi harus spesifik untuk topik user, realistis, dan tidak generik.`,
    prompt: `${
      prev
        ? `Ini dokumen yang sudah ada:

# ${prev.title}
${prev.subtitle ? `> ${prev.subtitle}\n` : ""}
${prev.markdown}

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

PERMINTAAN REVISI DARI USER: "${request}"

Revisi dokumen di atas sesuai permintaan dan PERTAHANKAN topiknya. Kembalikan dokumen LENGKAP yang sudah direvisi, bagian bagus yang tidak diminta diubah tetap dipertahankan.`
        : `Tulis dokumen. Topiknya diambil dari permintaan dan riwayat chat ini.

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

PERMINTAAN SEKARANG: "${request}"

Kalau permintaan sekarang cuma komentar, topiknya adalah topik yang dibahas di riwayat chat.`
    }

Format balasan (WAJIB, tanpa kalimat pembuka seperti "Berikut adalah"):
Baris 1: # Judul dokumen
Baris 2: > Satu kalimat subjudul
${prev ? "Baris foto yang sudah ada (diawali \"![\") WAJIB dipertahankan persis di tempatnya." : `Baris 3: [[cover: 2-4 kata kunci Inggris untuk foto sampul yang relevan]]
Sisipkan juga 2-3 baris [[foto: 2-4 kata kunci Inggris]] masing-masing di baris sendiri, tepat setelah judul bagian yang cocok dengan fotonya (foto konkret dan fotografis, mis. "team meeting office", bukan konsep abstrak).`}
Lalu isi lengkap dalam Markdown: ## untuk bagian, ### sub-bagian, daftar "- ", **tebal**, dan tabel Markdown bila cocok (misalnya anggaran, jadwal, atau perbandingan). Mulai dengan ringkasan eksekutif singkat. ${prev ? "Panjang menyesuaikan dokumen lama dan permintaan." : "900-1500 kata, kecuali user minta lain."} Isi setiap bagian dengan fakta, angka, contoh, atau langkah konkret.${guide ? guide.text : ""}`,
    apiKey,
    maxTokens: 6000,
    prefer: ["gemini", "openrouter"],
  });
  let body = text.replace(/^\s*```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/, "").trim();
  body = body.replace(/^(berikut[^\n]*\n+)/i, "");
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] || prev?.title || request.replace(/^(tolong\s+)?(tulis(kan)?|buat(kan)?|bikin(in)?)\s+/i, "")).replace(/[*_]/g, "").trim().slice(0, 90);
  if (titleMatch) body = body.replace(titleMatch[0], "").trim();
  const subMatch = body.match(/^>\s*(.+)$/m);
  const subtitle = subMatch?.[1]?.trim();
  if (subMatch && body.indexOf(subMatch[0]) < 5) body = body.replace(subMatch[0], "").trim();
  if (body.length < 200) throw new Error("Dokumen terlalu pendek");

  body = await resolveDocPhotos(body);
  const docTheme = prev && !wantsNewTheme(request) ? prev.theme : (await choosePalette({ request: `${title}. ${request}`, context: subtitle })).id;
  const words = body.split(/\s+/).length;
  return {
    reply: `Dokumen "${title}" ${prev ? "udah aku revisi" : "udah aku tulis"}, sekitar ${words} kata.${guide ? ` Pakai skill ${guide.name}.` : ""} Bisa diunduh jadi Word (.docx) atau dicetak jadi PDF. Mau ditambah bagian, diubah gayanya, atau diringkas? Bilang aja.`,
    artifact: {
      id: `art-doc-${Date.now()}`,
      type: "pdf_document",
      title,
      summary: subtitle,
      pdfTitle: `${title.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf`,
      pdfContent: body,
      pdfPages: Math.max(1, Math.round(words / 350)),
      docTheme,
      status: "completed",
    } as ArtifactItem,
    model,
  };
}

export async function runSkill(kind: SkillKind, request: string, apiKey?: string, ctx?: SlideContext & DocContext) {
  switch (kind) {
    case "slides":
      return makeSlides(request, apiKey, ctx);
    case "invoice":
      return makeInvoice(request, apiKey);
    case "spreadsheet":
      return makeSpreadsheet(request, apiKey);
    case "document":
      return makeDocument(request, apiKey, ctx);
  }
}
