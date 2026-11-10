import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import net from "net";
import path from "path";
import type { StackConfig } from "./scaffold";

/**
 * Pengelola proses untuk proyek hasil scaffold: install paket lalu menjalankan server dev.
 * Aman karena: perintahnya dipatok (bukan dari model), cwd selalu di dalam folder project,
 * lingkungan proses minimal (API key aplikasi TIDAK diwariskan), dan semuanya hanya
 * mendengarkan di 127.0.0.1.
 */

const BASE = path.join(process.cwd(), ".data");
const PROJECTS = path.join(BASE, "user_projects");
const LOGS = path.join(BASE, "procs");
const STATE = path.join(BASE, "procs.json");
const INSTALL_TIMEOUT_MS = 8 * 60 * 1000;

type Phase = "installing" | "running" | "stopped" | "failed";
interface ProcRec {
  pid: number;
  port: number;
  part: string;
  project: string;
  phase: Phase;
  startedAt: string;
  log: string;
  error?: string;
}
type State = Record<string, ProcRec>;

const key = (project: string, part: string) => `${project}/${part}`;

function readState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf-8")) as State;
  } catch {
    return {};
  }
}
function writeState(s: State) {
  fs.mkdirSync(BASE, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
}
function patchState(k: string, rec: Partial<ProcRec> & { project: string; part: string }) {
  const s = readState();
  const base: ProcRec = { pid: 0, port: 0, phase: "stopped", startedAt: new Date().toISOString(), log: "", project: rec.project, part: rec.part };
  s[k] = { ...base, ...(s[k] || {}), ...rec };
  writeState(s);
}

function alive(pid: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function portOpen(port: number, timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

/** Lingkungan minimal: tanpa API key aplikasi, hanya yang dibutuhkan toolchain. */
function safeEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH || "/usr/bin:/bin:/usr/local/bin",
    HOME: process.env.HOME || "",
    LANG: "en_US.UTF-8",
    NODE_ENV: "development",
    CI: "1",
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false",
    ...extra,
  };
}

interface Part {
  name: "server" | "web";
  dir: string;
  port: number;
  kind: "express" | "go" | "react" | "nextjs";
}

function partsOf(project: string, cfg: StackConfig): Part[] {
  const root = path.join(PROJECTS, project);
  const parts: Part[] = [];
  if (cfg.backend) parts.push({ name: "server", dir: path.join(root, "server"), port: cfg.apiPort, kind: cfg.backend });
  if (cfg.frontend) parts.push({ name: "web", dir: path.join(root, "web"), port: cfg.webPort, kind: cfg.frontend });
  return parts;
}

function openLog(project: string, part: string): { fd: number; file: string } {
  fs.mkdirSync(LOGS, { recursive: true });
  const file = path.join(LOGS, `${project}-${part}.log`);
  return { fd: fs.openSync(file, "a"), file };
}

function runToExit(cmd: string, args: string[], cwd: string, fd: number, timeoutMs: number): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: safeEnv(), stdio: ["ignore", fd, fd], detached: true });
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {}
      resolve(124);
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(127);
    });
  });
}

async function ensureInstalled(project: string, p: Part): Promise<boolean> {
  if (p.kind === "go") return true; // tanpa dependensi eksternal
  if (fs.existsSync(path.join(p.dir, "node_modules"))) return true;
  const k = key(project, p.name);
  const { fd, file } = openLog(project, p.name);
  fs.writeSync(fd, `\n$ npm install (${new Date().toISOString()})\n`);
  patchState(k, { project, part: p.name, port: p.port, phase: "installing", log: file, pid: 0, error: undefined });
  const code = await runToExit("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], p.dir, fd, INSTALL_TIMEOUT_MS);
  fs.closeSync(fd);
  if (code !== 0) {
    patchState(k, { project, part: p.name, phase: "failed", error: code === 124 ? "npm install melewati batas waktu 8 menit" : `npm install gagal (kode ${code}). Lihat log.` });
    return false;
  }
  return true;
}

function startPart(project: string, p: Part) {
  const k = key(project, p.name);
  const { fd, file } = openLog(project, p.name);
  const [cmd, args]: [string, string[]] =
    p.kind === "express" ? [process.execPath, ["--watch", "index.js"]] : p.kind === "go" ? ["go", ["run", "."]] : ["npm", ["run", "dev"]];
  fs.writeSync(fd, `\n$ ${cmd === process.execPath ? "node" : cmd} ${args.join(" ")} (${new Date().toISOString()})\n`);
  const child = spawn(cmd, args, { cwd: p.dir, env: safeEnv({ PORT: String(p.port) }), stdio: ["ignore", fd, fd], detached: true });
  child.unref();
  child.on("error", (e) => patchState(k, { project, part: p.name, phase: "failed", error: `Gagal menjalankan ${cmd}: ${e.message}` }));
  child.on("exit", (code) => {
    const cur = readState()[k];
    if (cur && cur.pid === child.pid && cur.phase === "running") patchState(k, { project, part: p.name, phase: code === 0 ? "stopped" : "failed", error: code === 0 ? undefined : `Proses berhenti (kode ${code}). Lihat log.` });
  });
  patchState(k, { project, part: p.name, pid: child.pid || 0, port: p.port, phase: "running", startedAt: new Date().toISOString(), log: file, error: undefined });
}

/** Install (bila perlu) lalu jalankan semua bagian, di latar belakang. */
export function startStackInBackground(project: string, cfg: StackConfig) {
  void (async () => {
    for (const p of partsOf(project, cfg)) {
      try {
        if (await portOpen(p.port)) continue; // sudah jalan
        if (!(await ensureInstalled(project, p))) continue;
        startPart(project, p);
      } catch (e) {
        patchState(key(project, p.name), { project, part: p.name, phase: "failed", error: (e as Error).message });
      }
    }
  })();
}

export function stopStack(project: string) {
  const s = readState();
  let n = 0;
  for (const [k, rec] of Object.entries(s)) {
    if (rec.project !== project) continue;
    if (alive(rec.pid)) {
      try {
        process.kill(-rec.pid, "SIGTERM");
      } catch {
        try {
          process.kill(rec.pid, "SIGTERM");
        } catch {}
      }
      n++;
    }
    s[k] = { ...rec, phase: "stopped", pid: 0 };
  }
  writeState(s);
  return n;
}

export interface PartStatus {
  name: string;
  kind: string;
  port: number;
  url: string;
  installed: boolean;
  phase: Phase | "not-started";
  responding: boolean;
  error?: string;
  logTail: string[];
}

async function tail(file: string, n = 12): Promise<string[]> {
  try {
    const t = await fsp.readFile(file, "utf-8");
    return t.split("\n").filter(Boolean).slice(-n).map((l) => l.slice(0, 220));
  } catch {
    return [];
  }
}

export async function stackStatus(project: string, cfg: StackConfig): Promise<PartStatus[]> {
  const st = readState();
  const out: PartStatus[] = [];
  for (const p of partsOf(project, cfg)) {
    const rec = st[key(project, p.name)];
    const responding = await portOpen(p.port);
    let phase: PartStatus["phase"] = rec?.phase || "not-started";
    if (phase === "running" && !responding && !alive(rec?.pid || 0)) phase = "failed";
    if (responding) phase = "running";
    out.push({
      name: p.name,
      kind: p.kind,
      port: p.port,
      url: `http://localhost:${p.port}`,
      installed: p.kind === "go" || fs.existsSync(path.join(p.dir, "node_modules")),
      phase,
      responding,
      error: rec?.error,
      logTail: rec?.log ? await tail(rec.log) : [],
    });
  }
  return out;
}
