import { exec, spawn, type ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import { projectDir } from "./projectDir";

const BLOCKED_PATTERNS = [/rm\s+-rf\s+\/($|\s)/i, /mkfs/i, /dd\s+if=/i, />\s*\/dev\/sd/i];
const LOG_LIMIT = 24_000;
const MAX_PROCESSES = 5;
const SECRET_NAME = /(?:key|token|secret|password|credential|authorization|cookie|database_url|connection_string|private)/i;

export class TerminalCommandError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface TerminalResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  workingDir: string;
  running: boolean;
  ready?: boolean;
  previewUrl?: string;
  pid?: number;
  signal?: string | null;
  timedOut?: boolean;
}

interface ManagedProcess {
  child: ChildProcess;
  command: string;
  workingDir: string;
  startedAt: number;
  endedAt?: number;
  stdout: string;
  stderr: string;
  running: boolean;
  exitCode: number | null;
  signal?: string | null;
  previewUrl?: string;
  candidateUrls: string[];
  secrets: string[];
}

const globals = globalThis as typeof globalThis & { __voxTerminalProcesses?: Map<string, ManagedProcess> };
const processes = globals.__voxTerminalProcesses ||= new Map<string, ManagedProcess>();

function environment() {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || "development" };
  const secrets: string[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (SECRET_NAME.test(name)) {
      if (value && value.length >= 6) secrets.push(value);
    } else if (value !== undefined) env[name] = value;
  }
  env.PATH = [path.dirname(process.execPath), process.env.PATH || "", "/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].filter(Boolean).join(path.delimiter);
  env.npm_config_update_notifier = "false";
  env.npm_config_fund = "false";
  env.npm_config_audit = "false";
  env.NO_COLOR = "1";
  env.FORCE_COLOR = "0";
  return { env, secrets };
}

function redact(value: string, secrets: string[]) {
  let clean = value.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");
  for (const secret of secrets) clean = clean.split(secret).join("[REDACTED]");
  return clean.replace(/\b(?:sk|gsk)-[A-Za-z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function persistentCommand(command: string) {
  return /(?:^|&&\s*|;\s*)(?:npm\s+(?:run\s+)?(?:dev|start)|(?:pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start))(?:\s|$)/i.test(command);
}

async function exists(file: string) { return fs.access(file).then(() => true, () => false); }

async function workingDirectory(projectId?: string, cwd?: string, preferWeb = false) {
  const base = await fs.realpath(await projectDir(projectId));
  let target = base;
  if (cwd) {
    const requested = path.resolve(base, cwd);
    if (requested !== base && !requested.startsWith(base + path.sep)) throw new TerminalCommandError("Folder terminal harus berada di proyek aktif.", 403);
    target = await fs.realpath(requested).catch(() => { throw new TerminalCommandError("Folder terminal tidak ditemukan."); });
    if (target !== base && !target.startsWith(base + path.sep)) throw new TerminalCommandError("Symlink keluar proyek tidak boleh dipakai sebagai folder terminal.", 403);
  } else if (preferWeb && !await exists(path.join(base, "package.json")) && await exists(path.join(base, "web", "package.json"))) {
    target = await fs.realpath(path.join(base, "web"));
    if (!target.startsWith(base + path.sep)) throw new TerminalCommandError("Folder web mengarah keluar proyek aktif.", 403);
  }
  if (!(await fs.stat(target)).isDirectory()) throw new TerminalCommandError("Folder terminal bukan direktori.");
  return target;
}

// A static project gets a real, dependency-free server. A build script is never fabricated.
async function ensureStaticServer(dir: string, command: string) {
  if (await exists(path.join(dir, "package.json"))) return;
  if (!persistentCommand(command) || !await exists(path.join(dir, "index.html"))) {
    if (/^(?:npm|npx)\b/.test(command) && !/^npm\s+(?:init|--version|-v|help|config|view|search|info|exec)\b/.test(command)) {
      throw new TerminalCommandError("Proyek ini belum memiliki package.json. Tentukan framework atau jalankan npm init terlebih dahulu; npm run dev perlu script dev yang nyata.");
    }
    return;
  }
  const server = `import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = await fs.realpath(process.cwd());
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const requestedPort = process.argv.find((arg, index, args) => args[index - 1] === '--port');
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const parts = pathname.split('/');
    if (parts.some(p => p.startsWith('.') || p === 'node_modules') || /(?:package(?:-lock)?\\.json|yarn\\.lock|pnpm-lock\\.yaml)$/i.test(pathname)) throw Error('private');
    let file = await fs.realpath(path.join(root, pathname === '/' ? 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    if ((await fs.stat(file)).isDirectory()) file = await fs.realpath(path.join(file, 'index.html'));
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(requestedPort || 0), '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port));
`;
  await fs.mkdir(path.join(dir, ".vox"), { recursive: true });
  await fs.writeFile(path.join(dir, ".vox", "serve.mjs"), server);
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ name: path.basename(dir), private: true, version: "1.0.0", scripts: { dev: "node .vox/serve.mjs", start: "node .vox/serve.mjs" } }, null, 2));
}

function resultFor(record: ManagedProcess): TerminalResult {
  const output = redact(record.stdout, record.secrets);
  return {
    success: record.running || record.exitCode === 0,
    command: redact(record.command, record.secrets),
    stdout: (output + (record.running ? `\n[Server ${record.previewUrl ? "siap; HTTP telah diperiksa" : "masih berjalan; HTTP belum terkonfirmasi"}. Gunakan status/stop terminal untuk memeriksa atau menghentikan.]` : "")).slice(-LOG_LIMIT),
    stderr: redact(record.stderr, record.secrets).slice(-LOG_LIMIT),
    exitCode: record.exitCode,
    durationMs: (record.endedAt || Date.now()) - record.startedAt,
    workingDir: record.workingDir,
    running: record.running, ready: record.running && !!record.previewUrl,
    ...(record.running && record.previewUrl ? { previewUrl: record.previewUrl } : {}),
    ...(record.child.pid ? { pid: record.child.pid } : {}),
    ...(record.signal ? { signal: record.signal } : {}),
  };
}

async function probe(record: ManagedProcess) {
  if (!record.running) return;
  record.previewUrl = undefined;
  for (const candidate of record.candidateUrls.slice(-5).reverse()) {
    try {
      const response = await fetch(candidate, { signal: AbortSignal.timeout(900), redirect: "manual" });
      await response.body?.cancel();
      if (record.running && response.status >= 200 && response.status < 400) { record.previewUrl = candidate; return; }
    } catch {}
  }
}

function recordFor(base: string) {
  return processes.get(base) || Array.from(processes.values()).filter((record) => record.workingDir.startsWith(base + path.sep)).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function getTerminalStatus(projectId?: string, cwd?: string): Promise<TerminalResult> {
  const dir = await workingDirectory(projectId, cwd);
  const record = recordFor(dir);
  if (!record) return { success: true, command: "", stdout: "Belum ada server terminal untuk proyek ini.", stderr: "", exitCode: null, durationMs: 0, workingDir: dir, running: false, ready: false };
  await probe(record);
  return resultFor(record);
}

function signalProcess(record: ManagedProcess, signal: NodeJS.Signals) {
  try {
    if (process.platform !== "win32" && record.child.pid) process.kill(-record.child.pid, signal);
    else record.child.kill(signal);
  } catch {}
}

export async function stopTerminal(projectId?: string, cwd?: string): Promise<TerminalResult> {
  const dir = await workingDirectory(projectId, cwd);
  const record = recordFor(dir);
  if (!record || !record.running) return getTerminalStatus(projectId, cwd);
  signalProcess(record, "SIGTERM");
  await new Promise<void>((resolve) => {
    if (!record.running) return resolve();
    const timer = setTimeout(resolve, 1200);
    record.child.once("close", () => { clearTimeout(timer); resolve(); });
  });
  if (record.running) signalProcess(record, "SIGKILL");
  await new Promise<void>((resolve) => {
    if (!record.running) return resolve();
    const timer = setTimeout(resolve, 500);
    record.child.once("close", () => { clearTimeout(timer); resolve(); });
  });
  return { ...resultFor(record), stdout: `${resultFor(record).stdout}\n${record.running ? "Penghentian masih menunggu proses." : "Server telah dihentikan."}`, success: !record.running };
}

export async function executeTerminal(opts: { command: string; projectId?: string; cwd?: string }): Promise<TerminalResult> {
  let command = opts.command?.trim();
  if (!command || command.length > 8000) throw new TerminalCommandError("Command wajib diisi (maksimal 8000 karakter).");
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(command))) throw new TerminalCommandError("Perintah berbahaya ditolak oleh sistem keamanan.", 403);
  const displayCommand = command;
  let cwd = opts.cwd;
  const prefix = command.match(/^npm\s+--prefix(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))\s+([\s\S]+)$/i);
  if (prefix) {
    const folder = prefix[1] || prefix[2] || prefix[3];
    cwd = path.isAbsolute(folder) ? folder : path.join(cwd || "", folder);
    command = `npm ${prefix[4]}`;
  }
  const persistent = persistentCommand(command);
  const dir = await workingDirectory(opts.projectId, cwd, persistent);
  await ensureStaticServer(dir, command);
  const { env, secrets } = environment();
  const startedAt = Date.now();
  if (persistent) {
    const existing = recordFor(dir);
    if (existing?.running) {
      await probe(existing);
      return { ...resultFor(existing), stdout: `${resultFor(existing).stdout}\nServer proyek sudah berjalan; hentikan sebelum menjalankan server lain.` };
    }
    if (Array.from(processes.values()).filter((record) => record.running).length >= MAX_PROCESSES) throw new TerminalCommandError("Maksimal 5 server aktif. Hentikan salah satu server proyek terlebih dahulu.", 409);
    for (const [key, record] of processes) if (!record.running) processes.delete(key);
    const child = spawn(command, { cwd: dir, env, shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const record: ManagedProcess = { child, command: displayCommand, workingDir: dir, startedAt, stdout: "", stderr: "", running: true, exitCode: null, candidateUrls: [], secrets };
    processes.set(dir, record);
    const collect = (stream: "stdout" | "stderr", chunk: Buffer) => {
      record[stream] = (record[stream] + chunk.toString()).slice(-LOG_LIMIT);
      const clean = record[stream].replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");
      for (const match of clean.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d{1,5}(?:\/[^\s<>"']*)?/g)) {
        try {
          const candidate = new URL(match[0]);
          candidate.hostname = "127.0.0.1";
          candidate.pathname = "/";
          candidate.search = "";
          candidate.hash = "";
          if (!record.candidateUrls.includes(candidate.toString())) record.candidateUrls.push(candidate.toString());
          record.candidateUrls = record.candidateUrls.slice(-5);
        } catch {}
      }
    };
    child.stdout?.on("data", (chunk: Buffer) => collect("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer) => collect("stderr", chunk));
    child.on("error", (error) => { record.stderr = (record.stderr + error.message).slice(-LOG_LIMIT); record.running = false; record.exitCode = 1; record.endedAt = Date.now(); });
    child.on("close", (code, signal) => { record.running = false; record.exitCode = code; record.signal = signal; record.endedAt = Date.now(); record.previewUrl = undefined; });
    const deadline = Date.now() + 3500;
    while (record.running && Date.now() < deadline) {
      await probe(record);
      if (record.previewUrl) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return resultFor(record);
  }
  const timeout = /^(?:npm|npx|yarn|pnpm|bun|git\s+clone|curl|wget)\b/.test(command) ? 180000 : 45000;
  return new Promise<TerminalResult>((resolve) => {
    exec(command, { cwd: dir, env, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const signal = error && "signal" in error ? error.signal : null;
      const code = error && "code" in error && typeof error.code === "number" ? error.code : error ? null : 0;
      const timedOut = !!error?.killed && Date.now() - startedAt >= timeout - 100;
      const errorOutput = [stderr || error?.message || "", timedOut ? `Perintah dihentikan setelah batas ${timeout / 1000} detik.` : ""].filter(Boolean).join("\n");
      resolve({ success: !error, command: redact(displayCommand, secrets), stdout: redact(stdout, secrets).slice(-100000), stderr: redact(errorOutput, secrets).slice(-LOG_LIMIT), exitCode: code, durationMs: Date.now() - startedAt, workingDir: dir, running: false, ...(signal ? { signal } : {}), ...(timedOut ? { timedOut } : {}) });
    });
  });
}

function concreteCommand(text: string): string | null {
  const inline = text.match(/`((?:npm|npx|node|pnpm|yarn|bun)\s+[^`\n]+)`/i)?.[1];
  const line = text.match(/(?:^|\n)\s*(?:\$\s*|[-*]\s*)?((?:npm|npx|node|pnpm|yarn|bun)\s+[^\n`]+)/i)?.[1];
  return (inline || line)?.trim() || null;
}

export async function handleTerminalMessage(opts: {
  message: string;
  projectId?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<{ reply: string; spoken: string; previewUrl?: string } | null> {
  const message = opts.message.trim();
  const stop = /^(?:stop|hentikan|matikan|berhenti(?:kan)?)\s+(?:terminal|(?:dev\s+)?server|npm)(?:\s+(?:dong|cuy|ya))?[.!]?$/i.test(message);
  const status = /^(?:cek|lihat|apa)?\s*status\s+(?:terminal|(?:dev\s+)?server|npm)(?:\s+(?:dong|cuy|ya))?[?!]?$/i.test(message);
  let command = /^(?:npm|npx|node|pnpm|yarn|bun)\s+/i.test(message) ? message : null;
  if (!command) command = message.match(/^(?:(?:tolong|coba)\s+)?(?:jalankan|jalanin|eksekusi|run)\s+(?:(?:di\s+)?terminal\s*:?\s*)?(`?(?:npm|npx|node|pnpm|yarn|bun)\s+[\s\S]+)$/i)?.[1] || null;
  if (!command && /^(?:jalanin|jalankan|kerjakan|eksekusi)(?:\s+(?:dong|aja|sekarang|instalasinya|installnya|perintahnya|itu|cuy|ya))*[.!]?$/i.test(message)) {
    for (const item of (opts.history || []).slice(-8).reverse()) {
      if (!["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
      const found = concreteCommand(item.content);
      if (found) { command = found; break; }
    }
  }
  if (!command && !stop && !status) return null;
  try {
    const cleanCommand = command?.replace(/\s+(?:dong|cuy|ya)[.!]?$/i, "").replace(/^`|`$/g, "");
    const result = stop ? await stopTerminal(opts.projectId) : status ? await getTerminalStatus(opts.projectId) : await executeTerminal({ projectId: opts.projectId, command: cleanCommand! });
    const state = result.running ? result.ready ? "Server berjalan dan respons HTTP sudah diperiksa." : "Proses berjalan. Server belum terkonfirmasi siap." : result.timedOut ? "Perintah melewati batas waktu dan dihentikan." : result.signal ? `Proses dihentikan (${result.signal}).` : result.exitCode === null ? "Tidak ada proses server yang berjalan." : `Perintah selesai dengan exit code ${result.exitCode}.`;
    const reply = [state, result.command ? `Perintah: \`${result.command.replace(/`/g, "")}\`` : "", `Folder: ${result.workingDir}`, result.stdout ? `Output:\n\n\`\`\`text\n${result.stdout.replace(/```/g, "'''")}\n\`\`\`` : "", result.stderr ? `Pesan proses:\n\n\`\`\`text\n${result.stderr.replace(/```/g, "'''")}\n\`\`\`` : "", result.previewUrl ? `Preview: ${result.previewUrl}` : ""].filter(Boolean).join("\n\n");
    return { reply, spoken: result.success ? state : "Perintah belum berhasil. Detail error sudah kutampilkan supaya bisa diperbaiki.", ...(result.previewUrl ? { previewUrl: result.previewUrl } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perintah terminal gagal.";
    return { reply: message, spoken: message };
  }
}
