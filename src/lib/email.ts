import { parseLoose } from "./jsonLoose";
import fs from "fs/promises";
import path from "path";
import net from "net";
import tls from "tls";
import { callLLM } from "./codeAgent";
import { skillHint } from "./skillHub";

/**
 * Email lewat Gmail SMTP (App Password). Tanpa paket tambahan: klien SMTP ditulis langsung di atas `tls`.
 *
 * Aturan keselamatan (tidak bisa dilewati oleh model):
 *  - Jarvis HANYA membuat DRAF. Email terkirim cuma setelah user mengetik konfirmasi ("kirim") di chat.
 *  - Alamat tujuan harus tertulis di pesan USER sendiri (bukan hasil karangan model atau isi halaman web/dokumen).
 *  - Satu penerima per email, maksimal 10 email per jam, semua pengiriman dicatat di .data/email.log.
 *
 * Env: GMAIL_USER, GMAIL_APP_PASSWORD, opsional EMAIL_FROM_NAME. (Uji lokal: SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=0)
 */

const DATA = path.join(process.cwd(), ".data");
const PENDING_FILE = path.join(DATA, "email-pending.json");
const LOG_FILE = path.join(DATA, "email.log");
const PENDING_TTL = 30 * 60_000;
const MAX_PER_HOUR = 10;

export interface Draft {
  to: string;
  subject: string;
  body: string;
}
interface Pending extends Draft {
  at: number;
}

// ------------------------------------------------------------------ deteksi pesan

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const findEmails = (s: string) => [...new Set(s.match(EMAIL_RE) ?? [])];

const CONFIRM = /^\s*(?:ya\s*,?\s*|oke\s*,?\s*|ok\s*,?\s*|boleh\s*,?\s*|siap\s*,?\s*)?(?:kirim(?:kan|in)?|send|gas(?:\s*kirim)?|lanjut\s*kirim|kirim\s*(?:aja|saja|sekarang|dong|ya))(?:\s+(?:aja|saja|sekarang|dong|ya|cuy|bro))*\s*[.!]*\s*$/i;
const CANCEL = /^\s*(?:batal(?:in|kan)?|cancel|jangan\s+(?:jadi\s+)?kirim|gak\s+jadi|ga\s+jadi|nggak\s+jadi|tidak\s+jadi)(?:\s+\S+){0,3}\s*[.!]*\s*$/i;
const REVISE = /\b(ubah|ganti|tambah(?:in|kan)?|kurang(?:i)?|revisi|perbaiki|bahasa|singkat(?:in|kan)?|panjang(?:in|kan)?|formal|santai|sopan|subjek|subject|judul|isi(?:nya)?|kalimat|paragraf|salam|tujuan|penerima|ke\s+alamat)\b/i;
const COMPOSE_VERB = /\b(kirim(?:in|kan)?|bikin(?:in|kan)?|buat(?:in|kan)?|tulis(?:in|kan)?|susun(?:kan)?|bales(?:in)?|balas(?:kan)?|draf(?:kan)?|draft(?:kan)?|compose|write|send|e-?mail(?:in|kan)?)\b/i;
const EMAIL_WORD = /\b(e-?mail|surel|mail)\b/i;
const WEB_WORDS = /\b(website|web|situs|landing|halaman|form|formulir|aplikasi|app|fitur|newsletter|smtp|api|kode|code|login)\b/i;

export type EmailIntent = "confirm" | "cancel" | "revise" | "compose" | null;

/** Klasifikasi pesan terhadap status draf yang menunggu. Murni (mudah dites). */
export function classifyEmailMessage(message: string, hasPending: boolean): EmailIntent {
  const m = message.trim();
  if (hasPending && CONFIRM.test(m)) return "confirm";
  if (hasPending && CANCEL.test(m)) return "cancel";
  const hasAddr = findEmails(m).length > 0;
  const toWord = /\b(e-?mail|surel)\s+(?:ke|untuk|buat)\b|\b(?:kirim|tulis|draf|draft|bales|balas)\w*\s+(?:sebuah\s+|satu\s+)?(?:e-?mail|surel)\b/i.test(m);
  if (COMPOSE_VERB.test(m) && EMAIL_WORD.test(m) && !WEB_WORDS.test(m) && (hasAddr || toWord)) return "compose";
  if (hasAddr && /\b(kirim\w*|e-?mail\w*)\s+(?:ke\s+)?[\w.+-]+@/i.test(m) && !WEB_WORDS.test(m)) return "compose";
  if (hasPending && (REVISE.test(m) || findEmails(m).length > 0) && m.split(/\s+/).length <= 60) return "revise";
  return null;
}

// ------------------------------------------------------------------ penyimpanan draf

async function readPending(): Promise<Record<string, Pending>> {
  try {
    return JSON.parse(await fs.readFile(PENDING_FILE, "utf-8")) as Record<string, Pending>;
  } catch {
    return {};
  }
}
async function writePending(db: Record<string, Pending>) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(PENDING_FILE, JSON.stringify(db), "utf-8");
}
async function getPending(convId: string): Promise<Pending | null> {
  const p = (await readPending())[convId];
  return p && Date.now() - p.at < PENDING_TTL ? p : null;
}
async function setPending(convId: string, d: Draft | null) {
  const db = await readPending();
  for (const k of Object.keys(db)) if (Date.now() - db[k].at > PENDING_TTL) delete db[k];
  if (d) db[convId] = { ...d, at: Date.now() };
  else delete db[convId];
  await writePending(db);
}

// ------------------------------------------------------------------ MIME + SMTP

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");
const header = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
const safeHeader = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

export function buildMime(from: { name?: string; address: string }, d: Draft): string {
  const fromHdr = from.name ? `${header(safeHeader(from.name))} <${from.address}>` : from.address;
  return [
    `From: ${fromHdr}`,
    `To: ${d.to}`,
    `Subject: ${header(safeHeader(d.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@vox-ai.local>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(d.body.replace(/\r?\n/g, "\r\n"))),
  ].join("\r\n");
}

/** Satu sesi SMTP sederhana: kirim perintah, tunggu balasan berkode (menangani balasan multi-baris). */
function smtpSession(host: string, port: number, secure: boolean): Promise<{ cmd: (line: string, expect: number[]) => Promise<string>; close: () => void }> {
  return new Promise((resolve, reject) => {
    const sock: net.Socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    sock.setEncoding("utf-8");
    sock.setTimeout(20_000, () => sock.destroy(new Error("SMTP timeout")));
    let buf = "";
    let waiter: ((r: string) => void) | null = null;
    const take = () => {
      // balasan selesai bila baris terakhir berformat "250 ..." (spasi, bukan "-")
      const lines = buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const reply = lines.slice(0, i + 1).join("\n");
          buf = lines.slice(i + 1).join("\r\n");
          const w = waiter;
          waiter = null;
          w?.(reply);
          return;
        }
      }
    };
    sock.on("data", (c: string) => {
      buf += c;
      take();
    });
    sock.on("error", reject);
    const next = () => new Promise<string>((res) => ((waiter = res), take()));
    const connectEvent = secure ? "secureConnect" : "connect";
    sock.once(connectEvent, async () => {
      const greeting = await next();
      if (!greeting.startsWith("220")) return reject(new Error(`SMTP menolak: ${greeting}`));
      resolve({
        cmd: async (line, expect) => {
          sock.write(`${line}\r\n`);
          const r = await next();
          if (!expect.includes(Number(r.slice(0, 3)))) throw new Error(`SMTP ${line.startsWith("AUTH") || /^[A-Za-z0-9+/=]{8,}$/.test(line) ? "(login)" : line.split(" ")[0]}: ${r.replace(/\n/g, " ").slice(0, 200)}`);
          return r;
        },
        close: () => sock.end(),
      });
    });
  });
}

export function emailConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function smtpSend(d: Draft): Promise<void> {
  const user = process.env.GMAIL_USER!;
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== "0";
  // Kata sandi tidak boleh lewat koneksi tanpa enkripsi, kecuali server uji di komputer sendiri
  if (!secure && !["127.0.0.1", "localhost"].includes(host)) throw new Error("SMTP tanpa TLS hanya boleh ke localhost");
  const s = await smtpSession(host, port, secure);
  try {
    await s.cmd("EHLO vox-ai.local", [250]);
    await s.cmd("AUTH LOGIN", [334]);
    await s.cmd(b64(user), [334]);
    await s.cmd(b64(pass), [235]);
    await s.cmd(`MAIL FROM:<${user}>`, [250]);
    await s.cmd(`RCPT TO:<${d.to}>`, [250, 251]);
    await s.cmd("DATA", [354]);
    const mime = buildMime({ name: process.env.EMAIL_FROM_NAME, address: user }, d).replace(/^\./gm, "..");
    await s.cmd(`${mime}\r\n.`, [250]);
    await s.cmd("QUIT", [221]).catch(() => undefined);
  } finally {
    s.close();
  }
}

// ------------------------------------------------------------------ batas kirim + log

async function sentLastHour(): Promise<number> {
  try {
    const lines = (await fs.readFile(LOG_FILE, "utf-8")).trim().split("\n");
    const cutoff = Date.now() - 3600_000;
    return lines.filter((l) => {
      const [ts, status] = l.split("\t");
      return status === "OK" && Date.parse(ts) > cutoff;
    }).length;
  } catch {
    return 0;
  }
}
async function logSend(d: Draft, status: string) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.appendFile(LOG_FILE, `${new Date().toISOString()}\t${status}\t${d.to}\t${d.subject.replace(/\s+/g, " ").slice(0, 80)}\n`);
}

// ------------------------------------------------------------------ draf dengan AI

function parseJson<T>(text: string): T | null {
  const v = parseLoose<T>(text);
  return v && typeof v === "object" ? v : null;
}

async function writeDraft(opts: { request: string; history: { role: string; content: string }[]; prev?: Draft; allowedTo: string[]; apiKey?: string }): Promise<{ to: string; subject: string; body: string } | null> {
  const hist = opts.history.slice(-8).map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content.replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
  const hint = await skillHint(opts.request, 3500);
  const sig = process.env.EMAIL_FROM_NAME ? `Tutup dengan "Salam,\\n${process.env.EMAIL_FROM_NAME}".` : 'Tutup dengan "Salam," tanpa nama (nama pengirim tidak diketahui).';
  const { text } = await callLLM({
    system: "Kamu asisten yang menulis email. Balas HANYA JSON valid.",
    prompt: `${opts.prev ? `DRAF SEKARANG:\nKepada: ${opts.prev.to}\nSubjek: ${opts.prev.subject}\n\n${opts.prev.body}\n\nREVISI DARI USER: "${opts.request}"\nTerapkan revisi, pertahankan sisanya.` : `Tulis email sesuai permintaan user: "${opts.request}"`}

RIWAYAT CHAT (terbaru di bawah):
${hist || "(kosong)"}

Alamat email yang disebut user: ${opts.allowedTo.join(", ") || "(belum ada)"}.
Balas JSON: {"to": "alamat email penerima atau null", "subject": "subjek singkat", "body": "isi email lengkap"}
Aturan: "to" HANYA boleh salah satu alamat yang disebut user di atas; kalau belum ada, isi null (jangan mengarang alamat). Bahasa Indonesia yang sopan dan natural kecuali user minta lain. Isi spesifik dan ringkas, jangan mengarang fakta, angka, atau janji yang tidak disebut user. ${sig}${hint ? hint.text : ""}`,
    maxTokens: 1500,
    prefer: ["gemini", "openrouter"],
  });
  const d = parseJson<{ to?: string | null; subject?: string; body?: string }>(text);
  if (!d || !d.subject || !d.body) return null;
  return { to: (d.to || "").trim(), subject: d.subject.trim().slice(0, 200), body: d.body.trim().slice(0, 20_000) };
}

const showDraft = (d: Draft) => `**Draf email** (belum terkirim)\n**Kepada:** ${d.to}\n**Subjek:** ${d.subject}\n\n${d.body}`;

// ------------------------------------------------------------------ alur utama untuk chat

export interface EmailReply {
  reply: string;
  spoken?: string;
  suggestions?: string[];
}

export async function handleEmailMessage(opts: { message: string; convId: string; history: { role: string; content: string }[]; apiKey?: string }): Promise<EmailReply | null> {
  const pending = await getPending(opts.convId);
  const intent = classifyEmailMessage(opts.message, !!pending);
  if (!intent) return null;

  if (intent === "cancel" && pending) {
    await setPending(opts.convId, null);
    return { reply: "Oke, draf emailnya dibatalin. Nggak ada yang terkirim.", spoken: "Draf emailnya dibatalin." };
  }

  if (intent === "confirm" && pending) {
    if (!emailConfigured()) {
      return { reply: "Draf siap, tapi email belum bisa dikirim: `GMAIL_USER` dan `GMAIL_APP_PASSWORD` belum diisi di `.env.local`. Isi dulu, restart server, lalu bilang \"kirim\" lagi (drafnya masih kesimpan 30 menit)." };
    }
    if (!findEmails(pending.to).length || pending.to.includes(",")) return { reply: "Alamat tujuannya nggak valid. Sebutin satu alamat email yang benar, misalnya \"kirim ke nama@domain.com\"." };
    if ((await sentLastHour()) >= MAX_PER_HOUR) return { reply: `Batas ${MAX_PER_HOUR} email per jam udah tercapai. Coba lagi nanti.` };
    try {
      await smtpSend(pending);
      await logSend(pending, "OK");
      await setPending(opts.convId, null);
      return { reply: `Email terkirim ke ${pending.to} dengan subjek "${pending.subject}".`, spoken: "Emailnya sudah terkirim." };
    } catch (e) {
      await logSend(pending, `GAGAL:${(e as Error).message.slice(0, 60)}`);
      return { reply: `Email gagal terkirim: ${(e as Error).message}. Cek App Password Gmail-nya. Drafnya masih ada, bilang "kirim" untuk coba lagi.` };
    }
  }

  // compose / revise
  const userText = opts.history.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const allowedTo = findEmails(`${userText}\n${opts.message}`);
  const draft = await writeDraft({ request: opts.message, history: opts.history, prev: intent === "revise" ? (pending ?? undefined) : undefined, allowedTo, apiKey: opts.apiKey });
  if (!draft) return { reply: "Aku belum berhasil nulis drafnya. Coba sebutin lagi: ke siapa (alamat email), dan isinya tentang apa." };
  // pengaman: alamat tujuan harus benar-benar disebut user
  const to = findEmails(draft.to).find((a) => allowedTo.map((x) => x.toLowerCase()).includes(a.toLowerCase())) ?? (intent === "revise" ? pending?.to : "") ?? "";
  if (!to) {
    await setPending(opts.convId, { ...draft, to: "" });
    return { reply: `${showDraft({ ...draft, to: "(belum diisi)" })}\n\nKe alamat email siapa ini mau dikirim? Sebutin alamatnya, nanti aku pasang.`, spoken: "Drafnya udah jadi. Ke alamat email siapa dikirimnya?" };
  }
  const final = { ...draft, to };
  await setPending(opts.convId, final);
  return {
    reply: `${showDraft(final)}\n\nBalas **"kirim"** buat mengirim, atau bilang bagian mana yang mau diubah. **"batal"** buat membatalkan.`,
    spoken: "Drafnya udah jadi. Bilang kirim kalau sudah oke.",
    suggestions: ["Kirim", "Bahasanya lebih santai", "Batal"],
  };
}
