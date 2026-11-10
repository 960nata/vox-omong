import fs from "fs";
import path from "path";

/**
 * Pemuat skill (format SKILL.md / Agent Skills) dari folder `skills/` di root project.
 * Isi skill hanya dipakai sebagai TEKS prompt untuk model; tidak ada kode skill yang dijalankan.
 * Sumber & lisensi tiap skill: skills/NOTICE.md.
 */

const DIR = path.join(process.cwd(), "skills");
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const cache = new Map<string, string>();

function readFile(name: string, file: string): string {
  if (!NAME.test(name) || !/^[\w.-]+$/.test(file)) return "";
  const key = `${name}/${file}`;
  if (!cache.has(key)) {
    try {
      cache.set(key, fs.readFileSync(path.join(DIR, name, file), "utf-8"));
    } catch {
      cache.set(key, "");
    }
  }
  return cache.get(key)!;
}

const stripFrontmatter = (s: string) => s.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

/** Isi SKILL.md tanpa frontmatter ("" bila skill tidak ada). */
export function loadSkill(name: string, file = "SKILL.md"): string {
  return stripFrontmatter(readFile(name, file));
}

/** Ambil satu bagian berdasarkan judul (## atau ###) sampai judul setingkat/lebih tinggi berikutnya. */
export function skillSection(name: string, heading: string, file = "SKILL.md"): string {
  const lines = loadSkill(name, file).split("\n");
  const start = lines.findIndex((l) => /^#{2,4}\s/.test(l) && l.replace(/^#+\s*/, "").trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return "";
  const level = lines[start].match(/^#+/)![0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function skillSections(name: string, headings: string[], file = "SKILL.md"): string {
  return headings
    .map((h) => skillSection(name, h, file))
    .filter(Boolean)
    .join("\n\n");
}

/** Daftar skill terpasang (nama + deskripsi dari frontmatter). */
export function listSkills(): { name: string; description: string }[] {
  let dirs: string[] = [];
  try {
    dirs = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  return dirs
    .map((name) => {
      const raw = readFile(name, "SKILL.md");
      const desc = raw.match(/^description:\s*(.+)$/m)?.[1]?.trim() || "";
      return raw ? { name, description: desc } : null;
    })
    .filter((x): x is { name: string; description: string } => !!x);
}
