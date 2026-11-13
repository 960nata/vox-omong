import fs from "fs/promises";
import path from "path";
import {
  INITIAL_BALANCE,
  calculateEstimatedCredits,
  type ModelPricingItem,
  MODEL_PRICING_CATALOG,
  type UsageRecord,
  type UsageSummary,
} from "./tokenPricing";

export {
  INITIAL_BALANCE,
  calculateEstimatedCredits,
  type ModelPricingItem,
  MODEL_PRICING_CATALOG,
  type UsageRecord,
  type UsageSummary,
};

const USAGE_FILE = path.join(process.cwd(), ".data", "token_usage.json");

interface StoredData {
  initialCredits: number;
  records: UsageRecord[];
}

async function loadData(): Promise<StoredData> {
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      initialCredits: INITIAL_BALANCE,
      records: [],
    };
  }
}

async function saveData(data: StoredData): Promise<void> {
  await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
  // Batasi penyimpanan log maksimal 500 pemanggilan terakhir agar file tidak membengkak
  data.records = data.records.slice(-500);
  await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function recordLlmUsage(entry: {
  model: string;
  source?: UsageRecord["source"];
  promptTokens: number;
  completionTokens: number;
}): Promise<UsageRecord> {
  const data = await loadData();
  const source = entry.source || (entry.model.includes("gemini") ? "gemini_direct" : "classai_prime");
  const estimatedCredits = calculateEstimatedCredits(entry.model, entry.promptTokens, entry.completionTokens, source);

  const record: UsageRecord = {
    id: `usg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    model: entry.model,
    source,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    totalTokens: entry.promptTokens + entry.completionTokens,
    estimatedCredits,
  };

  data.records.push(record);
  await saveData(data);
  return record;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const data = await loadData();
  const byModel: UsageSummary["byModel"] = {};
  let totalCreditsUsed = 0;
  let totalTokensUsed = 0;

  for (const r of data.records) {
    totalCreditsUsed += r.estimatedCredits;
    totalTokensUsed += r.totalTokens;

    if (!byModel[r.model]) {
      byModel[r.model] = {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCredits: 0,
      };
    }

    byModel[r.model].calls += 1;
    byModel[r.model].promptTokens += r.promptTokens;
    byModel[r.model].completionTokens += r.completionTokens;
    byModel[r.model].totalTokens += r.totalTokens;
    byModel[r.model].estimatedCredits += r.estimatedCredits;
  }

  const initial = data.initialCredits || INITIAL_BALANCE;
  const remainingCredits = Math.max(0, initial - totalCreditsUsed);

  return {
    initialCredits: initial,
    totalCreditsUsed,
    remainingCredits,
    totalTokensUsed,
    totalCalls: data.records.length,
    byModel,
    recentCalls: data.records.slice(-20).reverse(),
  };
}
