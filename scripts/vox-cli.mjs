#!/usr/bin/env node
// @ts-check
/**
 * CLI otomasi VOX: jalankan agent dari shell, cron OS, atau skrip CI lokal.
 *
 * URL dan token dibaca dari `.data/engine/automation/` (ditulis server saat automation dinyalakan
 * lewat `GET /api/engine/automation` dengan sesi studio). Token tidak pernah lewat argumen
 * perintah supaya tidak bocor ke `ps` atau history shell.
 *
 * Kode keluar: 0 selesai, 1 gagal, 2 salah pakai, 3 menunggu jawaban orang, 4 kehabisan waktu
 * (kerjaannya tetap lanjut), 5 server tidak bisa dihubungi atau agent tidak ada.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const USAGE = `Pakai:
  vox-cli list [--json]
  vox-cli run <agent> <prompt|-> [--wait] [--timeout 15m] [--side] [--json]
  vox-cli status <threadId> [--json]
  vox-cli stop <threadId> [--json]

<agent> = id project atau id sesi tim. Prompt "-" dibaca dari stdin.
Nyalakan dulu automation-nya: buka VOX, lalu GET /api/engine/automation dengan sesi studio.`;

const EXIT = { done: 0, failed: 1, usage: 2, needsPerson: 3, timedOut: 4, unreachable: 5 };
const POLL_MS = 2000;
const ENDED = new Set(["done", "error", "cancelled"]);

class CliError extends Error {
  /** @param {string} message @param {number} exitCode */
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

function automationDir() {
  if (process.env.VOX_AUTOMATION_DIR) return process.env.VOX_AUTOMATION_DIR;
  const engine = process.env.VOX_ENGINE_DIR || path.join(process.cwd(), ".data", "engine");
  return path.join(engine, "automation");
}

async function connection() {
  const dir = automationDir();
  try {
    const [url, token] = await Promise.all([
      readFile(path.join(dir, "url"), "utf8"),
      readFile(path.join(dir, "token"), "utf8"),
    ]);
    return { url: url.trim(), token: token.trim() };
  } catch {
    throw new CliError(
      `Automation belum nyala (tidak ada berkas di ${dir}). Buka VOX lalu panggil GET /api/engine/automation.`,
      EXIT.unreachable
    );
  }
}

/** @param {{url: string, token: string}} target @param {unknown} command */
async function send(target, command) {
  let response;
  try {
    response = await fetch(target.url, {
      method: "POST",
      headers: { authorization: `Bearer ${target.token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new CliError(`VOX tidak menjawab di ${target.url}.`, EXIT.unreachable);
  }
  const text = await response.text();
  let value = null;
  try {
    value = text ? JSON.parse(text) : null;
  } catch {
    // biarkan null; pesan error di bawah yang dipakai
  }
  if (response.status === 401) throw new CliError("Token automation ditolak.", EXIT.unreachable);
  if (!value) throw new CliError(`Balasan tidak bisa dibaca (HTTP ${response.status}).`, EXIT.failed);
  if (!value.ok) throw new CliError(value.error || `HTTP ${response.status}`, value.exit ?? EXIT.failed);
  return value;
}

function parseTimeout(raw) {
  const match = /^(\d+)(s|m|h)?$/.exec(raw ?? "");
  if (!match) throw new CliError(`Timeout "${raw}" tidak valid (contoh: 90s, 15m, 2h).`, EXIT.usage);
  const unit = { s: 1000, m: 60_000, h: 3_600_000 }[match[2] ?? "m"];
  return Number(match[1]) * unit;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printThread(thread, asJson) {
  if (asJson) {
    console.log(JSON.stringify(thread, null, 2));
    return;
  }
  const bits = [thread.id, thread.agent, thread.status, `${thread.progress}%`, thread.step];
  console.log(bits.join("  "));
  if (thread.result) console.log(`\n${thread.result}`);
  if (thread.error) console.error(`\nGagal: ${thread.error}`);
  if (thread.pending) console.log(`\nMenunggu jawaban: ${thread.pending.question}`);
}

async function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const args = argv.filter((a) => !a.startsWith("--"));
  const asJson = flags.has("--json");
  const [command, ...rest] = args;

  if (!command || flags.has("--help")) {
    console.log(USAGE);
    return flags.has("--help") ? EXIT.done : EXIT.usage;
  }

  const target = await connection();

  if (command === "list") {
    const { data } = await send(target, { action: "list" });
    if (asJson) console.log(JSON.stringify(data, null, 2));
    else {
      console.log(`Agent: ${data.agents.length ? data.agents.join(", ") : "(belum ada)"}`);
      for (const thread of data.threads) printThread(thread, false);
    }
    return EXIT.done;
  }

  if (command === "run") {
    const [agent, promptArg] = rest;
    if (!agent || !promptArg) {
      console.error(USAGE);
      return EXIT.usage;
    }
    const prompt = promptArg === "-" ? await readStdin() : promptArg;
    if (!prompt) throw new CliError("Prompt kosong.", EXIT.usage);

    const started = await send(target, {
      action: "run",
      agent,
      prompt,
      kind: flags.has("--side") ? "side-question" : "task",
    });
    let thread = started.data;
    if (!flags.has("--wait")) {
      printThread(thread, asJson);
      return EXIT.done;
    }

    const timeoutIndex = argv.indexOf("--timeout");
    const budget = parseTimeout(timeoutIndex >= 0 ? argv[timeoutIndex + 1] : "15m");
    const deadline = Date.now() + budget;
    while (!ENDED.has(thread.status)) {
      if (thread.status === "needs-person") {
        printThread(thread, asJson);
        return EXIT.needsPerson;
      }
      if (Date.now() > deadline) {
        printThread(thread, asJson);
        console.error("Kehabisan waktu tunggu; kerjaannya masih lanjut di VOX.");
        return EXIT.timedOut;
      }
      await sleep(POLL_MS);
      thread = (await send(target, { action: "status", threadId: thread.id })).data;
    }
    printThread(thread, asJson);
    return thread.status === "done" ? EXIT.done : EXIT.failed;
  }

  if (command === "status" || command === "stop") {
    const [threadId] = rest;
    if (!threadId) {
      console.error(USAGE);
      return EXIT.usage;
    }
    const result = await send(target, {
      action: command === "status" ? "status" : "stop",
      threadId,
    });
    printThread(result.data, asJson);
    return command === "status" ? (result.exit ?? EXIT.done) : EXIT.done;
  }

  console.error(USAGE);
  return EXIT.usage;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(error instanceof CliError ? error.exitCode : EXIT.failed);
  });
