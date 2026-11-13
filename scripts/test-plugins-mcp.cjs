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

const { MCP_PROVIDERS, isMcpProvider, mcpProviderStatus, isReadTool } = require("../src/lib/mcpConnections.ts");
const { loadSkill } = require("../src/lib/skillLoader.ts");
const { resolveSkill } = require("../src/lib/skillHub.ts");

async function run() {
  console.log("1. Testing MCP_PROVIDERS list and validation...");
  assert.ok(isMcpProvider("supabase"), "supabase harus terdaftar sebagai MCP provider");
  assert.ok(isMcpProvider("vercel"), "vercel harus terdaftar sebagai MCP provider");
  assert.ok(isMcpProvider("chrome-devtools"), "chrome-devtools harus terdaftar sebagai MCP provider");
  assert.equal(isMcpProvider("unknown-tool"), false, "unknown-tool harus ditolak");

  console.log("2. Testing mcpProviderStatus...");
  const statuses = mcpProviderStatus();
  const sbStatus = statuses.find(s => s.id === "supabase");
  const vcStatus = statuses.find(s => s.id === "vercel");
  const cdStatus = statuses.find(s => s.id === "chrome-devtools");

  assert.ok(sbStatus, "Status Supabase harus ada");
  assert.equal(sbStatus.name, "Supabase");
  assert.ok(vcStatus, "Status Vercel harus ada");
  assert.equal(vcStatus.name, "Vercel");
  assert.ok(cdStatus, "Status Chrome DevTools harus ada");
  assert.equal(cdStatus.name, "Chrome DevTools");

  console.log("3. Testing isReadTool filters...");
  // Supabase
  assert.equal(isReadTool("supabase", { name: "list_tables" }), true);
  assert.equal(isReadTool("supabase", { name: "get_schema" }), true);
  assert.equal(isReadTool("supabase", { name: "drop_table" }), false);
  assert.equal(isReadTool("supabase", { name: "insert_record" }), false);

  // Vercel
  assert.equal(isReadTool("vercel", { name: "list_deployments" }), true);
  assert.equal(isReadTool("vercel", { name: "get_build_logs" }), true);
  assert.equal(isReadTool("vercel", { name: "delete_project" }), false);
  assert.equal(isReadTool("vercel", { name: "create_deployment" }), false);

  // Chrome DevTools
  assert.equal(isReadTool("chrome-devtools", { name: "inspect_dom" }), true);
  assert.equal(isReadTool("chrome-devtools", { name: "get_console_logs" }), true);
  assert.equal(isReadTool("chrome-devtools", { name: "click_element" }), false);

  console.log("4. Testing Oh My Claude Code (OMC) skill loading & matching...");
  const omcBody = loadSkill("oh-my-claude");
  assert.ok(omcBody.length > 50, "Isi SKILL.md oh-my-claude harus terbaca");
  assert.match(omcBody, /Ultrawork/);

  const matched = await resolveSkill("tolong aktifkan mode ultrawork ala oh my claude");
  assert.ok(matched, "Harus cocok dengan query 'oh my claude'");
  assert.equal(matched.name, "oh-my-claude");

  console.log("5. Testing .mcp.json configuration file...");
  const mcpConfigRaw = await fs.readFile(path.join(root, ".mcp.json"), "utf8");
  const mcpConfig = JSON.parse(mcpConfigRaw);
  assert.ok(mcpConfig.mcpServers.supabase, "supabase harus ada di .mcp.json");
  assert.ok(mcpConfig.mcpServers.vercel, "vercel harus ada di .mcp.json");
  assert.ok(mcpConfig.mcpServers["chrome-devtools"], "chrome-devtools harus ada di .mcp.json");

  console.log("ALL PLUGIN & MCP INTEGRATION TESTS PASSED CLEANLY!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
