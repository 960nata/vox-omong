"use client";

export interface RustScannedFile {
  path: string;
  is_dir: boolean;
  size: number;
}

export interface RustSearchHit {
  path: string;
  line: number;
  preview: string;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[tauri] invoke(${cmd}) gagal:`, err);
    return null;
  }
}

export async function tauriScanFiles(rootDir: string, maxFiles = 5000): Promise<RustScannedFile[] | null> {
  return tauriInvoke<RustScannedFile[]>("vox_scan_files", { rootDir, maxFiles });
}

export async function tauriSearchCode(
  rootDir: string,
  query: string,
  maxResults = 80,
): Promise<RustSearchHit[] | null> {
  return tauriInvoke<RustSearchHit[]>("vox_search_code", { rootDir, query, maxResults });
}

export async function tauriSqliteGet(key: string): Promise<string | null> {
  return tauriInvoke<string | null>("vox_sqlite_get", { key });
}

export async function tauriSqliteSet(key: string, value: string): Promise<boolean> {
  const res = await tauriInvoke<boolean>("vox_sqlite_set", { key, value });
  return res === true;
}

export function onTauriMenu(handler: (action: string) => void): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | undefined;
  let cancelled = false;
  void import("@tauri-apps/api/event").then(({ listen }) => {
    if (cancelled) return;
    void listen<string>("vox:menu", (event) => {
      if (typeof event.payload === "string") handler(event.payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}
