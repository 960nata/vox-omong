import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { BackgroundTaskRecord, TaskStatus } from "./types";
import { runReActLoop } from "./reactLoop";
import { planAutonomousTask } from "./planner";
import { runVisualCritic } from "./visualCritic";
import { addMessage } from "../storage";

const TASKS_DIR = path.join(process.cwd(), ".data", "agentic", "tasks");

// In-memory cache of running task controllers
const runningControllers = new Map<string, AbortController>();

/** Tugas "running"/"queued" tanpa worker hidup dan lama tidak diperbarui = terputus (server restart/crash). */
const STALE_MS = 3 * 60_000;
function reconcile(record: BackgroundTaskRecord): { record: BackgroundTaskRecord; changed: boolean } {
  const active = record.status === "running" || record.status === "queued";
  if (!active || runningControllers.has(record.id)) return { record, changed: false };
  if (Date.now() - new Date(record.updatedAt).getTime() < STALE_MS) return { record, changed: false };
  record.status = "failed";
  record.error = "Terputus: server berhenti atau restart saat tugas ini berjalan.";
  record.currentStepMessage = "Terputus sebelum selesai. Minta ulang untuk menjalankannya lagi.";
  record.logs.push(`[${new Date().toLocaleTimeString()}] Ditandai terputus (tidak ada worker yang hidup).`);
  return { record, changed: true };
}

/** Tulis hasil tugas ke percakapan asalnya, supaya user melihatnya tanpa harus menebak perintah cek status. */
async function deliver(task: BackgroundTaskRecord): Promise<void> {
  if (task.delivered || !task.conversationId) return;
  const ok = task.status === "completed";
  const head = ok ? "Tugas background selesai" : task.status === "cancelled" ? "Tugas background dibatalkan" : "Tugas background gagal";
  const body = task.result?.reply || task.error || task.currentStepMessage;
  try {
    await addMessage(task.conversationId, {
      role: "assistant",
      content: `**${head}:** ${task.task.slice(0, 140)}\n\n${body}`,
      artifact: task.result?.artifacts?.[0],
      artifacts: task.result?.artifacts && task.result.artifacts.length > 1 ? task.result.artifacts : undefined,
    });
    task.delivered = true;
    await saveTaskRecord(task);
  } catch {}
}

async function ensureDir() {
  await fs.mkdir(TASKS_DIR, { recursive: true });
}

function taskFilePath(id: string): string {
  return path.join(TASKS_DIR, `${id}.json`);
}

export async function saveTaskRecord(record: BackgroundTaskRecord): Promise<void> {
  await ensureDir();
  record.updatedAt = new Date().toISOString();
  await fs.writeFile(taskFilePath(record.id), JSON.stringify(record, null, 2), "utf-8");
}

export async function getBackgroundTask(id: string): Promise<BackgroundTaskRecord | null> {
  try {
    const raw = await fs.readFile(taskFilePath(id), "utf-8");
    const { record, changed } = reconcile(JSON.parse(raw) as BackgroundTaskRecord);
    if (changed) { await saveTaskRecord(record); await deliver(record); }
    return record;
  } catch {
    return null;
  }
}

export async function listBackgroundTasks(): Promise<BackgroundTaskRecord[]> {
  try {
    await ensureDir();
    const files = await fs.readdir(TASKS_DIR);
    const records: BackgroundTaskRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(TASKS_DIR, f), "utf-8");
        const { record, changed } = reconcile(JSON.parse(raw) as BackgroundTaskRecord);
        if (changed) { await saveTaskRecord(record); await deliver(record); }
        records.push(record);
      } catch {}
    }
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function cancelBackgroundTask(id: string): Promise<boolean> {
  const controller = runningControllers.get(id);
  if (controller) {
    controller.abort();
    runningControllers.delete(id);
  }
  const task = await getBackgroundTask(id);
  if (task && (task.status === "running" || task.status === "queued")) {
    task.status = "cancelled";
    task.currentStepMessage = "Tugas dibatalkan oleh pengguna.";
    await saveTaskRecord(task);
    await deliver(task);
    return true;
  }
  return false;
}

export async function createBackgroundTask(
  taskInstruction: string,
  opts: {
    mode?: "react" | "plan" | "critic";
    projectId?: string;
    conversationId?: string;
    apiKey?: string;
  } = {}
): Promise<BackgroundTaskRecord> {
  await ensureDir();
  const id = `task-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const mode = opts.mode || "react";
  const projectId = opts.projectId || "default-workspace";

  const record: BackgroundTaskRecord = {
    id,
    task: taskInstruction,
    mode,
    status: "queued",
    progressPercent: 5,
    currentStepMessage: "Tugas masuk antrean background worker...",
    logs: [`[${new Date().toLocaleTimeString()}] Tugas terdaftar: "${taskInstruction}"`],
    projectId,
    conversationId: opts.conversationId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveTaskRecord(record);

  // Trigger execution asynchronously (non-blocking)
  setImmediate(() => {
    void runTaskWorker(record, projectId, opts.apiKey, opts.conversationId);
  });

  return record;
}

async function runTaskWorker(
  task: BackgroundTaskRecord,
  projectId: string,
  apiKey?: string,
  conversationId?: string
) {
  const controller = new AbortController();
  runningControllers.set(task.id, controller);

  task.status = "running";
  task.progressPercent = 15;
  task.currentStepMessage = "Memulai eksekusi agen mandiri...";
  await saveTaskRecord(task);

  try {
    if (task.mode === "critic") {
      task.logs.push(`[${new Date().toLocaleTimeString()}] Menjalankan Visual & Code Self-Correction...`);
      task.progressPercent = 30;
      await saveTaskRecord(task);

      const criticRes = await runVisualCritic(projectId, {
        apiKey,
        onLog: (msg) => {
          task.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
          void saveTaskRecord(task);
        },
      });

      task.progressPercent = 100;
      task.status = "completed";
      task.currentStepMessage = criticRes.passed ? "Inspeksi visual lolos." : "Inspeksi selesai dengan beberapa catatan.";
      task.result = {
        reply: `### Ringkasan Inspeksi Visual\n${criticRes.critiqueSummary}\n\n- Masalah ditemukan: ${criticRes.issues.length}\n- Perbaikan diterapkan: ${criticRes.fixedIssues.join(", ") || "Tidak ada"}`,
        artifacts: [],
      };
      await saveTaskRecord(task);
      return;
    }

    if (task.mode === "plan") {
      task.logs.push(`[${new Date().toLocaleTimeString()}] Menganalisis & menyusun DAG plan...`);
      task.progressPercent = 40;
      await saveTaskRecord(task);

      const plan = await planAutonomousTask(task.task, { projectId, apiKey });
      task.progressPercent = 100;
      task.status = "completed";
      task.currentStepMessage = "Rencana tugas berhasil disusun.";
      task.result = {
        reply: `### Rencana Eksekusi (${plan.complexity})\n**Ringkasan**: ${plan.goalSummary}\n\n**Langkah-langkah**:\n${plan.steps.map((s, i) => `${i + 1}. **${s.title}** (${s.suggestedTool})\n   ${s.description}`).join("\n")}`,
        artifacts: [],
      };
      await saveTaskRecord(task);
      return;
    }

    // Default mode: "react"
    task.logs.push(`[${new Date().toLocaleTimeString()}] Memulai ReAct loop eksekutif...`);
    task.progressPercent = 25;
    await saveTaskRecord(task);

    const reactRes = await runReActLoop(task.task, {
      projectId,
      conversationId,
      apiKey,
      maxSteps: 12,
      signal: controller.signal,
      onStep: (step) => {
        task.progressPercent = Math.min(90, task.progressPercent + 10);
        task.currentStepMessage = `[Langkah ${step.stepNumber}] ${step.thought.slice(0, 80)}...`;
        task.logs.push(
          `[${new Date().toLocaleTimeString()}] [Step ${step.stepNumber}] Action: ${step.action} -> ${step.observation?.slice(0, 150) || "ok"}`
        );
        void saveTaskRecord(task);
      },
    });

    if (controller.signal.aborted) return; // sudah ditandai batal oleh cancelBackgroundTask
    task.progressPercent = 100;
    // "completed" hanya untuk hasil yang lolos verifikasi; selain itu gagal, dengan cerita jujurnya
    task.status = reactRes.success ? "completed" : "failed";
    task.currentStepMessage = reactRes.success ? "Tugas selesai dan terverifikasi." : "Belum tuntas. Lihat rinciannya.";
    if (!reactRes.success) task.error = "Hasil belum terverifikasi.";
    task.result = {
      reply: reactRes.finalAnswer,
      artifacts: reactRes.artifacts,
    };
    await saveTaskRecord(task);
  } catch (err) {
    task.status = "failed";
    task.error = (err as Error).message;
    task.currentStepMessage = `Gagal: ${task.error}`;
    task.logs.push(`[${new Date().toLocaleTimeString()}] ERROR: ${task.error}`);
    await saveTaskRecord(task);
  } finally {
    runningControllers.delete(task.id);
    const finalStatus = task.status as TaskStatus;
    if (finalStatus !== "running" && finalStatus !== "queued") await deliver(task);
  }
}
