/**
 * Pemicu routine. Dipanggil dari luar (loop interval, cron OS, atau Vercel Schedules) lewat
 * `POST /api/engine/routines` dengan `action: "tick"`, jadi tidak ada timer yang nyangkut di
 * proses serverless.
 *
 * Waktu tick terakhir disimpan di `.data/engine/scheduler-state.json`. Itulah yang membuat
 * kebijakan missed-run bisa bekerja setelah aplikasi mati beberapa jam.
 */

import { readDoc, writeDoc } from "./store";
import { dueRoutines, listRoutines, recordRoutineRun } from "./routines";
import { getWorkflow, runWorkflow } from "./workflow";
import type { Routine } from "./types";

const STATE = "scheduler-state";

interface SchedulerState {
  lastTickAt?: string;
}

export interface TickResult {
  ranAt: string;
  since: string;
  runs: {
    routineId: string;
    name: string;
    scheduledFor: string;
    missed: boolean;
    status: "done" | "error";
    detail: string;
  }[];
}

/** Dipasang oleh bootstrap supaya scheduler tidak perlu tahu isi runtime agent. */
let promptRunner: ((routine: Routine & { target: { kind: "agent" } }) => Promise<string>) | null = null;

export function setRoutinePromptRunner(
  runner: (routine: Routine & { target: { kind: "agent" } }) => Promise<string>
): void {
  promptRunner = runner;
}

async function runRoutine(routine: Routine): Promise<string> {
  if (routine.target.kind === "workflow") {
    const workflow = await getWorkflow(routine.target.workflowId);
    if (!workflow) throw new Error(`Workflow "${routine.target.workflowId}" sudah tidak ada.`);
    const run = await runWorkflow(workflow, { triggerFields: { routine: routine.name } });
    if (run.status === "error") throw new Error(run.error || "Workflow gagal.");
    return `Workflow "${workflow.name}" ${run.status} (run ${run.id}).`;
  }
  if (!promptRunner) throw new Error("Runner prompt routine belum dipasang.");
  return promptRunner(routine as Routine & { target: { kind: "agent" } });
}

/**
 * Jalankan semua routine yang jatuh tempo. Satu routine maksimal satu run per tick, walau
 * jadwal yang terlewat banyak — supaya agent tidak kebanjiran antrean.
 */
export async function tickRoutines(now: Date = new Date()): Promise<TickResult> {
  const state = await readDoc<SchedulerState>(STATE, {});
  const since = state.lastTickAt ? new Date(state.lastTickAt) : now;
  const routines = await listRoutines();
  const due = dueRoutines(routines, since, now);

  const runs: TickResult["runs"] = [];
  for (const item of due) {
    try {
      const detail = await runRoutine(item.routine);
      await recordRoutineRun(item.routine.id, "done", now);
      runs.push({
        routineId: item.routine.id,
        name: item.routine.name,
        scheduledFor: item.scheduledFor.toISOString(),
        missed: item.missed,
        status: "done",
        detail,
      });
    } catch (error) {
      await recordRoutineRun(item.routine.id, "error", now);
      runs.push({
        routineId: item.routine.id,
        name: item.routine.name,
        scheduledFor: item.scheduledFor.toISOString(),
        missed: item.missed,
        status: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await writeDoc<SchedulerState>(STATE, { lastTickAt: now.toISOString() });
  return { ranAt: now.toISOString(), since: since.toISOString(), runs };
}
