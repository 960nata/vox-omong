import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let engine: typeof import("@/lib/engine/workflow");
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vox-engine-wf-"));
  process.env.VOX_ENGINE_DIR = tmpDir;
  engine = await import("@/lib/engine/workflow");
});

afterAll(async () => {
  delete process.env.VOX_ENGINE_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function workflow(steps: import("@/lib/engine/types").WorkflowStep[]) {
  const now = new Date().toISOString();
  return {
    id: "wf-test",
    name: "Tes",
    steps,
    trigger: { kind: "manual" as const },
    createdAt: now,
    updatedAt: now,
  };
}

describe("rencana workflow", () => {
  it("menyimpulkan dependensi dari placeholder, bukan cuma dari `needs`", () => {
    const waves = engine.planWorkflow(
      workflow([
        { id: "tulis", kind: "transform", title: "Tulis", input: { teks: "{{riset.ringkasan}}" } },
        { id: "riset", kind: "transform", title: "Riset", input: { topik: "ai" } },
      ])
    );
    expect(waves.map((wave) => wave.map((s) => s.id))).toEqual([["riset"], ["tulis"]]);
  });

  it("menaruh step yang saling bebas di satu gelombang", () => {
    const waves = engine.planWorkflow(
      workflow([
        { id: "a", kind: "transform", title: "A", input: {} },
        { id: "b", kind: "transform", title: "B", input: {} },
        { id: "c", kind: "transform", title: "C", input: {}, needs: ["a", "b"] },
      ])
    );
    expect(waves[0].map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(waves[1].map((s) => s.id)).toEqual(["c"]);
  });

  it("menolak ketergantungan melingkar", () => {
    expect(() =>
      engine.planWorkflow(
        workflow([
          { id: "a", kind: "transform", title: "A", input: { x: "{{b.y}}" } },
          { id: "b", kind: "transform", title: "B", input: { y: "{{a.x}}" } },
        ])
      )
    ).toThrow(engine.WorkflowError);
  });

  it("menolak `needs` ke step yang tidak ada", () => {
    expect(() =>
      engine.planWorkflow(
        workflow([{ id: "a", kind: "transform", title: "A", input: {}, needs: ["hantu"] }])
      )
    ).toThrow(/tidak ada/);
  });
});

describe("eksekusi workflow", () => {
  it("meneruskan hasil step ke step berikutnya", async () => {
    const run = await engine.runWorkflow(
      workflow([
        { id: "riset", kind: "transform", title: "Riset", input: { ringkasan: "tiga temuan" } },
        { id: "tulis", kind: "transform", title: "Tulis", input: { teks: "Hasil: {{riset.ringkasan}}" } },
      ])
    );
    expect(run.status).toBe("done");
    expect(run.results.tulis.output).toEqual({ teks: "Hasil: tiga temuan" });
  });

  it("menjalankan batch paralel dan menyimpan semua hasilnya", async () => {
    const seen: number[] = [];
    engine.registerStepRunner("batch-probe", async ({ batchIndex }) => {
      seen.push(batchIndex);
      return { index: batchIndex };
    });
    const run = await engine.runWorkflow(
      workflow([{ id: "gambar", kind: "batch-probe", title: "Gambar", input: {}, batch: 3 }])
    );
    expect(seen.sort()).toEqual([0, 1, 2]);
    expect(run.results.gambar.batchOutputs).toHaveLength(3);
  });

  it("melewati step yang dimatikan", async () => {
    const run = await engine.runWorkflow(
      workflow([{ id: "a", kind: "transform", title: "A", input: {}, disabled: true }])
    );
    expect(run.results.a.status).toBe("skipped");
    expect(run.status).toBe("done");
  });

  it("berhenti dengan status error dan menyetop gelombang berikutnya", async () => {
    engine.registerStepRunner("boom", async () => {
      throw new Error("meledak");
    });
    const after = vi.fn(async () => ({}));
    engine.registerStepRunner("after", after);
    const run = await engine.runWorkflow(
      workflow([
        { id: "x", kind: "boom", title: "X", input: {} },
        { id: "y", kind: "after", title: "Y", input: { dari: "{{x.apa}}" } },
      ])
    );
    expect(run.status).toBe("error");
    expect(run.error).toBe("meledak");
    expect(after).not.toHaveBeenCalled();
  });

  it("step approval menahan run di status waiting", async () => {
    const run = await engine.runWorkflow(
      workflow([
        { id: "minta", kind: "approval", title: "Minta izin", input: { question: "Lanjut?" } },
        { id: "lanjut", kind: "transform", title: "Lanjut", input: { ok: "{{minta.ok}}" } },
      ])
    );
    expect(run.status).toBe("waiting");
    expect(run.results.lanjut).toBeUndefined();
  });

  it("'run dari step ini' memakai ulang hasil sebelumnya dan menghitung ulang yang di bawahnya", async () => {
    const hitung = vi.fn(async () => ({ nilai: "baru" }));
    engine.registerStepRunner("hitung", hitung);
    const wf = workflow([
      { id: "satu", kind: "hitung", title: "Satu", input: {} },
      { id: "dua", kind: "hitung", title: "Dua", input: { dari: "{{satu.nilai}}" } },
      { id: "tiga", kind: "hitung", title: "Tiga", input: { dari: "{{dua.nilai}}" } },
    ]);
    const first = await engine.runWorkflow(wf);
    expect(hitung).toHaveBeenCalledTimes(3);

    hitung.mockClear();
    const second = await engine.runWorkflow(wf, { fromStep: "dua", previous: first });
    // `satu` dipakai ulang; `dua` dan `tiga` (yang bergantung padanya) dihitung lagi.
    expect(hitung).toHaveBeenCalledTimes(2);
    expect(second.results.satu.startedAt).toBe(first.results.satu.startedAt);
    expect(second.status).toBe("done");
  });

  it("menyimpan input yang sudah terisi untuk 'pakai setelan ini'", async () => {
    const run = await engine.runWorkflow(
      workflow([
        { id: "a", kind: "transform", title: "A", input: { kota: "Bandung" } },
        { id: "b", kind: "transform", title: "B", input: { pesan: "ke {{a.kota}}" } },
      ])
    );
    expect(run.results.b.resolvedInput).toEqual({ pesan: "ke Bandung" });
  });
});

describe("simpan, pause, export/import", () => {
  it("menolak menyimpan workflow yang tidak valid", async () => {
    await expect(
      engine.saveWorkflow({
        name: "Rusak",
        steps: [
          { id: "a", kind: "transform", title: "A", input: { x: "{{b.y}}" } },
          { id: "b", kind: "transform", title: "B", input: { y: "{{a.x}}" } },
        ],
      })
    ).rejects.toThrow(engine.WorkflowError);
  });

  it("workflow yang di-pause tidak bisa dijalankan", async () => {
    const saved = await engine.saveWorkflow({
      name: "Pause",
      steps: [{ id: "a", kind: "transform", title: "A", input: {} }],
    });
    await engine.setWorkflowPaused(saved.id, true);
    const paused = await engine.getWorkflow(saved.id);
    await expect(engine.runWorkflow(paused!)).rejects.toThrow(/pause/i);
  });

  it("export lalu import menghasilkan workflow baru dengan isi yang sama", async () => {
    const saved = await engine.saveWorkflow({
      name: "Pindahan",
      steps: [{ id: "a", kind: "transform", title: "A", input: { v: 1 } }],
    });
    const bundle = engine.exportWorkflow(saved);
    const imported = await engine.importWorkflow(JSON.parse(JSON.stringify(bundle)));
    expect(imported.id).not.toBe(saved.id);
    expect(imported.steps).toEqual(saved.steps);
  });

  it("menolak bundle yang bukan bundle workflow VOX", async () => {
    await expect(engine.importWorkflow({ kind: "lain", version: 1 })).rejects.toThrow(/bundle/i);
  });
});
