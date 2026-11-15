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

console.log("=== Testing Native FreeLLMAPI (No Docker Needed) ===\n");

async function run() {
  const { callNativeFreeLLM } = require("../src/lib/freellmEngine.ts");

  console.log("Menguji panggilan ke FreeLLMAPI Native (Pollinations Zero-Key)...");
  const res = await callNativeFreeLLM({
    system: "Kamu adalah asisten AI hemat dan cepat.",
    prompt: "Jawab dalam 1 kalimat pendek: Apa itu VOX AI?",
    model: "freellmapi-auto",
    maxTokens: 60,
  });

  console.log("✓ Berhasil mendapat respons!");
  console.log(`Provider: ${res.provider}`);
  console.log(`Model:    ${res.model}`);
  console.log(`Hasil:    "${res.text}"`);

  console.log("\nALL NATIVE FREELLMAPI TESTS PASSED 100% TANPA DOCKER!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
