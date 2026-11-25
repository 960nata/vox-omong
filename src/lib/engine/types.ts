/** Tipe bersama untuk mesin orkestrasi VOX (hasil adopsi konsep OpenBot, lihat docs/openbot-breakdown.md). */

// ───────────────────────────── Workflow ─────────────────────────────

/** Jenis step bawaan. `agent` memanggil tim/agent, sisanya utilitas. */
export type WorkflowStepKind = "agent" | "http" | "transform" | "notification" | "approval";

/**
 * Jenis step pada sebuah workflow: salah satu jenis bawaan, atau nama lain yang handler-nya
 * dipasang lewat `registerStepRunner`. Trik `string & {}` menjaga autocomplete jenis bawaan.
 */
export type StepKind = WorkflowStepKind | (string & {});

export interface WorkflowStep {
  /** ID unik di dalam satu workflow; dipakai sebagai nama field saat direferensikan `{{id.field}}`. */
  id: string;
  kind: StepKind;
  title: string;
  /** Step yang harus selesai dulu. Siklus ditolak saat validasi. */
  needs?: string[];
  /** Isi step; boleh memuat placeholder `{{step.field}}`. */
  input: Record<string, unknown>;
  /** Berapa hasil dibuat paralel (fitur Batch OpenBot). 1–4. */
  batch?: number;
  /** Step dalam satu grup di kanvas (fitur Group ⌘G). */
  group?: string;
  /** Step dilewati tanpa dijalankan. */
  disabled?: boolean;
}

export interface WorkflowTrigger {
  kind: "manual" | "schedule" | "webhook";
  /** Untuk `schedule`: ekspresi cron. Untuk `webhook`: nama event. */
  value?: string;
  /** Field yang disuplai trigger, tersedia sebagai `{{trigger.<key>}}`. */
  fields?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  trigger: WorkflowTrigger;
  /** Workflow yang di-pause tidak dijalankan trigger apa pun. */
  paused?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped" | "waiting";

export interface StepResult {
  stepId: string;
  status: StepStatus;
  /** Jawaban bertipe; dipakai step berikutnya lewat `{{stepId.field}}`. */
  output?: Record<string, unknown>;
  /** Semua hasil kalau `batch > 1`. */
  batchOutputs?: Record<string, unknown>[];
  error?: string;
  /** Input setelah placeholder diisi — dasar fitur "Use these settings". */
  resolvedInput?: Record<string, unknown>;
  startedAt?: string;
  finishedAt?: string;
}

export type RunStatus = "running" | "done" | "error" | "paused" | "cancelled" | "waiting";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  /** Hasil per step, dipakai ulang saat "Run from this step". */
  results: Record<string, StepResult>;
  triggerFields: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// ───────────────────────────── Routine ─────────────────────────────

/** Apa yang dilakukan kalau jadwal terlewat karena app mati (konsep missed-run OpenBot). */
export type MissedRunPolicy = "skip" | "run-once-on-start";

export interface Routine {
  id: string;
  name: string;
  /** Yang dijalankan: prompt ke agent, atau sebuah workflow. */
  target: { kind: "agent"; agent: string; prompt: string } | { kind: "workflow"; workflowId: string };
  /** Cron 5 field (`m h dom mon dow`), atau null kalau sekali jalan. */
  cron: string | null;
  /** Untuk routine sekali jalan: waktu ISO. */
  runAt?: string;
  /** IANA timezone, mis. `Asia/Jakarta`. Default WIB. */
  timezone: string;
  enabled: boolean;
  missedRunPolicy: MissedRunPolicy;
  /** Tujuan tambahan untuk hasil run (konsep "Send answers to"). */
  deliverTo?: { kind: "whatsapp" | "telegram" | "webhook"; target: string }[];
  lastRunAt?: string;
  lastStatus?: "done" | "error" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────── Thread ─────────────────────────────

export type ThreadStatus = "queued" | "running" | "done" | "error" | "cancelled" | "needs-person";

export interface AgentThread {
  id: string;
  agent: string;
  /** Thread utama vs thread samping (side question) yang tidak masuk konteks chat. */
  kind: "task" | "side-question";
  prompt: string;
  status: ThreadStatus;
  progress: number;
  step: string;
  result?: string;
  error?: string;
  /** Pertanyaan/approval yang menunggu jawaban orang. */
  pending?: UiBlock;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────── Provider & failover ─────────────────────────────

export interface ProviderAccount {
  id: string;
  provider: string;
  label: string;
  /** Nama env var yang memuat kredensial — kuncinya sendiri tidak pernah disimpan di sini. */
  credentialEnv: string;
  /** Diisi saat kena rate limit; akun dilewati sampai waktu ini. */
  limitedUntil?: string;
  disabled?: boolean;
}

export interface ModelChoice {
  provider: string;
  model: string;
  accountId?: string;
}

export interface FailoverPlan {
  /** Pilihan utama lalu urutan cadangan (konsep Backup models). */
  chain: ModelChoice[];
}

// ───────────────────────────── Memory ─────────────────────────────

export interface AgentMemory {
  id: string;
  agent: string;
  /** Satu fakta pendek, ditulis sebagai pernyataan. */
  text: string;
  /** `true` → selalu ikut di prompt; `false` → hanya muncul kalau dicari. */
  alwaysInPrompt: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────────── UI block ─────────────────────────────

export interface UiBlockOption {
  value: string;
  label: string;
  description?: string;
}

export interface UiBlockField {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "choice";
  required?: boolean;
  options?: UiBlockOption[];
}

/** Permintaan terstruktur dari agent ke orang: tombol, chip, daftar, atau form pendek. */
export type UiBlock =
  | { id: string; kind: "buttons"; question: string; options: UiBlockOption[]; skippable?: boolean }
  | { id: string; kind: "chips"; question: string; options: UiBlockOption[]; skippable?: boolean }
  | {
      id: string;
      kind: "list";
      question: string;
      options: UiBlockOption[];
      multiple?: boolean;
      skippable?: boolean;
    }
  | { id: string; kind: "form"; question: string; fields: UiBlockField[]; skippable?: boolean }
  | { id: string; kind: "approval"; question: string; detail?: string; skippable?: boolean };

export type UiBlockAnswer =
  | { blockId: string; skipped: true }
  | { blockId: string; skipped?: false; value: unknown };
