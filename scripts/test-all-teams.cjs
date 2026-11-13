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

const { createTeam, updateTeamMember, memberSkillGuide } = require("../src/lib/agentTeams.ts");

const teamKinds = [
  { kind: "developer", expectedLeader: "Ari", count: 5, expectedName: "Tim Developer" },
  { kind: "marketing", expectedLeader: "Maya", count: 5, expectedName: "Tim Marketing" },
  { kind: "creative", expectedLeader: "Kirana", count: 5, expectedName: "Tim Kreatif" },
  { kind: "founder", expectedLeader: "Hendra", count: 4, expectedName: "Tim Founder & Startup" },
  { kind: "research", expectedLeader: "Bram", count: 4, expectedName: "Tim Riset & Akademik" },
  { kind: "trading", expectedLeader: "Baskara", count: 4, expectedName: "Tim Trader & Finansial" },
  { kind: "career", expectedLeader: "Sandra", count: 4, expectedName: "Tim Karier & Talent" },
];

async function run() {
  console.log("Testing all 7 agent team kinds...\n");
  const testProjectId = `test-teams-${Date.now()}`;
  const createdTeamIds = [];

  try {
    for (const tk of teamKinds) {
      const team = await createTeam(testProjectId, tk.kind);
      createdTeamIds.push(team.id);

      assert.equal(team.kind, tk.kind);
      assert.equal(team.name, tk.expectedName);
      assert.equal(team.members.length, tk.count);
      
      const leader = team.members.find(m => m.id === team.leaderId);
      assert.ok(leader, "Ketua tim harus ditemukan");
      assert.equal(leader.name, tk.expectedLeader);

      console.log(`✓ [${tk.kind}] Created "${team.name}" with leader ${leader.name} and ${team.members.length} members`);
    }

    console.log("\nTesting member skill guide loading and update...");
    // Test founder team member
    const founderTeamId = createdTeamIds[3];
    const guide = memberSkillGuide("founder-skills");
    assert.ok(guide.includes("founder-skills"), "Skill guide harus terisi");
    assert.ok(guide.includes("Founder Skills"), "Konten skill founder harus terbaca");

    // Test updating skillId on a member
    const team = await createTeam(testProjectId, "founder");
    const member = team.members[1];
    const updated = await updateTeamMember(team.id, member.id, { skillId: "omniroute" });
    const updatedMember = updated.members.find(m => m.id === member.id);
    assert.equal(updatedMember.skillId, "omniroute");
    console.log(`✓ Successfully updated member skillId to omniroute`);

  } finally {
    console.log("\nCleaning up test team files...");
    for (const id of createdTeamIds) {
      const filePath = path.join(root, ".data", "teams", `${id}.json`);
      await fs.unlink(filePath).catch(() => {});
    }
  }

  console.log("\nALL 7 AGENT TEAMS VERIFIED AND PASSED CLEANLY!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
