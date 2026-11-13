import { chromium, type Browser } from "playwright-core";
import dns from "dns/promises";
import fs from "fs/promises";
import net from "net";
import path from "path";

/**
 * Browser untuk AI (Playwright + Google Chrome yang sudah terpasang).
 * Aman karena: profil Chrome baru yang kosong (bukan Chrome-mu yang sudah login), hanya http(s),
 * alamat jaringan privat/metadata diblokir (kecuali localhost milik sendiri), batas waktu, dan semua
 * aksi dicatat di .data/browser.log.
 */

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const DATA = path.join(process.cwd(), ".data");
const SHOTS = path.join(DATA, "shots");
const LOG = path.join(DATA, "browser.log");
const IDLE_MS = 90_000;

let browser: Browser | null = null;
let idle: NodeJS.Timeout | null = null;

async function chromePath() {
  for (const p of CHROME_PATHS) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  throw new Error("Google Chrome tidak ditemukan di laptop ini.");
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith("::ffff:") && isPrivateIp(ip.slice(7));
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/** Validasi URL: http(s) saja; host publik, atau localhost (proyek sendiri). */
export async function checkUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(javascript|data|file|blob|about|mailto|ftp|view-source):/i.test(raw) ? raw : `${/^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw) ? "http" : "https"}://${raw}`);
  } catch {
    throw new Error("Alamat tidak valid.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Hanya http/https yang boleh dibuka.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return u;
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("Alamat jaringan privat tidak boleh dibuka.");
  return u;
}

export async function log(entry: Record<string, unknown>) {
  try {
    await fs.mkdir(DATA, { recursive: true });
    await fs.appendFile(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  } catch {}
}

export async function getBrowser() {
  if (idle) clearTimeout(idle);
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ executablePath: await chromePath(), headless: true, args: ["--no-first-run", "--disable-extensions"] });
  }
  const closeWhenUnused = () => {
    // Sesi percakapan masih memegang halaman: jangan matikan browser di tengah tugas.
    if (browser?.isConnected() && browser.contexts().length) {
      idle = setTimeout(closeWhenUnused, IDLE_MS);
      idle.unref?.();
      return;
    }
    void browser?.close().catch(() => {});
    browser = null;
  };
  idle = setTimeout(closeWhenUnused, IDLE_MS);
  idle.unref?.();
  return browser;
}

export const BROWSER_PROFILE_DIR = path.join(DATA, "browser_profile");
let persistentContext: import("playwright-core").BrowserContext | null = null;
let persistentIdleTimer: NodeJS.Timeout | null = null;

export async function getPersistentContext(headless = true) {
  if (persistentIdleTimer) clearTimeout(persistentIdleTimer);
  if (!persistentContext || !persistentContext.browser()?.isConnected()) {
    await fs.mkdir(BROWSER_PROFILE_DIR, { recursive: true });
    persistentContext = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
      executablePath: await chromePath(),
      headless,
      args: ["--no-first-run", "--disable-extensions"],
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
  }
  const closeWhenUnused = () => {
    if (persistentContext?.browser()?.isConnected() && persistentContext.pages().length > 1) {
      persistentIdleTimer = setTimeout(closeWhenUnused, IDLE_MS);
      persistentIdleTimer.unref?.();
      return;
    }
    void persistentContext?.close().catch(() => {});
    persistentContext = null;
  };
  persistentIdleTimer = setTimeout(closeWhenUnused, IDLE_MS);
  persistentIdleTimer.unref?.();
  return persistentContext;
}

/** Buka jendela browser nyata di layar Mac agar pengguna bisa login ke LinkedIn (sesi disimpan permanen). */
export async function launchInteractiveLoginWindow(targetUrl = "https://www.linkedin.com/login"): Promise<{ message: string }> {
  const url = await checkUrl(targetUrl);
  await fs.mkdir(BROWSER_PROFILE_DIR, { recursive: true });
  if (persistentContext) {
    await persistentContext.close().catch(() => {});
    persistentContext = null;
  }
  const ctx = await chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    executablePath: await chromePath(),
    headless: false,
    args: ["--no-first-run", "--disable-extensions"],
    viewport: { width: 1280, height: 850 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  return { message: "Jendela browser login telah dibuka di layarmu. Silakan login akun LinkedIn. Sesi dan cookie otomatis tersimpan permanen di profil browser tim." };
}

export interface PageResult {
  url: string;
  title: string;
  text: string;
  links: { text: string; href: string }[];
  screenshot?: string;
}

export async function openPage(rawUrl: string, opts: { screenshot?: boolean; fullPage?: boolean; width?: number; height?: number; persistent?: boolean } = {}): Promise<PageResult> {
  const url = await checkUrl(rawUrl);
  const usePersistent = opts.persistent || url.hostname.includes("linkedin.com");
  let ctx: import("playwright-core").BrowserContext;
  let isStandaloneCtx = false;
  if (usePersistent) {
    try {
      ctx = await getPersistentContext(true);
    } catch {
      const b = await getBrowser();
      ctx = await b.newContext({
        viewport: { width: Math.min(opts.width || 1280, 1920), height: Math.min(opts.height || 800, 1200) },
        acceptDownloads: false,
        serviceWorkers: "block",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      isStandaloneCtx = true;
    }
  } else {
    const b = await getBrowser();
    ctx = await b.newContext({
      viewport: { width: Math.min(opts.width || 1280, 1920), height: Math.min(opts.height || 800, 1200) },
      acceptDownloads: false,
      serviceWorkers: "block",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    isStandaloneCtx = true;
  }
  let page: import("playwright-core").Page | null = null;
  try {
    // Setiap permintaan (termasuk redirect & sub-resource) divalidasi ulang.
    await ctx.route("**/*", async (route) => {
      try {
        await checkUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(800);
    let title = "";
    let text = "";
    let links: { text: string; href: string }[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
        title = await page.title();
        text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\n{3,}/g, "\n\n").slice(0, 6000);
        links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .slice(0, 25)
            .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
            .filter((l) => l.text && /^https?:/.test(l.href))
        );
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await page.waitForTimeout(1000);
      }
    }
    let screenshot: string | undefined;
    if (opts.screenshot) {
      await fs.mkdir(SHOTS, { recursive: true });
      const name = `shot-${Date.now()}.png`;
      await page.screenshot({ path: path.join(SHOTS, name), fullPage: !!opts.fullPage });
      screenshot = `/api/browser?shot=${name}`;
    }
    const finalUrl = page.url();
    await log({ action: "open", url: url.toString(), final: finalUrl, ok: true });
    return { url: finalUrl, title, text, links, screenshot };
  } catch (e) {
    await log({ action: "open", url: url.toString(), ok: false, error: (e as Error).message.slice(0, 160) });
    throw e;
  } finally {
    if (page) await page.close().catch(() => {});
    if (isStandaloneCtx) await ctx.close().catch(() => {});
  }
}

/** Konteks baru yang setiap permintaannya (termasuk redirect) divalidasi: dipakai agen browser. */
export async function newGuardedContext() {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: false, serviceWorkers: "block", permissions: [] });
  await ctx.route("**/*", async (route) => {
    try {
      await checkUrl(route.request().url());
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
  return ctx;
}

export async function saveShot(page: import("playwright-core").Page, fullPage = false): Promise<string> {
  await fs.mkdir(SHOTS, { recursive: true });
  const name = `shot-${Date.now()}.png`;
  await page.screenshot({ path: path.join(SHOTS, name), fullPage });
  return `/api/browser?shot=${name}`;
}

export async function readShot(name: string): Promise<Buffer | null> {
  if (!/^shot-\d+\.png$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(SHOTS, name));
  } catch {
    return null;
  }
}

/** "buka https://x.com", "screenshot localhost:3000", "lihat situs example.com" -> {url, screenshot} */
export function detectBrowse(msg: string): { url: string; screenshot: boolean } | null {
  const m = msg.trim().match(/^(?:tolong\s+)?(buka|kunjungi|lihat|cek|screenshot|tangkap(?:\s+layar)?|ss)\s+(?:situs\s+|website\s+|halaman\s+|web\s+)?((?:https?:\/\/)?(?:localhost|127\.0\.0\.1|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d{2,5})?(?:\/\S*)?)/i);
  if (!m) return null;
  return { url: m[2].replace(/[.,!?]+$/, ""), screenshot: /screenshot|tangkap|^ss$/i.test(m[1]) || /\b(screenshot|foto|tangkap)\b/i.test(msg) };
}

/** Render HTML lokal (tanpa jaringan) lalu simpan sebagai screenshot. Dipakai untuk laporan audit. */
export async function renderHtmlShot(html: string, width = 1100): Promise<string> {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width, height: 800 }, javaScriptEnabled: false });
  try {
    await ctx.route("**/*", (route) => route.abort("blockedbyclient"));
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await fs.mkdir(SHOTS, { recursive: true });
    const name = `shot-${Date.now()}.png`;
    await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
    return `/api/browser?shot=${name}`;
  } finally {
    await ctx.close().catch(() => {});
  }
}
