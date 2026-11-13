import { callLLM } from "./codeAgent";

/**
 * Council: satu pertanyaan dijawab beberapa "anggota" secara paralel, lalu satu ketua
 * merangkum jawaban terbaik. Peran dimasukkan ke prompt (gateway belum meneruskan `system`),
 * dan `prefer` dikirim per anggota supaya model berbeda dipakai begitu patch gateway dipasang.
 */

export interface Member {
  id: string;
  /** Model gratis OpenRouter untuk anggota ini (dipakai bila OPENROUTER_API_KEY ada). */
  free?: string;
  name: string;
  role: string;
  prefer: string[];
}

export const MEMBERS: Member[] = [
  { id: "analis", free: "solar-mini4:free", name: "Analis", role: "Kamu Analis: jawab runtut, logis, dengan alasan dan angka bila ada.", prefer: ["gemini"] },
  { id: "kritikus", free: "nemotron-3.5-lightning:free", name: "Kritikus", role: "Kamu Kritikus: cari celah, risiko, asumsi keliru, dan hal yang mudah terlewat.", prefer: ["deepseek"] },
  { id: "praktisi", free: "north-mini-code:free", name: "Praktisi", role: "Kamu Praktisi: beri langkah konkret yang bisa langsung dikerjakan.", prefer: ["qwen"] },
  { id: "kreatif", free: "lfm-3-1.7b:free", name: "Kreatif", role: "Kamu Kreatif: tawarkan sudut pandang atau ide yang tidak biasa tapi masuk akal.", prefer: ["deepseek"] },
];

export interface MemberAnswer {
  id: string;
  name: string;
  model: string;
  text: string;
  ok: boolean;
}

export interface CouncilResult {
  answers: MemberAnswer[];
  verdict: string;
  verdictModel: string;
}

async function askFree(model: string, prompt: string, maxTokens: number): Promise<{ text: string; model: string } | null> {
  const key = process.env.AI_GATEWAY_KEY_CHEAP || process.env.OPENROUTER_API_KEY || process.env.AI_GATEWAY_KEY;
  if (!key) return null;
  const rawUrl = process.env.AI_GATEWAY_URL || "https://router.classai.id/v1";
  const endpoint = rawUrl.endsWith("/chat/completions") ? rawUrl : `${rawUrl.replace(/\/+$/, "")}/chat/completions`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const text = String(d.choices?.[0]?.message?.content || "").trim();
    return text ? { text, model } : null;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

export async function runCouncil(question: string, apiKey?: string): Promise<CouncilResult> {
  const q = clip(question.trim(), 2000);
  const answers = await Promise.all(
    MEMBERS.map(async (m): Promise<MemberAnswer> => {
      try {
        const ask = `${m.role}\nJawab dalam bahasa Indonesia santai, maksimal 120 kata, tanpa pembukaan.\n\nPertanyaan: ${q}`;
        const r =
          (m.free && (await askFree(m.free, ask, 500))) ||
          (await callLLM({
            system: m.role,
            prompt: ask,
            apiKey: apiKey || process.env.AI_GATEWAY_KEY_CHEAP,
            maxTokens: 500,
            timeoutMs: 40000,
            prefer: m.prefer,
            fast: true,
          }));
        return { id: m.id, name: m.name, model: r.model, text: r.text.trim(), ok: !!r.text.trim() };
      } catch (e) {
        return { id: m.id, name: m.name, model: "-", text: `(gagal: ${(e as Error).message.slice(0, 80)})`, ok: false };
      }
    })
  );
  const good = answers.filter((a) => a.ok);
  if (!good.length) return { answers, verdict: "Semua anggota gagal menjawab. Coba lagi sebentar lagi.", verdictModel: "-" };
  if (good.length === 1) return { answers, verdict: good[0].text, verdictModel: good[0].model };

  const digest = good.map((a) => `[${a.name}] ${clip(a.text, 700)}`).join("\n\n");
  try {
    const r = await callLLM({
      system: "Kamu ketua rapat yang merangkum.",
      prompt: `Kamu ketua rapat. Gabungkan jawaban anggota berikut menjadi SATU jawaban akhir yang akurat, ringkas (maks 150 kata), bahasa Indonesia santai. Jika ada yang bertentangan, pilih yang paling masuk akal dan sebut singkat perbedaannya. Jangan menyebut dirimu AI atau model.\n\nPertanyaan: ${q}\n\n${digest}`,
      apiKey: apiKey || process.env.AI_GATEWAY_KEY_CHEAP,
      maxTokens: 600,
      timeoutMs: 40000,
      prefer: ["groq", "deepseek", "gemini"],
      fast: true,
    });
    return { answers, verdict: r.text.trim() || good[0].text, verdictModel: r.model };
  } catch {
    return { answers, verdict: good[0].text, verdictModel: good[0].model };
  }
}

/** "rapat: ...", "council ...", "tanya semua AI: ..." -> pertanyaannya, atau null. */
export function detectCouncil(msg: string): string | null {
  const m = msg.trim().match(/^(?:tolong\s+)?(?:rapat(?:kan)?|council|sidang|tanya\s+(?:semua|para|beberapa)\s+(?:ai|model)|minta\s+pendapat\s+(?:semua|para)\s+(?:ai|model))\s*[:,\-]?\s*(.{6,})$/i);
  return m ? m[1].trim() : null;
}

export function formatCouncil(r: CouncilResult): string {
  const lines = r.answers.map((a) => `• ${a.name} (${a.model}): ${a.text.replace(/\s+/g, " ")}`);
  return `Hasil rapat:\n${lines.join("\n")}\n\nKesimpulan ketua (${r.verdictModel}):\n${r.verdict}`;
}
