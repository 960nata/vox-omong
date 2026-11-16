import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Folder kerja ("workspace roots"): folder di komputer user yang boleh dipakai terminal,
 * di luar sandbox .data/user_projects. User yang memilih, lewat:
 *  - env VOX_WORKSPACE_ROOTS (dipisah titik dua / titik koma di Windows), atau
 *  - .data/workspace-roots.json (diatur dari aplikasi).
 * Home, root disk, dan folder kredensial tidak pernah boleh jadi folder kerja.
 */
const FILE = () => path.join(process.cwd(), ".data", "workspace-roots.json");
const SANDBOX = () => path.join(process.cwd(), ".data", "user_projects");
const FORBIDDEN_NAMES = new Set([".ssh", ".aws", ".gnupg", ".config", "Library", ".Trash"]);

const within = (child: string, parent: string) => child === parent || child.startsWith(parent + path.sep);

export function rootProblem(dir: string): string | null {
  const home = os.homedir();
  if (!path.isAbsolute(dir)) return "harus path lengkap (absolut)";
  const clean = path.resolve(dir);
  if (clean === path.parse(clean).root) return "root disk tidak boleh";
  if (within(home, clean)) return "folder home (atau induknya) terlalu luas; pilih folder proyek di dalamnya";
  if (within(clean, home) && FORBIDDEN_NAMES.has(path.relative(home, clean).split(path.sep)[0])) return "folder sistem/kredensial tidak boleh";
  return null;
}

async function real(dir: string) {
  return fs.realpath(dir).catch(() => null);
}

export async function listRoots(): Promise<string[]> {
  const fromEnv = (process.env.VOX_WORKSPACE_ROOTS || "").split(path.delimiter).map((s) => s.trim()).filter(Boolean);
  let fromFile: string[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(FILE(), "utf-8"));
    if (Array.isArray(parsed.roots)) fromFile = parsed.roots.filter((r: unknown): r is string => typeof r === "string");
  } catch {}
  const out: string[] = [];
  for (const dir of [...fromEnv, ...fromFile]) {
    if (rootProblem(dir)) continue;
    const r = await real(dir);
    if (r && !rootProblem(r) && !out.includes(r)) out.push(r);
  }
  return out;
}

export async function saveRoots(roots: string[]): Promise<string[]> {
  const clean: string[] = [];
  for (const dir of roots) {
    const problem = rootProblem(dir);
    if (problem) throw new Error(`${dir}: ${problem}`);
    const r = await real(dir);
    if (!r || !(await fs.stat(r)).isDirectory()) throw new Error(`${dir}: folder tidak ditemukan`);
    const again = rootProblem(r);
    if (again) throw new Error(`${dir}: ${again}`);
    if (!clean.includes(r)) clean.push(r);
  }
  await fs.mkdir(path.dirname(FILE()), { recursive: true });
  await fs.writeFile(FILE(), JSON.stringify({ roots: clean }, null, 2));
  return clean;
}

/** Path absolut ini ada di dalam salah satu folder kerja? Mengembalikan realpath-nya, atau null. */
export async function resolveInRoots(absolute: string): Promise<string | null> {
  if (!path.isAbsolute(absolute)) return null;
  const target = await real(absolute);
  if (!target) return null;
  for (const root of await listRoots()) if (within(target, root)) return target;
  return null;
}

export async function isSandboxed(dir: string): Promise<boolean> {
  const base = await real(SANDBOX());
  const target = await real(dir);
  return !!base && !!target && within(target, base);
}
