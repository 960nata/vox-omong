import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { renderHtmlShot } from "./browser";
import { PROJECTS_BASE } from "./projects";
import { readStackConfig } from "./scaffold";

/**
 * Audit keamanan untuk project MILIK SENDIRI. Hanya membaca file project, menjalankan
 * `npm audit` (read-only), dan mengirim beberapa permintaan HTTP biasa ke localhost.
 * Tidak ada eksploitasi, tidak ada target di luar laptop ini.
 */

export type Severity = "tinggi" | "sedang" | "rendah" | "info";
export interface Finding {
  severity: Severity;
  title: string;
  where: string;
  detail: string;
  fix: string;
}
export interface AuditResult {
  target: string;
  findings: Finding[];
  checked: string[];
  screenshot?: string;
  durationMs: number;
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "vendor", "__pycache__", ".data", ".turbo", "coverage"]);
const EXT = /\.(m?[jt]sx?|cjs|go|html?|py|php|json|vue|svelte)$/i;
const MAX_FILES = 2500;
const MAX_BYTES = 400_000;
const SELF = path.join("src", "lib", "securityAudit.ts");

const mask = (s: string) => (s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} karakter)`);

const SECRET_RULES: { re: RegExp; name: string }[] = [
  { re: /\bAKIA[0-9A-Z]{16}\b/g, name: "AWS access key" },
  { re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g, name: "API key (OpenAI/Anthropic)" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, name: "GitHub token" },
  { re: /\bAIzaSy[0-9A-Za-z_-]{33}\b/g, name: "Google API key" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, name: "Slack token" },
  { re: /\baigw_[0-9a-f]{32}\b/g, name: "AI gateway key" },
  { re: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g, name: "JWT / Supabase key" },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, name: "Private key" },
];

interface CodeRule {
  re: RegExp;
  severity: Severity;
  title: string;
  detail: string;
  fix: string;
}
const CODE_RULES: CodeRule[] = [
  {
    re: /`\s*(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{|["']\s*(?:SELECT|INSERT|UPDATE|DELETE)\b[^"'\n]*["']\s*\+\s*[A-Za-z_]/gi,
    severity: "tinggi",
    title: "Query SQL dirakit dari input (SQL injection)",
    detail: "Nilai dimasukkan langsung ke string SQL.",
    fix: "Pakai parameter/placeholder ($1, ?) dari driver database.",
  },
  {
    re: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/g,
    severity: "tinggi",
    title: "Perintah shell dirakit dari variabel (command injection)",
    detail: "exec() dengan string gabungan bisa menjalankan perintah sisipan.",
    fix: "Pakai execFile/spawn dengan array argumen, dan validasi input.",
  },
  {
    re: /\beval\s*\(|\bnew\s+Function\s*\(/g,
    severity: "sedang",
    title: "eval / new Function",
    detail: "Menjalankan string sebagai kode.",
    fix: "Hindari; pakai JSON.parse atau logika biasa.",
  },
  {
    re: /\.innerHTML\s*[+]?=\s*(?:`[^`]*\$\{|[A-Za-z_$][\w$.]*\s*[;+\n])/g,
    severity: "sedang",
    title: "innerHTML dari variabel (potensi XSS)",
    detail: "Data dimasukkan sebagai HTML tanpa di-escape.",
    fix: "Pakai textContent, atau escape HTML terlebih dulu.",
  },
  {
    re: /dangerouslySetInnerHTML/g,
    severity: "rendah",
    title: "dangerouslySetInnerHTML",
    detail: "Aman hanya bila isinya sudah dibersihkan.",
    fix: "Pastikan isinya di-sanitize (mis. DOMPurify) atau bukan dari input pengguna.",
  },
  {
    re: /\bcors\(\s*\)|origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[,:]\s*["']\*["']/g,
    severity: "sedang",
    title: "CORS terbuka untuk semua origin",
    detail: "Situs mana pun bisa memanggil API ini dari browser.",
    fix: "Batasi origin ke alamat frontend sendiri.",
  },
  {
    re: /\brejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/g,
    severity: "sedang",
    title: "Verifikasi TLS dimatikan",
    detail: "Koneksi HTTPS tidak memeriksa sertifikat.",
    fix: "Hapus; perbaiki sertifikatnya.",
  },
];

async function walk(dir: string, out: string[]) {
  if (out.length >= MAX_FILES) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) await walk(p, out);
    } else if (EXT.test(e.name) && !/\.(min|bundle)\.js$/.test(e.name) && e.name !== "package-lock.json") out.push(p);
  }
}

function lineOf(text: string, idx: number) {
  return text.slice(0, idx).split("\n").length;
}

async function scanCode(root: string, dirs: string[], findings: Finding[]) {
  const files: string[] = [];
  for (const d of dirs) await walk(path.join(root, d), files);
  const perRule = new Map<string, number>();
  for (const f of files) {
    const rel = path.relative(root, f);
    if (rel === SELF) continue;
    let text: string;
    try {
      const st = await fs.stat(f);
      if (st.size > MAX_BYTES) continue;
      text = await fs.readFile(f, "utf-8");
    } catch {
      continue;
    }
    for (const r of SECRET_RULES) {
      for (const m of text.matchAll(r.re)) {
        findings.push({
          severity: "tinggi",
          title: `Secret tertulis di kode: ${r.name}`,
          where: `${rel}:${lineOf(text, m.index || 0)}`,
          detail: `Nilai ${mask(m[0])}. Siapa pun yang membaca kode/repo bisa memakainya.`,
          fix: "Pindahkan ke .env (yang di-ignore git), lalu ganti (rotate) key-nya karena sudah bocor.",
        });
      }
    }
    for (const r of CODE_RULES) {
      for (const m of text.matchAll(r.re)) {
        const n = (perRule.get(r.title) || 0) + 1;
        perRule.set(r.title, n);
        if (n > 6) continue; // cukup contoh; sisanya dihitung
        findings.push({ severity: r.severity, title: r.title, where: `${rel}:${lineOf(text, m.index || 0)}`, detail: r.detail, fix: r.fix });
      }
    }
  }
  for (const [title, n] of perRule) {
    if (n > 6) findings.push({ severity: "info", title: `${title}: ${n - 6} lokasi lain`, where: "-", detail: "Tidak ditampilkan semua.", fix: "-" });
  }
  return files.length;
}

async function checkEnvIgnored(root: string, findings: Finding[]) {
  let names: string[] = [];
  try {
    names = (await fs.readdir(root)).filter((n) => /^\.env(\..+)?$/.test(n) && !/example|sample/.test(n));
  } catch {}
  if (!names.length) return;
  let gi = "";
  try {
    gi = await fs.readFile(path.join(root, ".gitignore"), "utf-8");
  } catch {}
  if (!/^\s*\.env/m.test(gi)) {
    findings.push({
      severity: "tinggi",
      title: "File .env tidak di-ignore git",
      where: names.join(", "),
      detail: "Secret di .env bisa ikut ter-commit dan ter-push.",
      fix: "Tambahkan `.env*` ke .gitignore.",
    });
  }
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", npm_config_update_notifier: "false", NODE_ENV: "production" } as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    const t = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", () => {
      clearTimeout(t);
      resolve(out);
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve("");
    });
  });
}

async function npmAudit(root: string, sub: string, findings: Finding[], checked: string[]) {
  const dir = path.join(root, sub);
  try {
    await fs.access(path.join(dir, "package-lock.json"));
  } catch {
    return;
  }
  const raw = await run("npm", ["audit", "--json", "--package-lock-only"], dir, 90_000);
  checked.push(`npm audit (${sub || "."})`);
  let j: { vulnerabilities?: Record<string, { severity: string; via: unknown[]; fixAvailable: unknown }> };
  try {
    j = JSON.parse(raw);
  } catch {
    findings.push({ severity: "info", title: "npm audit tidak bisa dijalankan", where: sub || ".", detail: "Mungkin offline.", fix: "Coba lagi saat online." });
    return;
  }
  const map: Record<string, Severity> = { critical: "tinggi", high: "tinggi", moderate: "sedang", low: "rendah", info: "info" };
  const vulns = Object.entries(j.vulnerabilities || {});
  const rank = ["critical", "high", "moderate", "low", "info"];
  vulns.sort((a, b) => rank.indexOf(a[1].severity) - rank.indexOf(b[1].severity));
  for (const [name, v] of vulns.slice(0, 10)) {
    const adv = (v.via || []).find((x): x is { title: string; url?: string } => typeof x === "object" && x !== null && "title" in x);
    findings.push({
      severity: map[v.severity] || "info",
      title: `Dependency rentan: ${name} (${v.severity})`,
      where: `${sub || "."}/package.json`,
      detail: adv ? adv.title : "Lewat dependency lain.",
      fix: v.fixAvailable ? "Jalankan `npm audit fix` (cek dulu perubahannya)." : "Belum ada versi perbaikan; pertimbangkan ganti paket.",
    });
  }
  if (vulns.length > 10) findings.push({ severity: "info", title: `${vulns.length - 10} dependency rentan lainnya`, where: sub || ".", detail: "Lihat `npm audit`.", fix: "-" });
}

function isLocal(u: URL) {
  return u.hostname === "localhost" || u.hostname === "127.0.0.1";
}

async function probe(url: string, init: RequestInit = {}) {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), ...init });
    const body = await res.text().catch(() => "");
    return { status: res.status, headers: res.headers, body };
  } catch {
    return null;
  }
}

const EVIL = "http://situs-asing.example";

async function checkHttp(pageUrls: string[], apiUrls: string[], findings: Finding[], checked: string[]) {
  for (const raw of pageUrls) {
    const u = new URL(raw);
    if (!isLocal(u)) continue;
    const r = await probe(raw);
    if (!r) continue;
    checked.push(`header ${u.pathname}${u.search ? "?…" : ""} (${u.port})`);
    const h = r.headers;
    const csp = h.get("content-security-policy") || "";
    const where = `${u.host}${u.pathname}`;
    if (!csp) findings.push({ severity: "sedang", title: "Tidak ada Content-Security-Policy", where, detail: "Tanpa CSP, XSS lebih mudah dieksploitasi.", fix: "Tambahkan header CSP (mulai dari default-src 'self')." });
    if (!h.get("x-frame-options") && !/frame-ancestors/.test(csp) && !/\bsandbox\b/.test(csp))
      findings.push({ severity: "sedang", title: "Halaman bisa dibingkai situs lain (clickjacking)", where, detail: "Tidak ada X-Frame-Options / frame-ancestors.", fix: "Tambahkan X-Frame-Options: DENY atau CSP frame-ancestors 'self'." });
    if (!h.get("x-content-type-options")) findings.push({ severity: "rendah", title: "Tidak ada X-Content-Type-Options", where, detail: "Browser bisa menebak tipe file.", fix: "Tambahkan X-Content-Type-Options: nosniff." });
    if (h.get("x-powered-by")) findings.push({ severity: "rendah", title: `Server memamerkan teknologinya (X-Powered-By: ${h.get("x-powered-by")})`, where, detail: "Memudahkan penyerang memilih celah.", fix: "Matikan header ini (Express: app.disable('x-powered-by'))." });
    for (const p of ["/.env", "/.git/config", "/server/data.json", "/data.json"]) {
      const t = new URL(p, u.origin).toString();
      const pr = await probe(t);
      if (pr && pr.status === 200 && pr.body.length > 0 && !/<html/i.test(pr.body.slice(0, 300))) {
        findings.push({ severity: "tinggi", title: `File sensitif bisa diunduh: ${p}`, where: t, detail: `Status 200, ${pr.body.length} byte.`, fix: "Jangan sajikan folder project sebagai file statis; pindahkan file ini keluar dari folder publik." });
      }
    }
  }
  for (const raw of apiUrls) {
    const u = new URL(raw);
    if (!isLocal(u)) continue;
    const r = await probe(raw, { headers: { Origin: EVIL } });
    if (!r) continue;
    checked.push(`CORS & akses ${u.pathname} (${u.port})`);
    const acao = r.headers.get("access-control-allow-origin");
    const where = `${u.host}${u.pathname}`;
    if (acao === EVIL && r.headers.get("access-control-allow-credentials") === "true")
      findings.push({ severity: "tinggi", title: "CORS memantulkan origin asing + credentials", where, detail: "Situs lain bisa membaca data pengguna yang login.", fix: "Pakai daftar origin yang diizinkan, bukan memantulkan Origin." });
    else if (acao === "*" || acao === EVIL)
      findings.push({ severity: "sedang", title: "API bisa dibaca dari situs mana pun (CORS)", where, detail: `access-control-allow-origin: ${acao}`, fix: "Batasi ke origin frontend sendiri." });
    if (r.status === 200 && /^\s*[[{]/.test(r.body))
      findings.push({ severity: "rendah", title: "Endpoint data tanpa login", where, detail: "Data bisa dibaca/diubah tanpa autentikasi (saat ini hanya dari laptop ini karena 127.0.0.1).", fix: "Tambahkan autentikasi sebelum di-deploy ke internet." });
  }
}

/** Tes CSRF untuk aplikasi VOX sendiri: permintaan POST dari origin asing harus ditolak. */
async function checkSelfCsrf(base: string, findings: Finding[], checked: string[]) {
  const r = await probe(new URL("/api/fs", base).toString(), {
    method: "POST",
    headers: { Origin: EVIL, "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "noop" }),
  });
  if (!r) return;
  checked.push("CSRF /api/fs dari origin asing");
  if (r.status !== 403) findings.push({ severity: "tinggi", title: "API menerima permintaan dari situs lain (CSRF)", where: "/api/fs", detail: `Status ${r.status}, seharusnya 403.`, fix: "Periksa src/proxy.ts." });
}

const SEV_ORDER: Severity[] = ["tinggi", "sedang", "rendah", "info"];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function reportHtml(r: AuditResult) {
  const count = (s: Severity) => r.findings.filter((f) => f.severity === s).length;
  const color: Record<Severity, string> = { tinggi: "#e5484d", sedang: "#f5a524", rendah: "#3e9cf0", info: "#8b8d98" };
  const rows = r.findings
    .slice(0, 40)
    .map(
      (f) => `<tr><td><span class="b" style="background:${color[f.severity]}">${f.severity}</span></td><td><b>${esc(f.title)}</b><div class="m">${esc(f.where)}</div><div>${esc(f.detail)}</div><div class="fx">Perbaikan: ${esc(f.fix)}</div></td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:32px;background:#0f1115;color:#e8e9ed;font:14px/1.5 -apple-system,Segoe UI,sans-serif}
h1{font-size:22px;margin:0 0 4px}.sub{color:#8b8d98;margin-bottom:20px}
.cards{display:flex;gap:12px;margin-bottom:20px}.c{flex:1;background:#181a20;border-radius:10px;padding:14px}.c b{font-size:26px;display:block}
table{width:100%;border-collapse:collapse}td{padding:12px 10px;border-top:1px solid #262830;vertical-align:top}
.b{color:#fff;border-radius:6px;padding:2px 8px;font-size:12px;text-transform:uppercase}.m{color:#8b8d98;font:12px ui-monospace,monospace;margin:2px 0}
.fx{color:#9fd8a8;margin-top:4px}.ok{background:#16261b;color:#9fd8a8;padding:14px;border-radius:10px}
.chk{color:#8b8d98;font-size:12px;margin-top:18px}</style></head><body>
<h1>Laporan keamanan: ${esc(r.target)}</h1><div class="sub">${new Date().toLocaleString("id-ID")} · ${(r.durationMs / 1000).toFixed(1)} detik</div>
<div class="cards">${SEV_ORDER.map((s) => `<div class="c"><b style="color:${color[s]}">${count(s)}</b>${s}</div>`).join("")}</div>
${r.findings.length ? `<table>${rows}</table>` : `<div class="ok">Tidak ada temuan dari pemeriksaan yang dijalankan.</div>`}
<div class="chk">Diperiksa: ${esc(r.checked.join(" · "))}</div></body></html>`;
}

export async function auditProject(opts: { projectId?: string; self?: boolean; appBase: string }): Promise<AuditResult> {
  const t0 = Date.now();
  const findings: Finding[] = [];
  const checked: string[] = [];
  let target: string;

  if (opts.self) {
    target = "aplikasi VOX·AI (project ini)";
    const root = process.cwd();
    const n = await scanCode(root, ["src", "jarvis-call"], findings);
    checked.push(`scan kode (${n} file)`);
    await checkEnvIgnored(root, findings);
    await npmAudit(root, "", findings, checked);
    await checkHttp([opts.appBase], [], findings, checked);
    await checkSelfCsrf(opts.appBase, findings, checked);
  } else {
    const id = opts.projectId || "default-workspace";
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id)) throw new Error("Project tidak valid.");
    const root = path.join(PROJECTS_BASE, id);
    await fs.access(root).catch(() => {
      throw new Error(`Project ${id} tidak ditemukan.`);
    });
    target = `project ${id}`;
    const n = await scanCode(root, ["."], findings);
    checked.push(`scan kode (${n} file)`);
    await checkEnvIgnored(root, findings);
    for (const sub of ["", "server", "web"]) await npmAudit(root, sub, findings, checked);
    const pages: string[] = [];
    const apis: string[] = [];
    try {
      await fs.access(path.join(root, "index.html"));
      pages.push(new URL(`/api/preview?projectId=${encodeURIComponent(id)}`, opts.appBase).toString());
    } catch {}
    const cfg = await readStackConfig(root);
    if (cfg) {
      if (cfg.frontend) pages.push(`http://127.0.0.1:${cfg.webPort}/`);
      if (cfg.backend) {
        pages.push(`http://127.0.0.1:${cfg.apiPort}/health`);
        apis.push(`http://127.0.0.1:${cfg.apiPort}/api/${cfg.resource}`);
      }
    }
    await checkHttp(pages, apis, findings, checked);
    if (cfg && !checked.some((c) => c.startsWith("header") || c.startsWith("CORS")))
      findings.push({ severity: "info", title: "Server project sedang mati", where: "-", detail: "Pemeriksaan HTTP dilewati.", fix: 'Bilang "jalankan" lalu cek ulang.' });
  }

  findings.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  const result: AuditResult = { target, findings, checked, durationMs: Date.now() - t0 };
  try {
    result.screenshot = await renderHtmlShot(reportHtml(result));
  } catch {}
  return result;
}

export function detectAudit(msg: string): { self: boolean } | null {
  if (!/\b(?:cek|audit|scan|periksa|tes|uji|cari)\s+(?:keamanan|celah|kerentanan|security|bug\s+keamanan)|\bpentest\b|\bcari\s+celah\b|\bcelah\s+keamanan\b/i.test(msg)) return null;
  return { self: /\b(?:aplikasi|app|project|proyek)\s+(?:ini|vox)\b|\bvox\b/i.test(msg) && !/\bproject\s+[a-z0-9-]+\s+ini\b/i.test(msg) && /\b(?:aplikasi|app)\b|\bvox\b/i.test(msg) };
}

export function formatAudit(r: AuditResult): { reply: string; spoken: string } {
  const c = (s: Severity) => r.findings.filter((f) => f.severity === s).length;
  const top = r.findings.filter((f) => f.severity !== "info").slice(0, 8);
  const lines = top.map((f) => `• [${f.severity}] ${f.title} — ${f.where}\n  Perbaikan: ${f.fix}`);
  const head = `Hasil cek keamanan ${r.target}: ${c("tinggi")} tinggi, ${c("sedang")} sedang, ${c("rendah")} rendah.`;
  const reply = `${head}\n${lines.length ? lines.join("\n") : "Tidak ada temuan berarti dari pemeriksaan ini."}${r.findings.length - top.length > 0 ? `\n(+${r.findings.length - top.length} temuan lain di laporan)` : ""}\n\nDiperiksa: ${r.checked.join(", ")}.${r.screenshot ? `\n\n![laporan keamanan](${r.screenshot})` : ""}`;
  const spoken = c("tinggi") ? `Ketemu ${c("tinggi")} masalah serius. Detailnya aku tulis di chat.` : r.findings.length ? "Gak ada yang serius, tapi ada beberapa saran. Detailnya di chat." : "Aman, gak ada temuan.";
  return { reply, spoken };
}
