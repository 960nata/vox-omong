type LocalFileHandle = { kind: "file"; getFile(): Promise<File>; createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }> };
type LocalDirectoryHandle = {
  kind: "directory";
  name: string;
  entries(): AsyncIterable<[string, LocalFileHandle | LocalDirectoryHandle]>;
  getDirectoryHandle(name: string): Promise<LocalDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFileHandle>;
  queryPermission(options: { mode: "read" | "readwrite" }): Promise<string>;
  requestPermission(options: { mode: "readwrite" }): Promise<string>;
};
type SavedFolder = { projectId: string; handle: LocalDirectoryHandle };

const DB_NAME = "vox-local-project";
const STORE = "folders";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savedFolder(projectId: string): Promise<SavedFolder | null> {
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(projectId);
      request.onsuccess = () => { db.close(); resolve((request.result as SavedFolder) || null); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch { return null; }
}

async function saveFolder(folder: SavedFolder) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(folder, folder.projectId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const excluded = (name: string) => name.startsWith(".") || ["node_modules", "dist", "build", "vendor"].includes(name);

async function collect(handle: LocalDirectoryHandle, prefix = "", found: { path: string; file: File }[] = []): Promise<{ path: string; file: File }[]> {
  for await (const [name, child] of handle.entries()) {
    if (excluded(name)) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (child.kind === "directory") await collect(child, path, found);
    else {
      const file = await child.getFile();
      if (file.size <= 2_000_000) found.push({ path, file });
    }
    if (found.length > 500) throw new Error("Folder terlalu besar untuk sinkronisasi (maksimal 500 file).");
    if (found.reduce((sum, entry) => sum + entry.file.size, 0) > 40_000_000) throw new Error("Folder terlalu besar untuk sinkronisasi (maksimal 40 MB).");
  }
  return found;
}

export async function connectLocalProject(): Promise<string> {
  const picker = (window as Window & { showDirectoryPicker?: (options?: { mode: "readwrite" }) => Promise<LocalDirectoryHandle> }).showDirectoryPicker;
  if (!picker) throw new Error("Browser ini belum mendukung akses folder langsung. Pakai Impor Folder Lokal.");
  const handle = await picker.call(window, { mode: "readwrite" });
  const slug = handle.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "project";
  const projectId = `local-${slug}`;
  await saveFolder({ projectId, handle });
  await syncSavedLocalProject(projectId);
  return projectId;
}

export async function syncSavedLocalProject(projectId: string): Promise<boolean> {
  const saved = await savedFolder(projectId);
  if (!saved || saved.projectId !== projectId) return false;
  const rootName = projectId.slice("local-".length);
  if (await saved.handle.queryPermission({ mode: "read" }) !== "granted") {
    throw new Error("Akses folder lokal perlu diberikan lagi. Klik Hubungkan Folder Lokal.");
  }
  const files = await collect(saved.handle);
  const fingerprintKey = `vox_local_files_${projectId}`;
  const conflictKey = `vox_local_conflicts_${projectId}`;
  const protectedPaths = new Set(JSON.parse(localStorage.getItem(conflictKey) || "[]") as string[]);
  const previous = JSON.parse(localStorage.getItem(fingerprintKey) || "{}") as Record<string, string>;
  const current: Record<string, string> = {};
  const changed = files.filter(({ path, file }) => {
    current[path] = `${file.size}:${file.lastModified}`;
    return !protectedPaths.has(path) && previous[path] !== current[path];
  });
  if (changed.length) {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("uploadType", "folder");
    form.append("folderName", rootName);
    form.append("paths", JSON.stringify(changed.map(({ path }) => path)));
    for (const { file } of changed) form.append("files", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Sinkronisasi folder lokal gagal.");
  }
  const removed = Object.keys(previous).filter((path) => !protectedPaths.has(path) && !(path in current));
  for (const path of removed) {
    const response = await fetch("/api/fs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", projectId, filePath: path }),
    });
    if (!response.ok && response.status !== 404) throw new Error(`Gagal menyinkronkan file yang dihapus: ${path}`);
  }
  localStorage.setItem(fingerprintKey, JSON.stringify(current));
  return true;
}

/** Apply only agent-changed files to the previously selected browser folder. */
export async function writeAgentChangesToLocalFolder(projectId: string, changedFiles: string[], requestWritePermission = false): Promise<{ written: string[]; conflicts: string[]; needsPermission: boolean }> {
  const result = { written: [] as string[], conflicts: [] as string[], needsPermission: false };
  if (!projectId.startsWith("local-") || !changedFiles.length) return result;
  const saved = await savedFolder(projectId);
  if (!saved || saved.projectId !== projectId) { result.needsPermission = true; return result; }
  const mode = { mode: "readwrite" as const };
  let permission = await saved.handle.queryPermission(mode);
  if (permission !== "granted" && requestWritePermission) permission = await saved.handle.requestPermission(mode);
  if (permission !== "granted") { result.needsPermission = true; return result; }
  const fingerprintKey = `vox_local_files_${projectId}`;
  const conflictKey = `vox_local_conflicts_${projectId}`;
  const previous = JSON.parse(localStorage.getItem(fingerprintKey) || "{}") as Record<string, string>;
  const protectedPaths = new Set(JSON.parse(localStorage.getItem(conflictKey) || "[]") as string[]);
  for (const rel of [...new Set(changedFiles)].slice(0, 30)) {
    if (protectedPaths.has(rel)) { result.conflicts.push(rel); continue; }
    const parts = rel.replace(/\\/g, "/").split("/");
    if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith(".")) || !/\.(?:tsx?|jsx?|mjs|cjs|json|md|html|css|scss|py|go|rs|java|kt|swift|vue|svelte|astro)$/i.test(rel)) { result.conflicts.push(rel); protectedPaths.add(rel); continue; }
    try {
      let folder = saved.handle;
      for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part);
      let handle: LocalFileHandle | null = null;
      try { handle = await folder.getFileHandle(parts.at(-1)!); } catch (error) { if ((error as DOMException).name !== "NotFoundError") throw error; }
      if (handle) {
        const current = await handle.getFile();
        if (previous[rel] !== `${current.size}:${current.lastModified}`) { result.conflicts.push(rel); protectedPaths.add(rel); continue; }
      } else if (previous[rel] !== undefined) { result.conflicts.push(rel); protectedPaths.add(rel); continue; }
      const response = await fetch(`/api/fs?projectId=${encodeURIComponent(projectId)}&filePath=${encodeURIComponent(rel)}`);
      const payload = await response.json();
      if (!response.ok || !payload.success || payload.isBinary || typeof payload.content !== "string" || payload.content.length > 120_000) throw new Error(`Salinan ${rel} tidak tersedia.`);
      handle ||= await folder.getFileHandle(parts.at(-1)!, { create: true });
      const writable = await handle.createWritable();
      try { await writable.write(payload.content); await writable.close(); }
      catch (error) { await writable.abort().catch(() => {}); throw error; }
      const updated = await handle.getFile();
      previous[rel] = `${updated.size}:${updated.lastModified}`;
      protectedPaths.delete(rel);
      localStorage.setItem(fingerprintKey, JSON.stringify(previous));
      result.written.push(rel);
    } catch { result.conflicts.push(rel); protectedPaths.add(rel); }
  }
  localStorage.setItem(conflictKey, JSON.stringify([...protectedPaths]));
  return result;
}
