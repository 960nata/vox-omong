/**
 * Memory per agent.
 *
 * Adopsi konsep OpenBot (docs/openbot-breakdown.md §E): sebagian memory ditandai
 * `alwaysInPrompt` sehingga selalu ikut di setiap turn, sisanya cuma muncul kalau dicari.
 * Satu memory = satu fakta pendek yang ditulis sebagai pernyataan.
 */

import { newId, readCollection, updateCollection } from "./store";
import type { AgentMemory } from "./types";

const MEMORIES = "agent-memories";
const MAX_TEXT = 500;
/** Batas memory "selalu di prompt" per agent, biar prompt tidak membengkak. */
export const MAX_ALWAYS = 24;

export class MemoryError extends Error {}

export function listMemories(agent?: string): Promise<AgentMemory[]> {
  return readCollection<AgentMemory>(MEMORIES).then((items) =>
    agent ? items.filter((m) => m.agent === agent) : items
  );
}

export async function saveMemory(input: {
  id?: string;
  agent: string;
  text: string;
  alwaysInPrompt?: boolean;
  tags?: string[];
}): Promise<AgentMemory> {
  const text = input.text.trim();
  if (!text) throw new MemoryError("Memory tidak boleh kosong.");
  if (text.length > MAX_TEXT) throw new MemoryError(`Memory maksimal ${MAX_TEXT} karakter.`);

  const now = new Date().toISOString();
  return updateCollection<AgentMemory, AgentMemory>(MEMORIES, (items) => {
    const existing = input.id ? items.find((m) => m.id === input.id) : undefined;
    const always = input.alwaysInPrompt ?? existing?.alwaysInPrompt ?? false;
    if (always) {
      const count = items.filter(
        (m) => m.agent === input.agent && m.alwaysInPrompt && m.id !== existing?.id
      ).length;
      if (count >= MAX_ALWAYS) {
        throw new MemoryError(
          `Agent ini sudah punya ${MAX_ALWAYS} memory yang selalu di prompt. Matikan salah satu dulu.`
        );
      }
    }
    const memory: AgentMemory = {
      id: existing?.id ?? input.id ?? newId("mem"),
      agent: input.agent,
      text,
      alwaysInPrompt: always,
      tags: input.tags ?? existing?.tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) items[items.indexOf(existing)] = memory;
    else items.push(memory);
    return memory;
  });
}

export function deleteMemory(id: string): Promise<boolean> {
  return updateCollection<AgentMemory, boolean>(MEMORIES, (items) => {
    const index = items.findIndex((m) => m.id === id);
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
  });
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
}

/** Skor kecocokan sederhana: berapa banyak kata kueri yang muncul di memory (plus bonus tag). */
export function scoreMemory(memory: AgentMemory, query: string): number {
  const words = new Set(tokenize(query));
  if (!words.size) return 0;
  const haystack = `${memory.text} ${(memory.tags ?? []).join(" ")}`.toLowerCase();
  let hits = 0;
  for (const word of words) if (haystack.includes(word)) hits++;
  return hits / words.size;
}

/** Memory yang dicari agent saat butuh konteks tambahan. */
export async function searchMemories(
  agent: string,
  query: string,
  limit = 8
): Promise<AgentMemory[]> {
  const items = await listMemories(agent);
  return items
    .map((memory) => ({ memory, score: scoreMemory(memory, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .slice(0, limit)
    .map((row) => row.memory);
}

/**
 * Blok memory yang ditempel ke system prompt: yang `alwaysInPrompt`, ditambah hasil pencarian
 * dari pesan terakhir kalau ada.
 */
export async function memoryPrompt(agent: string, query?: string): Promise<string> {
  const items = await listMemories(agent);
  const always = items.filter((m) => m.alwaysInPrompt);
  const found = query ? (await searchMemories(agent, query)).filter((m) => !m.alwaysInPrompt) : [];
  if (!always.length && !found.length) return "";

  const lines: string[] = ["Yang kamu ingat tentang orang ini dan kerjaannya:"];
  for (const memory of always) lines.push(`- ${memory.text}`);
  if (found.length) {
    lines.push("Mungkin relevan dengan pesan terakhir:");
    for (const memory of found) lines.push(`- ${memory.text}`);
  }
  return lines.join("\n");
}
