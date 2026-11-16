/**
 * Kebijakan perintah terminal: tiga tingkat.
 *  - "auto" : hanya membaca (ls, git status, npm test). Agent boleh menjalankan sendiri.
 *  - "ask"  : mengubah sesuatu (install, commit, tulis file). Agent hanya boleh di folder proyek
 *             sandbox; di folder kerja milik user harus user sendiri yang menjalankan.
 *  - "deny" : merusak atau membuka rahasia (sudo, rm -rf /, curl | sh, push --force). Selalu ditolak.
 * Perintah gabungan (&&, ;, |) dinilai per bagian dan diambil tingkat yang paling berat.
 */
export type Tier = "auto" | "ask" | "deny";
export interface Verdict { tier: Tier; reason: string }

const DENY: [RegExp, string][] = [
  [/(?:^|[\s;&|(])sudo(?:\s|$)/, "sudo tidak diizinkan"],
  [/(?:^|[\s;&|(])(?:shutdown|reboot|halt|poweroff)(?:\s|$)/, "mematikan komputer tidak diizinkan"],
  [/\brm\s+(?:-[a-zA-Z]*\s+)*(?:\/|~|\$HOME|\/\*|~\/\*|\.\.)(?:\s|$)/, "menghapus folder induk/home/root ditolak"],
  [/\bmkfs\b|\bdd\s+if=|>\s*\/dev\/(?:sd|disk|nvme)/, "menulis langsung ke disk ditolak"],
  [/\b(?:curl|wget)\b[^|;&]*\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\b/, "mengunduh lalu langsung menjalankan skrip ditolak"],
  [/\bgit\s+push\b[^;&|]*(?:--force(?!-with-lease)|\s-f(?:\s|$))/, "git push --force ditolak"],
  [/:\(\)\s*\{.*\};\s*:/, "fork bomb ditolak"],
  [/\bchmod\s+-R\s+777\s+\/(?:\s|$)/, "chmod 777 ke root ditolak"],
  [/(?:~|\$HOME|\/Users\/[^/\s]+|\/home\/[^/\s]+)\/\.(?:ssh|aws|gnupg|netrc)\b/, "membaca folder kredensial ditolak"],
];

const READ_ONLY = /^(?:ls|pwd|cat|head|tail|wc|which|whoami|date|echo|grep|rg|tree|du|df|file|stat|env|printenv|node\s+(?:-v|--version)|python3?\s+(?:-V|--version)|pip3?\s+(?:list|show|--version|-V)|npm\s+(?:-v|--version|ls|list|view|outdated|test|t|run\s+(?:test|lint|typecheck|check)(?::[\w-]+)?)|(?:pnpm|yarn|bun)\s+(?:-v|--version|test|lint|typecheck)|npx\s+(?:tsc\s+--noEmit|vitest\s+run|eslint)|git\s+(?:status|log|diff|show|branch|remote\s+-v|rev-parse|ls-files|blame|describe|stash\s+list)|find)(?:\s|$)/;

function splitParts(command: string): string[] {
  return command.split(/&&|\|\||;|\||\n/).map((p) => p.trim()).filter(Boolean);
}

export function classifyCommand(command: string): Verdict {
  const cmd = command.trim();
  if (!cmd) return { tier: "deny", reason: "perintah kosong" };
  for (const [re, reason] of DENY) if (re.test(cmd)) return { tier: "deny", reason };
  if (/\$\(|`/.test(cmd)) return { tier: "ask", reason: "ada substitusi perintah" };
  if (/(?:^|[^>&\d])>{1,2}(?!&)/.test(cmd)) return { tier: "ask", reason: "menulis ke file" };
  for (const part of splitParts(cmd)) {
    if (!READ_ONLY.test(part)) return { tier: "ask", reason: `mengubah sesuatu: ${part.split(/\s+/).slice(0, 2).join(" ")}` };
    if (/^find\b/.test(part) && /\s-(?:delete|exec|execdir|ok)\b/.test(part)) return { tier: "ask", reason: "find dengan aksi" };
    if (/^(?:env|printenv)\b/.test(part)) return { tier: "ask", reason: "menampilkan environment" };
  }
  return { tier: "auto", reason: "hanya membaca" };
}

export type Origin = "user" | "agent";

/** Boleh jalan? `sandboxed` = folder proyek buatan Vox (.data/user_projects), bukan folder kerja milik user. */
export function decide(command: string, origin: Origin, sandboxed: boolean): Verdict & { allowed: boolean } {
  const v = classifyCommand(command);
  if (v.tier === "deny") return { ...v, allowed: false };
  if (origin === "user" || v.tier === "auto" || sandboxed) return { ...v, allowed: true };
  return { ...v, allowed: false, reason: `${v.reason}. Di folder kerja kamu, perintah ini harus kamu jalankan sendiri (ketik di chat atau terminal).` };
}
