/**
 * Backup model & akun provider.
 *
 * Adopsi konsep OpenBot (docs/openbot-breakdown.md §D): kalau model utama kena rate limit atau
 * error sementara, permintaan dipindah ke pilihan berikutnya. Akun yang kena limit ditandai
 * `limitedUntil` dan dilewati sampai waktunya habis.
 *
 * Kredensial tidak pernah disimpan di sini — yang dicatat hanya nama env var-nya.
 */

import { newId, readCollection, updateCollection } from "./store";
import type { FailoverPlan, ModelChoice, ProviderAccount } from "./types";

const ACCOUNTS = "provider-accounts";

export class FailoverError extends Error {}

export function listAccounts(): Promise<ProviderAccount[]> {
  return readCollection<ProviderAccount>(ACCOUNTS);
}

export function addAccount(input: {
  provider: string;
  label: string;
  credentialEnv: string;
}): Promise<ProviderAccount> {
  return updateCollection<ProviderAccount, ProviderAccount>(ACCOUNTS, (items) => {
    const account: ProviderAccount = {
      id: newId("acc"),
      provider: input.provider,
      label: input.label,
      credentialEnv: input.credentialEnv,
    };
    items.push(account);
    return account;
  });
}

export function removeAccount(id: string): Promise<boolean> {
  return updateCollection<ProviderAccount, boolean>(ACCOUNTS, (items) => {
    const index = items.findIndex((a) => a.id === id);
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
  });
}

/** Tandai akun kena limit sampai `until`; akun ini dilewati selama itu. */
export function markLimited(id: string, until: Date): Promise<ProviderAccount | null> {
  return updateCollection<ProviderAccount, ProviderAccount | null>(ACCOUNTS, (items) => {
    const account = items.find((a) => a.id === id);
    if (!account) return null;
    account.limitedUntil = until.toISOString();
    return account;
  });
}

export function accountUsable(account: ProviderAccount, now: Date = new Date()): boolean {
  if (account.disabled) return false;
  if (!account.limitedUntil) return true;
  return new Date(account.limitedUntil).getTime() <= now.getTime();
}

/** Akun pertama yang masih bisa dipakai untuk sebuah provider. */
export function pickAccount(
  accounts: ProviderAccount[],
  provider: string,
  now: Date = new Date()
): ProviderAccount | null {
  return accounts.find((a) => a.provider === provider && accountUsable(a, now)) ?? null;
}

/** Error yang pantas dicoba ke model cadangan (rate limit, kuota, server sibuk, jaringan). */
export function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number; statusCode?: number } | null)?.status
    ?? (error as { statusCode?: number } | null)?.statusCode;
  if (status === 429 || (typeof status === "number" && status >= 500)) return true;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return [
    "rate limit",
    "rate_limit",
    "quota",
    "usage limit",
    "too many requests",
    "overloaded",
    "capacity",
    "timeout",
    "etimedout",
    "econnreset",
    "fetch failed",
    "503",
    "529",
  ].some((needle) => message.includes(needle));
}

export interface AttemptLog {
  choice: ModelChoice;
  error: string;
  retryable: boolean;
}

export interface FailoverResult<T> {
  value: T;
  /** Pilihan yang akhirnya berhasil. */
  used: ModelChoice;
  /** Percobaan yang gagal sebelum berhasil — enak buat ditampilkan di UI usage. */
  attempts: AttemptLog[];
}

/**
 * Jalankan `call` memakai rantai model: pilihan utama dulu, lalu cadangan berikutnya setiap kali
 * errornya layak dicoba lagi. Error yang tidak retryable (mis. prompt salah) langsung dilempar
 * supaya tidak membakar kuota akun lain.
 */
export async function withFailover<T>(
  plan: FailoverPlan,
  call: (choice: ModelChoice) => Promise<T>,
  options: { accounts?: ProviderAccount[]; now?: Date } = {}
): Promise<FailoverResult<T>> {
  if (!plan.chain.length) throw new FailoverError("Rantai model kosong.");
  const now = options.now ?? new Date();
  const attempts: AttemptLog[] = [];

  for (const raw of plan.chain) {
    const choice = { ...raw };
    if (options.accounts && !choice.accountId) {
      const account = pickAccount(options.accounts, choice.provider, now);
      if (!account) {
        attempts.push({
          choice,
          error: `Tidak ada akun ${choice.provider} yang bisa dipakai sekarang.`,
          retryable: true,
        });
        continue;
      }
      choice.accountId = account.id;
    }
    try {
      return { value: await call(choice), used: choice, attempts };
    } catch (error) {
      const retryable = isRetryable(error);
      attempts.push({
        choice,
        error: error instanceof Error ? error.message : String(error),
        retryable,
      });
      if (!retryable) throw error;
    }
  }

  throw new FailoverError(
    `Semua model gagal: ${attempts.map((a) => `${a.choice.model} (${a.error})`).join("; ")}`
  );
}
