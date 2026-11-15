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

const { listInstalledSkills, hasInstalledSkill, searchSkills } = require("../src/lib/skillInstaller.ts");
const { loadSkill, loadSkillMetadata, listSkills } = require("../src/lib/skillLoader.ts");
const { resolveSkill } = require("../src/lib/skillHub.ts");
const { extractPlaybook } = require("../src/lib/skillEngine.ts");

async function run() {
  console.log("=== Testing Skill Engine & Installer ===\n");

  // 1. Test installed count
  const installed = await listInstalledSkills();
  console.log(`Found ${installed.length} installed skills in skills/`);
  assert.ok(installed.length >= 100, `Harus ada minimal 100 skill terpasang, sekarang ada ${installed.length}`);

  // 2. Test key skills exist
  const keySkills = [
    "prd-development",
    "zero-slop",
    "resume-ats-optimizer",
    "bullshit-detector",
    "charlie-cfo-skill",
    "naming",
    "founder-skills",
    "trading-skills",
    "career-ops",
    "hyperframes",
    "audio-tldr",
    "vibe-check",
    "frontend-slides",
  ];

  for (const ks of keySkills) {
    const exists = hasInstalledSkill(ks);
    assert.ok(exists, `Skill ${ks} harus terpasang di folder skills/`);
    const content = loadSkill(ks);
    assert.ok(content.length > 50, `Skill ${ks} harus memiliki konten valid`);
    const meta = loadSkillMetadata(ks);
    assert.ok(meta && meta.description, `Metadata ${ks} harus memiliki description`);
    console.log(`✓ Skill [${ks}] terpasang dan terbaca (${content.length} chars)`);
  }

  // 3. Test resolveSkill local prioritization
  const resolvedPrd = await resolveSkill("pakai skill prd-development tolong rancang PRD");
  assert.ok(resolvedPrd, "resolveSkill harus menemukan prd-development");
  assert.equal(resolvedPrd.name, "prd-development");
  assert.equal(resolvedPrd.skill.local, true, "Harus ditandai sebagai local skill");
  console.log("✓ resolveSkill berhasil memprioritaskan local skill prd-development");

  // 4. Test extractPlaybook
  const playbook = extractPlaybook(resolvedPrd.body, resolvedPrd.name);
  assert.ok(playbook.goal, "Playbook harus memiliki goal");
  assert.ok(playbook.steps.length >= 2, "Playbook harus memiliki minimal 2 langkah");
  console.log(`✓ extractPlaybook sukses menghasilkan ${playbook.steps.length} langkah untuk ${resolvedPrd.name}`);

  // 5. Test searchSkills
  const searchRes = await searchSkills("product");
  assert.ok(searchRes.installed.length >= 1, "Pencarian 'product' harus menemukan skill terpasang");
  console.log(`✓ searchSkills('product') menemukan ${searchRes.installed.length} skill terpasang`);

  console.log("\nALL SKILL ENGINE & INSTALLER TESTS PASSED 100%!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
