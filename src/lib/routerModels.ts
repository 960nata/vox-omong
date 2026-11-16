/**
 * Nama model & key untuk ClassAI Router.
 * - Nama lama/alias di UI (claude-opus-5.0, qwen-max, ...) dibalas 404 oleh router: ubah ke ID katalog.
 * - Key CHEAP (lane Prime) dipakai untuk SEMUA model, termasuk Opus: harganya ~18x lebih murah dari lane Premium,
 *   dan lane Premium mengembalikan blok thinking sehingga balasan kosong (content: null) saat max_tokens kecil.
 */
const ALIASES: Record<string, string> = {
  "claude-opus-5.0": "claude-opus-5",
  "claude-sonnet-5.0": "claude-sonnet-5",
  "claude-sonnet-4.5": "claude-haiku-4.5",
  "claude-opus": "claude-opus-5.5",
  "qwen-max": "qwen3.8-max",
  "qwen-plus": "qwen3.7-plus",
  "deepseek-chat": "deepseek-v4.1-flash",
  "deepseek-pro": "deepseek-v4-pro",
  "gpt-6": "gpt-6-sol",
  "gpt-6.1": "gpt-6.1-sol",
  "gpt-5": "gpt-5.6-luna",
  "kimi-code": "kimi-k2.7-code",
};

export function routerModel(id: string): string {
  const k = id.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

