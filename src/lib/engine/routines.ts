/**
 * Routine: tugas terjadwal (cron atau sekali jalan) untuk agent maupun workflow.
 *
 * Adopsi konsep OpenBot (docs/openbot-breakdown.md §B):
 * - cron per-timezone dan routine sekali jalan
 * - kebijakan missed-run: `skip` (lewati jadwal yang terlewat saat app mati) atau
 *   `run-once-on-start` (jalankan sekali begitu app hidup lagi)
 * - enable/disable, catat `lastRunAt`/`lastStatus`, dan tujuan pengiriman hasil
 *
 * Modul ini sengaja tidak memegang timer sendiri: `dueRoutines()` dipanggil oleh pemicu luar
 * (loop `setInterval`, cron OS, atau Vercel Schedules) supaya tetap aman di serverless.
 */

import { nextCronRun, missedRuns } from "./cron";
import { newId, readCollection, updateCollection } from "./store";
import type { MissedRunPolicy, Routine } from "./types";

const ROUTINES = "routines";
export const DEFAULT_TIMEZONE = process.env.VOX_TIMEZONE || "Asia/Jakarta";

export class RoutineError extends Error {}

export function listRoutines(): Promise<Routine[]> {
  return readCollection<Routine>(ROUTINES);
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const all = await listRoutines();
  return all.find((r) => r.id === id) ?? null;
}

export async function saveRoutine(input: {
  id?: string;
  name: string;
  target: Routine["target"];
  cron?: string | null;
  runAt?: string;
  timezone?: string;
  enabled?: boolean;
  missedRunPolicy?: MissedRunPolicy;
  deliverTo?: Routine["deliverTo"];
}): Promise<Routine> {
  if (!input.cron && !input.runAt) {
    throw new RoutineError("Routine butuh `cron` atau `runAt` (sekali jalan).");
  }
  const timezone = input.timezone || DEFAULT_TIMEZONE;
  if (input.cron) nextCronRun(input.cron, timezone); // validasi cron & timezone lebih awal
  if (input.runAt && Number.isNaN(Date.parse(input.runAt))) {
    throw new RoutineError(`Waktu "${input.runAt}" bukan tanggal ISO yang valid.`);
  }

  const now = new Date().toISOString();
  return updateCollection<Routine, Routine>(ROUTINES, (items) => {
    const existing = input.id ? items.find((r) => r.id === input.id) : undefined;
    const routine: Routine = {
      id: existing?.id ?? input.id ?? newId("rt"),
      name: input.name,
      target: input.target,
      cron: input.cron ?? null,
      runAt: input.runAt,
      timezone,
      enabled: input.enabled ?? existing?.enabled ?? true,
      missedRunPolicy: input.missedRunPolicy ?? existing?.missedRunPolicy ?? "skip",
      deliverTo: input.deliverTo ?? existing?.deliverTo,
      lastRunAt: existing?.lastRunAt,
      lastStatus: existing?.lastStatus,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) items[items.indexOf(existing)] = routine;
    else items.push(routine);
    return routine;
  });
}

export function deleteRoutine(id: string): Promise<boolean> {
  return updateCollection<Routine, boolean>(ROUTINES, (items) => {
    const index = items.findIndex((r) => r.id === id);
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
  });
}

export function setRoutineEnabled(id: string, enabled: boolean): Promise<Routine | null> {
  return updateCollection<Routine, Routine | null>(ROUTINES, (items) => {
    const routine = items.find((r) => r.id === id);
    if (!routine) return null;
    routine.enabled = enabled;
    routine.updatedAt = new Date().toISOString();
    return routine;
  });
}

/** Jadwal berikutnya sebuah routine, atau `null` kalau mati / sekali-jalan yang sudah lewat. */
export function nextRunOf(routine: Routine, after: Date = new Date()): Date | null {
  if (!routine.enabled) return null;
  if (routine.cron) return nextCronRun(routine.cron, routine.timezone, after);
  if (!routine.runAt) return null;
  const at = new Date(routine.runAt);
  if (routine.lastRunAt) return null; // sekali jalan dan sudah dijalankan
  return at.getTime() > after.getTime() ? at : null;
}

export interface DueRoutine {
  routine: Routine;
  /** Waktu jadwal yang memicu, bukan waktu sekarang. */
  scheduledFor: Date;
  /** `true` kalau jadwalnya sudah lewat jauh — biasanya karena aplikasi mati saat itu. */
  missed: boolean;
}

/** Keterlambatan yang masih dianggap normal (tick tidak pernah pas di detik yang sama). */
export const GRACE_MS = 2 * 60_000;
/** Sejauh mana ke belakang jadwal dicari kalau routine belum pernah jalan. */
const LOOKBACK_MS = 24 * 3_600_000;

/**
 * Routine yang harus dijalankan sekarang.
 *
 * Satu jadwal dianggap **terlewat** kalau waktunya sudah lebih dari `GRACE_MS` lalu — itu yang
 * terjadi saat aplikasi mati melewati jadwalnya. Kebijakan `skip` mengabaikan jadwal terlewat,
 * `run-once-on-start` menjalankannya satu kali.
 *
 * `since` dipakai sebagai batas bawah pencarian untuk routine yang belum pernah jalan, bersama
 * jendela 24 jam, supaya tick pertama tidak menggali jadwal dari tahun lalu.
 */
export function dueRoutines(
  routines: Routine[],
  since: Date,
  now: Date = new Date(),
  graceMs: number = GRACE_MS
): DueRoutine[] {
  const due: DueRoutine[] = [];
  const floor = Math.min(since.getTime(), now.getTime()) - LOOKBACK_MS;

  for (const routine of routines) {
    if (!routine.enabled) continue;

    if (!routine.cron) {
      if (!routine.runAt || routine.lastRunAt) continue;
      const at = new Date(routine.runAt);
      if (at.getTime() > now.getTime()) continue;
      const missed = now.getTime() - at.getTime() > graceMs;
      if (missed && routine.missedRunPolicy === "skip") continue;
      due.push({ routine, scheduledFor: at, missed });
      continue;
    }

    const base = new Date(
      routine.lastRunAt ? Date.parse(routine.lastRunAt) : Math.max(floor, now.getTime() - LOOKBACK_MS)
    );
    const hits = missedRuns(routine.cron, routine.timezone, base, now);
    if (!hits.length) continue;
    // Selalu satu run saja walau banyak jadwal terlewat, biar agent tidak dibanjiri antrean.
    const last = hits[hits.length - 1];
    const missed = now.getTime() - last.getTime() > graceMs;
    if (missed && routine.missedRunPolicy === "skip") continue;
    due.push({ routine, scheduledFor: last, missed });
  }
  return due;
}

/** Catat hasil satu run ke routine-nya. */
export function recordRoutineRun(
  id: string,
  status: NonNullable<Routine["lastStatus"]>,
  at: Date = new Date()
): Promise<Routine | null> {
  return updateCollection<Routine, Routine | null>(ROUTINES, (items) => {
    const routine = items.find((r) => r.id === id);
    if (!routine) return null;
    routine.lastRunAt = at.toISOString();
    routine.lastStatus = status;
    routine.updatedAt = new Date().toISOString();
    return routine;
  });
}
