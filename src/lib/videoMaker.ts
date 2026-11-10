import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getBrowser } from "./browser";
import { askJson } from "./skillAgent";
import { choosePalette } from "./claudeSkills/palette";
import { searchPhotos, trackPhotoUse } from "./media";
import { isWebExplicit } from "./deckFlow";
import { execFile } from "child_process";
import { cleanScript, scriptToHtml, totalSeconds, type VideoScript } from "./videoScenes";
import { parseLoose } from "./jsonLoose";

/**
 * Mesin video: JSON adegan (atau HTML mentah) -> halaman animasi -> direkam Chrome headless jadi .webm.
 * Skill katalog cuma panduan teks; file ini yang benar-benar menghasilkan video.
 */

const VIDEO_REQ = /\b(buat|bikin|buatin|bikinin|buatkan|bikinkan|generate|render|jadiin|jadikan|export|ekspor)\b[^.!?\n]{0,40}\b(video|animasi|motion\s*graphic|explainer|mp4|webm)\b/i;
const DECK = /\b(ppt|pptx|powerpoint|slide|slides|presentasi|deck)\b/i;

export function isVideoRequest(msg: string): boolean {
  if (/```html|<!doctype html|<html[\s>]/i.test(msg) && /\b(video|rekam|render|export|ekspor)\b/i.test(msg)) return true;
  if (/"scenes"\s*:/.test(msg)) return true;
  return VIDEO_REQ.test(msg) && !DECK.test(msg) && !isWebExplicit(msg);
}

const DIR = path.join(process.cwd(), ".data", "videos");
async function writeScript(request: string, apiKey?: string): Promise<VideoScript> {
  const { data } = await askJson<VideoScript>(
    "Kamu sutradara video explainer pendek. Balas JSON saja.",
    `Buat naskah video motion graphic 25-45 detik untuk permintaan ini. Bahasa Indonesia. Teks di layar harus SINGKAT (heading maks 6 kata, tiap item maks 6 kata).
JSON: {"title":"...","scenes":[ ... ]}
Jenis adegan (pakai minimal 4 jenis berbeda supaya tidak monoton):
- {"kind":"title","label":"kategori 1-2 kata","heading":"...","text":"1 kalimat"}
- {"kind":"line","heading":"...","points":[angka berurutan, 5-30 titik],"unit":"","text":"sumber/keterangan"}  -> tren naik-turun (harga, indeks)
- {"kind":"chart","heading":"...","data":[{"label":"...","value":angka}],"unit":"%"}  -> perbandingan 2-6 hal
- {"kind":"stat","heading":"...","value":"7.215","label":"keterangan angka"}  -> satu angka penting
- {"kind":"bullets","heading":"...","items":["...","..."]}  -> 2-4 poin
- {"kind":"timeline","heading":"...","items":["...","..."]}  -> 3-5 langkah/urutan waktu
- {"kind":"quote","heading":"sumber","text":"kutipan pendek"}
- {"kind":"end","heading":"...","text":"..."}
Opsional di adegan title/bullets/quote: "photo":"kata kunci foto bahasa Inggris" (maks 2 adegan).
Aturan: 6-8 adegan, mulai "title", akhiri "end". line/chart/stat HANYA bila angkanya ADA di bahan riset/permintaan; JANGAN mengarang angka. Kalau tidak ada angka, pakai bullets/timeline/quote.

Permintaan:
${request.slice(0, 6000)}`,
    apiKey,
    2500
  );
  const v = cleanScript({ title: String(data?.title || ""), scenes: data?.scenes || [] });
  if (v.scenes.length < 2) throw new Error("naskah video kosong");
  return v;
}

async function attachPhotos(v: VideoScript): Promise<void> {
  const want = v.scenes.filter((s) => s.photo && ["title", "bullets", "quote", "end"].includes(s.kind)).slice(0, 2);
  await Promise.all(
    want.map(async (s) => {
      try {
        const [p] = await searchPhotos(s.photo!, 1);
        if (p) { s.photoUrl = p.url; await trackPhotoUse([p], ""); }
      } catch {}
    })
  );
}

/** Rekam halaman animasi jadi .webm. Butuh ffmpeg milik Playwright (npx playwright install ffmpeg). */
export async function recordHtml(html: string, seconds: number, id: string): Promise<string> {
  const tmp = path.join(DIR, `tmp-${id}`);
  await fs.mkdir(tmp, { recursive: true });
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } }, serviceWorkers: "block", acceptDownloads: false });
  try {
    await ctx.route("**/*", (r) => {
      const u = r.request().url();
      return /^(data:|about:|https:\/\/(images\.unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|cdn\.tailwindcss\.com)\/)/.test(u) ? r.continue() : r.abort();
    });
    const page = await ctx.newPage();
    await page.addInitScript(() => { (window as unknown as { __headless: boolean }).__headless = true; });
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    const hasTimeline = await page.evaluate(() => typeof (window as unknown as { __start?: () => void }).__start === "function");
    if (hasTimeline) {
      await page.evaluate(() => (window as unknown as { __start: () => void }).__start());
      await page.waitForFunction(() => (window as unknown as { __done?: boolean }).__done === true, null, { timeout: (seconds + 15) * 1000 });
    } else {
      await page.waitForTimeout(seconds * 1000);
    }
    const video = page.video();
    await page.close();
    const src = video ? await video.path() : "";
    await ctx.close();
    if (!src) throw new Error("rekaman tidak terbentuk");
    const out = path.join(DIR, `${id}.webm`);
    await fs.rename(src, out);
    return out;
  } finally {
    await ctx.close().catch(() => {});
    fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

let ffmpegTried = false;
function installFfmpeg(): Promise<void> {
  if (ffmpegTried) return Promise.reject(new Error("ffmpeg belum terpasang"));
  ffmpegTried = true;
  const cli = path.join(process.cwd(), "node_modules", "playwright-core", "cli.js");
  return new Promise((resolve, reject) =>
    execFile(process.execPath, [cli, "install", "ffmpeg"], { timeout: 180000 }, (err) => (err ? reject(new Error(`ffmpeg: ${err.message.slice(0, 120)}`)) : resolve()))
  );
}

export interface VideoArtifact { id: string; url: string; htmlUrl: string; seconds: number; scenes: number; recorded: boolean; note?: string }

export async function makeVideo(request: string, apiKey?: string): Promise<{ reply: string; video: VideoArtifact; title: string }> {
  const id = randomUUID().slice(0, 12);
  await fs.mkdir(DIR, { recursive: true });
  let html: string;
  let title = "Video animasi";
  let seconds = 10;
  let scenes = 0;

  const rawHtml = request.match(/```html\s*([\s\S]*?)```/i)?.[1] || (/<html[\s>]/i.test(request) ? request.slice(request.search(/<!doctype html|<html/i)) : "");
  const jsonText = request.match(/```json\s*([\s\S]*?)```/i)?.[1] || (/"scenes"\s*:/.test(request) ? request.slice(request.indexOf("{"), request.lastIndexOf("}") + 1) : "");
  if (rawHtml) {
    html = rawHtml;
    seconds = Math.min(60, Math.max(3, Number(request.match(/(\d{1,2})\s*(?:detik|s\b|sec)/i)?.[1]) || 10));
    title = html.match(/<title>([^<]+)/i)?.[1] || "Video dari HTML";
  } else {
    let script: VideoScript;
    try {
      const j = jsonText ? parseLoose<VideoScript>(jsonText) : null;
      script = j?.scenes ? cleanScript({ title: String(j.title || "Video"), scenes: j.scenes }) : await writeScript(request, apiKey);
      if (script.scenes.length < 1) script = await writeScript(request, apiKey);
    } catch {
      script = await writeScript(request, apiKey);
    }
    await attachPhotos(script);
    const theme = await choosePalette({ request: `${script.title}. ${request.slice(0, 300)}` });
    html = scriptToHtml(script, theme);
    title = script.title;
    scenes = script.scenes.length;
    seconds = totalSeconds(script);
  }
  await fs.writeFile(path.join(DIR, `${id}.html`), html);
  const base = `/api/video/${id}`;
  try {
    try {
      await recordHtml(html, seconds, id);
    } catch (e) {
      if (!/ffmpeg/i.test((e as Error).message)) throw e;
      await installFfmpeg(); // sekali saja: unduh ffmpeg milik Playwright, lalu rekam ulang
      await recordHtml(html, seconds, id);
    }
    return {
      title,
      reply: `Videonya jadi: "${title}" (${Math.round(seconds)} detik${scenes ? `, ${scenes} adegan` : ""}). Putar atau unduh .webm di kartu bawah.`,
      video: { id, url: base, htmlUrl: `${base}?f=html`, seconds, scenes, recorded: true },
    };
  } catch (e) {
    const msg = (e as Error).message;
    const ff = /ffmpeg/i.test(msg);
    const note = ff
      ? "Perekam butuh ffmpeg milik Playwright dan unduhan otomatisnya gagal. Jalankan sekali di folder project: npx playwright-core install ffmpeg, lalu minta lagi."
      : `Rekaman gagal: ${msg.slice(0, 140)}`;
    return {
      title,
      reply: `Animasinya jadi, tapi belum bisa direkam jadi file video. ${note} Animasi HTML-nya tetap bisa dibuka dari kartu.`,
      video: { id, url: base, htmlUrl: `${base}?f=html`, seconds, scenes, recorded: false, note },
    };
  }
}
