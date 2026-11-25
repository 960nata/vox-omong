/**
 * Menjalankan satu prompt lewat CLI provider dan mengumpulkan jawabannya.
 *
 * Prompt dikirim lewat stdin, bukan argumen, supaya tidak muncul di `ps`/history. Tidak ada
 * shell yang dipakai (`spawn` tanpa `shell: true`), jadi isi prompt tidak bisa jadi perintah.
 * Tanpa `write: true`, CLI dijalankan dalam mode baca-saja.
 */

import { spawn } from "node:child_process";
import { execArgs, providerSpec, type ProviderId, type ProviderSpec } from "./catalog";
import { findBinary } from "./detect";

export interface ProviderUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

export interface ProviderEvent {
  kind: "started" | "text" | "tool" | "usage" | "error" | "other";
  text?: string;
  usage?: ProviderUsage;
  sessionId?: string;
  raw?: unknown;
}

export class ProviderError extends Error {}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Satu baris JSONL `codex exec --json` → event yang dipahami VOX. */
export function parseCodexLine(line: string): ProviderEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  const type = String(data.type ?? "");

  if (type === "thread.started") {
    return { kind: "started", sessionId: String(data.thread_id ?? ""), raw: data };
  }
  if (type === "item.completed") {
    const item = (data.item ?? {}) as Record<string, unknown>;
    const itemType = String(item.type ?? "");
    if (itemType === "agent_message") return { kind: "text", text: String(item.text ?? ""), raw: data };
    if (itemType === "reasoning") return { kind: "other", raw: data };
    return { kind: "tool", text: String(item.text ?? item.command ?? ""), raw: data };
  }
  if (type === "turn.completed") {
    const usage = (data.usage ?? {}) as Record<string, unknown>;
    return {
      kind: "usage",
      usage: {
        inputTokens: num(usage.input_tokens),
        cachedInputTokens: num(usage.cached_input_tokens),
        outputTokens: num(usage.output_tokens),
      },
      raw: data,
    };
  }
  if (type === "turn.failed" || type === "error") {
    const error = (data.error ?? {}) as Record<string, unknown>;
    return { kind: "error", text: String(error.message ?? data.message ?? "Turn gagal."), raw: data };
  }
  return { kind: "other", raw: data };
}

/** Satu baris JSONL `claude -p --output-format stream-json` → event yang dipahami VOX. */
export function parseClaudeLine(line: string): ProviderEvent | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  const type = String(data.type ?? "");

  if (type === "system") {
    return { kind: "started", sessionId: String(data.session_id ?? ""), raw: data };
  }
  if (type === "assistant") {
    const message = (data.message ?? {}) as Record<string, unknown>;
    const content = Array.isArray(message.content) ? message.content : [];
    const text = content
      .filter((part): part is Record<string, unknown> => !!part && typeof part === "object")
      .filter((part) => part.type === "text")
      .map((part) => String(part.text ?? ""))
      .join("");
    if (!text) return { kind: "tool", raw: data };
    return { kind: "text", text, raw: data };
  }
  if (type === "result") {
    const usage = (data.usage ?? {}) as Record<string, unknown>;
    const isError = data.is_error === true || String(data.subtype ?? "") === "error";
    return {
      kind: isError ? "error" : "usage",
      // `result` adalah jawaban final; kalau error, isinya pesan errornya.
      text: typeof data.result === "string" ? data.result : undefined,
      usage: {
        inputTokens: num(usage.input_tokens),
        cachedInputTokens: num(usage.cache_read_input_tokens),
        outputTokens: num(usage.output_tokens),
      },
      raw: data,
    };
  }
  return { kind: "other", raw: data };
}

export function lineParser(spec: ProviderSpec): (line: string) => ProviderEvent | null {
  if (spec.stream === "codex-jsonl") return parseCodexLine;
  if (spec.stream === "claude-jsonl") return parseClaudeLine;
  // `plain`: seluruh keluaran dianggap teks jawaban.
  return (line: string) => (line.trim() ? { kind: "text", text: line } : null);
}

export interface ProviderRunResult {
  provider: ProviderId;
  /** Jawaban final. Untuk format JSONL, pesan agent terakhir yang dipakai. */
  text: string;
  usage: ProviderUsage;
  sessionId: string | null;
  exitCode: number | null;
  /** Langkah tool yang terlihat, buat ditampilkan sebagai progres. */
  steps: string[];
}

export interface ProviderRunOptions {
  provider: ProviderId;
  prompt: string;
  model?: string;
  cwd?: string;
  /** Default `false`: CLI jalan baca-saja, tidak boleh mengubah berkas. */
  write?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: ProviderEvent) => void;
}

const DEFAULT_TIMEOUT = 10 * 60_000;

/**
 * Jalankan prompt di CLI provider. Melempar `ProviderError` kalau CLI-nya belum terpasang,
 * promptnya kosong, atau turn-nya gagal.
 */
export async function runProvider(options: ProviderRunOptions): Promise<ProviderRunResult> {
  const prompt = options.prompt?.trim();
  if (!prompt) throw new ProviderError("Prompt kosong.");

  const spec = providerSpec(options.provider);
  const bin = await findBinary(spec);
  if (!bin) throw new ProviderError(`CLI ${spec.label} belum terpasang. Pasang dulu: ${spec.install}`);

  const args = execArgs(spec, { model: options.model, cwd: options.cwd, write: options.write });
  const parse = lineParser(spec);

  const child = spawn(bin, args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    // Tanpa shell: isi prompt tidak mungkin diartikan sebagai perintah.
    shell: false,
  });

  const texts: string[] = [];
  const steps: string[] = [];
  let usage: ProviderUsage = {};
  let sessionId: string | null = null;
  let failure: string | null = null;
  let stderr = "";
  let buffer = "";

  const handleLine = (line: string) => {
    const event = parse(line);
    if (!event) return;
    if (event.sessionId) sessionId = event.sessionId;
    if (event.usage) usage = { ...usage, ...event.usage };
    if (event.kind === "text" && event.text) texts.push(event.text);
    if (event.kind === "tool" && event.text) steps.push(event.text.slice(0, 120));
    if (event.kind === "error") failure = event.text || "Provider melaporkan kegagalan.";
    // Jawaban final Claude ikut di event `result`; pakai itu kalau belum ada teks.
    if (event.kind === "usage" && event.text && !texts.length) texts.push(event.text);
    options.onEvent?.(event);
  };

  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) handleLine(line);
  });
  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    if (stderr.length > 8000) stderr = stderr.slice(-8000);
  });

  child.stdin.end(prompt);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new ProviderError(`${spec.label} kelamaan (lewat ${Math.round(timeoutMs / 1000)} detik).`));
    }, timeoutMs);
    const onAbort = () => {
      child.kill("SIGTERM");
      reject(new ProviderError("Dibatalkan."));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      reject(new ProviderError(`Gagal menjalankan ${spec.label}: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(code);
    });
  });

  if (buffer.trim()) handleLine(buffer);

  if (failure) throw new ProviderError(`${spec.label}: ${failure}`);
  if (exitCode !== 0 && !texts.length) {
    const hint = stderr.trim().split("\n").slice(-3).join(" ").slice(0, 400);
    throw new ProviderError(`${spec.label} keluar dengan kode ${exitCode}.${hint ? ` ${hint}` : ""}`);
  }

  return {
    provider: options.provider,
    // Pesan terakhir = jawaban final; yang sebelumnya biasanya narasi langkah.
    text: texts[texts.length - 1] ?? "",
    usage,
    sessionId,
    exitCode,
    steps,
  };
}
