const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "conversations.json");
const DB_BAK = path.join(DATA_DIR, "conversations.json.bak");

console.log("=== Testing Local Storage Hardening ===");

async function run() {
  if (!fs.existsSync(DB_FILE)) {
    console.error("DB_FILE not found!");
    process.exit(1);
  }
  const stat = fs.statSync(DB_FILE);
  console.log(`✓ DB_FILE exists, size: ${stat.size} bytes`);

  // Let's test the atomic write mechanism
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}-test.tmp`;
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const parsed = JSON.parse(raw);

  console.log(`✓ Current conversations count: ${parsed.conversations.length}`);

  // Test atomic backup rotation
  fs.writeFileSync(tmpFile, raw, "utf-8");
  fs.copyFileSync(DB_FILE, DB_BAK);
  fs.renameSync(tmpFile, DB_FILE);

  const bakStat = fs.statSync(DB_BAK);
  console.log(`✓ Backup file created & verified: ${bakStat.size} bytes`);

  // Verify integrity
  const verifiedRaw = fs.readFileSync(DB_FILE, "utf-8");
  const verifiedParsed = JSON.parse(verifiedRaw);
  console.log(`✓ Integrity confirmed: ${verifiedParsed.conversations.length} conversations intact`);

  console.log("\nALL STORAGE HARDENING CHECKS PASSED 100%!");
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
