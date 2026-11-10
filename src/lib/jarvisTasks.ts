// Antrian tugas buat Jarvis yang dipanggil dari telpon WhatsApp (service Python jarvis-call).
// Disimpan di memori proses Next.js + log ke .data/jarvis-tasks.json.
// Kalau server Next.js restart, tugas yang lagi jalan ikut hilang (cukup buat pemakaian di laptop).

import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { buildWebsite, detectCodeIntent, hasGeneratedSite } from "@/lib/codeAgent";
import { detectSkill, runSkill } from "@/lib/skillAgent";

export type TaskStatus = "queued" | "running" | "done" | "error";

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
const g = globalThis as unknown as { __jarvisTasks?: Store };
const store: Store = (g.__jarvisTasks ??= new Map());

const LOG_FILE = path.join(process.cwd(), ".data", "jarvis-tasks.json");

function touch(t: JarvisTask, patch: Partial<JarvisTask>) {
  Object.assign(t, patch, { updatedAt: new Date().toISOString() });
}

async function persist() {
  const all = [...store.values()].slice(-50);
  await fs.writeFile(LOG_FILE, JSON.stringify(all, null, 2)).catch(() => {});
}

function sanitizeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "default-workspace"
  );
}

export function getTask(id: string) {
  return store.get(id) ?? null;
}

export function listTasks() {
  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function startTask(instruction: string, projectId?: string, source = "api"): JarvisTask {
  const now = new Date().toISOString();
  const task: JarvisTask = {
    id: randomUUID().slice(0, 8),
    instruction,
    projectId: sanitizeSlug(projectId || "default-workspace"),
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
  void run(task); // jalan di background, request langsung balik
  return task;
}

async function run(task: JarvisTask) {
  touch(task, { status: "running", step: "Menyiapkan", progress: 5 });
  try {
    const siteExists = await hasGeneratedSite(task.projectId);
    const intent = detectCodeIntent(task.instruction, siteExists);
    const skill = intent ? null : detectSkill(task.instruction);

    if (skill) {
      // Slide / invoice / tabel / dokumen: dirender di app, jadi lewat telpon cukup ringkasannya
      touch(task, { step: "Menyusun dokumen", progress: 30 });
      const out = await runSkill(skill, task.instruction);
      touch(task, {
        status: "done",
        progress: 100,
        step: "Selesai",
        summary: `${out.artifact.title}. ${out.reply} Buka app VOX·AI untuk melihat dan mengunduhnya.`,
      });
      return;
    }

    // Website sungguhan: tiap giliran tim AI (arsitek, aset, developer, reviewer, ...) jadi pembaruan progres
    let turns = 0;
    const site = await buildWebsite({
      request: task.instruction,
      mode: intent ?? "create",
      projectId: task.projectId,
      onProgress: (turn) => {
        turns++;
        touch(task, { step: `${turn.agent}: ${turn.note.slice(0, 90)}`, progress: Math.min(92, 8 + turns * 14) });
      },
    });
    const warn = site.warnings.length ? ` Perhatian: ${site.warnings.join(" ")}` : "";
    touch(task, {
      status: "done",
      progress: 100,
      step: "Selesai",
      files: ["index.html"],
      components: [...new Set(site.meeting.map((m) => m.agent))],
      summary: `${site.title}. ${site.summary} (${site.lines} baris, skor review ${site.score ?? "-"}/10).${warn}`.trim(),
      previewUrl: site.previewUrl,
    });
  } catch (e) {
    touch(task, {
      status: "error",
      step: "Gagal",
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await persist();
  }
}

export function checkAuth(req: Request): boolean {
  const secret = process.env.JARVIS_API_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
