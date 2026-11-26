import { NextRequest, NextResponse } from "next/server";
import { allProviderStatus } from "@/lib/providers";

export const runtime = "nodejs";

export interface ProbedModel {
  id: string;
  tier: "free" | "local" | "paid";
}

interface ProbeResult {
  provider: string;
  kind: "local" | "free" | "paid";
  gatewayUrl?: string;
  status: "ok" | "error";
  latencyMs: number;
  models: ProbedModel[];
  note?: string;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const start = Date.now();
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const latencyMs = Date.now() - start;
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, latencyMs, data };
}

function classifyModelTier(id: string, defaultTier: "free" | "local" | "paid"): "free" | "local" | "paid" {
  const low = id.toLowerCase();
  if (low.includes(":free") || low === "kai-baik" || low.startsWith("freellmapi")) return "free";
  return defaultTier;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const customGatewayUrl = typeof body.customGatewayUrl === "string" ? body.customGatewayUrl.trim() : "";

    const probes: ProbeResult[] = [];

    // 1. Auto-scan AI Lokal: Ollama (11434) & LM Studio (1234)
    try {
      const ollama = await fetchJsonWithTimeout("http://127.0.0.1:11434/api/tags", { method: "GET" }, 1800);
      if (ollama.ok && Array.isArray(ollama.data?.models)) {
        const models: ProbedModel[] = ollama.data.models
          .map((m: any) => ({ id: String(m.name || m.model || ""), tier: "local" as const }))
          .filter((m: ProbedModel) => m.id);
        probes.push({
          provider: "Ollama Lokal (127.0.0.1:11434)",
          kind: "local",
          gatewayUrl: "http://127.0.0.1:11434/v1",
          status: "ok",
          latencyMs: ollama.latencyMs,
          models,
          note: models.length ? `${models.length} model lokal terpasang & siap offline (Rp 0).` : "Ollama aktif, belum ada model terpasang (jalankan `ollama pull llama3.2`).",
        });
      }
    } catch {
      // Ollama tidak aktif — lewati diam-diam
    }

    try {
      const lms = await fetchJsonWithTimeout("http://127.0.0.1:1234/v1/models", { method: "GET" }, 1500);
      if (lms.ok && Array.isArray(lms.data?.data)) {
        const models: ProbedModel[] = lms.data.data
          .map((m: any) => ({ id: String(m.id || ""), tier: "local" as const }))
          .filter((m: ProbedModel) => m.id);
        probes.push({
          provider: "LM Studio Lokal (127.0.0.1:1234)",
          kind: "local",
          gatewayUrl: "http://127.0.0.1:1234/v1",
          status: "ok",
          latencyMs: lms.latencyMs,
          models,
          note: `${models.length} model lokal LM Studio siap dipakai (Rp 0).`,
        });
      }
    } catch {
      // LM Studio tidak aktif
    }

    // 2. Probe API key yang ditempel user (atau fallback ke key server di .env)
    const activeKey =
      rawKey ||
      process.env.AI_GATEWAY_KEY_CHEAP ||
      process.env.AI_GATEWAY_KEY ||
      process.env.USER_GATEWAY_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      "";

    if (activeKey.startsWith("AIzaSy")) {
      try {
        const r = await fetchJsonWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(activeKey)}`,
          { method: "GET" }
        );
        if (r.ok && Array.isArray(r.data?.models)) {
          const models: ProbedModel[] = r.data.models
            .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
            .map((m: any) => ({ id: String(m.name || "").replace(/^models\//, ""), tier: "free" as const }))
            .filter((m: ProbedModel) => m.id);
          probes.push({
            provider: "Google Gemini Direct (Free Tier)",
            kind: "free",
            status: "ok",
            latencyMs: r.latencyMs,
            models,
            note: `${models.length} model Gemini gratis terdeteksi (0 kredit ClassAI).`,
          });
        } else {
          probes.push({ provider: "Google Gemini Direct", kind: "free", status: "error", latencyMs: r.latencyMs, models: [], note: r.data?.error?.message || `HTTP ${r.status}` });
        }
      } catch (e: any) {
        probes.push({ provider: "Google Gemini Direct", kind: "free", status: "error", latencyMs: 0, models: [], note: e?.message || "Timeout" });
      }
    } else if (activeKey.startsWith("gsk_")) {
      try {
        const r = await fetchJsonWithTimeout("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${activeKey}` },
        });
        if (r.ok && Array.isArray(r.data?.data)) {
          const models: ProbedModel[] = r.data.data.map((m: any) => ({ id: String(m.id), tier: "free" as const })).filter((m: ProbedModel) => m.id);
          probes.push({
            provider: "Groq Cloud (Free LPU)",
            kind: "free",
            gatewayUrl: "https://api.groq.com/openai/v1",
            status: "ok",
            latencyMs: r.latencyMs,
            models,
            note: `${models.length} model Groq super cepat tersedia (Free Tier).`,
          });
        } else {
          probes.push({ provider: "Groq Cloud", kind: "free", status: "error", latencyMs: r.latencyMs, models: [], note: `HTTP ${r.status}` });
        }
      } catch (e: any) {
        probes.push({ provider: "Groq Cloud", kind: "free", status: "error", latencyMs: 0, models: [], note: e?.message || "Timeout" });
      }
    } else if (activeKey.startsWith("sk-or-")) {
      try {
        const r = await fetchJsonWithTimeout("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${activeKey}` },
        });
        if (r.ok && Array.isArray(r.data?.data)) {
          const allModels: ProbedModel[] = r.data.data
            .map((m: any) => {
              const id = String(m.id || "");
              const isFree = id.endsWith(":free") || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);
              return { id, tier: (isFree ? "free" : "paid") as "free" | "paid" };
            })
            .filter((m: ProbedModel) => m.id);
          // Prioritaskan model :free di urutan paling atas
          allModels.sort((a, b) => (a.tier === "free" ? -1 : 1) - (b.tier === "free" ? -1 : 1));
          const freeCount = allModels.filter((m) => m.tier === "free").length;
          probes.push({
            provider: "OpenRouter",
            kind: freeCount > 0 ? "free" : "paid",
            gatewayUrl: "https://openrouter.ai/api/v1",
            status: "ok",
            latencyMs: r.latencyMs,
            models: allModels.slice(0, 60),
            note: `${allModels.length} model ditemukan (${freeCount} model GRATIS :free, sisanya berbayar).`,
          });
        } else {
          probes.push({ provider: "OpenRouter", kind: "paid", status: "error", latencyMs: r.latencyMs, models: [], note: `HTTP ${r.status}` });
        }
      } catch (e: any) {
        probes.push({ provider: "OpenRouter", kind: "paid", status: "error", latencyMs: 0, models: [], note: e?.message || "Timeout" });
      }
    } else if (activeKey.startsWith("aigw_")) {
      const url = customGatewayUrl || process.env.USER_GATEWAY_URL || "https://aiinvestdesk.com/api/v1/ai/gateway";
      try {
        const r = await fetchJsonWithTimeout(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeKey}` },
            body: JSON.stringify({ agent: "custom", prefer: ["deepseek"], system: "ping", prompt: "Balas 1 kata: OK", maxTokens: 10 }),
          },
          15000
        );
        if (r.ok && r.data?.ok) {
          const activeModel = r.data?.meta?.model || "agnes-3.0-flash";
          probes.push({
            provider: "AI GW Free (Gateway Pribadi)",
            kind: "free",
            status: "ok",
            latencyMs: r.latencyMs,
            models: [
              { id: activeModel, tier: "free" },
              { id: "deepseek", tier: "free" },
              { id: "groq", tier: "free" },
              { id: "cerebras", tier: "free" },
              { id: "gemini", tier: "free" },
            ],
            note: `Terhubung! Model aktif: ${activeModel} (0 kredit / Gratis).`,
          });
        } else {
          probes.push({ provider: "AI GW Free", kind: "free", status: "error", latencyMs: r.latencyMs, models: [], note: `HTTP ${r.status}` });
        }
      } catch (e: any) {
        probes.push({ provider: "AI GW Free", kind: "free", status: "error", latencyMs: 0, models: [], note: e?.message || "Timeout" });
      }
    } else if (activeKey || customGatewayUrl) {
      const base = (customGatewayUrl || process.env.AI_GATEWAY_URL || "https://router.classai.id/v1").replace(/\/+$/, "");
      const modelsUrl = base.endsWith("/models") ? base : `${base}/models`;
      const isLocal = /127\.0\.0\.1|localhost/.test(base);
      const isClassAi = base.includes("classai");
      try {
        const r = await fetchJsonWithTimeout(modelsUrl, {
          headers: activeKey ? { Authorization: `Bearer ${activeKey}` } : {},
        });
        if (r.ok && Array.isArray(r.data?.data)) {
          const models: ProbedModel[] = r.data.data
            .map((m: any) => {
              const id = String(m.id || "");
              return { id, tier: classifyModelTier(id, isLocal ? "local" : "paid") };
            })
            .filter((m: ProbedModel) => m.id);
          models.sort((a, b) => (a.tier === "paid" ? 1 : 0) - (b.tier === "paid" ? 1 : 0));
          const freeCount = models.filter((m) => m.tier !== "paid").length;
          probes.push({
            provider: isClassAi ? "API GW Classic (ClassAI Prabayar)" : isLocal ? `AI Lokal (${base})` : `Custom Gateway (${base})`,
            kind: isLocal ? "local" : freeCount === models.length ? "free" : "paid",
            gatewayUrl: base,
            status: "ok",
            latencyMs: r.latencyMs,
            models,
            note: `${models.length} model bisa diakses (${freeCount} gratis/lokal, ${models.length - freeCount} prabayar).`,
          });
        } else {
          probes.push({ provider: base, kind: isLocal ? "local" : "paid", status: "error", latencyMs: r.latencyMs, models: [], note: r.data?.error?.message || `HTTP ${r.status}` });
        }
      } catch (e: any) {
        probes.push({ provider: base, kind: isLocal ? "local" : "paid", status: "error", latencyMs: 0, models: [], note: e?.message || "Timeout" });
      }
    }

    // 3. Jika ada AI GW Free di .env dan user tidak sedang menguji key aigw_, tampilkan juga statusnya
    if (!activeKey.startsWith("aigw_") && process.env.USER_GATEWAY_KEY) {
      probes.push({
        provider: "AI GW Free (.env lokal)",
        kind: "free",
        status: "ok",
        latencyMs: 0,
        models: [
          { id: "user-private", tier: "free" },
          { id: "deepseek", tier: "free" },
          { id: "groq", tier: "free" },
        ],
        note: "Key AI GW Free siap dipakai sebagai jalur gratis & auto-rotasi saat kuota utama habis.",
      });
    }

    // 4. Cek status CLI langganan (Codex / ChatGPT Plus, Claude Code, Gemini CLI)
    const subscriptions = await allProviderStatus().catch(() => []);

    return NextResponse.json({
      success: true,
      probes,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        label: s.label,
        subscription: s.subscription,
        installed: Boolean(s.bin),
        auth: s.auth,
        detail: s.detail,
        loginCommand: s.login,
        installCommand: s.install,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Gagal menganalisis model" }, { status: 500 });
  }
}
