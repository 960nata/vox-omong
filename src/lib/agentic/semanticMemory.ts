import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { SemanticMemoryItem, UserPreferenceProfile } from "./types";

const MEMORY_DIR = path.join(process.cwd(), ".data", "agentic");
const MEMORY_FILE = path.join(MEMORY_DIR, "semantic_memory.json");
const PREFERENCES_FILE = path.join(MEMORY_DIR, "user_preferences.json");

const VECTOR_DIM = 256;

// ------------------------------------------------------------- Local Fallback Vectorizer
/**
 * Fast, deterministic n-gram & word hashing vectorizer with L2 normalization.
 * Runs instantly offline without external API keys or heavy dependencies.
 */
function localEmbed(text: string): number[] {
  const vec = new Float64Array(VECTOR_DIM);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);

  // 1. Word hashing
  for (const w of words) {
    let h = 0;
    for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) >>> 0;
    const idx = h % VECTOR_DIM;
    vec[idx] += 1.0;
  }

  // 2. Character 3-grams for fuzzy matching
  for (let i = 0; i < normalized.length - 2; i++) {
    const gram = normalized.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < 3; j++) h = (h * 37 + gram.charCodeAt(j)) >>> 0;
    const idx = h % VECTOR_DIM;
    vec[idx] += 0.35;
  }

  // 3. L2 Normalization
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

// ------------------------------------------------------------- Gemini Embedding API
async function getGeminiEmbedding(text: string, apiKey?: string): Promise<number[] | null> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key || !key.startsWith("AIzaSy")) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 2000) }] },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const values = data.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      return values as number[];
    }
  } catch {
    // Fall back to local embedder on network or quota issues
  }
  return null;
}

export async function computeEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const geminiVec = await getGeminiEmbedding(text, apiKey);
  if (geminiVec && geminiVec.length > 0) {
    return geminiVec;
  }
  return localEmbed(text);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ------------------------------------------------------------- Storage & Recall
async function ensureDir() {
  await fs.mkdir(MEMORY_DIR, { recursive: true });
}

export async function loadMemories(): Promise<SemanticMemoryItem[]> {
  try {
    await ensureDir();
    const raw = await fs.readFile(MEMORY_FILE, "utf-8");
    return JSON.parse(raw) as SemanticMemoryItem[];
  } catch {
    return [];
  }
}

export async function saveMemories(items: SemanticMemoryItem[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(MEMORY_FILE, JSON.stringify(items.slice(-300), null, 2), "utf-8");
}

export async function rememberSemantic(
  topic: string,
  content: string,
  category: SemanticMemoryItem["category"] = "episodic",
  apiKey?: string
): Promise<SemanticMemoryItem> {
  const items = await loadMemories();
  const embedding = await computeEmbedding(`${topic}: ${content}`, apiKey);

  const item: SemanticMemoryItem = {
    id: `mem-${Date.now()}-${randomUUID().slice(0, 6)}`,
    topic: topic.slice(0, 160),
    content: content.slice(0, 1500),
    embedding,
    category,
    createdAt: new Date().toISOString(),
    accessCount: 0,
  };

  items.push(item);
  await saveMemories(items);
  return item;
}

export async function recallSemantic(
  query: string,
  opts: { topK?: number; minScore?: number; category?: SemanticMemoryItem["category"]; apiKey?: string } = {}
): Promise<{ item: SemanticMemoryItem; score: number }[]> {
  const items = await loadMemories();
  if (items.length === 0) return [];

  const topK = opts.topK ?? 4;
  const minScore = opts.minScore ?? 0.28;
  const queryVec = await computeEmbedding(query, opts.apiKey);

  const scored = items
    .filter((it) => !opts.category || it.category === opts.category)
    .map((item) => {
      // If dimension matches, use cosine similarity; otherwise fallback to text similarity
      let score = 0;
      if (item.embedding && item.embedding.length === queryVec.length) {
        score = cosineSimilarity(queryVec, item.embedding);
      } else {
        score = cosineSimilarity(localEmbed(query), localEmbed(`${item.topic} ${item.content}`));
      }
      return { item, score };
    })
    .filter((res) => res.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Update access counts
  if (scored.length > 0) {
    const accessedIds = new Set(scored.map((s) => s.item.id));
    for (const it of items) {
      if (accessedIds.has(it.id)) it.accessCount = (it.accessCount || 0) + 1;
    }
    await saveMemories(items);
  }

  return scored;
}

// ------------------------------------------------------------- User Preference Profile
export async function getUserPreferences(): Promise<UserPreferenceProfile> {
  try {
    await ensureDir();
    const raw = await fs.readFile(PREFERENCES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      themePreference: "dark",
      designStyle: "modern minimalist",
      techStackPreference: ["Tailwind CSS", "TypeScript", "React"],
      languageStyle: "casual",
      customNotes: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function saveUserPreferences(profile: UserPreferenceProfile): Promise<void> {
  await ensureDir();
  profile.updatedAt = new Date().toISOString();
  await fs.writeFile(PREFERENCES_FILE, JSON.stringify(profile, null, 2), "utf-8");
}

export async function autoLearnPreferences(userText: string): Promise<boolean> {
  const lower = userText.toLowerCase();
  const profile = await getUserPreferences();
  let changed = false;

  // Theme preference
  if (/\b(suka mode gelap|selalu dark mode|bikin gelap terus|prefer dark)\b/.test(lower)) {
    profile.themePreference = "dark";
    changed = true;
  } else if (/\b(suka mode terang|selalu light mode|bikin terang terus|prefer light)\b/.test(lower)) {
    profile.themePreference = "light";
    changed = true;
  }

  // Design style
  if (/\b(gaya mewah|luxury|vintage|cyberpunk|minimalis|clean|brutalist)\b/.test(lower)) {
    const match = lower.match(/\b(mewah|luxury|vintage|cyberpunk|minimalis|clean|brutalist)\b/);
    if (match && profile.designStyle !== match[0]) {
      profile.designStyle = match[0];
      changed = true;
    }
  }

  // Language preference
  if (/\b(ngomong pake bahasa inggris|in english please|speak english)\b/.test(lower)) {
    profile.languageStyle = "english";
    changed = true;
  } else if (/\b(bahasa santai|pake gue-lu|casual aja)\b/.test(lower)) {
    profile.languageStyle = "casual";
    changed = true;
  } else if (/\b(bahasa resmi|formal aja|baku)\b/.test(lower)) {
    profile.languageStyle = "formal";
    changed = true;
  }

  if (changed) {
    await saveUserPreferences(profile);
  }
  return changed;
}

export async function formatAgentMemoryContext(query: string, apiKey?: string): Promise<string> {
  const [relevant, profile] = await Promise.all([
    recallSemantic(query, { topK: 3, apiKey }),
    getUserPreferences(),
  ]);

  const sections: string[] = [];

  if (relevant.length > 0) {
    sections.push(
      "MEMORI SEMANTIK RELEVAN DARI SESI SEBELUMNYA:\n" +
        relevant.map((r, i) => `${i + 1}. [${r.item.topic}] (${Math.round(r.score * 100)}% cocok): ${r.item.content}`).join("\n")
    );
  }

  if (profile) {
    const notes = [
      profile.themePreference ? `Tema: ${profile.themePreference}` : null,
      profile.designStyle ? `Gaya: ${profile.designStyle}` : null,
      profile.languageStyle ? `Gaya Bahasa: ${profile.languageStyle}` : null,
      ...(profile.customNotes || []),
    ].filter(Boolean);

    if (notes.length > 0) {
      sections.push("PREFERENSI PENGGUNA TERSIMPAN:\n" + notes.map((n) => `- ${n}`).join("\n"));
    }
  }

  return sections.join("\n\n");
}
