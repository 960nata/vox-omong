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

const { AGENCY_AGENTS, agencyAgent, agencyGuide } = require("../src/lib/agencyAgents.ts");
const { loadSkill } = require("../src/lib/skillLoader.ts");
const { resolveSkill } = require("../src/lib/skillHub.ts");
const { createTeam, updateTeamMember, getTeam, TeamError } = require("../src/lib/agentTeams.ts");

async function run() {
  console.log("1. Testing AGENCY_AGENTS definition and lookup...");
  assert.equal(AGENCY_AGENTS.length, 8, "Harus ada 8 profil Agency Agents pilihan");
  
  const frontend = agencyAgent("frontend-developer");
  assert.ok(frontend, "Frontend developer harus ditemukan");
  assert.equal(frontend.kind, "developer");
  assert.match(frontend.guide, /HTML semantik/);
  
  const guide = agencyGuide("frontend-developer");
  assert.match(guide, /Metode Agency Agents — Frontend Developer/);
  assert.equal(agencyGuide("non-existent"), "");
  assert.equal(agencyGuide(""), "");

  console.log("2. Testing local skill loading (skills/agency-agents/SKILL.md)...");
  const skillBody = loadSkill("agency-agents");
  assert.ok(skillBody.length > 100, "Isi SKILL.md agency-agents harus terbaca");
  assert.match(skillBody, /# Agency Agents — Metode Spesialis Kerja/);
  assert.match(skillBody, /UI\/UX Designer/);
  assert.match(skillBody, /Frontend Developer/);
  assert.match(skillBody, /Backend Architect/);

  console.log("3. Testing skill resolution in skillHub...");
  const matched1 = await resolveSkill("tolong pakai metode agency agents untuk proyek ini");
  assert.ok(matched1, "Harus cocok dengan query 'agency agents'");
  assert.equal(matched1.name, "agency-agents");
  assert.ok(matched1.body.includes("Agency Agents"));

  const matched2 = await resolveSkill("kita butuh peran reality checker untuk cek website");
  assert.ok(matched2, "Harus cocok dengan kata kunci 'reality checker'");
  assert.equal(matched2.name, "agency-agents");

  console.log("4. Testing agentTeams integration (create & defaults)...");
  const testProjectId = `test-agency-${Date.now()}`;
  const team = await createTeam(testProjectId, "developer");
  assert.ok(team, "Team developer berhasil dibuat");
  assert.equal(team.members.length, 5);

  // Check default agency assignments
  // Ari: undefined, Naya: ui-designer, Raka: frontend-developer, Bima: backend-architect, Dara: reality-checker
  const naya = team.members.find(m => m.name === "Naya");
  const raka = team.members.find(m => m.name === "Raka");
  const bima = team.members.find(m => m.name === "Bima");
  const dara = team.members.find(m => m.name === "Dara");
  
  assert.equal(naya?.agencyAgentId, "ui-designer");
  assert.equal(raka?.agencyAgentId, "frontend-developer");
  assert.equal(bima?.agencyAgentId, "backend-architect");
  assert.equal(dara?.agencyAgentId, "reality-checker");

  console.log("5. Testing updateTeamMember agency profile change...");
  // Update Raka to no agency profile
  const updated1 = await updateTeamMember(team.id, raka.id, { agencyAgentId: "" });
  const rakaUpdated = updated1.members.find(m => m.id === raka.id);
  assert.equal(rakaUpdated?.agencyAgentId, "");

  // Update Raka to ui-designer (valid developer agent)
  const updated2 = await updateTeamMember(team.id, raka.id, { agencyAgentId: "ui-designer" });
  const rakaUpdated2 = updated2.members.find(m => m.id === raka.id);
  assert.equal(rakaUpdated2?.agencyAgentId, "ui-designer");

  // Attempt to assign marketing agent (growth-hacker) to developer team member -> should fail
  await assert.rejects(
    async () => {
      await updateTeamMember(team.id, raka.id, { agencyAgentId: "growth-hacker" });
    },
    (err) => {
      assert.ok(err instanceof TeamError);
      assert.match(err.message, /tidak sesuai jenis tim/);
      return true;
    }
  );

  // Attempt to assign non-existent agent -> should fail
  await assert.rejects(
    async () => {
      await updateTeamMember(team.id, raka.id, { agencyAgentId: "invalid-hacker-id" });
    },
    (err) => {
      assert.ok(err instanceof TeamError);
      assert.match(err.message, /tidak dikenal/);
      return true;
    }
  );

  console.log("6. Cleaning up test team data...");
  const teamFilePath = path.join(root, ".data", "teams", `${team.id}.json`);
  await fs.unlink(teamFilePath).catch(() => {});

  console.log("ALL AGENCY AGENT TESTS PASSED WITHOUT DEFECT!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
