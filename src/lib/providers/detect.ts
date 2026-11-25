/**
 * Deteksi CLI provider: ada tidak binary-nya, versinya berapa, sudah login atau belum.
 *
 * Yang dibaca cuma keberadaan berkas kredensial dan `auth_mode`-nya — nilai token tidak
 * pernah dibaca, tidak pernah dicatat, dan tidak pernah dikirim ke mana pun.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PROVIDERS, ProviderId, ProviderSpec, providerSpec } from "./catalog";

const run = promisify(execFile);

export type AuthMode = "subscription" | "api-key" | "unknown" | "none";

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  subscription: string;
  /** Jalur binary, atau null kalau belum terpasang. */
  bin: string | null;
  version: string | null;
  /** `subscription` = login lewat akun langganan, `api-key` = pakai kunci API. */
  auth: AuthMode;
  /** Keterangan singkat buat ditampilkan di UI. */
  detail: string;
  /** Perintah yang perlu user jalankan supaya provider ini siap. */
  nextStep: string | null;
  install: string;
  login: string;
}

async function executable(file: string): Promise<boolean> {
  try {
    await fs.access(file, fs.constants.X_OK);
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Cari binary di PATH lalu di folder tambahan. Tidak memakai shell. */
export async function findBinary(spec: ProviderSpec): Promise<string | null> {
  const fromPath = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of [...fromPath, ...spec.extraDirs]) {
    const candidate = path.join(dir, spec.bin);
    if (await executable(candidate)) return candidate;
  }
  return null;
}

async function versionOf(bin: string): Promise<string | null> {
  try {
    const { stdout } = await run(bin, ["--version"], { timeout: 15_000 });
    return stdout.trim().split("\n")[0] || null;
  } catch {
    return null;
  }
}

/** Baca mode login Codex dari `auth.json` tanpa menyentuh isi tokennya. */
async function codexAuth(spec: ProviderSpec): Promise<{ mode: AuthMode; detail: string }> {
  if (!spec.authFile) return { mode: "unknown", detail: "Status login tidak bisa dibaca." };
  try {
    const parsed = JSON.parse(await fs.readFile(spec.authFile, "utf-8")) as Record<string, unknown>;
    const hasTokens = !!parsed.tokens;
    const hasKey = typeof parsed.OPENAI_API_KEY === "string" && parsed.OPENAI_API_KEY.length > 0;
    if (hasTokens && !hasKey) return { mode: "subscription", detail: "Login pakai akun ChatGPT." };
    if (hasKey) return { mode: "api-key", detail: "Login pakai OPENAI_API_KEY (bukan langganan)." };
    return { mode: "none", detail: "Belum login." };
  } catch {
    return { mode: "none", detail: "Belum login." };
  }
}

async function fileAuth(spec: ProviderSpec, okDetail: string): Promise<{ mode: AuthMode; detail: string }> {
  if (!spec.authFile) return { mode: "unknown", detail: "Status login tidak bisa dibaca." };
  try {
    await fs.access(spec.authFile);
    return { mode: "subscription", detail: okDetail };
  } catch {
    // Claude Code bisa menyimpan kredensial di Keychain macOS, jadi "tidak ada berkas" belum
    // tentu berarti belum login — biarkan UI menyuruh cek lewat perintah login.
    return { mode: "unknown", detail: "Kredensial tidak ketemu di berkas (mungkin di Keychain)." };
  }
}

export async function providerStatus(id: ProviderId): Promise<ProviderStatus> {
  const spec = providerSpec(id);
  const bin = await findBinary(spec);

  if (!bin) {
    return {
      id,
      label: spec.label,
      subscription: spec.subscription,
      bin: null,
      version: null,
      auth: "none",
      detail: "CLI-nya belum terpasang.",
      nextStep: spec.install,
      install: spec.install,
      login: spec.login,
    };
  }

  const [version, auth] = await Promise.all([
    versionOf(bin),
    id === "codex" ? codexAuth(spec) : fileAuth(spec, `Login pakai akun ${spec.label}.`),
  ]);

  return {
    id,
    label: spec.label,
    subscription: spec.subscription,
    bin,
    version,
    auth: auth.mode,
    detail: auth.detail,
    nextStep: auth.mode === "subscription" ? null : spec.login,
    install: spec.install,
    login: spec.login,
  };
}

export function allProviderStatus(): Promise<ProviderStatus[]> {
  return Promise.all((Object.keys(PROVIDERS) as ProviderId[]).map(providerStatus));
}

/** Provider yang siap dipakai sekarang: binary ada dan login lewat langganan. */
export async function readyProviders(): Promise<ProviderStatus[]> {
  const all = await allProviderStatus();
  return all.filter((p) => p.bin && p.auth === "subscription");
}
