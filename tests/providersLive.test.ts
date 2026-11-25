/**
 * Tes langsung ke CLI provider. Dilewati kecuali `VOX_LIVE=1`, karena ini benar-benar memanggil
 * langganan user (kena kuota) dan butuh CLI yang sudah login.
 *
 *   VOX_LIVE=1 npx vitest run tests/providersLive.test.ts
 */

import { describe, expect, it } from "vitest";
import { providerStatus, runProvider } from "@/lib/providers";

const live = process.env.VOX_LIVE === "1";

describe.skipIf(!live)("CLI provider sungguhan", () => {
  it("melaporkan status codex", async () => {
    const status = await providerStatus("codex");
    expect(status.bin).toBeTruthy();
    expect(status.auth).toBe("subscription");
  }, 60_000);

  it("menjawab prompt pendek tanpa API key", async () => {
    const result = await runProvider({
      provider: "codex",
      prompt: "Balas persis satu kata: SIAP",
      timeoutMs: 180_000,
    });
    expect(result.text.toUpperCase()).toContain("SIAP");
    expect(result.exitCode).toBe(0);
    expect(result.sessionId).toBeTruthy();
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  }, 240_000);

  it("menolak prompt kosong tanpa memanggil CLI", async () => {
    await expect(runProvider({ provider: "codex", prompt: "   " })).rejects.toThrow(/kosong/);
  });
});
