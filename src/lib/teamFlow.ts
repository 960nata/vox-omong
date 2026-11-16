/**
 * Alur tim proyek (analisis ide → rekomendasi divisi → bentuk tim) punya jalur sendiri di chat route.
 * Pesan yang milik alur ini tidak boleh diambil Autopilot / router maksud lalu dikerjakan agent umum
 * (yang hasilnya cuma file .md atau skrip Python, bukan divisi tim yang benar-benar terbentuk).
 * Fungsi murni supaya gampang dites.
 */
import type { IdeaOption, PipelineStage } from "./teamTypes";
import type { TeamPicker } from "./types";
import { parseLoose } from "./jsonLoose";

const DIVISIONS = "developer|marketing|founder|trading|creative|research|career|custom";

/** "bentuk tim rekomendasi", "buat tim dulu", "tim developer aja" */
export function isTeamSetupRequest(message: string): boolean {
  return (
    /\b(?:bentuk|buat|bikin|pilih|aktifkan|setup)(?:in|kan)?\s+(?:semua\s+)?(?:tim|team|divisi)\b/i.test(message) ||
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
    /\b(?:a?gen(?:t|tik)?|ajentik|agentic)\b[\s\S]{0,40}\b(?:tim|team)(?:nya)?\b|\b(?:tim|team)\s+(?:a?gen(?:t|tik)?|ajentik|agentic)/i.test(message)
  );
}

/** Pesan berisi ide/brief proyek di tahap ideation → dianalisis + direkomendasikan divisinya. */
export function isProjectBrief(message: string, hasFolder = false): boolean {
  if (hasFolder) return true;
  return message.trim().length >= 15 && /\b(proyek|project|ide|produk|bisnis|startup|start\s*up|aplikasi|platform|website|buatkan|bikin|kembangkan|analisis|analisa|bedah|konsep|investasi)\b/i.test(message);
}

/**
 * User belum punya ide konkret dan minta disarankan ("ide startup apa yang ok", "tanya idenya dulu").
 * Pesan yang sudah menjelaskan idenya sendiri ("ide gw: aplikasi kasir UMKM") bukan termasuk.
 */
export function wantsIdeaSuggestions(message: string): boolean {
  const m = message.trim();
  if (m.length > 160) return false;
  if (/\bide(?:nya|ku|\s+(?:gw|gue|aku|saya))?\s*(?::|adalah|yaitu|berupa)/i.test(m)) return false;
  if (!/\b(?:ide|idea|ide-ide)(?:nya)?\b/i.test(m)) return false;
  return /\b(?:apa|apaan|mana|yang\s+(?:ok|oke|bagus|cocok|mateng|cuan|menarik)|rekomendasi(?:in|kan)?|saran(?:in|kan)?|kasih|cariin|usul(?:in)?|brainstorm|nanya|tanya|dulu|mateng|cuan)\b/i.test(m);
}

const ORDINAL: Record<string, number> = { pertama: 1, kesatu: 1, kedua: 2, ketiga: 3, keempat: 4, kelima: 5 };

/** "ID 1", "ide 2 aja", "yang kedua", "3" → indeks 0-based; null kalau bukan pilihan. */
export function pickIdea(message: string, count: number): number | null {
  if (count <= 0) return null;
  const m = message.trim().toLowerCase();
  if (m.length > 60) return null;
  const num =
    m.match(/^\s*#?([1-9])\s*[.!]?\s*$/)?.[1] ??
    m.match(/\b(?:ide|id|idea|nomor|no\.?|opsi|pilihan|pilih|ambil|yang)\s*(?:ke-?\s*|nomor\s*|no\.?\s*)?#?([1-9])\b/)?.[1];
  let n = num ? Number(num) : null;
  if (n === null) {
    const ord = m.match(/\b(?:yang\s+|ide\s+|opsi\s+)?(pertama|kesatu|kedua|ketiga|keempat|kelima)\b/)?.[1];
    if (ord) n = ORDINAL[ord];
  }
  return n !== null && n >= 1 && n <= count ? n - 1 : null;
}

export interface TeamFlowCtx {
  stage: PipelineStage;
  /** Jumlah divisi non-executive yang sudah terbentuk. */
  teamCount: number;
  hasFolder?: boolean;
  /** Jumlah ide yang terakhir ditawarkan (menunggu dipilih). */
  ideaCount?: number;
}

/** Apakah pesan ini milik alur tim proyek (dan harus dijalankan sebelum Autopilot / router)? */
export function claimsTeamFlow(message: string, ctx: TeamFlowCtx): boolean {
  if (isTeamSetupRequest(message) || asksForTeams(message)) return true;
  const ideation = ctx.stage === "ideation" || ctx.teamCount === 0;
  if (!ideation) return false;
  if (pickIdea(message, ctx.ideaCount ?? 0) !== null) return true;
  return wantsIdeaSuggestions(message) || isProjectBrief(message, ctx.hasFolder);
}

export const IDEA_SYSTEM = `Kamu mentor startup Indonesia yang realistis. Beri TEPAT 3 ide startup yang bisa mulai dengan modal kecil dan cepat menghasilkan uang.
Tiap ide: pelanggan jelas, masalah yang sudah mereka bayar untuk diselesaikan, dan cara dapat uang.
Hormati preferensi user kalau ada (bidang, modal, skill). Jangan mengarang angka pasar spesifik.
Balas JSON saja: {"ideas":[{"title":"<nama 1-3 kata>","pitch":"<1 kalimat: untuk siapa, masalahnya, cara cuan>"}]}`;

export function parseIdeas(text: string): IdeaOption[] {
  const d = parseLoose<{ ideas?: { title?: unknown; pitch?: unknown }[] }>(text);
  return (d?.ideas || [])
    .map((i) => ({ title: String(i.title || "").trim().slice(0, 60), pitch: String(i.pitch || "").trim().slice(0, 300) }))
    .filter((i) => i.title && i.pitch)
    .slice(0, 5);
}

/* Pesan alur tim: bahasa sehari-hari, tanpa emoji/simbol, selalu diakhiri satu langkah berikutnya yang jelas. */

export const WELCOME_MESSAGE = `Halo! Di sini kita bangun proyek kamu bareng-bareng dalam 3 langkah:

1. Tentukan ide. Ceritain ide kamu, atau ketik "kasih ide" kalau belum punya.
2. Aku bedah idenya: apa bagusnya, apa risikonya, dan tim AI yang cocok.
3. Kamu pilih timnya, lalu tim itu siap kerja.

Kalau sudah punya folder proyek, lampirkan saja, nanti aku pelajari dulu.

Mau mulai dari mana? Ceritain ide kamu, atau ketik "kasih ide".`;

export function formatIdeas(ideas: IdeaOption[]): string {
  return `Langkah 1 dari 3: pilih ide

Ini ${ideas.length} ide yang bisa dimulai dengan modal kecil:

${ideas.map((i, n) => `${n + 1}. ${i.title}. ${i.pitch}`).join("\n")}

Ketik nomornya, misalnya "ide 1". Kalau belum sreg, ceritain ide kamu sendiri.`;
}

export function ideaFailedMessage(reason: string): string {
  return `Maaf, aku belum berhasil menyusun ide barusan (${reason}). Coba kirim lagi, atau ceritain ide kamu sendiri.`;
}

export interface AnalysisView {
  title: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  divisions: { name: string; reason: string }[];
}

export function formatAnalysis(a: AnalysisView): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  return `Langkah 2 dari 3: bedah ide

Ide: ${a.title}

${a.summary}

Yang bagus:
${list(a.strengths)}

Yang perlu diwaspadai:
${list(a.weaknesses)}

Tim yang aku sarankan: ${a.divisions.map((d) => d.name).join(", ")}.

Langkah berikutnya: centang tim yang kamu mau di kolom bawah, lalu tekan "Bentuk tim". Yang sudah tercentang adalah saran aku, boleh diubah. Bisa juga ketik "bentuk tim".`;
}

export function teamsFormedMessage(names: string[], withBoard: boolean): string {
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}` : names[0] || "Tim";
  return `Langkah 3 dari 3: tim sudah jadi

Tim kamu: ${joined}.${withBoard ? " Ada juga Dewan Direksi yang menjaga semua tim tetap searah." : ""}

Buka panel Riwayat & Divisi di sebelah kiri untuk ngobrol dan kasih tugas ke tiap tim.`;
}

export function teamListMessage(project: string, teams: { name: string; members: string[] }[]): string {
  return `Ini tim AI di proyek ${project}:

${teams.map((t) => `- ${t.name}: ${t.members.join(", ")} (${t.members.length} orang)`).join("\n")}

Buka panel Riwayat & Divisi di sebelah kiri untuk ngobrol dan kasih tugas ke tim mana pun.`;
}

/* Kolom ceklis tim: semua divisi bisa dipilih, yang disarankan sudah dicentang. */

export const DIVISION_INFO: { kind: string; name: string; role: string; words: RegExp }[] = [
  { kind: "founder", name: "Tim Founder & Startup", role: "Mengecek apakah ide ini dibutuhkan orang, menentukan harga, dan menyusun rencana produk.", words: /\bfounder\b/i },
  { kind: "developer", name: "Tim Developer", role: "Membuat aplikasi atau website-nya, dari tampilan sampai sistem di belakangnya.", words: /\b(?:developer|dev|programmer|coding)\b/i },
  { kind: "marketing", name: "Tim Marketing", role: "Mengenalkan produk ke calon pengguna lewat konten, media sosial, dan promosi.", words: /\b(?:marketing|pemasaran)\b/i },
  { kind: "creative", name: "Tim Kreatif", role: "Membuat logo, tampilan merek, video, dan desain visual.", words: /\b(?:kreatif|creative|desain|design)\b/i },
  { kind: "research", name: "Tim Riset & Akademik", role: "Mengumpulkan data, membaca sumber, dan mengecek fakta.", words: /\b(?:riset|research|akademik)\b/i },
  { kind: "trading", name: "Tim Trader & Finansial", role: "Menghitung keuangan, risiko modal, dan strategi investasi.", words: /\b(?:trader|trading|finansial|keuangan)\b/i },
  { kind: "career", name: "Tim Karier & Talent", role: "Membantu soal CV, wawancara kerja, dan mencari orang untuk tim.", words: /\b(?:karier|karir|career|talent)\b/i },
];

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
