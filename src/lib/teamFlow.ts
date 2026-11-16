/**
 * Alur tim proyek (analisis ide → rekomendasi divisi → bentuk tim) punya jalur sendiri di chat route.
 * Pesan yang milik alur ini tidak boleh diambil Autopilot / router maksud lalu dikerjakan agent umum
 * (yang hasilnya cuma file .md atau skrip Python, bukan divisi tim yang benar-benar terbentuk).
 * Fungsi murni supaya gampang dites.
 */
import type { PipelineStage } from "./teamTypes";

const DIVISIONS = "developer|marketing|founder|trading|creative|research|career|custom";

/** "bentuk tim rekomendasi", "buat tim dulu", "tim developer aja" */
export function isTeamSetupRequest(message: string): boolean {
  return (
    /\b(?:bentuk|buat|bikin|pilih|aktifkan|setup)(?:in|kan)?\s+(?:semua\s+)?(?:tim|team|divisi)\b/i.test(message) ||
    /\b(?:tim\s+rekomendasi|rekomendasi\s+tim|semua\s+tim|semua\s+divisi)\b/i.test(message) ||
    new RegExp(`\\b(?:hanya\\s+)?(?:tim|divisi)\\s+(${DIVISIONS})(?:\\s+saja|\\s+aja)?\\b`, "i").test(message)
  );
}

export function singleDivision(message: string): string | null {
  return message.match(new RegExp(`\\b(?:hanya\\s+)?(?:tim|divisi)\\s+(${DIVISIONS})(?:\\s+saja|\\s+aja)?\\b`, "i"))?.[1]?.toLowerCase() ?? null;
}

/** "timnya mana", "mana tim agent-nya", "agentic AI yang ada timnya" */
export function asksForTeams(message: string): boolean {
  return (
    /\b(?:tim|team|divisi)(?:nya)?\s+(?:mana|dimana|di\s+mana|belum|gak\s+ada|nggak\s+ada|ga\s+ada|kok)\b/i.test(message) ||
    /\bmana\s+(?:tim|team|divisi|agen|agent)/i.test(message) ||
    /\b(?:a?gen(?:t|tik)?|ajentik|agentic)\b[\s\S]{0,40}\b(?:tim|team)(?:nya)?\b|\b(?:tim|team)\s+(?:a?gen(?:t|tik)?|ajentik|agentic)/i.test(message)
  );
}

/** Pesan berisi ide/brief proyek di tahap ideation → dianalisis + direkomendasikan divisinya. */
export function isProjectBrief(message: string, hasFolder = false): boolean {
  if (hasFolder) return true;
  return message.trim().length >= 15 && /\b(proyek|project|ide|produk|bisnis|startup|start\s*up|aplikasi|platform|website|buatkan|bikin|kembangkan|analisis|analisa|bedah|konsep|investasi)\b/i.test(message);
}

export interface TeamFlowCtx {
  stage: PipelineStage;
  /** Jumlah divisi non-executive yang sudah terbentuk. */
  teamCount: number;
  hasFolder?: boolean;
}

/** Apakah pesan ini milik alur tim proyek (dan harus dijalankan sebelum Autopilot / router)? */
export function claimsTeamFlow(message: string, ctx: TeamFlowCtx): boolean {
  if (isTeamSetupRequest(message) || asksForTeams(message)) return true;
  const ideation = ctx.stage === "ideation" || ctx.teamCount === 0;
  return ideation && isProjectBrief(message, ctx.hasFolder);
}
