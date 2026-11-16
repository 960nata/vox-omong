/**
 * Alur proyek tim (ide → bedah → bentuk tim → kerja) untuk orang awam.
 * Semua keputusan "pesan ini skenario apa" ada di decideFlow; semua kalimat balasan ada di sini juga.
 * Fungsi murni (tanpa I/O) supaya tiap skenario bisa dites. Eksekusinya di teamFlowRunner.ts.
 *
 * Aturan pesan: bahasa sehari-hari, tanpa emoji/simbol/kode, selalu diakhiri satu langkah berikutnya
 * yang jelas, dan sapaan mengikuti gaya user (gw/lu, saya/Anda, atau aku/kamu).
 */
import type { IdeaOption, PipelineStage } from "./teamTypes";
import type { TeamPicker } from "./types";
import { parseLoose } from "./jsonLoose";

/* ------------------------------------------------------------------ gaya bahasa */

export type Voice = "gw" | "saya" | "aku";

const VOICE_GW = /\b(?:gw|gue|gua|guwe|lu|lo|loe|elu|elo|cuy|bro|sis|bang|njir|anjir|cok|jir|wkwk\w*)\b/i;
const VOICE_SAYA = /\b(?:saya|anda|bapak|ibu|mohon|silakan)\b/i;
const VOICE_AKU = /\b(?:aku|kamu|ku)\b/i;

/** Gaya sapaan user: pesan terbaru dulu, lalu riwayat (terbaru → terlama). Default aku/kamu. */
export function detectVoice(textsNewestFirst: string[]): Voice {
  for (const t of textsNewestFirst) {
    if (VOICE_GW.test(t)) return "gw";
    if (VOICE_SAYA.test(t)) return "saya";
    if (VOICE_AKU.test(t)) return "aku";
  }
  return "aku";
}

const PRONOUNS: Record<Voice, Record<string, string>> = {
  gw: { "{aku}": "gw", "{Aku}": "Gw", "{kamu}": "lu", "{Kamu}": "Lu" },
  saya: { "{aku}": "saya", "{Aku}": "Saya", "{kamu}": "Anda", "{Kamu}": "Anda" },
  aku: { "{aku}": "aku", "{Aku}": "Aku", "{kamu}": "kamu", "{Kamu}": "Kamu" },
};

/** Ganti {aku}/{kamu} sesuai gaya user. */
export function say(text: string, v: Voice): string {
  return text.replace(/\{[Aa]ku\}|\{[Kk]amu\}/g, (k) => PRONOUNS[v][k] ?? k);
}

/** Instruksi gaya untuk model (ide & analisis) supaya isinya juga mengikuti user. */
export function styleNote(v: Voice): string {
  if (v === "gw") return 'Pakai gaya santai: sebut diri "gw" dan sapa user "lu".';
  if (v === "saya") return 'Pakai bahasa sopan: sebut diri "saya" dan sapa user "Anda".';
  return 'Pakai gaya ramah: sebut diri "aku" dan sapa user "kamu".';
}

/* ------------------------------------------------------------------ pengenal pesan */

const DIVISIONS = "developer|marketing|founder|trading|creative|research|career|custom";

/** "bentuk tim rekomendasi", "buat tim dulu", "tim developer aja", "bntk tim" */
export function isTeamSetupRequest(message: string): boolean {
  return (
    /\b(?:bentuk|bntk|bentk|buat|bikin|pilih|aktifkan|setup|tambah|tambahin|tambahkan)(?:in|kan)?\s+(?:semua\s+)?(?:tim|team|tem|divisi)\b/i.test(message) ||
    /\b(?:tim\s+rekomendasi|rekomendasi\s+tim|semua\s+tim|semua\s+divisi)\b/i.test(message) ||
    new RegExp(`\\b(?:hanya\\s+)?(?:tim|divisi)\\s+(${DIVISIONS})(?:\\s+saja|\\s+aja)?\\b`, "i").test(message)
  );
}

export function singleDivision(message: string): string | null {
  return message.match(new RegExp(`\\b(?:hanya\\s+)?(?:tim|divisi)\\s+(${DIVISIONS})(?:\\s+saja|\\s+aja)?\\b`, "i"))?.[1]?.toLowerCase() ?? null;
}

/** "timnya mana", "mana tim agent-nya", "agentic AI yang ada timnya" */
export function asksForTeams(message: string): boolean {
  return (
    /\b(?:tim|team|divisi)(?:nya)?\s+(?:mana|dimana|di\s+mana|belum|gak\s+ada|nggak\s+ada|ga\s+ada|kok)\b/i.test(message) ||
    /\bmana\s+(?:tim|team|divisi|agen|agent)/i.test(message) ||
    /\b(?:lihat|liat|tampilkan|daftar)\s+(?:tim|team|divisi)\b/i.test(message) ||
    /\b(?:a?gen(?:t|tik)?|ajentik|agentic)\b[\s\S]{0,40}\b(?:tim|team)(?:nya)?\b|\b(?:tim|team)\s+(?:a?gen(?:t|tik)?|ajentik|agentic)/i.test(message)
  );
}

/** Pesan berisi ide/brief proyek → dibedah. */
export function isProjectBrief(message: string, hasFolder = false): boolean {
  if (hasFolder) return true;
  return message.trim().length >= 15 && /\b(proyek|project|ide|produk|bisnis|usaha|jualan|startup|start\s*up|aplikasi|app|platform|website|toko|jasa|layanan|buatkan|bikin|kembangkan|analisis|analisa|bedah|konsep|investasi)\b/i.test(message);
}

/** "belum punya ide", "bingung mau bikin apa" */
const NO_IDEA = /\b(?:belum\s+(?:punya|ada)\s+ide|gak\s+(?:punya|ada)\s+ide|ga\s+(?:punya|ada)\s+ide|nggak\s+(?:punya|ada)\s+ide|gak\s+tau\s+mau\s+(?:bikin|buat)\s+apa|bingung\s+mau\s+(?:bikin|buat|usaha)\s+apa)\b/i;

/**
 * User belum punya ide konkret dan minta disarankan ("ide startup apa yang ok", "kasih ide di bidang kuliner").
 * Pesan yang sudah menjelaskan idenya sendiri ("ide gw: aplikasi kasir UMKM") bukan termasuk.
 */
export function wantsIdeaSuggestions(message: string): boolean {
  const m = message.trim();
  if (m.length > 160) return false;
  if (NO_IDEA.test(m)) return true;
  if (/\bide(?:nya|ku|\s+(?:gw|gue|aku|saya))?\s*(?::|adalah|yaitu|berupa)/i.test(m)) return false;
  if (!/\b(?:ide|idea|ide-ide)(?:nya)?\b/i.test(m)) return false;
  return /\b(?:apa|apaan|mana|yang\s+(?:ok|oke|bagus|cocok|mateng|cuan|menarik)|rekomendasi(?:in|kan)?|saran(?:in|kan)?|kasih|cariin|usul(?:in)?|brainstorm|nanya|tanya|dulu|mateng|cuan|bidang|seputar|tentang|soal|modal|dong|nih|lagi)\b/i.test(m);
}

/** "terserah", "bebas", "apa aja" saat belum ada ide → beri ide. */
const WHATEVER = /^(?:terserah|bebas|apa\s+aja|apa\s+saja|gak\s+tau|ga\s+tau|nggak\s+tau|gatau|ngikut|ikut\s+aja|serah)\b[\s\S]{0,30}$/i;

/** "ide lain", "yang lain dong", "gak ada yang cocok", "ganti ide" */
const MORE_IDEAS = /\b(?:ide\s+(?:lain|baru|yang\s+lain|lainnya)|yang\s+lain|lainnya|gak\s+ada\s+yang\s+(?:cocok|sreg|bagus)|ga\s+ada\s+yang\s+(?:cocok|sreg|bagus)|nggak\s+ada\s+yang\s+(?:cocok|sreg|bagus)|kurang\s+(?:sreg|cocok|bagus)|ga\s+suka|gak\s+suka|nggak\s+suka|ganti\s+ide|ide\s+lagi|kasih\s+lagi|lagi\s+dong)\b/i;

/** Ide terlalu umum untuk dibedah ("mau bikin startup", "usaha online") → tanya detail dulu. */
export function isTooVague(message: string): boolean {
  const m = message.trim().toLowerCase().replace(/[.!?,]+/g, " ").replace(/\s+/g, " ").trim();
  if (m.split(" ").length > 7) return false;
  return /^(?:(?:gw|gue|aku|saya|kita)\s+)?(?:mau|pengen|pingin|ingin|pgn|mo)?\s*(?:bikin|buat|bangun|mulai|punya|coba)?\s*(?:sebuah\s+)?(?:usaha|bisnis|startup|start\s+up|aplikasi|app|produk|proyek|project|jualan|toko)\s*(?:online|baru|digital|sendiri|kecil|kecil-kecilan|yang\s+(?:cuan|untung|laku|bagus|sukses))?\s*(?:dong|nih|ya|cuy|deh|bro|sih)?$/.test(m);
}

const ORDINAL: Record<string, number> = { pertama: 1, kesatu: 1, kedua: 2, ketiga: 3, keempat: 4, kelima: 5 };

/** Semua nomor ide yang disebut ("ide 1", "1 sama 3", "yang kedua"); termasuk yang di luar jangkauan. */
export function mentionedIdeaNumbers(message: string): number[] {
  const m = message.trim().toLowerCase();
  if (m.length > 80) return [];
  const nums = new Set<number>();
  if (/^\s*#?\d\s*[.!]?\s*$/.test(m)) nums.add(Number(m.replace(/\D/g, "")));
  const lead = /\b(?:ide|id|idea|nomor|no\.?|opsi|pilihan|pilih|ambil|yang|gabung(?:in|kan)?|campur(?:in)?)\s*(?:ke-?\s*|nomor\s*|no\.?\s*)?#?(\d)\b/g;
  for (const x of m.matchAll(lead)) nums.add(Number(x[1]));
  // "1 sama 3", "1 dan 2", "1, 3": angka tunggal yang dirangkai
  if (nums.size > 0 || /\b(?:gabung|campur|sama|dan)\b/.test(m)) {
    for (const x of m.matchAll(/(?:^|[\s,&+])(\d)(?=$|[\s,&+.!])/g)) nums.add(Number(x[1]));
  }
  for (const x of m.matchAll(/\b(pertama|kesatu|kedua|ketiga|keempat|kelima)\b/g)) nums.add(ORDINAL[x[1]]);
  return [...nums].filter((n) => n >= 1 && n <= 9).sort((a, b) => a - b);
}

/** "ID 1", "ide 2 aja", "yang kedua", "3" → indeks 0-based; null kalau bukan satu pilihan yang valid. */
export function pickIdea(message: string, count: number): number | null {
  if (count <= 0) return null;
  const nums = mentionedIdeaNumbers(message);
  return nums.length === 1 && nums[0] <= count ? nums[0] - 1 : null;
}

/** Pilih ide lewat namanya ("yang invoice kilat aja"). */
export function pickIdeaByTitle(message: string, ideas: IdeaOption[]): number | null {
  const m = message.toLowerCase();
  if (m.length > 80) return null;
  const hits = ideas
    .map((idea, i) => ({ i, words: idea.title.toLowerCase().split(/\s+/).filter((w) => w.length >= 4) }))
    .filter((x) => x.words.length > 0 && x.words.every((w) => m.includes(w)));
  return hits.length === 1 ? hits[0].i : null;
}

const HELP = /\b(?:bingung|gak\s+ngerti|ga\s+ngerti|nggak\s+ngerti|gak\s+paham|ga\s+paham|caranya|cara\s+pakai(?:nya)?|cara\s+kerja(?:nya)?|gimana\s+(?:cara|sih|ini|nih|caranya)|ini\s+apa(?:an)?|apa\s+ini|maksudnya|ribet|susah|kok\s+gini|apaan\s+sih|help|tolong\s+jelas(?:in|kan)|ini\s+gimana)\b/i;
const GREETING = /^(?:hai|hay|halo|hallo|hello|hi|hei|hey|p|pp|tes|test|testing|ping|pagi|siang|sore|malam|met\s+\w+|assalamu.?alaikum|woi|oi|bro|cuy|min|kak|ok(?:e|ay)?|sip|siap|mantap|makasih|thanks|terima\s+kasih|thx|ya|iya|y|yoi|wkwk\w*|hehe\w*|haha\w*)\b[\s!.?]*\S{0,12}[\s!.?]*$/i;
const RESET = /\b(?:mulai\s+(?:dari\s+)?(?:awal|nol|ulang)|ulang\s+dari\s+awal|reset|dari\s+awal\s+lagi|batal(?:in|kan)?\s+semua)\b/i;
const REMOVE = /\b(?:hapus|buang|bubar(?:in|kan)|keluar(?:in|kan)|copot|gak\s+jadi|ga\s+jadi|nggak\s+jadi|gajadi|batal(?:in|kan)?)\b/i;
const REANALYZE = /\b(?:bedah|analisis|analisa|cek)\s+(?:ulang|lagi)\b|\bcoba\s+(?:lagi|ulang)\b/i;
const NEXT = /^(?:terus|trus|lalu|habis\s+ini|abis\s+ini|abis\s+itu|selanjutnya|next|lanjut(?:kan)?|sekarang\s+apa|ngapain|terus\s+ngapain|terus\s+gimana|udah|sudah|done|beres)\b[\s\S]{0,30}$/i;

/** Nama tim yang tidak dikenal ("bentuk tim hukum") untuk dijelaskan, bukan diam-diam diabaikan. */
export function unknownDivision(message: string): string | null {
  const skip = /^(?:rekomendasi|semua|dulu|yang|nya|ini|itu|aja|saja|baru|untuk|buat|dong|kita|ku|gw|lu|kamu|aku|saya|ai|agent|agen|ajentik|agentic|apa|mana|dan|sama|lengkap|lagi|deh|cuy|bro|di|ke|nih|tim|team|divisi|sesuai|saran|pilihan|terpilih|kayak|seperti)$/i;
  for (const x of message.matchAll(/\b(?:tim|team|divisi)\s+([a-z]+)/gi)) {
    const w = x[1].toLowerCase();
    if (!skip.test(w) && !DIVISION_INFO.some((d) => d.words.test(w)) && !new RegExp(`^(?:${DIVISIONS})$`).test(w)) return w;
  }
  return null;
}

/* ------------------------------------------------------------------ keputusan alur */

export interface FlowCtx {
  stage: PipelineStage;
  /** Divisi non-executive yang sudah terbentuk. */
  existingKinds: string[];
  /** Ide yang terakhir ditawarkan, menunggu dipilih. */
  ideaOptions: IdeaOption[];
  /** Ide terlalu umum yang sedang ditanyakan detailnya. */
  pendingBrief?: string;
  /** Sudah ada hasil bedah ide (rekomendasi divisi). */
  hasRecommendation: boolean;
  /** Ide terakhir yang dibedah (untuk "bedah ulang"). */
  lastBrief?: string;
  hasFolder: boolean;
}

export type FlowAction =
  | { type: "help" }
  | { type: "nudge" }
  | { type: "reset" }
  | { type: "suggest"; preference: string }
  | { type: "pickOutOfRange"; count: number }
  | { type: "clarify"; brief: string }
  | { type: "analyze"; brief: string }
  | { type: "formTeams"; kinds: string[] }
  | { type: "formRecommended" }
  | { type: "showPicker"; reason: "no-idea" | "unknown"; unknown?: string }
  | { type: "listTeams" }
  | { type: "removeTeams"; kinds: string[] }
  | { type: "nextSteps" };

/** Skenario mana pesan ini? null = bukan urusan alur tim (diteruskan ke chat/agent biasa). */
export function decideFlow(message: string, ctx: FlowCtx): FlowAction | null {
  const m = message.trim();
  if (!m) return null;
  const hasTeams = ctx.existingKinds.length > 0;
  const ideation = ctx.stage === "ideation" || !hasTeams;
  const chosen = chosenDivisions(m);

  if (RESET.test(m) && m.length <= 80) return { type: "reset" };
  if (ctx.lastBrief && REANALYZE.test(m) && m.length <= 60) return { type: "analyze", brief: ctx.lastBrief };

  // Hapus tim: "hapus tim marketing", "gak jadi pakai tim kreatif"
  if (hasTeams && REMOVE.test(m) && /\b(?:tim|team|divisi)\b/i.test(m)) {
    return chosen.length ? { type: "removeTeams", kinds: chosen } : { type: "listTeams" };
  }

  // Bentuk / tambah tim
  if (isTeamSetupRequest(m) || (asksForTeams(m) && !hasTeams)) {
    if (chosen.length) return { type: "formTeams", kinds: chosen };
    const unknown = unknownDivision(m);
    if (unknown) return { type: "showPicker", reason: "unknown", unknown };
    if (ctx.hasRecommendation) return { type: "formRecommended" };
    return { type: "showPicker", reason: "no-idea" };
  }
  if (asksForTeams(m)) return { type: "listTeams" };

  if (!ideation) {
    if (NEXT.test(m) || HELP.test(m)) return { type: "nextSteps" };
    return null;
  }

  // ---- tahap ide (belum ada tim)
  const options = ctx.ideaOptions;
  if (options.length) {
    const nums = mentionedIdeaNumbers(m);
    if (nums.length) {
      if (nums.some((n) => n > options.length)) return { type: "pickOutOfRange", count: options.length };
      const picked = nums.map((n) => options[n - 1]);
      return {
        type: "analyze",
        brief: picked.length === 1 ? `${picked[0].title}: ${picked[0].pitch}` : `Gabungan ide: ${picked.map((p) => `${p.title} (${p.pitch})`).join(" + ")}`,
      };
    }
    const byTitle = pickIdeaByTitle(m, options);
    if (byTitle !== null) return { type: "analyze", brief: `${options[byTitle].title}: ${options[byTitle].pitch}` };
    if (MORE_IDEAS.test(m)) return { type: "suggest", preference: m };
  }

  if (NO_IDEA.test(m)) return { type: "suggest", preference: m };
  if (HELP.test(m) && m.length <= 120) return { type: "help" };
  if (GREETING.test(m)) return { type: "nudge" };
  if (WHATEVER.test(m)) return { type: "suggest", preference: "" };

  // Jawaban atas pertanyaan detail ide yang terlalu umum
  if (ctx.pendingBrief) {
    if (wantsIdeaSuggestions(m)) return { type: "suggest", preference: `${ctx.pendingBrief}. ${m}` };
    return { type: "analyze", brief: `${ctx.pendingBrief}\nDetail dari user: ${m}` };
  }

  if (wantsIdeaSuggestions(m) && !ctx.hasFolder) return { type: "suggest", preference: m };
  if (!ctx.hasFolder && isTooVague(m)) return { type: "clarify", brief: m };
  if (isProjectBrief(m, ctx.hasFolder)) return { type: "analyze", brief: m };
  return null;
}

/* ------------------------------------------------------------------ prompt model */

export function ideaSystem(v: Voice, exclude: string[]): string {
  return `Kamu mentor usaha di Indonesia yang realistis. Beri TEPAT 3 ide usaha/startup yang bisa mulai dengan modal kecil dan cepat menghasilkan uang.
Tiap ide: pelanggan jelas, masalah yang sudah mereka bayar untuk diselesaikan, dan cara dapat uang.
Hormati preferensi user kalau ada (bidang, modal, skill). Jangan mengarang angka pasar spesifik.
Bahasa sehari-hari untuk orang awam, tanpa istilah asing yang tidak perlu, tanpa emoji. ${styleNote(v)}
${exclude.length ? `Jangan ulangi atau memodifikasi sedikit ide-ide ini: ${exclude.join("; ")}.\n` : ""}Balas JSON saja: {"ideas":[{"title":"<nama 1-3 kata>","pitch":"<1 kalimat tanpa kata ganti orang (tanpa gw/lu/aku/kamu/saya/Anda): untuk siapa, masalahnya, cara dapat uang>"}]}`;
}

export function parseIdeas(text: string): IdeaOption[] {
  const d = parseLoose<{ ideas?: { title?: unknown; pitch?: unknown }[] }>(text);
  return (d?.ideas || [])
    .map((i) => ({ title: String(i.title || "").trim().slice(0, 60), pitch: String(i.pitch || "").trim().slice(0, 300) }))
    .filter((i) => i.title && i.pitch)
    .slice(0, 5);
}

/* ------------------------------------------------------------------ kalimat balasan */

export const WELCOME_MESSAGE = `Halo! Di sini kita bangun proyek kamu bareng-bareng dalam 3 langkah:

1. Tentukan ide. Ceritain ide kamu, atau ketik "kasih ide" kalau belum punya.
2. Aku bedah idenya: apa bagusnya, apa risikonya, dan tim AI yang cocok.
3. Kamu pilih timnya, lalu tim itu siap kerja.

Kalau sudah punya folder proyek, lampirkan saja, nanti aku pelajari dulu.

Mau mulai dari mana? Ceritain ide kamu, atau ketik "kasih ide".`;

const join = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}` : names[0] || "");

export function formatIdeas(ideas: IdeaOption[], v: Voice = "aku", again = false): string {
  return say(`Langkah 1 dari 3: pilih ide

${again ? "Oke, ini ide yang lain" : `Ini ${ideas.length} ide yang bisa dimulai dengan modal kecil`}:

${ideas.map((i, n) => `${n + 1}. ${i.title}. ${i.pitch}`).join("\n")}

Ketik nomornya, misalnya "ide 1". Bisa juga gabung dua ide ("ide 1 dan 3"), minta "ide lain", atau ceritain ide {kamu} sendiri.`, v);
}

export function ideaFailedMessage(reason: string, v: Voice = "aku"): string {
  return say(`Maaf, {aku} belum berhasil menyusun ide barusan (${reason}). Coba kirim lagi, atau ceritain ide {kamu} sendiri.`, v);
}

export function fallbackSummary(v: Voice = "aku"): string {
  return say(`Bedah lengkapnya belum berhasil dibuat barusan, jadi ini saran tim umum dulu. Ketik "bedah ulang" kalau mau {aku} coba lagi.`, v);
}

export function analysisFailedMessage(reason: string, v: Voice = "aku"): string {
  return say(`Maaf, {aku} belum berhasil membedah idenya barusan (${reason}). Kirim ulang pesan yang sama sebentar lagi, ya.`, v);
}

export function outOfRangeMessage(count: number, v: Voice = "aku"): string {
  return say(`Idenya cuma ada ${count}. Ketik angka 1 sampai ${count}, misalnya "ide 1", atau minta "ide lain" kalau belum sreg.`, v);
}

export function clarifyMessage(v: Voice = "aku"): string {
  return say(`Boleh! Biar sarannya pas, {aku} perlu tahu sedikit lagi. Jawab singkat saja:

1. Bidangnya apa? Misalnya makanan, jasa, pendidikan, fashion.
2. Untuk siapa? Misalnya mahasiswa, ibu rumah tangga, pemilik warung.
3. Modal kira-kira berapa?

Kalau malas jawab, ketik "kasih ide" dan {aku} kasih beberapa contoh.`, v);
}

export function helpMessage(step: FlowStep, v: Voice = "aku"): string {
  const now: Record<FlowStep, string> = {
    idea: `Sekarang {kamu} di langkah 1. Ceritain ide {kamu} dalam satu kalimat, atau ketik "kasih ide".`,
    pickIdea: `Sekarang {kamu} di langkah 1. Tinggal pilih salah satu ide tadi dengan ketik nomornya, misalnya "ide 1", atau ketik "ide lain".`,
    clarify: `Sekarang {aku} lagi nunggu jawaban {kamu}: bidangnya apa, untuk siapa, dan modalnya berapa. Jawab singkat saja.`,
    pickTeam: `Sekarang {kamu} di langkah 3. Centang tim yang {kamu} mau di kolom tadi lalu tekan "Bentuk tim", atau ketik "bentuk tim".`,
    working: `Tim {kamu} sudah jadi. Buka panel Riwayat & Divisi di kiri untuk kasih tugas ke tiap tim.`,
  };
  return say(`Gampangnya begini. Ada 3 langkah:

1. Tentukan ide.
2. {Aku} bedah idenya dan sarankan tim.
3. {Kamu} pilih timnya, lalu tim itu siap kerja.

${now[step]}

Mau mulai ulang kapan saja? Ketik "mulai dari awal".`, v);
}

export function nudgeMessage(step: FlowStep, v: Voice = "aku"): string {
  const lines: Record<FlowStep, string> = {
    idea: `Halo! Kita mulai dari langkah 1: tentukan ide. Ceritain ide {kamu}, atau ketik "kasih ide" kalau belum punya.`,
    pickIdea: `Halo! Tadi {aku} sudah kasih beberapa ide. Ketik nomornya, misalnya "ide 1", atau "ide lain" kalau belum sreg.`,
    clarify: `Halo! {Aku} masih nunggu sedikit detail: bidangnya apa, untuk siapa, dan modalnya berapa. Atau ketik "kasih ide".`,
    pickTeam: `Halo! Tinggal satu langkah lagi: centang tim yang {kamu} mau lalu tekan "Bentuk tim", atau ketik "bentuk tim".`,
    working: `Halo! Tim {kamu} sudah siap. Buka panel Riwayat & Divisi di kiri untuk kasih tugas.`,
  };
  return say(lines[step], v);
}

export function resetMessage(keptTeams: string[], v: Voice = "aku"): string {
  return say(`Oke, kita mulai dari awal.${keptTeams.length ? ` Tim yang sudah ada (${join(keptTeams)}) tetap disimpan. Kalau mau dihapus, ketik misalnya "hapus tim marketing".` : ""}

Langkah 1: ceritain ide {kamu}, atau ketik "kasih ide" kalau belum punya.`, v);
}

export interface AnalysisView {
  title: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  divisions: { name: string; reason: string }[];
}

export function formatAnalysis(a: AnalysisView, v: Voice = "aku"): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return say(`Langkah 2 dari 3: bedah ide

Ide: ${a.title}

${a.summary}

Yang bagus:
${list(a.strengths)}

Yang perlu diwaspadai:
${list(a.weaknesses)}

Tim yang {aku} sarankan: ${a.divisions.map((d) => d.name).join(", ")}.

Langkah berikutnya: centang tim yang {kamu} mau di kolom bawah, lalu tekan "Bentuk tim". Yang sudah tercentang adalah saran {aku}, boleh diubah. Bisa juga ketik "bentuk tim".`, v);
}

export function pickerIntroMessage(reason: "no-idea" | "unknown", unknown: string | undefined, v: Voice = "aku"): string {
  if (reason === "unknown") {
    return say(`Tim ${unknown} belum tersedia. Pilih dari daftar di bawah, ya. Kalau butuh tim khusus, buat Divisi Kustom lewat panel Riwayat & Divisi di kiri.`, v);
  }
  return say(`{Kamu} belum cerita idenya, jadi ini saran umum yang cocok untuk kebanyakan usaha baru. Centang tim yang {kamu} mau, lalu tekan "Bentuk tim".

Kalau mau sarannya lebih pas, ceritain dulu ide {kamu} atau ketik "kasih ide".`, v);
}

export function teamsFormedMessage(r: { created: string[]; already: string[]; withBoard: boolean }, v: Voice = "aku"): string {
  if (!r.created.length) {
    return say(`Tim itu sudah ada semua: ${join(r.already)}. Buka panel Riwayat & Divisi di kiri untuk ngobrol dan kasih tugas.`, v);
  }
  return say(`Langkah 3 dari 3: tim sudah jadi

Tim baru: ${join(r.created)}.${r.already.length ? ` Yang sudah ada sebelumnya: ${join(r.already)}.` : ""}${r.withBoard ? " Ada juga Dewan Direksi yang menjaga semua tim tetap searah." : ""}

Buka panel Riwayat & Divisi di kiri untuk ngobrol dan kasih tugas ke tiap tim. Mau tambah tim lain? Ketik misalnya "bentuk tim kreatif".`, v);
}

export function teamListMessage(project: string, teams: { name: string; members: string[] }[], v: Voice = "aku"): string {
  if (!teams.length) return say(`Proyek ${project} belum punya tim. Ketik "bentuk tim" untuk mulai.`, v);
  return say(`Ini tim AI di proyek ${project}:

${teams.map((t) => `- ${t.name}: ${t.members.join(", ")} (${t.members.length} orang)`).join("\n")}

Buka panel Riwayat & Divisi di kiri untuk ngobrol dan kasih tugas ke tim mana pun.`, v);
}

export function teamsRemovedMessage(r: { removed: string[]; missing: string[]; busy: string[]; left: string[] }, v: Voice = "aku"): string {
  const parts: string[] = [];
  if (r.removed.length) parts.push(`${join(r.removed)} sudah dihapus.`);
  if (r.missing.length) parts.push(`${join(r.missing)} memang belum ada.`);
  if (r.busy.length) parts.push(`${join(r.busy)} lagi mengerjakan tugas, jadi belum bisa dihapus. Hentikan dulu tugasnya di panel Riwayat & Divisi.`);
  parts.push(r.left.length ? `Tim yang tersisa: ${join(r.left)}.` : `Sekarang belum ada tim. Ketik "bentuk tim" kalau mau bikin lagi.`);
  return say(parts.join(" "), v);
}

export function nextStepsMessage(teams: string[], v: Voice = "aku"): string {
  return say(`Tim {kamu} sudah siap: ${join(teams)}. Yang bisa {kamu} lakukan sekarang:

1. Kasih tugas: buka panel Riwayat & Divisi di kiri, pilih ${teams[0] || "salah satu tim"}, lalu tulis tugasnya. Contoh: "susun rencana kerja minggu ini".
2. Tambah tim: ketik misalnya "bentuk tim kreatif".
3. Hapus tim: ketik misalnya "hapus tim marketing".
4. Mulai ulang dari ide: ketik "mulai dari awal".`, v);
}

/** Posisi user di alur (untuk pesan bantuan & sapaan). */
export type FlowStep = "idea" | "pickIdea" | "clarify" | "pickTeam" | "working";

export function stepOf(ctx: Pick<FlowCtx, "existingKinds" | "ideaOptions" | "pendingBrief" | "hasRecommendation">): FlowStep {
  if (ctx.existingKinds.length) return "working";
  if (ctx.hasRecommendation) return "pickTeam";
  if (ctx.pendingBrief) return "clarify";
  if (ctx.ideaOptions.length) return "pickIdea";
  return "idea";
}

/* ------------------------------------------------------------------ kolom ceklis tim */

export const DIVISION_INFO: { kind: string; name: string; role: string; words: RegExp }[] = [
  { kind: "founder", name: "Tim Founder & Startup", role: "Mengecek apakah ide ini dibutuhkan orang, menentukan harga, dan menyusun rencana produk.", words: /\bfounder\b/i },
  { kind: "developer", name: "Tim Developer", role: "Membuat aplikasi atau website-nya, dari tampilan sampai sistem di belakangnya.", words: /\b(?:developer|dev|programmer|coding|ngoding)\b/i },
  { kind: "marketing", name: "Tim Marketing", role: "Mengenalkan produk ke calon pengguna lewat konten, media sosial, dan promosi.", words: /\b(?:marketing|pemasaran|promosi)\b/i },
  { kind: "creative", name: "Tim Kreatif", role: "Membuat logo, tampilan merek, video, dan desain visual.", words: /\b(?:kreatif|creative|desain|design|desainer)\b/i },
  { kind: "research", name: "Tim Riset & Akademik", role: "Mengumpulkan data, membaca sumber, dan mengecek fakta.", words: /\b(?:riset|research|akademik|peneliti)\b/i },
  { kind: "trading", name: "Tim Trader & Finansial", role: "Menghitung keuangan, risiko modal, dan strategi investasi.", words: /\b(?:trader|trading|finansial|keuangan)\b/i },
  { kind: "career", name: "Tim Karier & Talent", role: "Membantu soal CV, wawancara kerja, dan mencari orang untuk tim.", words: /\b(?:karier|karir|career|talent|hrd)\b/i },
];

export const DEFAULT_RECOMMENDATION = ["founder", "developer", "marketing"];

/** Opsi kolom ceklis: yang disarankan di atas (dengan alasan dari analisis), sisanya di bawah tanpa centang. */
export function buildTeamPicker(recommended: { kind: string; reason?: string }[]): TeamPicker {
  const rec = new Map(recommended.map((r) => [r.kind, r.reason]));
  const options = DIVISION_INFO.map((d) => ({ kind: d.kind, name: d.name, role: rec.get(d.kind) || d.role, recommended: rec.has(d.kind) }));
  return { options: [...options.filter((o) => o.recommended), ...options.filter((o) => !o.recommended)] };
}

/** Pesan yang dikirim tombol kolom ceklis. */
export function pickerMessage(names: string[]): string {
  return `Bentuk tim: ${names.join(", ")}`;
}

/** Divisi yang disebut di pesan ("Bentuk tim: Tim Developer, Tim Marketing" / "tim developer saja"). */
export function chosenDivisions(message: string): string[] {
  return DIVISION_INFO.filter((d) => d.words.test(message)).map((d) => d.kind);
}

export function divisionName(kind: string): string {
  return DIVISION_INFO.find((d) => d.kind === kind)?.name || kind;
}
