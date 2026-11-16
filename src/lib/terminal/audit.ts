import fs from "fs/promises";
import path from "path";

/** Jejak audit terminal: satu baris JSON per perintah di .data/terminal-audit.log (dipotong di ~2 MB). */
const FILE = () => path.join(process.cwd(), ".data", "terminal-audit.log");
const MAX = 2 * 1024 * 1024;

export interface AuditEntry {
  origin: "user" | "agent" | "session";
  command: string;
  cwd: string;
  tier: string;
  allowed: boolean;
  exitCode?: number | null;
  durationMs?: number;
  note?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const file = FILE();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const stat = await fs.stat(file).catch(() => null);
    if (stat && stat.size > MAX) {
      const text = await fs.readFile(file, "utf-8");
      await fs.writeFile(file, text.slice(text.indexOf("\n", text.length / 2) + 1));
    }
    await fs.appendFile(file, JSON.stringify({ at: new Date().toISOString(), ...entry, command: entry.command.slice(0, 500) }) + "\n");
  } catch {}
}

export async function readAudit(limit = 100): Promise<unknown[]> {
  try {
    const lines = (await fs.readFile(FILE(), "utf-8")).trim().split("\n").slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}
