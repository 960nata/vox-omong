/**
 * Jembatan shell desktop (lihat electron/preload.cjs).
 *
 * `window.vox` hanya ada kalau VOX dibuka dari app desktop. Di tab browser nilainya `undefined`,
 * jadi selalu cek dulu: `if (window.vox?.desktop) …`.
 */

interface VoxDesktopInfo {
  platform: NodeJS.Platform | string;
  appVersion: string;
  electron: string;
  isDev: boolean;
  serverUrl: string | null;
  keepAwake: boolean;
}

interface VoxDesktopBridge {
  readonly desktop: true;
  info(): Promise<VoxDesktopInfo>;
  notify(title: string, body: string): Promise<boolean>;
  setKeepAwake(on: boolean): Promise<boolean>;
  /** Hanya perintah yang sudah di-whitelist: "codex login" | "claude login" | "gemini". */
  providerLogin(command: "codex login" | "claude login" | "gemini"): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;
  /** Mengembalikan fungsi untuk berhenti mendengarkan. */
  onDeepLink(handler: (url: string) => void): () => void;
}

interface Window {
  vox?: VoxDesktopBridge;
}
