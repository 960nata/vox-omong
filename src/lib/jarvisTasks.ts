// Antrian tugas buat Jarvis yang dipanggil dari telpon WhatsApp (service Python jarvis-call).
// Disimpan di memori proses Next.js + log ke .data/jarvis-tasks.json.
// Kalau server Next.js restart, tugas yang lagi jalan ikut hilang (cukup buat pemakaian di laptop).

import { randomUUID, timingSafeEqual } from "crypto";
import fs from "fs/promises";
import path from "path";
import { buildWebsite, detectCodeIntent, hasGeneratedSite, readProjectHtml } from "@/lib/codeAgent";
import { detectSkill, runSkill } from "@/lib/skillAgent";
import { resolveSkill } from "@/lib/skillHub";
import { isSkillTask, runSkillEngine } from "@/lib/skillEngine";
import { handleTeamMessage } from "@/lib/agentTeams";
import { handleTerminalMessage } from "@/lib/terminalRuntime";
import { findProject, listProjectFiles, listProjects, slugify } from "@/lib/projects";

export type TaskStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface JarvisTask {
  id: string;
  instruction: string;
  projectId: string;
  source: string;
  status: TaskStatus;
  progress: number; // 0-100
  step: string;
  files: string[];
  components: string[];
  summary: string;
  previewUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

type Store = Map<string, JarvisTask>;
const g = globalThis as unknown as { __jarvisTasks?: Store; __jarvisCancel?: Set<string> };
const store: Store = (g.__jarvisTasks ??= new Map());
/** Tugas yang diminta berhenti; dicek setelah tiap langkah (pembatalan kooperatif). */
const cancelRequested: Set<string> = (g.__jarvisCancel ??= new Set());

const LOG_FILE = path.join(process.cwd(), ".data", "jarvis-tasks.json");
/** Tugas yang nggak kelar dalam batas ini dianggap mogok, biar nggak dipolling selamanya. */
const TASK_TIMEOUT_MS = Math.max(60_000, Number(process.env.JARVIS_TASK_TIMEOUT_MS) || 900_000);
/** Batas tugas yang disimpan di memori (yang lama dibuang biar nggak numpuk). */
const MAX_TASKS = 60;

class CancelledError extends Error {
  constructor() {
    super("Tugas dibatalkan");
    this.name = "CancelledError";
  }
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Tugas kelamaan (lewat ${Math.round(ms / 1000)} detik) dan dihentikan pemantauannya`);
    this.name = "TimeoutError";
  }
}

function touch(t: JarvisTask, patch: Partial<JarvisTask>) {
  Object.assign(t, patch, { updatedAt: new Date().toISOString() });
}

async function persist() {
  const all = [...store.values()].slice(-50);
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true }).catch(() => {});
  await fs.writeFile(LOG_FILE, JSON.stringify(all, null, 2)).catch(() => {});
}

/** Buang tugas lama yang sudah selesai supaya Map nggak tumbuh terus. */
function prune() {
  if (store.size <= MAX_TASKS) return;
  const finished = [...store.values()]
    .filter((t) => t.status !== "running" && t.status !== "queued")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const t of finished) {
    if (store.size <= MAX_TASKS) break;
    store.delete(t.id);
    cancelRequested.delete(t.id);
  }
}

/**
 * Nama project dari omongan ("toko online baju") dicocokkan ke folder yang SUDAH ada dulu,
 * biar "toko baju" dan "toko online baju" nggak jadi dua project berbeda.
 */
export async function resolveProjectId(spoken?: string): Promise<string> {
  const raw = (spoken || "").trim();
  if (!raw) return "default-workspace";
  const existing = await listProjects().catch(() => []);
  const hit = findProject(existing, raw);
  if (hit) return hit.id;
  return slugify(raw) || "default-workspace";
}

/** Daftar project buat tool `daftar_project` di bot telpon. */
export async function projectsForVoice() {
  const list = await listProjects().catch(() => []);
  return list.map((p) => ({ id: p.id, nama: p.name, ada_website: p.hasSite, diubah: p.updatedAt }));
}

export function getTask(id: string) {
  return store.get(id) ?? null;
}

export function listTasks() {
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Minta tugas berhenti. Pembatalan kooperatif: berlaku di batas langkah berikutnya. */
export function cancelTask(id: string): JarvisTask | null {
  const t = store.get(id);
  if (!t) return null;
  if (t.status === "done" || t.status === "error" || t.status === "cancelled") return t;
  cancelRequested.add(id);
  touch(t, { step: "Membatalkan…" });
  return t;
}

export function startTask(instruction: string, projectId?: string, source = "api"): JarvisTask {
  const now = new Date().toISOString();
  const task: JarvisTask = {
    id: randomUUID().slice(0, 8),
    instruction,
    projectId: slugify(projectId || "") || "default-workspace",
    source,
    status: "queued",
    progress: 0,
    step: "Antri",
    files: [],
    components: [],
    summary: "",
    previewUrl: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  store.set(task.id, task);
  prune();
  void run(task, projectId); // jalan di background, request langsung balik
  return task;
}

function throwIfCancelled(id: string) {
  if (cancelRequested.has(id)) throw new CancelledError();
}

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer!)) as Promise<T>;
}

/** Nama bagian/komponen nyata dari HTML hasil build (bukan nama agent). */
export function extractComponents(html: string): string[] {
  const names: string[] = [];
  const tagRe = /<(section|header|footer|nav|main|aside)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const attrs = m[2];
    const id = /\bid=["']([^"']+)["']/i.exec(attrs)?.[1];
    const label = /\baria-label=["']([^"']+)["']/i.exec(attrs)?.[1];
    const picked = (id || label || "").trim();
    names.push(picked || m[1].toLowerCase());
  }
  if (names.length < 3) {
    const hRe = /<h[12][^>]*>([\s\S]{1,80}?)<\/h[12]>/gi;
    while ((m = hRe.exec(html))) {
      const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) names.push(text);
    }
  }
  const pretty = names
    .map((n) =>
      n
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (c) => c.toUpperCase())
    )
    .filter((n) => n.length >= 2 && n.length <= 40);
  return [...new Set(pretty)].slice(0, 20);
}

async function filesOfProject(projectId: string): Promise<string[]> {
  const entries = await listProjectFiles(projectId).catch(() => []);
  return entries
    .filter((e) => !e.isDir)
    .map((e) => e.path)
    .sort()
    .slice(0, 50);
}

async function run(task: JarvisTask, spokenProject?: string) {
  touch(task, { status: "running", step: "Menyiapkan", progress: 5 });
  try {
    const projectId = await resolveProjectId(spokenProject);
    touch(task, { projectId });
    throwIfCancelled(task.id);

    await withDeadline(work(task), TASK_TIMEOUT_MS);
  } catch (e) {
    if (e instanceof CancelledError) {
      touch(task, { status: "cancelled", step: "Dibatalkan", error: null, summary: "Tugas dibatalkan sebelum selesai." });
    } else {
      touch(task, {
        status: "error",
        step: "Gagal",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  } finally {
    cancelRequested.delete(task.id);
    await persist();
  }
}

async function work(task: JarvisTask) {
  const terminal = await handleTerminalMessage({ message: task.instruction, projectId: task.projectId });
  if (terminal) {
    throwIfCancelled(task.id);
    touch(task, {
      status: "done",
      progress: 100,
      step: "Terminal",
      summary: terminal.spoken || terminal.reply,
      files: await filesOfProject(task.projectId),
      previewUrl: terminal.previewUrl || null,
    });
    return;
  }
  throwIfCancelled(task.id);

  const team = await handleTeamMessage({ message: task.instruction, projectId: task.projectId });
  if (team) {
    throwIfCancelled(task.id);
    touch(task, {
      status: "done",
      progress: 100,
      step: "Laporan tim",
      summary: team.spoken || team.reply,
      files: await filesOfProject(task.projectId),
      previewUrl: team.previewUrl || null,
    });
    return;
  }
  throwIfCancelled(task.id);

  const siteExists = await hasGeneratedSite(task.projectId);
  const intent = detectCodeIntent(task.instruction, siteExists);
  const skill = intent ? null : detectSkill(task.instruction);

  if (skill) {
    // Slide / invoice / tabel / dokumen: dirender di app, jadi lewat telpon cukup ringkasannya
    touch(task, { step: "Menyusun dokumen", progress: 30 });
    const out = await runSkill(skill, task.instruction);
    throwIfCancelled(task.id);
    touch(task, {
      status: "done",
      progress: 100,
      step: "Selesai",
      summary: `${out.artifact.title}. ${out.reply} Buka app VOX·AI untuk melihat dan mengunduhnya.`,
    });
    return;
  }

  // Skill komunitas (PRD, naming, riset pajak, dst.): dikerjakan mesin skill, bukan dijadikan website
  const resolved = intent ? null : await resolveSkill(task.instruction).catch(() => null);
  if (resolved && isSkillTask(task.instruction)) {
    const out = await runSkillEngine({
      message: task.instruction,
      resolved,
      onStep: (step) => {
        throwIfCancelled(task.id);
        touch(task, { step, progress: Math.min(90, task.progress + 20) });
      },
    });
    throwIfCancelled(task.id);
    if (out) {
      const gist = out.reply.replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").slice(0, 400);
      touch(task, {
        status: "done",
        progress: 100,
        step: "Selesai",
        summary: `Dikerjakan dengan skill ${out.skill}. ${gist}… Hasil lengkap ada di app VOX·AI.`,
      });
      return;
    }
  }

  // Website sungguhan: tiap giliran tim AI (arsitek, aset, developer, reviewer, ...) jadi pembaruan progres
  let turns = 0;
  const site = await buildWebsite({
    request: task.instruction,
    mode: intent ?? "create",
    projectId: task.projectId,
    onProgress: (turn) => {
      throwIfCancelled(task.id); // user minta batal → build berhenti di giliran ini
      turns++;
      touch(task, { step: `${turn.agent}: ${turn.note.slice(0, 90)}`, progress: Math.min(92, 8 + turns * 14) });
    },
  });
  throwIfCancelled(task.id);

  const html = site.html || (await readProjectHtml(task.projectId)) || "";
  const warn = site.warnings.length ? ` Perhatian: ${site.warnings.join(" ")}` : "";
  touch(task, {
    status: "done",
    progress: 100,
    step: "Selesai",
    files: await filesOfProject(task.projectId),
    components: extractComponents(html),
    summary: `${site.title}. ${site.summary} (${site.lines} baris, skor review ${site.score ?? "-"}/10).${warn}`.trim(),
    previewUrl: site.previewUrl,
  });
}

/**
 * Endpoint ini bisa menjalankan terminal dan menulis file project, jadi TIDAK boleh
 * terbuka: tanpa JARVIS_API_SECRET semua request ditolak (fail-closed).
 */
export function checkAuth(req: Request): boolean {
  const secret = process.env.JARVIS_API_SECRET?.trim();
  if (!secret) {
    console.warn("[jarvis] JARVIS_API_SECRET belum diisi — semua request /api/jarvis ditolak.");
    return false;
  }
  const header = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
