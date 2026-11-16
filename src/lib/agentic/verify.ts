import fsSync from "fs";
import path from "path";
import type { ArtifactItem } from "../types";
import type { ReActStep } from "./types";

/**
 * Verifikasi oleh kode, bukan oleh klaim model.
 * "Selesai" hanya diterima kalau ada bukti: alat yang berhasil, artefak yang berisi, langkah terakhir tidak gagal.
 */
const WORK_GOAL = /\b(bikin|buat|tulis|simpan|install|pasang|jalan(?:in|kan)|perbaiki|benerin|fix|ubah|ganti|tambah|hapus|deploy|rapi(?:in|kan)|generate|create|build|refactor|rename|convert|konversi|update)\w*/i;
const PASSIVE_TOOLS = new Set(["memory_recall", "memory_store", "finish"]);

/** Tujuan ini menuntut hasil nyata (bukan sekadar jawaban)? */
export function goalNeedsEvidence(goal: string): boolean {
  return WORK_GOAL.test(goal);
}

/** Artefak benar-benar berisi? Mengembalikan alasan kalau kosong/rusak, atau null kalau sah. */
export function artifactProblem(a: ArtifactItem | undefined | null): string | null {
  if (!a || typeof a !== "object" || !a.type) return "artefak tidak terbentuk";
  switch (a.type) {
    case "slides": {
      const slides = (a.slides as { slides?: unknown[] } | undefined)?.slides;
      return Array.isArray(slides) && slides.length > 0 ? null : "slide kosong";
    }
    case "pdf_document":
      return (a.pdfContent && a.pdfContent.trim().length > 40) || a.letter ? null : "dokumen kosong";
    case "spreadsheet": {
      const s = a.spreadsheet as { rows?: unknown[]; sheets?: unknown[] } | undefined;
      return s && ((Array.isArray(s.rows) && s.rows.length > 0) || (Array.isArray(s.sheets) && s.sheets.length > 0)) ? null : "tabel kosong";
    }
    case "invoice":
      return a.invoice ? null : "invoice kosong";
    case "video": {
      if (!a.video?.id) return "video tidak terbentuk";
      const dir = path.join(process.cwd(), ".data", "videos");
      const files = fsSync.existsSync(dir) ? fsSync.readdirSync(dir).filter((f) => f.startsWith(a.video!.id)) : [];
      return files.some((f) => fsSync.statSync(path.join(dir, f)).size > 0) ? null : "file video tidak ditemukan";
    }
    case "website":
      return a.website?.html && a.website.html.length > 200 ? null : "website kosong";
    default:
      return null;
  }
}

export interface Evidence { ok: boolean; done: string[]; failed: string[]; problems: string[] }

export function collectEvidence(goal: string, steps: ReActStep[], artifacts: ArtifactItem[]): Evidence {
  const acted = steps.filter((s) => !PASSIVE_TOOLS.has(s.action));
  const done = acted.filter((s) => s.success).map((s) => describe(s));
  const failed = acted.filter((s) => s.success === false).map((s) => describe(s));
  const problems: string[] = [];
  for (const a of artifacts) {
    const p = artifactProblem(a);
    if (p) problems.push(`${a?.title || a?.type || "artefak"}: ${p}`);
  }
  if (goalNeedsEvidence(goal) && done.length === 0) problems.push("tidak ada alat yang berhasil dijalankan");
  const last = acted[acted.length - 1];
  if (last && last.success === false) problems.push(`langkah terakhir gagal (${last.action})`);
  return { ok: problems.length === 0, done, failed, problems };
}

function describe(s: ReActStep): string {
  const a = s.args || {};
  const target = a.path ?? a.command ?? a.kind ?? a.query ?? a.url ?? a.tool ?? "";
  return `${s.action}${target ? `: ${String(target).slice(0, 80)}` : ""}`;
}

/** Catatan bukti yang ditempel kode di akhir jawaban agent. */
export function evidenceNote(e: Evidence): string {
  const lines: string[] = [];
  if (e.done.length) lines.push(`Yang benar-benar dijalankan (${e.done.length}): ${e.done.slice(0, 8).join("; ")}`);
  if (e.failed.length) lines.push(`Yang gagal (${e.failed.length}): ${e.failed.slice(0, 5).join("; ")}`);
  if (e.problems.length) lines.push(`Belum terverifikasi: ${e.problems.join("; ")}`);
  return lines.join("\n");
}
