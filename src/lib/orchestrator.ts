import type { ArtifactItem } from "./types";
import { runAgentTeam } from "./agentCore";
import { runSkill, type SkillKind } from "./skillAgent";
import { makeVideo } from "./videoMaker";
import { handleEmailMessage, findEmails } from "./email";

/**
 * Orkestrator: satu perintah -> beberapa mesin berurutan.
 * Contoh: "riset kompetitor kopi, bikin slide-nya, terus bikin video, lalu email ke bos@x.com".
 * Perencanaan berbasis aturan (0 token). Tiap langkah dapat bahan dari langkah sebelumnya.
 */

type StepKind = "riset" | "video" | "email" | SkillKind;
interface Step { kind: StepKind; clause: string }

const KINDS: [StepKind, RegExp][] = [
  ["riset", /\b(riset|teliti|selidiki|cari\s+tahu|bandingkan|analisis|cari\s+data)(?:nya)?\b/i],
  ["slides", /\b(ppt|pptx|powerpoint|slide|slides|presentasi|deck)(?:nya)?\b/i],
  ["video", /\b(video|animasi|motion\s*graphic|explainer)(?:nya)?\b/i],
  ["spreadsheet", /\b(excel|spreadsheet|xlsx|tabel|sheet)(?:nya)?\b/i],
  ["invoice", /\b(invoice|tagihan|faktur|kwitansi)(?:nya)?\b/i],
  ["document", /\b(dokumen|laporan|proposal|surat|makalah|artikel|ringkasan|rangkuman|pdf|docx|word)(?:nya)?\b/i],
  ["email", /\b(email|e-mail|surel|kirim(?:kan)?\s+ke)(?:nya)?\b/i],
];
const SPLIT = /\s*(?:,\s*(?:lalu|terus|kemudian|habis\s+itu|setelah\s+itu|dan)?|;|\b(?:lalu|terus|kemudian|habis\s+itu|setelah\s+itu|sekalian|dan\s+juga)\b|\bdan\b(?=\s+(?:buat|bikin|buatin|bikinin|buatkan|kirim|tulis|jadiin|jadikan|riset|render)))\s*/i;

function kindOf(clause: string): StepKind | null {
  for (const [k, re] of KINDS) if (re.test(clause)) return k;
  return null;
}

/** Rencana bila pesan meminta >= 2 jenis keluaran berbeda; selain itu null (alur biasa). */
export function planChain(msg: string): Step[] | null {
  const m = msg.trim();
  if (m.length < 15 || m.length > 1500) return null;
  const parts = m.split(SPLIT).map((p) => p.trim()).filter((p) => p.length > 2);
  const steps: Step[] = [];
  for (const p of parts) {
    const k = kindOf(p);
    if (k && !steps.some((s) => s.kind === k)) steps.push({ kind: k, clause: p });
  }
  const outputs = steps.filter((s) => s.kind !== "riset");
  if (steps.length < 2 || outputs.length < 1) return null;
  if (outputs.length === 1 && steps[0].kind === "riset") return null; // riset -> 1 output sudah ditangani agentCore
  // riset selalu duluan, email selalu terakhir
  steps.sort((a, b) => (a.kind === "riset" ? -1 : b.kind === "riset" ? 1 : a.kind === "email" ? 1 : b.kind === "email" ? -1 : 0));
  return steps.slice(0, 5);
}

export interface ChainResult { reply: string; spoken: string; artifacts: ArtifactItem[]; suggestions?: string[] }

const label: Record<StepKind, string> = { riset: "Riset", slides: "Slide", video: "Video", spreadsheet: "Tabel", invoice: "Invoice", document: "Dokumen", email: "Email" };

export async function runChain(
  msg: string,
  steps: Step[],
  opts: { apiKey?: string; convId: string; history: { role: string; content: string }[] }
): Promise<ChainResult> {
  const { apiKey } = opts;
  let notes = "";
  const lines: string[] = [];
  const artifacts: ArtifactItem[] = [];
  let suggestions: string[] | undefined;
  const brief = (clause: string) =>
    `${clause}\n\nKerjakan HANYA bagian ini. Konteks permintaan lengkap: ${msg}${notes ? `\n\nBahan (pakai ini, jangan mengarang data):\n${notes.slice(0, 5000)}` : ""}`;

  for (const s of steps) {
    try {
      if (s.kind === "riset") {
        const r = await runAgentTeam({ topic: msg, then: true }, apiKey);
        notes = r.notes;
        lines.push(notes ? `✓ Riset: ${r.spoken}` : `✗ Riset gagal, langkah berikut tanpa data web.`);
      } else if (s.kind === "video") {
        const v = await makeVideo(brief(s.clause), apiKey);
        artifacts.push({ id: `video-${v.video.id}`, type: "video", title: v.title, video: v.video, status: "completed" });
        lines.push(`${v.video.recorded ? "✓" : "△"} Video: ${v.title}${v.video.recorded ? "" : ` (${v.video.note})`}`);
      } else if (s.kind === "email") {
        const addr = findEmails(msg)[0];
        if (!addr) { lines.push("✗ Email: alamat tujuan tidak disebut, jadi tidak aku draf."); continue; }
        const made = artifacts.map((a) => `- ${a.type}: ${a.title}`).join("\n");
        const em = await handleEmailMessage({
          message: `tulis email ke ${addr}: ${s.clause}\nRingkas hasil yang sudah dibuat:\n${made}\n${notes.slice(0, 1200)}`,
          convId: opts.convId,
          history: opts.history,
          apiKey,
        });
        if (em) { lines.push(`✉ ${em.reply}`); suggestions = em.suggestions; }
        else lines.push("✗ Email gagal didraf.");
      } else {
        const out = await runSkill(s.kind, brief(s.clause), apiKey, { history: [] });
        if (out?.artifact) artifacts.push(out.artifact as ArtifactItem);
        lines.push(`✓ ${label[s.kind]}: ${out?.artifact?.title || "selesai"}`);
      }
    } catch (e) {
      lines.push(`✗ ${label[s.kind]} gagal: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  const ok = artifacts.length;
  return {
    reply: `Aku kerjain ${steps.length} langkah berurutan:\n${lines.join("\n")}${ok ? `\n\nHasilnya ada di ${ok} kartu di bawah.` : ""}`,
    spoken: `Selesai, ${ok} hasil siap.`,
    artifacts,
    suggestions,
  };
}
