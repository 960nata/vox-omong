import { describe, expect, it, vi } from "vitest";
import { accountUsable, isRetryable, pickAccount, withFailover, FailoverError } from "@/lib/engine/failover";
import type { ProviderAccount } from "@/lib/engine/types";

const chain = [
  { provider: "anthropic", model: "claude-opus-5" },
  { provider: "anthropic", model: "claude-sonnet-5" },
  { provider: "google", model: "gemini-3-pro" },
];

function rateLimit() {
  const error = new Error("rate limit exceeded") as Error & { status?: number };
  error.status = 429;
  return error;
}

describe("deteksi error yang layak dicoba lagi", () => {
  it("menganggap 429, 5xx, dan pesan kuota sebagai retryable", () => {
    expect(isRetryable(rateLimit())).toBe(true);
    expect(isRetryable(Object.assign(new Error("boom"), { status: 503 }))).toBe(true);
    expect(isRetryable(new Error("Usage limit reached"))).toBe(true);
    expect(isRetryable(new Error("fetch failed"))).toBe(true);
  });

  it("tidak mengulang error yang memang salah permintaannya", () => {
    expect(isRetryable(Object.assign(new Error("bad request"), { status: 400 }))).toBe(false);
    expect(isRetryable(new Error("prompt terlalu panjang"))).toBe(false);
  });
});

describe("withFailover", () => {
  it("memakai pilihan pertama kalau berhasil", async () => {
    const call = vi.fn(async () => "oke");
    const result = await withFailover({ chain }, call);
    expect(result.value).toBe("oke");
    expect(result.used.model).toBe("claude-opus-5");
    expect(result.attempts).toHaveLength(0);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("pindah ke model cadangan saat kena rate limit", async () => {
    const call = vi.fn(async (choice: { model: string }) => {
      if (choice.model !== "gemini-3-pro") throw rateLimit();
      return "dari gemini";
    });
    const result = await withFailover({ chain }, call);
    expect(result.value).toBe("dari gemini");
    expect(result.used.model).toBe("gemini-3-pro");
    expect(result.attempts.map((a) => a.choice.model)).toEqual(["claude-opus-5", "claude-sonnet-5"]);
  });

  it("langsung melempar error yang bukan rate limit, tanpa membakar kuota lain", async () => {
    const call = vi.fn(async () => {
      throw Object.assign(new Error("prompt tidak valid"), { status: 400 });
    });
    await expect(withFailover({ chain }, call)).rejects.toThrow("prompt tidak valid");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("melempar FailoverError kalau semua pilihan habis", async () => {
    const call = vi.fn(async () => {
      throw rateLimit();
    });
    await expect(withFailover({ chain }, call)).rejects.toThrow(FailoverError);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("rantai kosong ditolak", async () => {
    await expect(withFailover({ chain: [] }, async () => "x")).rejects.toThrow(FailoverError);
  });
});

describe("pemilihan akun", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const accounts: ProviderAccount[] = [
    {
      id: "acc-1",
      provider: "anthropic",
      label: "utama",
      credentialEnv: "ANTHROPIC_API_KEY",
      limitedUntil: "2026-11-25T11:00:00Z",
    },
    { id: "acc-2", provider: "anthropic", label: "kedua", credentialEnv: "ANTHROPIC_API_KEY_2" },
    { id: "acc-3", provider: "google", label: "g", credentialEnv: "GEMINI_API_KEY", disabled: true },
  ];

  it("melewati akun yang masih kena limit dan yang dimatikan", () => {
    expect(accountUsable(accounts[0], now)).toBe(false);
    expect(accountUsable(accounts[0], new Date("2026-11-25T11:30:00Z"))).toBe(true);
    expect(pickAccount(accounts, "anthropic", now)?.id).toBe("acc-2");
    expect(pickAccount(accounts, "google", now)).toBeNull();
  });

  it("mengisi akun otomatis dan melewati provider tanpa akun yang bisa dipakai", async () => {
    const seen: (string | undefined)[] = [];
    const result = await withFailover(
      { chain },
      async (choice) => {
        seen.push(choice.accountId);
        return choice.model;
      },
      { accounts, now }
    );
    expect(result.used.accountId).toBe("acc-2");
    expect(seen).toEqual(["acc-2"]);

    const googleOnly = await withFailover(
      { chain: [{ provider: "google", model: "gemini-3-pro" }, { provider: "anthropic", model: "claude-sonnet-5" }] },
      async (choice) => choice.model,
      { accounts, now }
    );
    expect(googleOnly.used.model).toBe("claude-sonnet-5");
    expect(googleOnly.attempts[0].error).toMatch(/google/);
  });
});
