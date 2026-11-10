import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { sanitizeSlug } from "./codeAgent";

const execFileAsync = promisify(execFile);
const BASE = path.join(process.cwd(), ".data", "user_projects");

/** Folder project aktif (dibuat kalau belum ada). Selalu di dalam .data/user_projects, tidak pernah folder aplikasi Jarvis. */
export async function projectDir(projectId?: string | null): Promise<string> {
  const id = sanitizeSlug(String(projectId || "")) || "default-workspace";
  const dir = path.join(BASE, id);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export const TOOL_PATH = `${process.env.PATH ?? ""}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${process.env.HOME ?? ""}/npm-global/bin`;

/** Jalankan program TANPA shell: argumen tidak bisa menyuntikkan perintah lain. */
export function run(cmd: string, args: string[], cwd: string, extraEnv: Record<string, string | undefined> = {}, timeout = 60_000) {
  return execFileAsync(cmd, args, {
    cwd,
    timeout,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, PATH: TOOL_PATH, ...extraEnv },
  });
}

/** Folder ini punya repo git SENDIRI (bukan repo induk, mis. repo Jarvis yang membungkus .data/). */
export async function hasOwnGitRepo(dir: string): Promise<boolean> {
  try {
    await fs.stat(path.join(dir, ".git"));
    return true;
  } catch {
    return false;
  }
}

/** Project punya sesuatu yang layak di-deploy? */
export async function hasDeployableFiles(dir: string): Promise<boolean> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  return names.some((n) => n === "index.html" || n === "package.json");
}
