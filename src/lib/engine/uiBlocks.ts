/**
 * UI block interaktif: cara agent minta keputusan tanpa menebak jawaban bebas.
 *
 * Adopsi konsep OpenBot (docs/openbot-breakdown.md §F): tombol, reply chip, daftar pilihan,
 * form pendek, dan kartu approval. Semuanya bisa di-skip seperti pertanyaan biasa.
 *
 * Modul ini juga bisa membaca blok dari balasan model: model menulis satu blok JSON di dalam
 * fence ```vox-ui, dan sisanya tetap teks biasa.
 */

import { newId } from "./store";
import type { UiBlock, UiBlockAnswer, UiBlockField, UiBlockOption } from "./types";

export class UiBlockError extends Error {}

function normalizeOptions(raw: unknown): UiBlockOption[] {
  if (!Array.isArray(raw) || !raw.length) throw new UiBlockError("Blok ini butuh daftar pilihan.");
  return raw.map((item, index) => {
    if (typeof item === "string") return { value: item, label: item };
    const option = item as Partial<UiBlockOption>;
    const value = option.value ?? option.label;
    if (!value) throw new UiBlockError(`Pilihan ke-${index + 1} tidak punya value/label.`);
    return { value, label: option.label ?? value, description: option.description };
  });
}

function normalizeFields(raw: unknown): UiBlockField[] {
  if (!Array.isArray(raw) || !raw.length) throw new UiBlockError("Form butuh minimal satu field.");
  return raw.map((item, index) => {
    const field = item as Partial<UiBlockField>;
    if (!field.name) throw new UiBlockError(`Field ke-${index + 1} tidak punya nama.`);
    const type = field.type ?? "text";
    if (!["text", "number", "boolean", "choice"].includes(type)) {
      throw new UiBlockError(`Field "${field.name}" punya tipe "${type}" yang tidak dikenal.`);
    }
    return {
      name: field.name,
      label: field.label ?? field.name,
      type: type as UiBlockField["type"],
      required: field.required ?? false,
      options: type === "choice" ? normalizeOptions(field.options) : undefined,
    };
  });
}

/** Rapikan blok dari model/UI jadi bentuk yang pasti valid. */
export function normalizeBlock(raw: unknown): UiBlock {
  const input = (raw ?? {}) as Record<string, unknown>;
  const kind = String(input.kind ?? "");
  const id = typeof input.id === "string" && input.id ? input.id : newId("ui");
  const question = String(input.question ?? input.text ?? "").trim();
  if (!question) throw new UiBlockError("Blok ini tidak punya pertanyaan.");
  const skippable = input.skippable !== false;

  switch (kind) {
    case "buttons":
    case "chips":
      return { id, kind, question, options: normalizeOptions(input.options), skippable };
    case "list":
      return {
        id,
        kind,
        question,
        options: normalizeOptions(input.options),
        multiple: input.multiple === true,
        skippable,
      };
    case "form":
      return { id, kind, question, fields: normalizeFields(input.fields), skippable };
    case "approval":
      return {
        id,
        kind,
        question,
        detail: typeof input.detail === "string" ? input.detail : undefined,
        skippable,
      };
    default:
      throw new UiBlockError(`Jenis blok "${kind}" tidak dikenal.`);
  }
}

const FENCE = /```vox-ui\s*([\s\S]*?)```/;

/** Pisahkan blok UI dari teks balasan model. Teks sisa dikembalikan tanpa fence-nya. */
export function extractBlock(text: string): { text: string; block: UiBlock | null } {
  const match = text.match(FENCE);
  if (!match) return { text, block: null };
  let block: UiBlock | null = null;
  try {
    block = normalizeBlock(JSON.parse(match[1]));
  } catch {
    // fence rusak: biarkan teksnya apa adanya daripada menjatuhkan balasan
    return { text, block: null };
  }
  return { text: text.replace(FENCE, "").trim(), block };
}

/**
 * Periksa jawaban terhadap bloknya. Melempar `UiBlockError` kalau jawabannya tidak sah,
 * dan mengembalikan nilai yang sudah dirapikan (angka jadi number, dst.).
 */
export function validateAnswer(block: UiBlock, answer: UiBlockAnswer): UiBlockAnswer {
  if (answer.blockId && answer.blockId !== block.id) {
    throw new UiBlockError("Jawaban ini untuk blok yang lain.");
  }
  if (answer.skipped) {
    if (block.skippable === false) throw new UiBlockError("Pertanyaan ini tidak bisa dilewati.");
    return { blockId: block.id, skipped: true };
  }

  const value = (answer as { value: unknown }).value;

  if (block.kind === "approval") {
    if (typeof value !== "boolean") throw new UiBlockError("Approval butuh jawaban ya/tidak.");
    return { blockId: block.id, value };
  }

  if (block.kind === "form") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new UiBlockError("Form butuh jawaban berupa objek.");
    }
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of block.fields) {
      const given = source[field.name];
      const empty = given === undefined || given === null || given === "";
      if (empty) {
        if (field.required) throw new UiBlockError(`Field "${field.label}" wajib diisi.`);
        continue;
      }
      if (field.type === "number") {
        const num = Number(given);
        if (!Number.isFinite(num)) throw new UiBlockError(`Field "${field.label}" harus angka.`);
        out[field.name] = num;
      } else if (field.type === "boolean") {
        out[field.name] = given === true || given === "true";
      } else if (field.type === "choice") {
        const allowed = (field.options ?? []).map((o) => o.value);
        if (!allowed.includes(String(given))) {
          throw new UiBlockError(`Field "${field.label}" harus salah satu dari: ${allowed.join(", ")}.`);
        }
        out[field.name] = String(given);
      } else {
        out[field.name] = String(given);
      }
    }
    return { blockId: block.id, value: out };
  }

  const allowed = block.options.map((o) => o.value);
  if (block.kind === "list" && block.multiple) {
    const picked = Array.isArray(value) ? value.map(String) : [String(value)];
    const bad = picked.filter((item) => !allowed.includes(item));
    if (bad.length) throw new UiBlockError(`Pilihan tidak dikenal: ${bad.join(", ")}.`);
    return { blockId: block.id, value: picked };
  }
  const picked = String(value);
  if (!allowed.includes(picked)) {
    throw new UiBlockError(`Pilihan "${picked}" tidak ada. Yang ada: ${allowed.join(", ")}.`);
  }
  return { blockId: block.id, value: picked };
}

/** Ringkasan jawaban buat dimasukkan ke transkrip chat. */
export function describeAnswer(block: UiBlock, answer: UiBlockAnswer): string {
  if (answer.skipped) return `(dilewati: ${block.question})`;
  const value = (answer as { value: unknown }).value;
  if (block.kind === "approval") return value ? "Disetujui." : "Ditolak.";
  if (block.kind === "form") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(", ") : "(form kosong)";
  }
  const labelOf = (raw: string) => block.options.find((o) => o.value === raw)?.label ?? raw;
  return Array.isArray(value) ? value.map((v) => labelOf(String(v))).join(", ") : labelOf(String(value));
}
