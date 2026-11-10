import { parseLoose } from "./jsonLoose";
import type { Page } from "playwright-core";
import { checkUrl, log, newGuardedContext, saveShot } from "./browser";
import { callLLM } from "./codeAgent";

/**
 * Agen browser: AI boleh navigasi, klik, mengetik, dan membaca halaman (maks 8 langkah).
 * Batas keselamatan (di kode, bukan di prompt):
 *  - tidak pernah mengetik ke kolom password / kartu kredit,
 *  - teks yang diketik harus ada di pesan user, atau kolom itu kotak pencarian,
 *  - tombol login / bayar / beli / kirim / hapus / daftar tidak diklik: berhenti dan minta user melakukannya sendiri,
 *  - alamat jaringan privat diblokir, tidak ada download, profil Chrome kosong (tanpa login user).
 */

const MAX_STEPS = 8;
const RISKY = /\b(log\s*in|login|sign\s*in|sign\s*up|masuk|daftar|register|bayar|pay(?:ment)?|checkout|check\s*out|beli|buy|order|pesan|purchase|submit|kirim|send|hapus|delete|remove|konfirmasi|confirm|donasi|donate|subscribe|berlangganan)\b/i;
const ACTION_WORDS = /\b(cari(?:kan|in)?|search|klik|click|ketik|type|isi|scroll|baca|ambil|cek|temukan|find|bandingkan|compare|harga|price)\b/i;
const DOMAIN = /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?::\d{2,5})?(?:\/\S*)?/i;

export interface BrowserTask {
  task: string;
  startUrl: string;
}

/** "buka tokopedia.com dan cari laptop", "cari di google harga X" -> {task, startUrl} atau null */
export function detectBrowserTask(msg: string): BrowserTask | null {
  const m = msg.trim();
  if (m.length > 400 || !ACTION_WORDS.test(m)) return null;
  if (/\b(website|situs)\s+(?:untuk|buat|baru)|buatkan|bikinin|bikin\s+(?:website|web|aplikasi)|slide|ppt|dokumen|email/i.test(m)) return null;
  const mentionsBrowse = /\b(buka|kunjungi|browser|browsing|selancar|telusuri|di\s+(?:google|youtube|situs|web))\b/i.test(m);
  if (!mentionsBrowse) return null;
  const urlMatch = m.match(DOMAIN);
  if (urlMatch) return { task: m, startUrl: urlMatch[0].replace(/[.,!?]+$/, "") };
  if (/\bgoogle\b/i.test(m)) return { task: m, startUrl: "https://www.google.com" };
  if (/\byoutube\b/i.test(m)) return { task: m, startUrl: "https://www.youtube.com" };
  return null;
}

interface El {
  i: number;
  tag: string;
  type: string;
  text: string;
  name: string;
  search: boolean;
}

async function observe(page: Page): Promise<{ title: string; text: string; els: El[] }> {
  return page.evaluate(() => {
    const vis = (e: Element) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      const st = getComputedStyle(e as HTMLElement);
      return r.width > 2 && r.height > 2 && st.visibility !== "hidden" && st.display !== "none";
    };
    document.querySelectorAll("[data-vox-i]").forEach((e) => e.removeAttribute("data-vox-i"));
    const out: { i: number; tag: string; type: string; text: string; name: string; search: boolean }[] = [];
    const cand = Array.from(document.querySelectorAll("a[href],button,input,textarea,select,[role=button],[role=searchbox]"));
    for (const e of cand) {
      if (out.length >= 45) break;
      if (!vis(e)) continue;
      const el = e as HTMLInputElement;
      const tag = e.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();
      if (tag === "input" && ["hidden", "image"].includes(type)) continue;
      const label = (el.getAttribute("aria-label") || el.placeholder || el.value || e.textContent || el.title || "").replace(/\s+/g, " ").trim().slice(0, 70);
      if (!label && tag !== "input" && tag !== "textarea") continue;
      const name = (el.name || el.id || "").slice(0, 30);
      const search = type === "search" || e.getAttribute("role") === "searchbox" || /^(q|query|search|s|keyword|k)$/i.test(el.name || "") || /cari|search/i.test(el.placeholder || el.getAttribute("aria-label") || "");
      const i = out.length + 1;
      e.setAttribute("data-vox-i", String(i));
      out.push({ i, tag, type, text: label, name, search });
    }
    return { title: document.title, text: (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 2500), els: out };
  });
}

type Act = { action: "click" | "type" | "goto" | "press" | "scroll" | "done"; i?: number; text?: string; url?: string; submit?: boolean; answer?: string };

function parseAct(text: string): Act | null {
  const v = parseLoose<Act>(text);
  return v && typeof v === "object" && typeof v.action === "string" ? v : null;
}

export interface BrowserRun {
  reply: string;
  spoken: string;
  screenshot?: string;
}

type Decide = (ctx: { task: string; url: string; title: string; text: string; els: El[]; steps: string[] }) => Promise<Act | null>;

const llmDecide: Decide = async (c) => {
  const els = c.els.map((e) => `[${e.i}] ${e.tag}${e.type ? `(${e.type})` : ""}${e.search ? " (kotak cari)" : ""} ${e.name ? `name=${e.name} ` : ""}"${e.text}"`).join("\n");
  const { text } = await callLLM({
    system: "Kamu mengendalikan browser untuk menyelesaikan tugas user. Balas HANYA satu JSON.",
    json: true,
    fast: true,
    prompt: `TUGAS USER: ${c.task}

HALAMAN: ${c.url}
Judul: ${c.title}
Isi (potongan):
${c.text.slice(0, 1800)}

ELEMEN YANG BISA DIAKSES:
${els}

LANGKAH SEBELUMNYA:
${c.steps.join("\n") || "(belum ada)"}

Pilih SATU aksi berikutnya (JSON):
{"action":"click","i":nomor}
{"action":"type","i":nomor,"text":"...","submit":true}   // ketik di kotak; submit=true menekan Enter
{"action":"goto","url":"https://..."}
{"action":"scroll"}
{"action":"done","answer":"jawaban/ringkasan akhir untuk user, berdasarkan isi halaman"}
Aturan: jangan mengulang aksi yang gagal. Jangan login/bayar/membeli/mengisi data pribadi. Teks yang diketik harus berasal dari tugas user. Kalau info sudah cukup, langsung "done" dengan jawaban yang menyebut fakta dari halaman (jangan mengarang).`,
    maxTokens: 700,
    prefer: ["gemini", "openrouter"],
  });
  return parseAct(text);
};

export async function runBrowserTask(t: BrowserTask, opts: { decide?: Decide } = {}): Promise<BrowserRun> {
  const decide = opts.decide ?? llmDecide;
  const ctx = await newGuardedContext();
  const steps: string[] = [];
  let page: Page | undefined;
  try {
    page = await ctx.newPage();
    page.setDefaultTimeout(12_000);
    const start = await checkUrl(t.startUrl);
    await page.goto(start.toString(), { waitUntil: "load", timeout: 25_000 });
    steps.push(`Buka ${start.hostname}`);
    let answer = "";
    let stopNote = "";
    for (let n = 0; n < MAX_STEPS; n++) {
      await page.waitForTimeout(500);
      const o = await observe(page);
      const act = await decide({ task: t.task, url: page.url(), title: o.title, text: o.text, els: o.els, steps });
      if (!act) {
        stopNote = "Aku bingung langkah berikutnya.";
        break;
      }
      if (act.action === "done") {
        answer = (act.answer || "").trim();
        break;
      }
      const el = act.i ? o.els.find((e) => e.i === act.i) : undefined;
      try {
        if (act.action === "goto") {
          const u = await checkUrl(act.url || "");
          await page.goto(u.toString(), { waitUntil: "load", timeout: 25_000 });
          steps.push(`Buka ${u.hostname}${u.pathname}`);
        } else if (act.action === "scroll") {
          await page.mouse.wheel(0, 700);
          steps.push("Scroll");
        } else if (act.action === "click") {
          if (!el) throw new Error("elemen tidak ada");
          if (RISKY.test(el.text) || el.type === "submit") {
            stopNote = `Berhenti sebelum menekan "${el.text}" karena itu bisa berarti login/bayar/kirim data. Lakukan sendiri kalau memang mau.`;
            break;
          }
          const loc = page.locator(`[data-vox-i="${el.i}"]`).first();
          await loc.evaluate((e) => e.removeAttribute("target"));
          await loc.click({ timeout: 8000 });
          await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
          steps.push(`Klik "${el.text}"`);
        } else if (act.action === "type") {
          if (!el || !(el.tag === "input" || el.tag === "textarea")) throw new Error("bukan kolom isian");
          const value = (act.text || "").slice(0, 200);
          const sensitive = el.type === "password" || /pass|card|cvv|cvc|kartu|otp|pin/i.test(el.name + el.text);
          if (sensitive) {
            stopNote = "Berhenti: halaman minta data sensitif (password/kartu). Itu harus kamu isi sendiri.";
            break;
          }
          const fromUser = value && t.task.toLowerCase().includes(value.toLowerCase());
          if (!el.search && !fromUser) throw new Error("teks itu tidak berasal dari permintaanmu");
          const loc = page.locator(`[data-vox-i="${el.i}"]`).first();
          await loc.fill(value);
          steps.push(`Ketik "${value}"`);
          if (act.submit) {
            if (await page.locator("input[type=password]:visible").count()) {
              stopNote = "Berhenti: ada kolom password di halaman ini, jadi aku tidak menekan Enter.";
              break;
            }
            await Promise.all([page.waitForLoadState("load", { timeout: 12_000 }).catch(() => undefined), loc.press("Enter")]);
            steps.push("Tekan Enter");
          }
        } else {
          steps.push(`(aksi tidak dikenal: ${act.action})`);
        }
      } catch (e) {
        steps.push(`Gagal ${act.action}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
    const finalObs = await observe(page).catch(() => null);
    const shot = await saveShot(page).catch(() => undefined);
    await log({ action: "task", task: t.task.slice(0, 120), steps, final: page.url(), ok: true });
    if (!answer) {
      answer = stopNote || `Sampai di ${page.url()} (${finalObs?.title || "tanpa judul"}). Batas ${MAX_STEPS} langkah tercapai, jadi aku berhenti di sini.`;
    }
    return {
      reply: `${answer}\n\n**Langkah:** ${steps.map((s, i) => `${i + 1}. ${s}`).join("  ")}\n**Halaman akhir:** ${page.url()}${shot ? `\n\n![screenshot](${shot})` : ""}`,
      spoken: answer.replace(/[*_`#]/g, "").slice(0, 300),
      screenshot: shot,
    };
  } catch (e) {
    await log({ action: "task", task: t.task.slice(0, 120), ok: false, error: (e as Error).message.slice(0, 160) });
    return { reply: `Gagal menjalankan tugas browser: ${(e as Error).message}${steps.length ? `\nLangkah yang sempat jalan: ${steps.join(" → ")}` : ""}`, spoken: "Tugas browsernya gagal." };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
