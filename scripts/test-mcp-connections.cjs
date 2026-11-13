const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

Module._extensions[".ts"] = (mod, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};

const { MCP_PROVIDERS, isMcpProvider, isReadTool, mcpProviderStatus, mcpRequiresStudioSession } = require(path.resolve(__dirname, "../src/lib/mcpConnections.ts"));
const { hasStudioSession, issueStudioSession } = require(path.resolve(__dirname, "../src/lib/studioAuth.ts"));
assert.deepEqual(MCP_PROVIDERS, ["perplexity", "firecrawl", "posthog", "playwright", "composio", "supabase", "vercel", "chrome-devtools"]);
assert.equal(isMcpProvider("firecrawl"), true);
assert.equal(isMcpProvider("unknown"), false);
assert.equal(mcpProviderStatus().length, 8);
assert.equal(isReadTool("playwright", { name: "browser_navigate" }), true);
assert.equal(isReadTool("playwright", { name: "browser_click" }), false);
assert.equal(isReadTool("posthog", { name: "list_errors" }), true);
assert.equal(isReadTool("composio", { name: "execute_tool" }), false);
assert.equal(isReadTool("firecrawl", { name: "firecrawl_scrape" }), true);
assert.equal(mcpRequiresStudioSession("playwright"), true);
const oldPin = process.env.STUDIO_PIN;
process.env.STUDIO_PIN = "test-pin-only";
const cookie = issueStudioSession("test-pin-only");
assert.equal(hasStudioSession(new Request("http://localhost", { headers: { Cookie: `vox_studio_session=${cookie}` } })), true);
assert.equal(hasStudioSession(new Request("http://localhost", { headers: { Cookie: "vox_studio_session=bad" } })), false);
if (oldPin === undefined) delete process.env.STUDIO_PIN; else process.env.STUDIO_PIN = oldPin;
console.log("MCP provider catalog and read-only tool policy passed.");
