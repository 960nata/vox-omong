/**
 * FreeLLMAPI Native Engine (VOX·AI Studio)
 *
 * Mesin agregator model AI 100% GRATIS (0 Kredit / Rp 0).
 * Berjalan secara NATIVE di Node.js tanpa perlu Docker atau software pihak ketiga.
 *
 * Provider yang didukung:
 * 1. Pollinations Native: Bebas kunci (Zero Key), 100% Gratis, model: openai, mistral, qwen, deepseek.
 * 2. Google Gemini Free Tier: Kuota resmi 1.500 req/hari dari Google AI Studio.
 * 3. Groq Free Tier: Kecepatan 500+ tok/s resmi dari Groq Cloud (Llama 3.3 70B).
 * 4. Cerebras Free Tier: LPU Ultra Fast resmi dari Cerebras.
 * 5. FreeLLMAPI Local Proxy: Jika pengguna menjalankan proxy lokal sendiri di port 3005/3001.
 */

import { recordLlmUsage } from "./tokenTracker";

export interface FreeLLMRequest {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}

export interface FreeLLMResponse {
  text: string;
  model: string;
  provider: string;
}

/** Auto-routing & Failover untuk model gratis */
export async function callNativeFreeLLM(req: FreeLLMRequest): Promise<FreeLLMResponse> {
  const targetModel = (req.model || "freellmapi-auto").toLowerCase();
  const errors: string[] = [];
  const timeout = Math.max(req.timeoutMs || 0, 45000);

  // 1. Cek apakah ada Groq Free Key di environment
  const groqKey = process.env.GROQ_API_KEY;
  const isGroqTarget = targetModel.includes("groq");
  if (groqKey && (isGroqTarget || targetModel === "freellmapi-auto")) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.prompt },
          ],
          temperature: req.temperature ?? (req.json ? 0.2 : 0.6),
          max_tokens: req.maxTokens || 2048,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (text.trim()) {
          void recordLlmUsage({
            model: "freellmapi-groq-llama3.3",
            source: "freellmapi",
            promptTokens: data.usage?.prompt_tokens || Math.round((req.system.length + req.prompt.length) / 4),
            completionTokens: data.usage?.completion_tokens || Math.round(text.length / 4),
          }).catch(() => {});
          return { text: text.trim(), model: "freellmapi-groq-llama3.3", provider: "Groq Free LPU" };
        }
      }
      errors.push(`Groq Free: HTTP ${res.status}`);
    } catch (e: any) {
      errors.push(`Groq Free: ${e.message}`);
    }
  }

  // 2. Cek apakah ada Gemini Free Key di environment
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const isGeminiTarget = targetModel.includes("gemini");
  if (geminiKey && (isGeminiTarget || targetModel === "freellmapi-auto")) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(timeout),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: [{ role: "user", parts: [{ text: req.prompt }] }],
            generationConfig: {
              temperature: req.temperature ?? (req.json ? 0.2 : 0.6),
              maxOutputTokens: req.maxTokens || 2048,
              ...(req.json ? { responseMimeType: "application/json" } : {}),
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
        if (text.trim()) {
          void recordLlmUsage({
            model: "freellmapi-gemini-2.0-flash",
            source: "freellmapi",
            promptTokens: Math.round((req.system.length + req.prompt.length) / 4),
            completionTokens: Math.round(text.length / 4),
          }).catch(() => {});
          return { text: text.trim(), model: "freellmapi-gemini-2.0-flash", provider: "Google Gemini Free" };
        }
      }
      errors.push(`Gemini Free: HTTP ${res.status}`);
    } catch (e: any) {
      errors.push(`Gemini Free: ${e.message}`);
    }
  }

  // 2B. Cek apakah ada AI GW Free (USER_GATEWAY_KEY) di environment
  const userGwKey = process.env.USER_GATEWAY_KEY;
  const userGwUrl = process.env.USER_GATEWAY_URL || "https://aiinvestdesk.com/api/v1/ai/gateway";
  if (userGwKey && userGwKey.startsWith("aigw_")) {
    try {
      const res = await fetch(userGwUrl, {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userGwKey}`,
        },
        body: JSON.stringify({
          agent: "custom",
          prefer: ["deepseek", "groq", "cerebras", "gemini"],
          system: req.system,
          prompt: `${req.system}\n\n=====\n\n${req.prompt}${req.json ? "\n\nBalas HANYA JSON valid. Tanpa teks lain, tanpa pagar kode." : ""}`,
          temperature: req.temperature ?? (req.json ? 0.2 : 0.6),
          json: req.json,
          maxTokens: req.maxTokens || 2048,
        }),
      });
      if (res.ok) {
        const out = await res.json();
        const text = out?.data?.response || out?.data?.code || (typeof out?.data === "string" ? out.data : "");
        if (text && typeof text === "string" && text.trim()) {
          void recordLlmUsage({
            model: "user-private-gateway",
            source: "custom_local",
            promptTokens: Math.round((req.system.length + req.prompt.length) / 4),
            completionTokens: Math.round(text.length / 4),
          }).catch(() => {});
          return { text: text.trim(), model: "user-private-gateway", provider: "AI GW Free" };
        }
      }
      errors.push(`AI GW Free: HTTP ${res.status}`);
    } catch (e: any) {
      errors.push(`AI GW Free: ${e.message}`);
    }
  }

  // 3. Provider Cadangan Zero-Key: Pollinations Native (100% Gratis Tanpa API Key)
  const pollinationsModels = req.json
    ? ["openai", "mistral"]
    : targetModel.includes("cerebras") || targetModel.includes("groq")
    ? ["qwen", "openai", "mistral"]
    : ["openai", "mistral", "qwen"];

  for (const pModel of pollinationsModels) {
    try {
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `${req.system}${req.json ? "\n\nBalas HANYA JSON valid. Tanpa teks pembuka atau penutup." : ""}` },
            { role: "user", content: req.prompt },
          ],
          model: pModel,
          temperature: req.temperature ?? (req.json ? 0.2 : 0.6),
          seed: Math.floor(Math.random() * 100000),
          jsonMode: Boolean(req.json),
        }),
      });

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          void recordLlmUsage({
            model: `freellmapi-${pModel}`,
            source: "freellmapi",
            promptTokens: Math.round((req.system.length + req.prompt.length) / 4),
            completionTokens: Math.round(text.length / 4),
          }).catch(() => {});
          return {
            text: text.trim(),
            model: `freellmapi-${pModel}`,
            provider: `FreeLLMAPI Native (${pModel})`,
          };
        }
      }
      errors.push(`Pollinations (${pModel}): HTTP ${res.status}`);
      if (res.status === 402 || res.status === 429) break;
    } catch (e: any) {
      errors.push(`Pollinations (${pModel}): ${e.message}`);
    }
  }

  throw new Error(`Semua provider FreeLLMAPI gagal: ${errors.join(" | ")}`);
}
