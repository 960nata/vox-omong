const syncFs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
Module._extensions[".ts"] = (mod, filename) => {
  const source = syncFs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(output, filename);
};

console.log("=== Testing FreeLLMAPI & AIGW Isolation ===\n");

async function run() {
  const { MODEL_CREDIT_MULTIPLIERS, calculateEstimatedCredits } = require("../src/lib/tokenPricing.ts");

  // 1. Verify FreeLLMAPI entries exist and are 0 cost
  const freeModels = [
    "freellmapi",
    "freellmapi-auto",
    "freellmapi-groq",
    "freellmapi-cerebras",
    "freellmapi-gemini",
    "freellmapi-mistral",
  ];

  for (const m of freeModels) {
    if (!MODEL_CREDIT_MULTIPLIERS[m]) {
      throw new Error(`Model ${m} tidak ditemukan di MODEL_CREDIT_MULTIPLIERS!`);
    }
    if (MODEL_CREDIT_MULTIPLIERS[m].in !== 0 || MODEL_CREDIT_MULTIPLIERS[m].out !== 0) {
      throw new Error(`Model ${m} memiliki biaya non-nol! Harus 0 kredit.`);
    }
    console.log(`✓ Model [${m}] terdaftar dengan 0 biaya (Gratis)`);
  }

  // 2. Test calculateEstimatedCredits for FreeLLMAPI
  const freeCost = calculateEstimatedCredits("freellmapi-groq", 1000, 2000, "freellmapi");
  if (freeCost !== 0) {
    throw new Error(`Perhitungan kredit FreeLLMAPI gagal! Diharapkan 0, didapat: ${freeCost}`);
  }
  console.log(`✓ calculateEstimatedCredits untuk FreeLLMAPI = ${freeCost} Kredit (100% Gratis - Saldo Utuh)`);

  // 3. Test calculateEstimatedCredits for AIGW (Paid)
  const paidCost = calculateEstimatedCredits("claude-sonnet-5.5", 1000, 2000, "classai_prime");
  if (paidCost <= 0) {
    throw new Error(`Perhitungan kredit AIGW gagal! Diharapkan > 0, didapat: ${paidCost}`);
  }
  console.log(`✓ calculateEstimatedCredits untuk AIGW (Sonnet 5.5) = ${paidCost} Kredit (Potong Saldo Berbayar)`);

  console.log("\nALL FREELLMAPI & AIGW ISOLATION TESTS PASSED 100%!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
