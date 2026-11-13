import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { BackgroundTaskRecord, TaskStatus } from "./types";
import { runReActLoop } from "./reactLoop";
import { planAutonomousTask } from "./planner";
import { runVisualCritic } from "./visualCritic";

const TASKS_DIR = path.join(process.cwd(), ".data", "agentic", "tasks");

// In-memory cache of running task controllers
const runningControllers = new Map<string, AbortController>();

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
    return JSON.parse(raw) as BackgroundTaskRecord;
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
        records.push(JSON.parse(raw));
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
      maxSteps: 8,
      onStep: (step) => {
        task.progressPercent = Math.min(90, task.progressPercent + 10);
        task.currentStepMessage = `[Langkah ${step.stepNumber}] ${step.thought.slice(0, 80)}...`;
        task.logs.push(
          `[${new Date().toLocaleTimeString()}] [Step ${step.stepNumber}] Action: ${step.action} -> ${step.observation?.slice(0, 150) || "ok"}`
        );
        void saveTaskRecord(task);
      },
    });

    task.progressPercent = 100;
    task.status = "completed";
    task.currentStepMessage = "Tugas selesai.";
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
  }
}
