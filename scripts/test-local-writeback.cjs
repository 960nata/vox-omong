const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

Module._extensions[".ts"] = (mod, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};

const records = new Map();
const db = {
  createObjectStore() {},
  close() {},
  transaction() {
    const tx = { oncomplete: null, onerror: null, objectStore() { return {
      put(value, key) { records.set(key, value); queueMicrotask(() => tx.oncomplete?.()); },
      get(key) { const request = { result: undefined, onsuccess: null, onerror: null }; queueMicrotask(() => { request.result = records.get(key); request.onsuccess?.(); }); return request; },
    }; } };
    return tx;
  },
};
let firstOpen = true;
global.indexedDB = { open() {
  const request = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
  queueMicrotask(() => { if (firstOpen) { firstOpen = false; request.onupgradeneeded?.(); } request.onsuccess?.(); });
  return request;
} };
const storage = new Map();
global.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };

let content = "const value = 1;\n";
let modified = 100;
const file = {
  kind: "file",
  async getFile() { return { size: Buffer.byteLength(content), lastModified: modified }; },
  async createWritable() {
    let next = "";
    return { async write(value) { next = value; }, async close() { content = next; modified++; }, async abort() {} };
  },
};
let permission = "prompt";
let hasFile = false;
const folder = {
  kind: "directory", name: "example",
  async *entries() {},
  async queryPermission({ mode }) { return mode === "read" ? "granted" : permission; },
  async requestPermission() { permission = "granted"; return permission; },
  async getFileHandle() { if (!hasFile) { const error = new Error("missing"); error.name = "NotFoundError"; throw error; } return file; },
};
global.window = { showDirectoryPicker: async () => folder };
global.fetch = async () => ({ ok: true, async json() { return { success: true, content: "const value = 2;\n", isBinary: false }; } });

const { connectLocalProject, syncSavedLocalProject, writeAgentChangesToLocalFolder } = require(path.resolve(__dirname, "../src/lib/browserLocalProject.ts"));

async function main() {
  const projectId = await connectLocalProject();
  assert.equal(projectId, "local-example");
  hasFile = true;
  storage.set(`vox_local_files_${projectId}`, JSON.stringify({ "sample.js": `${Buffer.byteLength(content)}:${modified}` }));
  const waiting = await writeAgentChangesToLocalFolder(projectId, ["sample.js"]);
  assert.equal(waiting.needsPermission, true);
  assert.equal(content, "const value = 1;\n");
  const written = await writeAgentChangesToLocalFolder(projectId, ["sample.js"], true);
  assert.deepEqual(written.written, ["sample.js"]);
  assert.equal(content, "const value = 2;\n");
  content = "const value = 99;\n"; modified++;
  const conflict = await writeAgentChangesToLocalFolder(projectId, ["sample.js"], true);
  assert.deepEqual(conflict.conflicts, ["sample.js"]);
  assert.equal(content, "const value = 99;\n");
  assert.deepEqual(JSON.parse(storage.get(`vox_local_conflicts_${projectId}`)), ["sample.js"]);
  await syncSavedLocalProject(projectId);
  const stillProtected = await writeAgentChangesToLocalFolder(projectId, ["sample.js"], true);
  assert.deepEqual(stillProtected.conflicts, ["sample.js"]);
  console.log("Local writeback: permission and conflict checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
