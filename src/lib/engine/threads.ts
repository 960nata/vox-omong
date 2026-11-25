/**
 * Thread agent: beberapa tugas satu agent jalan paralel dengan batas konkurensi.
 *
 * Adopsi konsep OpenBot (docs/openbot-breakdown.md §C):
 * - tiap thread punya progress, hasil, dan tombol stop sendiri
 * - batas "tasks at once" per agent; sisanya mengantre
 * - `side-question`: jawaban tidak masuk konteks chat utama
 * - thread bisa berhenti di status `needs-person` sambil menunggu jawaban UI block
 *
 * Eksekutor-nya dipasang dari luar (`setThreadExecutor`) supaya modul ini tetap bisa diuji
 * tanpa menarik seluruh runtime agent.
 */

import fs from "fs/promises";
import path from "path";
import { engineDir, newId } from "./store";
import type { AgentThread, ThreadStatus, UiBlock, UiBlockAnswer } from "./types";

const LOG_FILE = () => path.join(engineDir(), "threads.json");
const DEFAULT_CONCURRENCY = Math.max(1, Number(process.env.VOX_THREADS_AT_ONCE) || 2);
const MAX_KEPT = 200;

export interface ThreadContext {
  thread: AgentThread;
  /** Perbarui progress & langkah yang sedang jalan. */
  update: (patch: { progress?: number; step?: string }) => void;
  /** Minta jawaban orang; thread jadi `needs-person` sampai `answerThread` dipanggil. */
  ask: (block: UiBlock) => Promise<UiBlockAnswer>;
  signal: AbortSignal;
}

export type ThreadExecutor = (ctx: ThreadContext) => Promise<string>;

interface ThreadRuntime {
  thread: AgentThread;
  controller: AbortController;
  resolveAnswer?: (answer: UiBlockAnswer) => void;
}

interface ThreadState {
  runtimes: Map<string, ThreadRuntime>;
  queues: Map<string, string[]>;
  limits: Map<string, number>;
  executor?: ThreadExecutor;
}

const g = globalThis as unknown as { __voxThreads?: ThreadState };
const state: ThreadState = (g.__voxThreads ??= {
  runtimes: new Map(),
  queues: new Map(),
  limits: new Map(),
});

export class ThreadError extends Error {}

/** Pasang eksekutor yang benar-benar menjalankan prompt (dipanggil sekali saat boot). */
export function setThreadExecutor(executor: ThreadExecutor): void {
  state.executor = executor;
}

/** Batas thread yang jalan bersamaan untuk satu agent. */
export function setConcurrency(agent: string, limit: number): void {
  state.limits.set(agent, Math.max(1, Math.trunc(limit)));
}

export function concurrencyOf(agent: string): number {
  return state.limits.get(agent) ?? DEFAULT_CONCURRENCY;
}

function touch(thread: AgentThread, patch: Partial<AgentThread>): void {
  Object.assign(thread, patch, { updatedAt: new Date().toISOString() });
}

async function persist(): Promise<void> {
  const all = listThreads().slice(0, MAX_KEPT);
  try {
    await fs.mkdir(engineDir(), { recursive: true });
    await fs.writeFile(LOG_FILE(), JSON.stringify(all, null, 2), "utf-8");
  } catch {
    // log thread bersifat best-effort; kegagalan tulis tidak boleh menjatuhkan run
  }
}

export function listThreads(filter?: { agent?: string; status?: ThreadStatus }): AgentThread[] {
  let all = [...state.runtimes.values()].map((r) => r.thread);
  if (filter?.agent) all = all.filter((t) => t.agent === filter.agent);
  if (filter?.status) all = all.filter((t) => t.status === filter.status);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getThread(id: string): AgentThread | null {
  return state.runtimes.get(id)?.thread ?? null;
}

/** Jumlah thread yang menunggu jawaban orang — dipakai buat badge di tab Threads. */
export function waitingCount(agent?: string): number {
  return listThreads({ agent }).filter((t) => t.status === "needs-person").length;
}

function runningCount(agent: string): number {
  return listThreads({ agent }).filter((t) => t.status === "running").length;
}

function pump(agent: string): void {
  const queue = state.queues.get(agent);
  if (!queue?.length) return;
  while (queue.length && runningCount(agent) < concurrencyOf(agent)) {
    const id = queue.shift()!;
    const runtime = state.runtimes.get(id);
    if (!runtime || runtime.thread.status !== "queued") continue;
    void execute(runtime);
  }
}

async function execute(runtime: ThreadRuntime): Promise<void> {
  const { thread } = runtime;
  const executor = state.executor;
  if (!executor) {
    touch(thread, { status: "error", error: "Eksekutor thread belum dipasang.", progress: 100 });
    await persist();
    return;
  }

  touch(thread, { status: "running", step: "Mulai", progress: 5 });
  await persist();

  try {
    const result = await executor({
      thread,
      update: (patch) => touch(thread, patch),
      ask: (block) =>
        new Promise<UiBlockAnswer>((resolve) => {
          runtime.resolveAnswer = resolve;
          touch(thread, { status: "needs-person", pending: block });
          void persist();
        }),
      signal: runtime.controller.signal,
    });
    if (runtime.controller.signal.aborted) touch(thread, { status: "cancelled", progress: 100 });
    else touch(thread, { status: "done", progress: 100, step: "Selesai", result, pending: undefined });
  } catch (error) {
    touch(thread, {
      status: runtime.controller.signal.aborted ? "cancelled" : "error",
      progress: 100,
      error: error instanceof Error ? error.message : String(error),
      pending: undefined,
    });
  }
  await persist();
  pump(thread.agent);
}

/** Buat thread baru. Jalan langsung kalau slot agent masih ada, kalau tidak mengantre. */
export async function startThread(input: {
  agent: string;
  prompt: string;
  kind?: AgentThread["kind"];
}): Promise<AgentThread> {
  const now = new Date().toISOString();
  const thread: AgentThread = {
    id: newId("th"),
    agent: input.agent,
    kind: input.kind ?? "task",
    prompt: input.prompt,
    status: "queued",
    progress: 0,
    step: "Menunggu",
    createdAt: now,
    updatedAt: now,
  };
  state.runtimes.set(thread.id, { thread, controller: new AbortController() });
  const queue = state.queues.get(input.agent) ?? [];
  queue.push(thread.id);
  state.queues.set(input.agent, queue);
  await persist();
  pump(input.agent);
  return thread;
}

/** Jawab UI block yang sedang ditunggu sebuah thread. */
export function answerThread(id: string, answer: UiBlockAnswer): AgentThread | null {
  const runtime = state.runtimes.get(id);
  if (!runtime) return null;
  if (runtime.thread.status !== "needs-person" || !runtime.resolveAnswer) {
    throw new ThreadError("Thread ini tidak sedang menunggu jawaban.");
  }
  const resolve = runtime.resolveAnswer;
  runtime.resolveAnswer = undefined;
  touch(runtime.thread, { status: "running", pending: undefined });
  resolve(answer);
  return runtime.thread;
}

/** Hentikan thread. Pembatalan kooperatif: eksekutor memeriksa `signal`. */
export function stopThread(id: string): AgentThread | null {
  const runtime = state.runtimes.get(id);
  if (!runtime) return null;
  const { thread } = runtime;
  if (thread.status === "done" || thread.status === "error" || thread.status === "cancelled") return thread;
  runtime.controller.abort();
  if (thread.status === "queued") {
    const queue = state.queues.get(thread.agent);
    if (queue) state.queues.set(thread.agent, queue.filter((qid) => qid !== id));
    touch(thread, { status: "cancelled", progress: 100, step: "Dibatalkan" });
  } else {
    touch(thread, { step: "Menghentikan…" });
  }
  runtime.resolveAnswer?.({ blockId: thread.pending?.id ?? "", skipped: true });
  runtime.resolveAnswer = undefined;
  void persist();
  return thread;
}

/** Buang thread yang sudah selesai dari memori (dipakai di tes dan saat bersih-bersih). */
export function clearFinishedThreads(): number {
  let removed = 0;
  for (const [id, runtime] of [...state.runtimes.entries()]) {
    const { status } = runtime.thread;
    if (status === "done" || status === "error" || status === "cancelled") {
      state.runtimes.delete(id);
      removed++;
    }
  }
  return removed;
}
