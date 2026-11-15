import fs from "fs/promises";
import syncFs from "fs";
import path from "path";
import { SKILL_CATALOG, type CatalogSkill } from "./skillCatalog";
import { loadSkill } from "./skillLoader";

export interface InstalledSkill {
  name: string;
  description: string;
  path: string;
  license?: string;
  repo?: string;
  headings: string[];
  sizeBytes: number;
  updatedAt: string;
  isLocal: boolean;
}

const ROOT = process.cwd();
const SKILLS_DIR = path.join(ROOT, "skills");
const CACHE_DIR = path.join(ROOT, ".data", "skill-cache");

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Sanitasi nama folder skill: hanya huruf kecil, angka, dan strip tunggal.
 */
export function sanitizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/[-_]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/**
 * Cek apakah skill tertentu sudah terpasang di folder skills/<name>/SKILL.md
 */
export function hasInstalledSkill(name: string): boolean {
  const clean = sanitizeSkillName(name);
  if (!clean) return false;
  const p = path.join(SKILLS_DIR, clean, "SKILL.md");
  return syncFs.existsSync(p) && syncFs.statSync(p).size > 40;
}

/**
 * Daftar semua skill yang terpasang fisik di folder skills/
 */
export async function listInstalledSkills(): Promise<InstalledSkill[]> {
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const results: InstalledSkill[] = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const name = ent.name;
      const skillPath = path.join(SKILLS_DIR, name, "SKILL.md");
      const stat = await fs.stat(skillPath).catch(() => null);
      if (!stat || stat.size < 40) continue;

      const raw = await fs.readFile(skillPath, "utf-8").catch(() => "");
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      const licenseMatch = raw.match(/^license:\s*(.+)$/m);
      const repoMatch = raw.match(/^repo:\s*(.+)$/m);

      const headings = raw
        .split("\n")
        .filter((l) => /^#{2,3}\s+\S/.test(l))
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .slice(0, 10);

      results.push({
        name,
        description: descMatch ? descMatch[1].trim() : `Skill ${name}`,
        path: `skills/${name}/SKILL.md`,
        license: licenseMatch ? licenseMatch[1].trim() : undefined,
        repo: repoMatch ? repoMatch[1].trim() : undefined,
        headings,
        sizeBytes: stat.size,
        updatedAt: new Date(stat.mtimeMs).toISOString(),
        isLocal: true,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Gagal membaca daftar skills terpasang:", error);
    return [];
  }
}

/**
 * Pasang satu skill ke skills/<name>/SKILL.md dengan metadata frontmatter yang rapi
 */
export async function installSkill(opts: {
  name: string;
  content: string;
  description?: string;
  repo?: string;
  license?: string;
}): Promise<{ success: boolean; name: string; path: string; error?: string }> {
  const name = sanitizeSkillName(opts.name);
  if (!name || !NAME_REGEX.test(name)) {
    return { success: false, name: opts.name, path: "", error: "Nama skill tidak valid." };
  }

  try {
    const targetDir = path.join(SKILLS_DIR, name);
    await fs.mkdir(targetDir, { recursive: true });

    let body = opts.content.trim();
    // Ekstrak deskripsi dari isi jika tidak disediakan
    let desc = opts.description?.trim();
    if (!desc) {
      const firstHeading = body.match(/^#\s+(.+)$/m)?.[1];
      const firstPara = body
        .replace(/^#.*$/gm, "")
        .replace(/^---\n[\s\S]*?\n---\n?/, "")
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .find((p) => p.length > 20 && !p.startsWith("```"));
      desc = firstPara?.slice(0, 240) || firstHeading || `Skill ${name}`;
    }

    // Jika belum ada frontmatter, bungkus rapi
    if (!body.startsWith("---")) {
      const frontmatter = [
        "---",
        `name: ${name}`,
        `description: ${desc.replace(/[\n\r]/g, " ")}`,
        opts.repo ? `repo: ${opts.repo}` : null,
        opts.license ? `license: ${opts.license}` : "license: MIT",
        "---",
        "",
      ]
        .filter(Boolean)
        .join("\n");

      body = `${frontmatter}\n${body}`;
    }

    const targetFile = path.join(targetDir, "SKILL.md");
    await fs.writeFile(targetFile, body, "utf-8");

    return {
      success: true,
      name,
      path: `skills/${name}/SKILL.md`,
    };
  } catch (err) {
    return {
      success: false,
      name,
      path: "",
      error: (err as Error).message,
    };
  }
}

/**
 * Pasang semua skill yang ada di cache .data/skill-cache/ secara otomatis
 */
export async function installAllFromCache(): Promise<{
  installedCount: number;
  skippedCount: number;
  installedSkills: string[];
}> {
  if (!syncFs.existsSync(CACHE_DIR)) {
    return { installedCount: 0, skippedCount: 0, installedSkills: [] };
  }

  const catalogByRepo = new Map<string, CatalogSkill>();
  for (const s of SKILL_CATALOG) {
    catalogByRepo.set(s.repo, s);
  }

  const files = (await fs.readdir(CACHE_DIR)).filter((f) => f.endsWith(".md"));
  const installedSkills: string[] = [];
  let skippedCount = 0;

  for (const f of files) {
    const filePath = path.join(CACHE_DIR, f);
    const content = await fs.readFile(filePath, "utf-8").catch(() => "");
    if (content.length < 80) {
      skippedCount++;
      continue;
    }

    const parts = f.replace(/\.md$/, "").split("__");
    const repo = `${parts[0]}/${parts[1]}`;

    let subSkill = "";
    for (let i = parts.length - 1; i >= 1; i--) {
      const p = parts[i];
      if (p.toLowerCase() === "skill" || p.toLowerCase() === "readme") continue;
      if (
        ["skills", "skill", "plugin", "plugins", "core", ".grok", ".claude", ".factory", "agent-skills", "integrations", "apps"].includes(
          p
        )
      ) {
        continue;
      }
      subSkill = p;
      break;
    }
    if (!subSkill) subSkill = parts[1].replace(/-skills?$/, "");

    const name = sanitizeSkillName(subSkill);
    if (!name) {
      skippedCount++;
      continue;
    }

    const cat = catalogByRepo.get(repo);
    const desc = cat ? cat.desc : `Panduan keahlian ${name} dari repo ${repo}`;

    const res = await installSkill({
      name,
      content,
      description: desc,
      repo,
      license: "MIT",
    });

    if (res.success) {
      installedSkills.push(name);
    } else {
      skippedCount++;
    }
  }

  return {
    installedCount: installedSkills.length,
    skippedCount,
    installedSkills,
  };
}

/**
 * Pasang skill dari katalog atau dari GitHub raw URL
 */
export async function installFromCatalog(skillNameOrRepo: string): Promise<{
  success: boolean;
  name: string;
  message: string;
}> {
  const query = skillNameOrRepo.toLowerCase().trim();

  // Cari kecocokan di katalog
  const target =
    SKILL_CATALOG.find((s) => s.skill?.toLowerCase() === query || s.repo.toLowerCase() === query || s.repo.toLowerCase().endsWith("/" + query)) ||
    SKILL_CATALOG.find((s) => s.desc.toLowerCase().includes(query));

  if (!target) {
    // Coba tebak nama repo langsung
    if (query.includes("/")) {
      const url = `https://raw.githubusercontent.com/${query}/HEAD/SKILL.md`;
      const res = await fetch(url, { headers: { "User-Agent": "vox-skill-engine" }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
      if (res && res.ok) {
        const text = await res.text();
        const name = sanitizeSkillName(query.split("/")[1]);
        const inst = await installSkill({ name, content: text, repo: query });
        if (inst.success) {
          return { success: true, name, message: `Berhasil memasang skill ${name} dari repo ${query}` };
        }
      }
    }
    return { success: false, name: query, message: `Skill "${query}" tidak ditemukan di katalog.` };
  }

  // Jika sudah lokal di skills/
  const resolvedName = target.skill || target.repo.split("/")[1];
  const cleanName = sanitizeSkillName(resolvedName);

  // Coba ambil dari cache dulu jika ada
  const cachedFiles = syncFs.existsSync(CACHE_DIR) ? syncFs.readdirSync(CACHE_DIR) : [];
  const matchCached = cachedFiles.find((f) => f.includes(target.repo.replace("/", "__")));
  let body = "";

  if (matchCached) {
    body = syncFs.readFileSync(path.join(CACHE_DIR, matchCached), "utf-8");
  }

  if (!body || body.length < 80) {
    // Ambil dari raw github
    const candidates = target.skill
      ? [`skills/${target.skill}/SKILL.md`, `${target.skill}/SKILL.md`, "SKILL.md", "README.md"]
      : ["SKILL.md", "README.md"];

    for (const file of candidates) {
      const url = `https://raw.githubusercontent.com/${target.repo}/HEAD/${file}`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": "vox-skill-engine" }, signal: AbortSignal.timeout(8_000) });
        if (res.ok) {
          body = await res.text();
          if (body.length >= 80) break;
        }
      } catch {
        /* coba kandidat berikutnya */
      }
    }
  }

  if (!body || body.length < 80) {
    return {
      success: false,
      name: cleanName,
      message: `Tidak dapat mengunduh isi skill untuk ${target.repo}.`,
    };
  }

  const res = await installSkill({
    name: cleanName,
    content: body,
    description: target.desc,
    repo: target.repo,
    license: "MIT",
  });

  if (res.success) {
    return {
      success: true,
      name: cleanName,
      message: `Berhasil memasang skill "${cleanName}" (${target.desc}).`,
    };
  } else {
    return {
      success: false,
      name: cleanName,
      message: `Gagal menyimpan skill: ${res.error}`,
    };
  }
}

/**
 * Hapus skill fisik dari folder skills/
 */
export async function uninstallSkill(name: string): Promise<{ success: boolean; message: string }> {
  const clean = sanitizeSkillName(name);
  const targetDir = path.join(SKILLS_DIR, clean);

  if (!syncFs.existsSync(targetDir)) {
    return { success: false, message: `Skill "${clean}" tidak ditemukan di folder skills/.` };
  }

  try {
    await fs.rm(targetDir, { recursive: true, force: true });
    return { success: true, message: `Skill "${clean}" berhasil dihapus.` };
  } catch (err) {
    return { success: false, message: `Gagal menghapus skill: ${(err as Error).message}` };
  }
}

/**
 * Cari skill di antara yang sudah terpasang dan yang ada di katalog
 */
export async function searchSkills(query: string) {
  const q = query.toLowerCase().trim();
  const installed = await listInstalledSkills();
  const installedNames = new Set(installed.map((s) => s.name));

  const matchedInstalled = q
    ? installed.filter((s) => s.name.includes(q) || s.description.toLowerCase().includes(q))
    : installed;

  const catalogMatches = (q
    ? SKILL_CATALOG.filter((s) => (s.skill && s.skill.toLowerCase().includes(q)) || s.desc.toLowerCase().includes(q) || s.kw.toLowerCase().includes(q))
    : SKILL_CATALOG
  ).map((s) => {
    const sName = s.skill || s.repo.split("/")[1];
    return {
      name: sName,
      description: s.desc,
      repo: s.repo,
      isInstalled: installedNames.has(sanitizeSkillName(sName)),
      isLocalOnly: Boolean(s.local),
    };
  });

  return {
    query: q,
    installed: matchedInstalled,
    catalog: catalogMatches.slice(0, 30),
    totalInstalled: installed.length,
    totalCatalog: SKILL_CATALOG.length,
  };
}
