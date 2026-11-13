const path = require("node:path");
const Module = require("node:module");
const syncFs = require("node:fs");
const ts = require("typescript");

// Load .env.local
const envFile = syncFs.readFileSync(".env.local", "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Za-z_0-9]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2];
  }
}

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) request = path.join(root, "src", request.slice(2));
  if (request.startsWith("./") && parent?.filename?.endsWith(".ts")) {
    const candidate = path.resolve(path.dirname(parent.filename), request + ".ts");
    if (syncFs.existsSync(candidate)) request = candidate;
  }
  return originalResolve.call(this, request, parent, ...rest);
};
Module._extensions[".ts"] = (mod, filename) => {
  const source = syncFs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  mod._compile(output, filename);
};

const { callLLM } = require("../src/lib/codeAgent.ts");

async function main() {
  console.log("🧪 Testing Team Agent Call with Stale/Invalid Key (Simulating user's previous 401 error)...");
  
  try {
    const resultWithBadKey = await callLLM({
      apiKey: "aigw_old_dummy_key_from_browser_storage",
      system: "Kamu Reza, ATS Resume Specialist. Jawab ringkas dalam 1 kalimat.",
      prompt: "Halo Reza, mohon konfirmasi kesiapanmu mengecek resume.",
      prefer: ["deepseek", "cheap"],
      fast: true,
      maxTokens: 100,
    });
    console.log("✅ Reza (dengan key invalid dari storage) BERHASIL via server fallback!");
    console.log("Model:", resultWithBadKey.model);
    console.log("Hasil:", resultWithBadKey.text.trim());
  } catch (err) {
    console.error("❌ Gagal:", err.message);
    process.exit(1);
  }

  console.log("\n🧪 Testing Team Agent Call without apiKey (Empty string)...");
  try {
    const resultNormal = await callLLM({
      apiKey: "",
      system: "Kamu Tasya, Job Matcher & Interview Coach. Jawab ringkas dalam 1 kalimat.",
      prompt: "Halo Tasya, apakah kamu siap?",
      prefer: ["deepseek", "cheap"],
      fast: true,
      maxTokens: 100,
    });
    console.log("✅ Tasya BERHASIL!");
    console.log("Model:", resultNormal.model);
    console.log("Hasil:", resultNormal.text.trim());
  } catch (err) {
    console.error("❌ Gagal:", err.message);
    process.exit(1);
  }

  console.log("\n🎉 ALL TESTS PASSED! Router 401 issue is completely resolved!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
