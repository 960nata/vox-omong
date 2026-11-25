import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

let threads: typeof import("@/lib/engine/threads");
let tmpDir: string;

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vox-engine-th-"));
  process.env.VOX_ENGINE_DIR = tmpDir;
  threads = await import("@/lib/engine/threads");
});

afterEach(() => {
  threads.clearFinishedThreads();
});

afterAll(async () => {
  delete process.env.VOX_ENGINE_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Eksekutor yang baru selesai kalau `release` dipanggil, biar konkurensi bisa diuji. */
function gatedExecutor() {
  const gates: (() => void)[] = [];
  let active = 0;
  let peak = 0;
  threads.setThreadExecutor(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => gates.push(resolve));
    active--;
    return "beres";
  });
  return {
    releaseAll: () => {
      while (gates.length) gates.shift()!();
    },
    get peak() {
      return peak;
    },
    get waiting() {
      return gates.length;
    },
  };
}

describe("thread agent", () => {
  it("menghormati batas 'tasks at once' dan menjalankan antrean setelahnya", async () => {
    const gate = gatedExecutor();
    threads.setConcurrency("toko", 2);

    const started = await Promise.all(
      ["a", "b", "c", "d"].map((p) => threads.startThread({ agent: "toko", prompt: p }))
    );
    await tick();

    expect(gate.peak).toBe(2);
    expect(threads.listThreads({ agent: "toko", status: "running" })).toHaveLength(2);
    expect(threads.listThreads({ agent: "toko", status: "queued" })).toHaveLength(2);

    gate.releaseAll();
    await tick();
    await tick();
    gate.releaseAll();
    await tick();
    await tick();

    expect(threads.listThreads({ agent: "toko", status: "done" })).toHaveLength(4);
    expect(started.every((t) => threads.getThread(t.id)?.status === "done")).toBe(true);
  });

  it("batas konkurensi dihitung per agent", async () => {
    threads.setConcurrency("satu", 1);
    threads.setConcurrency("dua", 1);
    const gate = gatedExecutor();

    await threads.startThread({ agent: "satu", prompt: "x" });
    await threads.startThread({ agent: "dua", prompt: "y" });
    await tick();

    expect(threads.listThreads({ status: "running" })).toHaveLength(2);
    gate.releaseAll();
    await tick();
  });

  it("berhenti di status needs-person sampai dijawab", async () => {
    threads.setConcurrency("tanya", 1);
    let answered: unknown = null;
    threads.setThreadExecutor(async ({ ask }) => {
      const answer = await ask({
        id: "ui-1",
        kind: "approval",
        question: "Lanjut deploy?",
      });
      answered = answer;
      return "selesai";
    });

    const thread = await threads.startThread({ agent: "tanya", prompt: "deploy" });
    await tick();
    expect(threads.getThread(thread.id)?.status).toBe("needs-person");
    expect(threads.waitingCount("tanya")).toBe(1);

    threads.answerThread(thread.id, { blockId: "ui-1", value: true });
    await tick();
    expect(answered).toEqual({ blockId: "ui-1", value: true });
    expect(threads.getThread(thread.id)?.status).toBe("done");
    expect(threads.waitingCount("tanya")).toBe(0);
  });

  it("menolak jawaban untuk thread yang tidak sedang menunggu", async () => {
    const gate = gatedExecutor();
    threads.setConcurrency("sibuk", 1);
    const thread = await threads.startThread({ agent: "sibuk", prompt: "kerja" });
    await tick();
    expect(() => threads.answerThread(thread.id, { blockId: "x", value: 1 })).toThrow(
      threads.ThreadError
    );
    gate.releaseAll();
    await tick();
  });

  it("thread yang masih mengantre langsung batal saat distop", async () => {
    const gate = gatedExecutor();
    threads.setConcurrency("stop", 1);
    const first = await threads.startThread({ agent: "stop", prompt: "satu" });
    const queued = await threads.startThread({ agent: "stop", prompt: "dua" });
    await tick();

    threads.stopThread(queued.id);
    expect(threads.getThread(queued.id)?.status).toBe("cancelled");

    gate.releaseAll();
    await tick();
    await tick();
    // Yang dibatalkan tidak ikut jalan walau slotnya sudah kosong.
    expect(threads.getThread(queued.id)?.status).toBe("cancelled");
    expect(threads.getThread(first.id)?.status).toBe("done");
  });

  it("eksekutor yang gagal menandai thread error, bukan menggantung", async () => {
    threads.setConcurrency("gagal", 1);
    threads.setThreadExecutor(async () => {
      throw new Error("API mati");
    });
    const thread = await threads.startThread({ agent: "gagal", prompt: "x" });
    await tick();
    expect(threads.getThread(thread.id)).toMatchObject({ status: "error", error: "API mati" });
  });

  it("side-question ditandai terpisah dari task biasa", async () => {
    const gate = gatedExecutor();
    threads.setConcurrency("sisi", 2);
    await threads.startThread({ agent: "sisi", prompt: "tanya", kind: "side-question" });
    await tick();
    expect(threads.listThreads({ agent: "sisi" })[0].kind).toBe("side-question");
    gate.releaseAll();
    await tick();
  });
});
