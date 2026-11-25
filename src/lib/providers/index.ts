/**
 * Provider langganan VOX: menjalankan model lewat CLI resmi vendor yang sudah login dengan
 * akun langganan user (ChatGPT Plus/Pro, Claude Pro/Max, Google AI Pro) — tanpa API key.
 *
 * Lihat docs/providers.md.
 */

export { PROVIDERS, providerSpec, execArgs } from "./catalog";
export type { ProviderId, ProviderSpec } from "./catalog";
export { findBinary, providerStatus, allProviderStatus, readyProviders } from "./detect";
export type { AuthMode, ProviderStatus } from "./detect";
export { runProvider, ProviderError, parseCodexLine, parseClaudeLine, lineParser } from "./run";
export type { ProviderEvent, ProviderUsage, ProviderRunOptions, ProviderRunResult } from "./run";
