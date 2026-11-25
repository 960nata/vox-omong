/**
 * Runner workflow multi-step.
 *
 * Yang didukung (adopsi konsep OpenBot, lihat docs/openbot-breakdown.md §A):
 * - graf step dengan `needs`, plus dependensi implisit dari placeholder `{{step.field}}`
 * - urutan topologis + step yang saling bebas jalan paralel
 * - `batch` 1–4 hasil paralel untuk satu step
 * - `resume` / "Run from this step": hasil step lama dipakai ulang, tidak dijalankan ulang
 * - step `approval` menghentikan run dengan status `waiting` sampai dijawab
 * - pause, export, dan import workflow
 */

import { fillTemplate, referencedSteps, TemplateScope } from "./template";
import { newId, readCollection, updateCollection } from "./store";
import type {
  RunStatus,
  StepResult,
  Workflow,
  WorkflowRun,
  WorkflowStep,
  WorkflowTrigger,
} from "./types";

const WORKFLOWS = "workflows";
const RUNS = "workflow-runs";
const MAX_BATCH = 4;

export class WorkflowError extends Error {}

// ───────────────────────────── validasi ─────────────────────────────

/** Dependensi efektif sebuah step: `needs` eksplisit + step yang dirujuk placeholder-nya. */
export function stepDependencies(step: WorkflowStep, known: Set<string>): string[] {
  const deps = new Set(step.needs ?? []);
  for (const ref of referencedSteps(step.input)) {
    if (ref !== "trigger" && ref !== step.id && known.has(ref)) deps.add(ref);
  }
  return [...deps];
}

/**
 * Urutan jalan step, dikelompokkan per "gelombang": semua step dalam satu gelombang
 * boleh jalan paralel karena dependensinya sudah selesai di gelombang sebelumnya.
 * Melempar `WorkflowError` kalau ada siklus, referensi ke step yang tidak ada, atau ID ganda.
 */
export function planWorkflow(workflow: Workflow): WorkflowStep[][] {
  const steps = workflow.steps;
  const ids = new Set<string>();
  for (const step of steps) {
    if (!step.id) throw new WorkflowError("Ada step tanpa id.");
    if (ids.has(step.id)) throw new WorkflowError(`Step "${step.id}" dobel.`);
    ids.add(step.id);
  }

  const deps = new Map<string, string[]>();
  for (const step of steps) {
    const resolved = stepDependencies(step, ids);
    for (const need of step.needs ?? []) {
      if (!ids.has(need)) throw new WorkflowError(`Step "${step.id}" butuh "${need}" yang tidak ada.`);
    }
    deps.set(step.id, resolved);
  }

  const waves: WorkflowStep[][] = [];
  const done = new Set<string>();
  let remaining = steps.slice();
  while (remaining.length) {
    const ready = remaining.filter((step) => deps.get(step.id)!.every((d) => done.has(d)));
    if (!ready.length) {
      throw new WorkflowError(
        `Ada ketergantungan melingkar di: ${remaining.map((s) => s.id).join(", ")}.`
      );
    }
    waves.push(ready);
    ready.forEach((step) => done.add(step.id));
    const readyIds = new Set(ready.map((s) => s.id));
    remaining = remaining.filter((step) => !readyIds.has(step.id));
  }
  return waves;
}

// ───────────────────────────── handler step ─────────────────────────────

export interface StepContext {
  workflow: Workflow;
  run: WorkflowRun;
  step: WorkflowStep;
  /** Input setelah placeholder diisi. */
  input: Record<string, unknown>;
  /** Index hasil saat `batch > 1` (0-based). */
  batchIndex: number;
  signal?: AbortSignal;
}

/** Hasil handler. `waiting: true` → run berhenti dan menunggu orang. */
export type StepRunner = (
  ctx: StepContext
) => Promise<Record<string, unknown> | { waiting: true; block?: unknown }>;

const runners = new Map<string, StepRunner>();

/** Daftarkan handler untuk satu jenis step; menimpa handler bawaan dengan nama sama. */
export function registerStepRunner(kind: string, runner: StepRunner): void {
  runners.set(kind, runner);
}

function isWaiting(value: unknown): value is { waiting: true } {
  return !!value && typeof value === "object" && (value as { waiting?: unknown }).waiting === true;
}

/** Handler bawaan. `agent` sengaja belum terpasang: didaftarkan dari luar lewat `registerStepRunner`. */
registerStepRunner("transform", async ({ input }) => {
  // `transform` cuma meneruskan input yang sudah terisi — gunanya menamai & merapikan field.
  return { ...input };
});

registerStepRunner("notification", async ({ input }) => {
  const text = typeof input.text === "string" ? input.text : JSON.stringify(input);
  return { notified: true, text };
});

registerStepRunner("approval", async () => ({ waiting: true as const }));

registerStepRunner("http", async ({ input, signal }) => {
  const url = typeof input.url === "string" ? input.url : "";
  if (!url) throw new WorkflowError("Step http butuh field `url`.");
  const method = typeof input.method === "string" ? input.method.toUpperCase() : "GET";
  const headers = (input.headers as Record<string, string> | undefined) ?? {};
  const hasBody = method !== "GET" && method !== "HEAD" && input.body !== undefined;
  const response = await fetch(url, {
    method,
    headers: hasBody ? { "content-type": "application/json", ...headers } : headers,
    body: hasBody ? JSON.stringify(input.body) : undefined,
    signal,
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // biarkan sebagai teks mentah
  }
  return { status: response.status, ok: response.ok, body: parsed };
});

// ───────────────────────────── CRUD workflow ─────────────────────────────

export function listWorkflows(): Promise<Workflow[]> {
  return readCollection<Workflow>(WORKFLOWS);
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const all = await listWorkflows();
  return all.find((w) => w.id === id) ?? null;
}

export function saveWorkflow(input: {
  id?: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  trigger?: WorkflowTrigger;
  paused?: boolean;
}): Promise<Workflow> {
  const now = new Date().toISOString();
  return updateCollection<Workflow, Workflow>(WORKFLOWS, (items) => {
    const existing = input.id ? items.find((w) => w.id === input.id) : undefined;
    const workflow: Workflow = {
      id: existing?.id ?? input.id ?? newId("wf"),
      name: input.name,
      description: input.description,
      steps: input.steps,
      trigger: input.trigger ?? existing?.trigger ?? { kind: "manual" },
      paused: input.paused ?? existing?.paused ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    planWorkflow(workflow); // tolak workflow tak valid sebelum disimpan
    if (existing) items[items.indexOf(existing)] = workflow;
    else items.push(workflow);
    return workflow;
  });
}

export function deleteWorkflow(id: string): Promise<boolean> {
  return updateCollection<Workflow, boolean>(WORKFLOWS, (items) => {
    const index = items.findIndex((w) => w.id === id);
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
  });
}

export function setWorkflowPaused(id: string, paused: boolean): Promise<Workflow | null> {
  return updateCollection<Workflow, Workflow | null>(WORKFLOWS, (items) => {
    const workflow = items.find((w) => w.id === id);
    if (!workflow) return null;
    workflow.paused = paused;
    workflow.updatedAt = new Date().toISOString();
    return workflow;
  });
}

// ───────────────────────────── export / import ─────────────────────────────

export interface WorkflowBundle {
  kind: "vox.workflow";
  version: 1;
  exportedAt: string;
  workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">;
}

export function exportWorkflow(workflow: Workflow): WorkflowBundle {
  return {
    kind: "vox.workflow",
    version: 1,
    exportedAt: new Date().toISOString(),
    workflow: {
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps,
      trigger: workflow.trigger,
      paused: workflow.paused,
    },
  };
}

/** Terima bundle hasil `exportWorkflow` (dari komputer lain) dan simpan sebagai workflow baru. */
export async function importWorkflow(bundle: unknown): Promise<Workflow> {
  const data = bundle as WorkflowBundle;
  if (!data || data.kind !== "vox.workflow" || data.version !== 1) {
    throw new WorkflowError("Berkas ini bukan bundle workflow VOX versi 1.");
  }
  const wf = data.workflow;
  if (!wf?.name || !Array.isArray(wf.steps)) throw new WorkflowError("Bundle workflow tidak lengkap.");
  return saveWorkflow({
    name: wf.name,
    description: wf.description,
    steps: wf.steps,
    trigger: wf.trigger ?? { kind: "manual" },
    paused: wf.paused,
  });
}

// ───────────────────────────── eksekusi ─────────────────────────────

export interface RunOptions {
  triggerFields?: Record<string, unknown>;
  /** Jalankan ulang dari step ini; hasil step sebelumnya dipakai ulang. */
  fromStep?: string;
  /** Hasil run sebelumnya yang dipakai ulang (untuk `fromStep` / lanjut dari `waiting`). */
  previous?: WorkflowRun;
  signal?: AbortSignal;
  /** Dipanggil tiap kali satu step selesai, buat progress di UI. */
  onStep?: (result: StepResult) => void;
}

function scopeOf(run: WorkflowRun): TemplateScope {
  const scope: TemplateScope = { trigger: run.triggerFields };
  for (const [stepId, result] of Object.entries(run.results)) {
    if (result.status === "done") scope[stepId] = result.output ?? {};
  }
  return scope;
}

/** Step mana yang hasilnya tetap dipakai saat "Run from this step". */
function reusableSteps(workflow: Workflow, fromStep: string): Set<string> {
  const waves = planWorkflow(workflow);
  const order: string[] = [];
  waves.forEach((wave) => wave.forEach((step) => order.push(step.id)));
  const cut = order.indexOf(fromStep);
  if (cut < 0) throw new WorkflowError(`Step "${fromStep}" tidak ada di workflow ini.`);

  // Step setelah titik potong — dan apa pun yang bergantung padanya — harus dihitung lagi.
  const stale = new Set(order.slice(cut));
  const ids = new Set(workflow.steps.map((s) => s.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of workflow.steps) {
      if (stale.has(step.id)) continue;
      if (stepDependencies(step, ids).some((d) => stale.has(d))) {
        stale.add(step.id);
        changed = true;
      }
    }
  }
  return new Set(order.filter((id) => !stale.has(id)));
}

async function runOneStep(
  workflow: Workflow,
  run: WorkflowRun,
  step: WorkflowStep,
  signal?: AbortSignal
): Promise<StepResult> {
  const runner = runners.get(step.kind);
  const startedAt = new Date().toISOString();
  if (!runner) {
    return {
      stepId: step.id,
      status: "error",
      error: `Belum ada handler untuk step jenis "${step.kind}".`,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const input = fillTemplate(step.input, scopeOf(run)) as Record<string, unknown>;
  const batch = Math.min(MAX_BATCH, Math.max(1, Math.trunc(step.batch ?? 1)));

  try {
    const outputs = await Promise.all(
      Array.from({ length: batch }, (_unused, batchIndex) =>
        runner({ workflow, run, step, input, batchIndex, signal })
      )
    );
    if (outputs.some(isWaiting)) {
      return { stepId: step.id, status: "waiting", resolvedInput: input, startedAt };
    }
    const typed = outputs as Record<string, unknown>[];
    return {
      stepId: step.id,
      status: "done",
      output: typed[0],
      batchOutputs: batch > 1 ? typed : undefined,
      resolvedInput: input,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      stepId: step.id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      resolvedInput: input,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}

/**
 * Jalankan workflow sampai selesai, gagal, atau berhenti menunggu orang.
 * Workflow yang di-pause ditolak, kecuali run-nya dilanjutkan dari `previous`.
 */
export async function runWorkflow(workflow: Workflow, options: RunOptions = {}): Promise<WorkflowRun> {
  if (workflow.paused && !options.previous) {
    throw new WorkflowError(`Workflow "${workflow.name}" sedang di-pause.`);
  }
  const waves = planWorkflow(workflow);
  const reuse = options.fromStep ? reusableSteps(workflow, options.fromStep) : null;

  const run: WorkflowRun = {
    id: newId("run"),
    workflowId: workflow.id,
    status: "running",
    results: {},
    triggerFields: options.triggerFields ?? workflow.trigger.fields ?? {},
    startedAt: new Date().toISOString(),
  };

  if (options.previous) {
    run.triggerFields = { ...options.previous.triggerFields, ...run.triggerFields };
    for (const [stepId, result] of Object.entries(options.previous.results)) {
      const keep = reuse ? reuse.has(stepId) : result.status === "done";
      if (keep && result.status === "done") run.results[stepId] = result;
    }
  }

  let status: RunStatus = "done";
  outer: for (const wave of waves) {
    const todo = wave.filter((step) => !run.results[step.id]);
    for (const step of wave) {
      if (step.disabled && !run.results[step.id]) {
        run.results[step.id] = { stepId: step.id, status: "skipped" };
        options.onStep?.(run.results[step.id]);
      }
    }
    const active = todo.filter((step) => !step.disabled);
    if (!active.length) continue;

    const results = await Promise.all(
      active.map((step) => runOneStep(workflow, run, step, options.signal))
    );
    for (const result of results) {
      run.results[result.stepId] = result;
      options.onStep?.(result);
    }
    if (options.signal?.aborted) {
      status = "cancelled";
      break;
    }
    if (results.some((r) => r.status === "error")) {
      status = "error";
      run.error = results.find((r) => r.status === "error")?.error;
      break;
    }
    if (results.some((r) => r.status === "waiting")) {
      status = "waiting";
      break outer;
    }
  }

  run.status = status;
  if (status !== "waiting") run.finishedAt = new Date().toISOString();
  await updateCollection<WorkflowRun, void>(RUNS, (items) => {
    items.push(run);
    // Simpan 200 run terakhir saja supaya berkas tidak tumbuh tanpa batas.
    if (items.length > 200) items.splice(0, items.length - 200);
  });
  return run;
}

export function listRuns(workflowId?: string): Promise<WorkflowRun[]> {
  return readCollection<WorkflowRun>(RUNS).then((items) =>
    (workflowId ? items.filter((r) => r.workflowId === workflowId) : items).reverse()
  );
}
