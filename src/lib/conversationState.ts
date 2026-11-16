/**
 * State percakapan yang disimpan: apa yang sedang "dipegang" percakapan ini (deck, dokumen, dll.)
 * supaya pesan lanjutan ("tambahin gambar", "bahasanya lebih formal") tidak perlu ditebak ulang dari riwayat.
 * Fungsi murni supaya gampang dites; penyimpanannya di storage.addMessage.
 */
import type { ArtifactItem, ConversationState, Message } from "./types";

export type Focus = ConversationState["focus"];

/** Berapa balasan asisten tanpa artefak baru sebelum fokus dianggap selesai. */
export const MAX_IDLE_REPLIES = 4;

export const EMPTY_STATE: ConversationState = { focus: null, idleReplies: 0 };

/** Artefak apa yang menentukan fokus. Artefak lain (website, video, tabel...) tetap mengganti fokus supaya deck lama tidak "membajak" pesan berikutnya. */
export function focusOf(artifact: Partial<ArtifactItem> | undefined | null): Focus {
  if (!artifact || typeof artifact !== "object") return null;
  if (artifact.slides || artifact.type === "slides") return "slides";
  if (artifact.type === "pdf_document") return "document";
  return artifact.type ? "other" : null;
}

/** State setelah satu balasan asisten disimpan. */
export function nextState(prev: ConversationState | undefined, artifact: Partial<ArtifactItem> | undefined | null, messageId: string, now = new Date().toISOString()): ConversationState {
  const focus = focusOf(artifact);
  if (focus) return { focus, artifactMessageId: messageId, idleReplies: 0, updatedAt: now };
  const p = prev ?? EMPTY_STATE;
  if (!p.focus) return { ...EMPTY_STATE, updatedAt: now };
  const idle = p.idleReplies + 1;
  return idle >= MAX_IDLE_REPLIES ? { ...EMPTY_STATE, updatedAt: now } : { ...p, idleReplies: idle, updatedAt: now };
}

/** Percakapan lama tanpa state: bangun ulang sekali dari riwayat balasan asisten. */
export function deriveState(messages: Pick<Message, "id" | "role" | "artifact">[]): ConversationState {
  let s: ConversationState = EMPTY_STATE;
  for (const m of messages) if (m.role === "assistant") s = nextState(s, m.artifact, m.id, s.updatedAt);
  return s;
}

/** State efektif: yang tersimpan, atau turunan dari riwayat untuk percakapan lama. */
export function stateOf(conv: { state?: ConversationState; messages: Pick<Message, "id" | "role" | "artifact">[] } | null | undefined): ConversationState {
  if (!conv) return EMPTY_STATE;
  return conv.state ?? deriveState(conv.messages);
}
