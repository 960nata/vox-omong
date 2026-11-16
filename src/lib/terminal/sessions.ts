import { spawn, type ChildProcess } from "child_process";
import { randomBytes } from "crypto";
import fsSync from "fs";
import path from "path";

/**
 * Sesi terminal interaktif: satu shell hidup per sesi, output mengalir (streaming), input bisa diketik.
 * PTY tanpa dependensi native: memakai perintah `script` bawaan macOS/Linux untuk membuat terminal semu.
 * Kalau `script` tidak ada atau gagal, turun ke mode pipa (tanpa echo/prompt; klien yang menampilkan ketikan).
 * Sesi disimpan di memori proses server dan dibuang setelah lama menganggur.
 */
const MAX_SESSIONS = 6;
const BUFFER_LIMIT = 200_000;
const IDLE_MS = 30 * 60_000;
const SECRET_NAME = /(?:key|token|secret|password|credential|authorization|cookie|database_url|connection_string|private|studio_pin)/i;

export type SessionEvent = { type: "data"; data: string } | { type: "exit"; code: number | null };
type Listener = (event: SessionEvent) => void;

export interface SessionInfo { id: string; cwd: string; projectId?: string; pty: boolean; running: boolean; exitCode: number | null; createdAt: number }

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : fallback);

interface Session extends SessionInfo {
  child: ChildProcess;
  buffer: string;
  listeners: Set<Listener>;
  lastActive: number;
}

const g = globalThis as typeof globalThis & { __voxSessions?: Map<string, Session>; __voxSessionSweep?: NodeJS.Timeout };
const sessions = (g.__voxSessions ||= new Map<string, Session>());

function shellEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || "development" };
  for (const [name, value] of Object.entries(process.env)) if (value !== undefined && !SECRET_NAME.test(name)) env[name] = value;
  env.PATH = [process.env.PATH || "", "/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin"].filter(Boolean).join(path.delimiter);
  env.TERM = "xterm-256color";
  env.COLUMNS = "100";
  env.LINES = "30";
  return env;
}

function userShell(): string {
  const sh = process.env.SHELL;
  if (sh && fsSync.existsSync(sh)) return sh;
  return fsSync.existsSync("/bin/zsh") ? "/bin/zsh" : fsSync.existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh";
}

function spawnShell(cwd: string, pty: boolean, cols = 100, rows = 30): ChildProcess {
  const env = shellEnv();
  env.COLUMNS = String(cols);
  env.LINES = String(rows);
  const opts = { cwd, env, stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" };
  if (pty) {
    // `script` membuat terminal semu tanpa ukuran; stty mengisinya supaya baris panjang terlipat benar.
    const boot = `stty cols ${cols} rows ${rows} 2>/dev/null; exec ${userShell()} -i`;
    return process.platform === "darwin"
      ? spawn("/usr/bin/script", ["-q", "/dev/null", "/bin/sh", "-c", boot], opts)
      : spawn("script", ["-qfc", boot, "/dev/null"], opts);
  }
  // Mode pipa: `trap : INT` membuat Ctrl-C menghentikan perintah yang jalan, bukan shell-nya.
  return spawn("/bin/sh", ["-c", 'trap : INT; while IFS= read -r __line; do eval "$__line"; done'], opts);
}

function hasScript(): boolean {
  if (process.platform === "win32") return false;
  return ["/usr/bin/script", "/bin/script"].some((p) => fsSync.existsSync(p));
}

function emit(s: Session, event: SessionEvent) {
  if (event.type === "data") s.buffer = (s.buffer + event.data).slice(-BUFFER_LIMIT);
  for (const l of s.listeners) { try { l(event); } catch {} }
}

function wire(s: Session) {
  const onData = (chunk: Buffer) => emit(s, { type: "data", data: chunk.toString("utf-8") });
  s.child.stdout?.on("data", onData);
  s.child.stderr?.on("data", onData);
  s.child.stdin?.on("error", () => {});
  s.child.on("error", (err) => { emit(s, { type: "data", data: `\r\n[gagal menjalankan shell: ${err.message}]\r\n` }); });
  s.child.on("close", (code) => {
    // `script` gagal seketika (mis. versi yang menolak stdin non-terminal): ulang sekali dalam mode pipa
    if (s.pty && Date.now() - s.createdAt < 1500 && code !== 0 && !s.buffer.trim().includes("$")) {
      s.pty = false;
      s.buffer = "";
      s.child = spawnShell(s.cwd, false);
      wire(s);
      emit(s, { type: "data", data: "[mode sederhana: terminal semu tidak tersedia di sistem ini]\r\n" });
      return;
    }
    s.running = false;
    s.exitCode = code;
    emit(s, { type: "exit", code });
  });
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (!s.running && now - s.lastActive > 60_000) sessions.delete(id);
    else if (s.running && s.listeners.size === 0 && now - s.lastActive > IDLE_MS) killSession(id);
  }
}

const info = (s: Session): SessionInfo => ({ id: s.id, cwd: s.cwd, projectId: s.projectId, pty: s.pty, running: s.running, exitCode: s.exitCode, createdAt: s.createdAt });

export function createSession(opts: { cwd: string; projectId?: string; pty?: boolean; cols?: number; rows?: number }): SessionInfo {
  sweep();
  if (Array.from(sessions.values()).filter((s) => s.running).length >= MAX_SESSIONS) throw new Error(`Maksimal ${MAX_SESSIONS} terminal aktif. Tutup salah satu dulu.`);
  const pty = opts.pty ?? hasScript();
  const cols = clamp(opts.cols, 20, 300, 100), rows = clamp(opts.rows, 5, 120, 30);
  const s: Session = {
    id: randomBytes(12).toString("hex"), cwd: opts.cwd, projectId: opts.projectId, pty, running: true, exitCode: null,
    createdAt: Date.now(), lastActive: Date.now(), buffer: "", listeners: new Set(), child: spawnShell(opts.cwd, pty, cols, rows),
  };
  wire(s);
  sessions.set(s.id, s);
  if (!g.__voxSessionSweep) { g.__voxSessionSweep = setInterval(sweep, 60_000); g.__voxSessionSweep.unref?.(); }
  return info(s);
}

export function getSession(id: string): SessionInfo | null {
  const s = sessions.get(id);
  return s ? info(s) : null;
}

export function listSessions(projectId?: string): SessionInfo[] {
  return Array.from(sessions.values()).filter((s) => !projectId || s.projectId === projectId).map(info);
}

export function writeSession(id: string, data: string): boolean {
  const s = sessions.get(id);
  if (!s || !s.running || !s.child.stdin?.writable) return false;
  s.lastActive = Date.now();
  s.child.stdin.write(data);
  return true;
}

/** Ctrl-C. Di mode PTY cukup kirim byte 0x03; di mode pipa kirim SIGINT ke grup proses. */
export function interruptSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s || !s.running) return false;
  s.lastActive = Date.now();
  if (s.pty) return writeSession(id, "\x03");
  try {
    if (s.child.pid) process.kill(-s.child.pid, "SIGINT");
    return true;
  } catch {
    return false;
  }
}

export function killSession(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  if (s.running) {
    try { if (s.child.pid && process.platform !== "win32") process.kill(-s.child.pid, "SIGKILL"); else s.child.kill("SIGKILL"); } catch {}
  }
  s.lastActive = 0;
  return true;
}

/** Berlangganan output. Output yang sudah lewat (backlog) dikirim lebih dulu. Mengembalikan fungsi berhenti. */
export function subscribe(id: string, listener: Listener): (() => void) | null {
  const s = sessions.get(id);
  if (!s) return null;
  if (s.buffer) listener({ type: "data", data: s.buffer });
  if (!s.running) { listener({ type: "exit", code: s.exitCode }); return () => {}; }
  s.listeners.add(listener);
  s.lastActive = Date.now();
  return () => { s.listeners.delete(listener); s.lastActive = Date.now(); };
}
