const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

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

const { rememberSemantic, recallSemantic, autoLearnPreferences, getUserPreferences, cosineSimilarity } = require("../src/lib/agentic/semanticMemory.ts");
const { AGENT_TOOLS, executeAgentTool } = require("../src/lib/agentic/toolRegistry.ts");
const { planAutonomousTask } = require("../src/lib/agentic/planner.ts");
const { createBackgroundTask, getBackgroundTask, listBackgroundTasks } = require("../src/lib/agentic/taskQueue.ts");

async function runTests() {
  console.log("🚀 Testing Agentic AI System Components...\n");

  // 1. Semantic Memory & Vector Math
  console.log("1. Testing Semantic Memory & Cosine Similarity...");
  const vecA = [1, 0, 1, 0];
  const vecB = [1, 0, 1, 0];
  const vecC = [0, 1, 0, 1];
  assert.equal(Math.round(cosineSimilarity(vecA, vecB)), 1);
  assert.equal(Math.round(cosineSimilarity(vecA, vecC)), 0);

  await rememberSemantic("Bantuan Tailwind", "Gunakan flexbox dan gap-4 untuk layout kartu yang rapi.", "solution");
  const recalled = await recallSemantic("Bagaimana membuat layout kartu tailwind?");
  assert.ok(recalled.length > 0, "Harus menemukan memori terkait tailwind");
  console.log(`   ✓ Semantic recall berhasil: "${recalled[0].item.topic}" (score: ${(recalled[0].score * 100).toFixed(1)}%)`);

  // User preference learning
  await autoLearnPreferences("Saya lebih suka mode gelap dan gaya modern minimalis");
  const prefs = await getUserPreferences();
  assert.equal(prefs.themePreference, "dark");
  console.log(`   ✓ Preference learning berhasil: Theme=${prefs.themePreference}, Style=${prefs.designStyle}`);

  // 2. Tool Registry
  console.log("\n2. Testing Universal Tool Registry...");
  assert.ok(AGENT_TOOLS.file_list, "Tool file_list harus terdaftar");
  assert.ok(AGENT_TOOLS.file_read, "Tool file_read harus terdaftar");
  assert.ok(AGENT_TOOLS.terminal_exec, "Tool terminal_exec harus terdaftar");

  const listRes = await executeAgentTool("file_list", {}, { projectId: "default-workspace" });
  assert.equal(listRes.success, true);
  console.log(`   ✓ Tool execution (file_list) sukses: ${listRes.output.slice(0, 80)}...`);

  // 3. Autonomous Planner
  console.log("\n3. Testing Dynamic Intent & DAG Planner...");
  const plan = await planAutonomousTask("Halo apa kabar Vox?");
  assert.equal(plan.isAutonomousGoal, false);
  console.log(`   ✓ Sapaan santai berhasil dideteksi sebagai non-autonomous`);

  // 4. Background Task Queue
  console.log("\n4. Testing Async Background Task Queue...");
  const task = await createBackgroundTask("Analisis performa halaman web", { mode: "plan" });
  assert.ok(task.id.startsWith("task-"));
  assert.equal(task.status, "queued");
  console.log(`   ✓ Background task terdaftar: ${task.id}`);

  const fetched = await getBackgroundTask(task.id);
  assert.ok(fetched !== null);
  const allTasks = await listBackgroundTasks();
  assert.ok(allTasks.length > 0);
  console.log(`   ✓ Task retrieval & queue listing verified (${allTasks.length} tasks recorded)`);

  console.log("\n🎉 ALL AGENTIC AI SUITE TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
