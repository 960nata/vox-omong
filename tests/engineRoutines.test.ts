import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Routine } from "@/lib/engine/types";

let routines: typeof import("@/lib/engine/routines");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vox-engine-rt-"));
  process.env.VOX_ENGINE_DIR = tmpDir;
  routines = await import("@/lib/engine/routines");
});

afterAll(async () => {
  delete process.env.VOX_ENGINE_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function routine(patch: Partial<Routine> = {}): Routine {
  const now = new Date().toISOString();
  return {
    id: "rt-1",
    name: "Laporan pagi",
    target: { kind: "agent", agent: "toko-baju", prompt: "Ringkas penjualan semalam" },
    cron: "0 7 * * *",
    timezone: "Asia/Jakarta",
    enabled: true,
    missedRunPolicy: "skip",
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

describe("simpan routine", () => {
  it("menolak routine tanpa cron maupun runAt", async () => {
    await expect(
      routines.saveRoutine({ name: "Kosong", target: routine().target })
    ).rejects.toThrow(routines.RoutineError);
  });

  it("menolak cron yang tidak valid sebelum disimpan", async () => {
    await expect(
      routines.saveRoutine({ name: "Ngawur", target: routine().target, cron: "tiap pagi" })
    ).rejects.toThrow();
    expect(await routines.listRoutines()).toHaveLength(0);
  });

  it("memakai timezone bawaan dan menghitung jadwal berikutnya", async () => {
    const saved = await routines.saveRoutine({
      name: "Pagi",
      target: routine().target,
      cron: "0 7 * * *",
    });
    expect(saved.timezone).toBe(routines.DEFAULT_TIMEZONE);
    expect(routines.nextRunOf(saved)).toBeInstanceOf(Date);
  });
});

describe("routine yang jatuh tempo", () => {
  const now = new Date("2026-11-25T01:00:00Z"); // 08:00 WIB

  it("tidak menjalankan routine yang dimatikan", () => {
    const due = routines.dueRoutines(
      [routine({ enabled: false })],
      new Date("2026-11-25T00:30:00Z"),
      now
    );
    expect(due).toHaveLength(0);
  });

  it("menjalankan jadwal yang baru lewat dan tidak menandainya terlewat", () => {
    // 07:00 WIB = 00:00 UTC; tick-nya 30 detik setelah jadwal, masih di dalam grace.
    const due = routines.dueRoutines(
      [routine()],
      new Date("2026-11-24T23:50:00Z"),
      new Date("2026-11-25T00:00:30Z")
    );
    expect(due).toHaveLength(1);
    expect(due[0].missed).toBe(false);
    expect(due[0].scheduledFor.toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("melewati jadwal yang terlewat saat kebijakannya `skip`", () => {
    const since = new Date("2026-11-25T00:30:00Z"); // app baru hidup setengah jam setelah jadwal
    expect(routines.dueRoutines([routine()], since, now)).toHaveLength(0);
  });

  it("menjalankan sekali kalau kebijakannya `run-once-on-start`", () => {
    const due = routines.dueRoutines(
      [routine({ missedRunPolicy: "run-once-on-start" })],
      new Date("2026-11-25T00:30:00Z"),
      now
    );
    expect(due).toHaveLength(1);
    expect(due[0].missed).toBe(true);
  });

  it("banyak jadwal terlewat tetap jadi satu run saja", () => {
    const due = routines.dueRoutines(
      [routine({ cron: "0 * * * *", missedRunPolicy: "run-once-on-start" })],
      new Date("2026-11-24T20:00:00Z"),
      now
    );
    expect(due).toHaveLength(1);
    expect(due[0].scheduledFor.toISOString()).toBe("2026-11-25T01:00:00.000Z");
  });

  it("routine sekali jalan hilang dari antrean setelah dijalankan", () => {
    const once = routine({
      cron: null,
      runAt: "2026-11-25T00:45:00Z",
      lastRunAt: "2026-11-25T00:46:00Z",
    });
    expect(routines.dueRoutines([once], new Date("2026-11-25T00:40:00Z"), now)).toHaveLength(0);
    expect(routines.nextRunOf(once, now)).toBeNull();
  });

  it("routine sekali jalan jatuh tempo begitu waktunya tiba", () => {
    const once = routine({ cron: null, runAt: "2026-11-25T00:45:00Z" });
    const due = routines.dueRoutines(
      [once],
      new Date("2026-11-25T00:40:00Z"),
      new Date("2026-11-25T00:45:10Z")
    );
    expect(due).toHaveLength(1);
    expect(due[0].missed).toBe(false);
  });

  it("routine sekali jalan yang kelewat jauh ikut kebijakan missed-run", () => {
    const base = { cron: null, runAt: "2026-11-25T00:45:00Z" } as const;
    expect(routines.dueRoutines([routine(base)], new Date("2026-11-25T00:40:00Z"), now)).toHaveLength(0);
    const forced = routine({ ...base, missedRunPolicy: "run-once-on-start" });
    const due = routines.dueRoutines([forced], new Date("2026-11-25T00:40:00Z"), now);
    expect(due).toHaveLength(1);
    expect(due[0].missed).toBe(true);
  });
});
