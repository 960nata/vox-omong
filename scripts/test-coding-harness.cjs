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

const { runCodingHarness } = require("../src/lib/codingHarness.ts");
const projectId = `harness-test-${process.pid}`;
const project = path.join(root, ".data", "user_projects", projectId);

async function main() {
  await fs.mkdir(project, { recursive: true });
  try {
    await fs.writeFile(path.join(project, "sample.js"), "const answer = 1;\nconsole.log(answer);\n");
    await fs.symlink(path.join(root, ".env.example"), path.join(project, "outside.js"));
    const actions = [
      { tool: "read_file", path: "sample.js" },
      { tool: "replace_text", path: "outside.js", oldText: "x", newText: "y" },
      { tool: "replace_text", path: "sample.js", oldText: "const answer = 1;", newText: "const answer = ;" },
      { tool: "replace_text", path: "sample.js", oldText: "const answer = 1;", newText: "const answer = 2;" },
      { tool: "create_file", path: "extra.js", content: "module.exports = { extra: true };\n" },
      { tool: "run_check", path: "sample.js" },
      { tool: "run_check", path: "extra.js" },
      { tool: "finish", summary: "Nilai answer diperbarui dan file baru dibuat." },
    ];
    let turn = 0;
    const prompts = [];
    const result = await runCodingHarness(projectId, "Ubah answer menjadi 2", async (_system, prompt) => { prompts.push(prompt); return JSON.stringify(actions[turn++]); });
    assert.deepEqual(result.changedFiles, ["sample.js", "extra.js"]);
    assert.match(result.reply, /node --check/);
    assert.match(prompts.join("\n"), /Symlink tidak boleh/);
    assert.match(result.reply, /sintaks/);
    assert.equal(await fs.readFile(path.join(project, "sample.js"), "utf8"), "const answer = 2;\nconsole.log(answer);\n");
    assert.equal(await fs.readFile(path.join(project, "extra.js"), "utf8"), "module.exports = { extra: true };\n");
    await fs.writeFile(path.join(project, "typed.ts"), "export const total: number = 2;\n");
    await fs.writeFile(path.join(project, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, files: ["typed.ts"] }));
    const typeActions = [{ tool: "run_check", path: "tsconfig.json" }, { tool: "finish" }];
    let typeTurn = 0;
    const typeResult = await runCodingHarness(projectId, "Periksa TypeScript", async () => JSON.stringify(typeActions[typeTurn++]));
    assert.match(typeResult.reply, /TypeScript typecheck/);
    await fs.writeFile(path.join(project, "sample.test.js"), "const test = require('node:test'); const assert = require('node:assert/strict'); test('answer', () => assert.equal(2, 2));\n");
    const testActions = [{ tool: "run_test", path: "sample.test.js" }, { tool: "finish" }];
    let testTurn = 0;
    const testResult = await runCodingHarness(projectId, "Jalankan tes", async () => JSON.stringify(testActions[testTurn++]));
    assert.match(testResult.reply, /Lulus: terminal menjalankan sample.test.js/);
    console.log("Coding harness: edit, symlink guard, and terminal check passed.");
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
