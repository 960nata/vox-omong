/**
 * Control plane lokal: jalankan agent VOX dari shell, cron OS, atau skrip lain.
 *
 * Adopsi konsep "Local scripts" OpenBot (docs/openbot-breakdown.md §H): server menulis URL dan
 * token ke folder automation, lalu CLI membacanya. Tokennya tidak pernah lewat argumen perintah,
 * dan dibandingkan dengan `timingSafeEqual` supaya tidak bisa ditebak lewat beda waktu respons.
 */

import { randomBytes, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";
import { engineDir } from "./store";
import { getThread, listThreads, startThread, stopThread } from "./threads";
import type { AgentThread } from "./types";

function automationDir(): string {
  return path.join(engineDir(), "automation");
}

/**
 * Pastikan ada token, lalu tulis URL + token ke folder automation.
 * Berkasnya dibuat dengan mode 0600 supaya hanya pemilik akun yang bisa membaca.
 */
export async function writeAutomationHandshake(url: string): Promise<{ url: string; token: string }> {
  const dir = automationDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const tokenFile = path.join(dir, "token");
  let token: string;
  try {
    token = (await fs.readFile(tokenFile, "utf-8")).trim();
    if (!token) throw new Error("empty");
  } catch {
    token = randomBytes(32).toString("base64url");
    await fs.writeFile(tokenFile, token, { encoding: "utf-8", mode: 0o600 });
  }
  await fs.writeFile(path.join(dir, "url"), url, { encoding: "utf-8", mode: 0o600 });
  return { url, token };
}

/** Hapus handshake (mis. saat fitur automation dimatikan). */
export async function clearAutomationHandshake(): Promise<void> {
  await fs.rm(automationDir(), { recursive: true, force: true });
}

async function currentToken(): Promise<string | null> {
  try {
    const token = (await fs.readFile(path.join(automationDir(), "token"), "utf-8")).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** Cocokkan header `Authorization: Bearer …` dengan token yang tersimpan. */
export async function verifyAutomationToken(header: string | null): Promise<boolean> {
  const expected = await currentToken();
  if (!expected) return false;
  const given = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type AutomationCommand =
  | { action: "list" }
  | { action: "run"; agent: string; prompt: string; kind?: AgentThread["kind"] }
  | { action: "status"; threadId: string }
  | { action: "stop"; threadId: string };

export interface AutomationResult {
  ok: boolean;
  /** Kode keluar yang dipakai CLI: 0 selesai, 1 gagal, 3 menunggu orang, 5 tidak ketemu. */
  exit: 0 | 1 | 3 | 5;
  data?: unknown;
  error?: string;
}

/** Daftar agent yang boleh dipanggil lewat automation; dipasang dari luar saat boot. */
let agentLister: (() => Promise<string[]> | string[]) | null = null;

export function setAutomationAgents(lister: () => Promise<string[]> | string[]): void {
  agentLister = lister;
}

function exitFor(thread: AgentThread): AutomationResult["exit"] {
  if (thread.status === "needs-person") return 3;
  if (thread.status === "error") return 1;
  return 0;
}

export async function handleAutomationCommand(command: AutomationCommand): Promise<AutomationResult> {
  switch (command.action) {
    case "list": {
      const agents = agentLister ? await agentLister() : [];
      return { ok: true, exit: 0, data: { agents, threads: listThreads() } };
    }
    case "run": {
      const prompt = command.prompt?.trim();
      if (!command.agent || !prompt) {
        return { ok: false, exit: 1, error: "`agent` dan `prompt` wajib diisi." };
      }
      const allowed = agentLister ? await agentLister() : null;
      if (allowed && allowed.length && !allowed.includes(command.agent)) {
        return { ok: false, exit: 5, error: `Agent "${command.agent}" tidak ada atau tidak diizinkan.` };
      }
      const thread = await startThread({ agent: command.agent, prompt, kind: command.kind });
      return { ok: true, exit: 0, data: thread };
    }
    case "status": {
      const thread = getThread(command.threadId);
      if (!thread) return { ok: false, exit: 5, error: "Thread tidak ketemu." };
      return { ok: true, exit: exitFor(thread), data: thread };
    }
    case "stop": {
      const thread = stopThread(command.threadId);
      if (!thread) return { ok: false, exit: 5, error: "Thread tidak ketemu." };
      return { ok: true, exit: 0, data: thread };
    }
    default:
      return { ok: false, exit: 1, error: "Perintah tidak dikenal." };
  }
}
