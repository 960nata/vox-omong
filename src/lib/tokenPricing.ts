export const INITIAL_BALANCE = 742_000_000; // Sisa Saldo Real Terkini: 742 Juta Kredit (dari dashboard ClassAI)

// Pengali kredit per 1 token (input / output) sesuai tarif resmi ClassAI Router
// 1 IDR = 6.666,67 Kredit (idr_per_unit = 0.00015)
export const MODEL_CREDIT_MULTIPLIERS: Record<string, { in: number; out: number }> = {
  // Auto Orchestrators
  "coding-china-auto": { in: 12.5, out: 61.6 },
  "coding-us-auto": { in: 30, out: 150 },

  // DeepSeek Series
  "deepseek-v4.1-flash": { in: 8.3, out: 30.2 },
  "deepseek-v4.1-flash-1017": { in: 7.7, out: 28 },
  "deepseek-v4-flash": { in: 7.7, out: 30.9 },
  "deepseek-v4-flash-0731": { in: 7.2, out: 27.5 },
  "deepseek-v4-pro": { in: 20.9, out: 55 },
  "deepseek-v4-pro-0813": { in: 21.4, out: 55 },
  "deepseek-chat": { in: 8.3, out: 30.2 },

  // Claude Series
  "claude-fable-5": { in: 66, out: 330 },
  "claude-opus-5.5": { in: 52.8, out: 264 },
  "claude-opus-5.0": { in: 52.8, out: 264 },
  "claude-opus-4.8": { in: 66, out: 330 },
  "claude-opus-4.7": { in: 66, out: 330 },
  "claude-opus-4.6": { in: 66, out: 330 },
  "claude-sonnet-5.5": { in: 26.4, out: 132 },
  "claude-sonnet-5.0": { in: 26.4, out: 132 },
  "claude-sonnet-4.6": { in: 26.4, out: 132 },
  "claude-sonnet-4.5": { in: 26.4, out: 132 },
  "claude-haiku-5.5": { in: 10.8, out: 33 },
  "claude-haiku-4.5": { in: 6.6, out: 33 },

  // OpenAI & Grok Series
  "gpt-6-astra": { in: 66, out: 330 },
  "gpt-6.1-sol": { in: 34.2, out: 100 },
  "gpt-6-sol": { in: 34.2, out: 110 },
  "gpt-6-luna": { in: 12.4, out: 61.9 },
  "gpt-5.6-sol": { in: 34.2, out: 110 },
  "gpt-5.6-terra": { in: 28.8, out: 82.5 },
  "gpt-5.6-luna": { in: 12.4, out: 61.9 },
  "grok-4.7": { in: 21.1, out: 66 },

  // Alibaba Qwen Series
  "qwen3.8-max": { in: 13.2, out: 66 },
  "qwen3.7-max": { in: 9.8, out: 48.7 },
  "qwen3.7-plus": { in: 5.4, out: 24.7 },

  // GLM, Kimi, MiniMax, Hunyuan
  "glm-5.3": { in: 12.5, out: 61.6 },
  "glm-5.3-flash": { in: 7.4, out: 30.8 },
  "glm-5.2": { in: 12.3, out: 61.6 },
  "glm-5.1": { in: 12.3, out: 61.6 },
  "kimi-k3": { in: 19.8, out: 99 },
  "kimi-k2.7-code": { in: 8.4, out: 41.8 },
  "kimi-k2.6": { in: 8.4, out: 41.8 },
  "minimax-m3": { in: 6, out: 23.1 },
  "minimax-m2.7": { in: 5.3, out: 13.2 },
  "hy3": { in: 9.9, out: 49.5 },
  "gemini-3.8-flash": { in: 14, out: 56 },

  // 100% Model Gratisan & Kai Grant
  "kai-baik": { in: 0, out: 0 },
  "nemotron-3.5-lightning:free": { in: 0, out: 0 },
  "nemotron-3.5-super-vl:free": { in: 0, out: 0 },
  "nemotron-3-nano-omni:free": { in: 0, out: 0 },
  "nemotron-3-ultra:free": { in: 0, out: 0 },
  "solar-mini4:free": { in: 0, out: 0 },
  "north-mini-code:free": { in: 0, out: 0 },
  "gemma-4-31b:free": { in: 0, out: 0 },
  "gemma-4-26b:free": { in: 0, out: 0 },
  "dots-3-note:free": { in: 0, out: 0 },
  "flint-1.0:free": { in: 0, out: 0 },
  "lfm-3-1.7b:free": { in: 0, out: 0 },
  "longcat-2.5:free": { in: 0, out: 0 },
  "step-3.7-flash:free": { in: 0, out: 0 },
  "user-private": { in: 0, out: 0 },

  // Google Direct API
  "gemini-2.5-flash": { in: 0, out: 0 },
  "gemini-1.5-flash": { in: 0, out: 0 },
};

// Premium multipliers jika memanggil AI_GATEWAY_KEY_PREMIUM (Sultan Key)
export const PREMIUM_CREDIT_MULTIPLIERS: Record<string, { in: number; out: number }> = {
  "claude-opus-5.5": { in: 963.8, out: 4819 },
  "claude-opus-5.0": { in: 963.8, out: 4819 },
  "claude-sonnet-5.5": { in: 481.9, out: 2409.5 },
  "claude-sonnet-5.0": { in: 481.9, out: 2409.5 },
  "claude-haiku-4.5": { in: 241, out: 1204.8 },
};

export interface ModelPricingItem {
  id: string;
  name: string;
  tier: string;
  inMultiplier: number;
  outMultiplier: number;
  costPerCall: string;
  capacity775M: string;
  desc: string;
}

export const MODEL_PRICING_CATALOG: ModelPricingItem[] = [
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    tier: "Ultra Hemat",
    inMultiplier: 1,
    outMultiplier: 2,
    costPerCall: "~600 kredit",
    capacity775M: "~1.200.000 panggilan",
    desc: "Pilihan utama chat & coding harian. Hemat gila-gilaan!",
  },
  {
    id: "claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    tier: "Hemat Cepat",
    inMultiplier: 12,
    outMultiplier: 60,
    costPerCall: "~24.000 kredit",
    capacity775M: "~32.000 panggilan",
    desc: "Mampu membaca gambar/UI mockup & arsitektur cepat.",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    tier: "Menengah",
    inMultiplier: 30,
    outMultiplier: 150,
    costPerCall: "~55.000 kredit",
    capacity775M: "~14.000 panggilan",
    desc: "Frontier coding seimbang untuk fitur kompleks.",
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    tier: "Menengah Tinggi",
    inMultiplier: 35,
    outMultiplier: 175,
    costPerCall: "~65.000 kredit",
    capacity775M: "~11.900 panggilan",
    desc: "High throughput reasoning engineering & debugging.",
  },
  {
    id: "claude-sonnet-5.0",
    name: "Claude Sonnet 5.0",
    tier: "Flagship",
    inMultiplier: 40,
    outMultiplier: 200,
    costPerCall: "~80.000 kredit",
    capacity775M: "~9.600 panggilan",
    desc: "Kemampuan logika kuat untuk arsitektur multi-file.",
  },
  {
    id: "claude-sonnet-5.5",
    name: "Claude Sonnet 5.5",
    tier: "Flagship Frontier",
    inMultiplier: 45,
    outMultiplier: 225,
    costPerCall: "~90.000 kredit",
    capacity775M: "~8.600 panggilan",
    desc: "Model coding paling presisi, audit kode & refactor masif.",
  },
  {
    id: "claude-opus-5.0",
    name: "Claude Opus 5.0",
    tier: "Sultan Tier",
    inMultiplier: 65,
    outMultiplier: 325,
    costPerCall: "~130.000 kredit",
    capacity775M: "~5.900 panggilan",
    desc: "Penalaran mendalam untuk masalah algoritmik berat.",
  },
  {
    id: "claude-opus-5.5",
    name: "Claude Opus 5.5",
    tier: "Ultimate Sultan",
    inMultiplier: 75,
    outMultiplier: 375,
    costPerCall: "~150.000 kredit",
    capacity775M: "~5.100 panggilan",
    desc: "Reasoning level tertinggi. Gunakan untuk task raksasa / arsitektur final.",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    tier: "Direct API",
    inMultiplier: 0,
    outMultiplier: 0,
    costPerCall: "0 kredit (Gratis API Key)",
    capacity775M: "Unlimited kuota harian",
    desc: "Langsung ke Google API tanpa memotong kredit router.",
  },
  {
    id: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    tier: "Flagship China",
    inMultiplier: 13.2,
    outMultiplier: 66,
    costPerCall: "~30.000 kredit",
    capacity775M: "~25.000 panggilan",
    desc: "Qwen paling pintar dari Alibaba — reasoning dan coding berat.",
  },
  {
    id: "qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    tier: "Ultra Hemat",
    inMultiplier: 5.4,
    outMultiplier: 24.7,
    costPerCall: "~2.000 kredit",
    capacity775M: "~380.000 panggilan",
    desc: "Cepat dan sangat hemat untuk volume tinggi.",
  },
  {
    id: "gpt-6-sol",
    name: "GPT-6 Sol",
    tier: "Flagship Frontier",
    inMultiplier: 34.2,
    outMultiplier: 110,
    costPerCall: "~65.000 kredit",
    capacity775M: "~11.900 panggilan",
    desc: "GPT-6 seimbang — reasoning, coding, dan agen konteks 1M.",
  },
  {
    id: "user-private",
    name: "Gateway Pribadi (aigw)",
    tier: "Server Sendiri",
    inMultiplier: 0,
    outMultiplier: 0,
    costPerCall: "0 kredit (Server Pribadi)",
    capacity775M: "Bebas Kuota",
    desc: "Menggunakan server proxy dan LLM pribadi lu sendiri.",
  },
  {
    id: "nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning (Free)",
    tier: "100% Gratis",
    inMultiplier: 0,
    outMultiplier: 0,
    costPerCall: "0 kredit (Gratis)",
    capacity775M: "Free limited quota",
    desc: "Model NVIDIA gratis untuk tugas harian dan backup darurat.",
  },
];

export interface UsageRecord {
  id: string;
  timestamp: string;
  model: string;
  source: "classai_prime" | "classai_premium" | "gemini_direct" | "custom_local";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCredits: number;
}

export interface UsageSummary {
  initialCredits: number;
  totalCreditsUsed: number;
  remainingCredits: number;
  totalTokensUsed: number;
  totalCalls: number;
  byModel: Record<
    string,
    {
      calls: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCredits: number;
    }
  >;
  recentCalls: UsageRecord[];
}

export function calculateEstimatedCredits(
  model: string,
  promptTokens: number,
  completionTokens: number,
  source?: UsageRecord["source"]
): number {
  const norm = model.toLowerCase();
  let mult = { in: 8.3, out: 30.2 }; // default Prime

  if (source === "classai_premium") {
    for (const [key, val] of Object.entries(PREMIUM_CREDIT_MULTIPLIERS)) {
      if (norm.includes(key)) {
        mult = val;
        break;
      }
    }
  } else {
    for (const [key, val] of Object.entries(MODEL_CREDIT_MULTIPLIERS)) {
      if (norm.includes(key)) {
        mult = val;
        break;
      }
    }
  }

  return Math.round(promptTokens * mult.in + completionTokens * mult.out);
}
