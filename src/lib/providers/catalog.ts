/**
 * Provider langganan: pakai CLI resmi vendor, bukan API key.
 *
 * Inilah cara OpenBot memakai akun Claude/ChatGPT orang (lihat docs/openbot-breakdown.md §D:
 * "OpenBot updates the provider CLIs that it downloaded each hour"). CLI resmi yang login lewat
 * OAuth memang diizinkan memakai langganan Pro/Plus/Max, jadi VOX cukup menjalankan CLI itu dan
 * membaca keluarannya. VOX tidak pernah menyentuh cookie atau sesi web vendor.
 *
 * Kredensial tetap milik CLI masing-masing (`~/.codex/auth.json`, keychain Claude). VOX hanya
 * membaca *status*-nya, tidak pernah nilai tokennya.
 */

export type ProviderId = "codex" | "claude" | "gemini";

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Langganan yang bisa dipakai CLI ini. */
  subscription: string;
  /** Nama binary yang dicari di PATH. */
  bin: string;
  /** Folder tambahan tempat CLI biasa terpasang (selain PATH). */
  extraDirs: string[];
  /** Perintah pasang, ditampilkan ke user — VOX tidak memasang sendiri tanpa diminta. */
  install: string;
  /** Perintah login interaktif (harus dijalankan user di terminal/jendela sendiri). */
  login: string;
  /** Perintah cek status login, kalau ada. */
  statusArgs?: string[];
  /** Berkas yang menandakan CLI pernah login (isinya tidak dibaca). */
  authFile?: string;
  /** Model bawaan kalau pemanggil tidak menyebut model. */
  defaultModel?: string;
  /** Format keluaran yang diparse `run.ts`. */
  stream: "codex-jsonl" | "claude-jsonl" | "plain";
}

/** `$HOME` dibaca saat dipakai, bukan saat modul dimuat, biar aman di tes. */
function home(...parts: string[]): string {
  return [process.env.HOME || "", ...parts].join("/");
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  codex: {
    id: "codex",
    label: "ChatGPT (Codex)",
    subscription: "ChatGPT Plus / Pro / Business",
    bin: "codex",
    extraDirs: [home("npm-global/bin"), home(".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"],
    install: "npm i -g @openai/codex",
    login: "codex login",
    statusArgs: ["login", "status"],
    authFile: home(".codex/auth.json"),
    stream: "codex-jsonl",
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    subscription: "Claude Pro / Max",
    bin: "claude",
    extraDirs: [
      home(".claude/local"),
      home("npm-global/bin"),
      home(".local/bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
    ],
    install: "npm i -g @anthropic-ai/claude-code",
    login: "claude login",
    authFile: home(".claude/.credentials.json"),
    stream: "claude-jsonl",
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    subscription: "Google AI Pro / akun Google",
    bin: "gemini",
    extraDirs: [home("npm-global/bin"), home(".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"],
    install: "npm i -g @google/gemini-cli",
    login: "gemini",
    authFile: home(".gemini/oauth_creds.json"),
    stream: "plain",
  },
};

export function providerSpec(id: string): ProviderSpec {
  const spec = PROVIDERS[id as ProviderId];
  if (!spec) throw new Error(`Provider "${id}" tidak dikenal.`);
  return spec;
}

/**
 * Argumen untuk menjalankan satu prompt tanpa interaksi.
 * Prompt TIDAK pernah masuk argumen — selalu lewat stdin, biar tidak bocor ke `ps` atau log shell.
 */
export function execArgs(
  spec: ProviderSpec,
  options: { model?: string; cwd?: string; write?: boolean } = {}
): string[] {
  const model = options.model || spec.defaultModel;

  if (spec.id === "codex") {
    const args = ["exec", "--json", "--skip-git-repo-check"];
    // Tanpa izin tulis, sandbox-nya baca saja: agent tidak bisa mengubah berkas atau jaringan.
    args.push("-s", options.write ? "workspace-write" : "read-only");
    if (model) args.push("-m", model);
    if (options.cwd) args.push("-C", options.cwd);
    args.push("-"); // prompt dari stdin
    return args;
  }

  if (spec.id === "claude") {
    const args = ["-p", "--output-format", "stream-json", "--verbose"];
    // `plan` = boleh baca & menyusun rencana, tidak boleh menulis berkas.
    args.push("--permission-mode", options.write ? "acceptEdits" : "plan");
    if (model) args.push("--model", model);
    return args;
  }

  const args = ["-p", "-"];
  if (model) args.push("-m", model);
  return args;
}
