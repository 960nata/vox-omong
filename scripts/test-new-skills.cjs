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

const { loadSkill } = require("../src/lib/skillLoader.ts");
const { resolveSkill } = require("../src/lib/skillHub.ts");

const testCases = [
  { skill: "career-ops", query: "tolong review carer ops dan cv saya", check: /Career Ops/ },
  { skill: "founder-skills", query: "bagaimana validasi ide fonder skills", check: /Founder Skills/ },
  { skill: "hyperframes", query: "buat video pakai hyperframes", check: /HyperFrames/ },
  { skill: "trading-skills", query: "hitung risk management traders skill", check: /Trading Skills/ },
  { skill: "find-skills", query: "bantu saya find skills yang cocok", check: /Find Skills/ },
  { skill: "graphify", query: "buat graphify dari repo ini", check: /Graphify/ },
  { skill: "youtube-agent", query: "bikin rangkuman youtube agent skills", check: /YouTube Agent/ },
  { skill: "omniroute", query: "tolong jelaskan cara kerja omniroute untuk gateway ai", check: /OmniRoute/ },
  { skill: "claude-mem", query: "aktifkan cloude mem dan memhead room", check: /Claude-Mem/ },
  { skill: "claude-code-setup", query: "panduan clode code setup di mac", check: /Claude Code Setup/ },
  { skill: "task-observer", query: "nyalakan taskt observer untuk catat friksi", check: /Task Observer/ },
  { skill: "instagram-agent", query: "buat konten carousel iinstagram agent skill", check: /Instagram Agent/ },
  { skill: "academic-research", query: "susun literature review academic reserc skill", check: /Academic Research/ },
];

async function run() {
  console.log(`Testing ${testCases.length} newly requested skills...\n`);

  for (const tc of testCases) {
    // 1. Check file exists and loads via loadSkill
    const body = loadSkill(tc.skill);
    assert.ok(body.length > 50, `Skill ${tc.skill} harus memiliki konten SKILL.md yang terbaca`);
    assert.match(body, tc.check, `Konten ${tc.skill} harus cocok dengan regex`);

    // 2. Check skill resolution in skillHub with user's actual keywords / typos
    const resolved = await resolveSkill(tc.query);
    assert.ok(resolved, `Query "${tc.query}" harus berhasil di-resolve`);
    assert.equal(resolved.name, tc.skill, `Resolved name harus '${tc.skill}', dapat '${resolved.name}'`);
    assert.ok(resolved.body.length > 50, `Resolved body harus tidak kosong`);

    console.log(`✓ [${tc.skill}] SKILL.md loaded & matched with query: "${tc.query}"`);
  }

  console.log("\nALL 13 NEW SKILLS PASSED VERIFICATION PERFECTLY!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
