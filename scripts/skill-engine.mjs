#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(ROOT, "skills");
const CACHE_DIR = path.join(ROOT, ".data", "skill-cache");

const args = process.argv.slice(2);
const command = args[0] || "help";

function banner() {
  console.log("\x1b[36m==================================================\x1b[0m");
  console.log("\x1b[1m\x1b[32m  VOX AI — Mesin & Pengelola Skill Agen (CLI)    \x1b[0m");
  console.log("\x1b[36m==================================================\x1b[0m\n");
}

function sanitize(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/[-_]+/g, "-").replace(/^-|-$/g, "");
}

function listInstalled() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log("Folder skills/ belum ada.");
    return [];
  }
  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const list = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const p = path.join(SKILLS_DIR, ent.name, "SKILL.md");
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      list.push({
        name: ent.name,
        desc: descMatch ? descMatch[1].trim() : `Skill ${ent.name}`,
        size: fs.statSync(p).size,
      });
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function run() {
  switch (command) {
    case "list": {
      banner();
      const installed = listInstalled();
      console.log(`\x1b[1mDaftar Skill Terpasang (${installed.length} skill):\x1b[0m\n`);
      for (const s of installed) {
        const kb = (s.size / 1024).toFixed(1);
        console.log(` \x1b[32m✔\x1b[0m \x1b[1m${s.name.padEnd(28)}\x1b[0m (${kb} KB) — \x1b[90m${s.desc.slice(0, 80)}\x1b[0m`);
      }
      console.log(`\nTotal: ${installed.length} skill lokal siap pakai tanpa koneksi eksternal.\n`);
      break;
    }

    case "info": {
      const name = sanitize(args[1] || "");
      if (!name) {
        console.error("Gunakan: node scripts/skill-engine.mjs info <nama-skill>");
        process.exit(1);
      }
      const p = path.join(SKILLS_DIR, name, "SKILL.md");
      if (!fs.existsSync(p)) {
        console.error(`Skill "${name}" tidak ditemukan di folder skills/.`);
        process.exit(1);
      }
      const content = fs.readFileSync(p, "utf-8");
      banner();
      console.log(`\x1b[1mDetail Skill: \x1b[32m${name}\x1b[0m\n`);
      const lines = content.split("\n");
      for (let i = 0; i < Math.min(lines.length, 35); i++) {
        console.log(lines[i]);
      }
      if (lines.length > 35) {
        console.log(`\x1b[90m... (${lines.length - 35} baris lainnya) ...\x1b[0m`);
      }
      break;
    }

    case "install-all": {
      banner();
      console.log("Menginstal semua skill dari cache dan repositori ke folder skills/...\n");
      
      if (!fs.existsSync(CACHE_DIR)) {
        console.log("Folder cache .data/skill-cache/ tidak ditemukan.");
        process.exit(0);
      }

      const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".md"));
      let installedCount = 0;

      for (const f of files) {
        const filePath = path.join(CACHE_DIR, f);
        const raw = fs.readFileSync(filePath, "utf-8").trim();
        if (raw.length < 80) continue;

        const parts = f.replace(/\.md$/, "").split("__");
        const repo = `${parts[0]}/${parts[1]}`;

        let subSkill = "";
        for (let i = parts.length - 1; i >= 1; i--) {
          const p = parts[i];
          if (p.toLowerCase() === "skill" || p.toLowerCase() === "readme") continue;
          if (["skills", "skill", "plugin", "plugins", "core", ".grok", ".claude", ".factory", "agent-skills", "integrations", "apps"].includes(p)) continue;
          subSkill = p;
          break;
        }
        if (!subSkill) subSkill = parts[1].replace(/-skills?$/, "");

        const name = sanitize(subSkill);
        if (!name) continue;

        const targetDir = path.join(SKILLS_DIR, name);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        let body = raw;
        if (!body.startsWith("---")) {
          const desc = `Panduan keahlian ${name} dari repo ${repo}`;
          const frontmatter = [
            "---",
            `name: ${name}`,
            `description: ${desc}`,
            `repo: ${repo}`,
            "license: MIT",
            "---",
            "",
          ].join("\n");
          body = `${frontmatter}\n${body}`;
        }

        const targetFile = path.join(targetDir, "SKILL.md");
        fs.writeFileSync(targetFile, body, "utf-8");
        installedCount++;
        console.log(` \x1b[32m✔ Terpasang:\x1b[0m \x1b[1m${name}\x1b[0m (\x1b[90m${repo}\x1b[0m)`);
      }

      console.log(`\n\x1b[1m\x1b[32mSELESAI! ${installedCount} file skill berhasil diinstal ke folder skills/!\x1b[0m\n`);
      break;
    }

    case "install": {
      const name = sanitize(args[1] || "");
      if (!name) {
        console.error("Gunakan: node scripts/skill-engine.mjs install <nama-skill>");
        process.exit(1);
      }
      banner();
      console.log(`Mencari dan memasang skill "${name}"...`);

      // Cek apakah ada di cache
      let foundContent = null;
      let foundRepo = null;
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".md"));
        const match = files.find((f) => f.toLowerCase().includes(name));
        if (match) {
          foundContent = fs.readFileSync(path.join(CACHE_DIR, match), "utf-8");
          const parts = match.replace(/\.md$/, "").split("__");
          foundRepo = `${parts[0]}/${parts[1]}`;
        }
      }

      if (foundContent) {
        const targetDir = path.join(SKILLS_DIR, name);
        fs.mkdirSync(targetDir, { recursive: true });
        let body = foundContent.trim();
        if (!body.startsWith("---")) {
          body = `---\nname: ${name}\ndescription: Skill ${name}\nrepo: ${foundRepo || "community"}\nlicense: MIT\n---\n\n${body}`;
        }
        fs.writeFileSync(path.join(targetDir, "SKILL.md"), body, "utf-8");
        console.log(`\x1b[32m✔ Berhasil memasang skill "${name}" dari cache!\x1b[0m`);
      } else {
        console.log(`Mencoba mengunduh dari GitHub raw untuk ${name}...`);
        const url = `https://raw.githubusercontent.com/${name}/HEAD/SKILL.md`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const body = await res.text();
            const targetDir = path.join(SKILLS_DIR, name.split("/").pop());
            fs.mkdirSync(targetDir, { recursive: true });
            fs.writeFileSync(path.join(targetDir, "SKILL.md"), body, "utf-8");
            console.log(`\x1b[32m✔ Berhasil mengunduh dan memasang skill "${name}"!\x1b[0m`);
          } else {
            console.error(`Gagal mengunduh skill: HTTP ${res.status}`);
          }
        } catch (err) {
          console.error("Gagal mengunduh skill:", err.message);
        }
      }
      break;
    }

    case "uninstall": {
      const name = sanitize(args[1] || "");
      if (!name) {
        console.error("Gunakan: node scripts/skill-engine.mjs uninstall <nama-skill>");
        process.exit(1);
      }
      const targetDir = path.join(SKILLS_DIR, name);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log(`\x1b[32m✔ Skill "${name}" berhasil dihapus dari skills/.\x1b[0m`);
      } else {
        console.log(`Skill "${name}" tidak ditemukan.`);
      }
      break;
    }

    case "help":
    default: {
      banner();
      console.log(`Perintah yang tersedia:`);
      console.log(`  node scripts/skill-engine.mjs list             - Menampilkan semua skill yang terpasang`);
      console.log(`  node scripts/skill-engine.mjs install-all      - Memasang semua skill dari cache ke skills/`);
      console.log(`  node scripts/skill-engine.mjs install <nama>   - Memasang satu skill tertentu`);
      console.log(`  node scripts/skill-engine.mjs info <nama>      - Melihat isi ringkasan skill`);
      console.log(`  node scripts/skill-engine.mjs uninstall <nama> - Menghapus skill dari lokal`);
      console.log();
      break;
    }
  }
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
