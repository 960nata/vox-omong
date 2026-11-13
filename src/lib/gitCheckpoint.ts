import fs from "fs/promises";
import path from "path";
import { PROJECTS_BASE } from "./projects";
import { invalidateCodeIndex } from "./localCodeSearch";

export interface CheckpointRecord {
  id: string;
  projectId: string;
  description: string;
  createdAt: string;
  backupFiles: Record<string, string>; // relPath -> relative path in checkpoint storage
  createdFiles: string[];
}

export async function getCheckpointDir(projectId: string): Promise<string> {
  const base = await fs.realpath(PROJECTS_BASE);
  const root = path.join(base, projectId);
  const chkDir = path.join(root, ".vox_checkpoints");
  await fs.mkdir(chkDir, { recursive: true });
  return chkDir;
}

/**
 * Buat sesi checkpoint sebelum agen coding mengubah file apapun.
 */
export async function createCheckpoint(projectId: string, description: string): Promise<string> {
  const id = `chk_${Date.now()}`;
  const chkDir = await getCheckpointDir(projectId);
  const dir = path.join(chkDir, id);
  await fs.mkdir(path.join(dir, "files"), { recursive: true });

  const record: CheckpointRecord = {
    id,
    projectId,
    description: description.slice(0, 300),
    createdAt: new Date().toISOString(),
    backupFiles: {},
    createdFiles: [],
  };

  await fs.writeFile(path.join(dir, "checkpoint.json"), JSON.stringify(record, null, 2), "utf8");

  // Bersihkan checkpoint lama, simpan maksimal 8 checkpoint terbaru
  cleanOldCheckpoints(chkDir).catch(() => {});
  return id;
}

async function cleanOldCheckpoints(chkDir: string) {
  try {
    const entries = await fs.readdir(chkDir);
    const checkpoints = entries.filter((e) => e.startsWith("chk_")).sort();
    if (checkpoints.length > 8) {
      const toDelete = checkpoints.slice(0, checkpoints.length - 8);
      for (const oldId of toDelete) {
        await fs.rm(path.join(chkDir, oldId), { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Cadangkan file asli sebelum ditimpa/diedit oleh agen.
 */
export async function backupFileBeforeEdit(projectId: string, checkpointId: string, relPath: string): Promise<void> {
  const base = await fs.realpath(PROJECTS_BASE);
  const root = path.join(base, projectId);
  const chkDir = await getCheckpointDir(projectId);
  const recordPath = path.join(chkDir, checkpointId, "checkpoint.json");

  try {
    const raw = await fs.readFile(recordPath, "utf8");
    const record: CheckpointRecord = JSON.parse(raw);
    if (record.backupFiles[relPath]) return; // sudah dicadangkan di checkpoint ini

    const originalFile = path.join(root, relPath);
    const content = await fs.readFile(originalFile, "utf8").catch(() => null);
    if (content === null) return;

    const safeName = relPath.replace(/[\\/]/g, "__");
    const backupStorageRel = path.join("files", safeName);
    const backupStoragePath = path.join(chkDir, checkpointId, backupStorageRel);
    await fs.writeFile(backupStoragePath, content, "utf8");

    record.backupFiles[relPath] = backupStorageRel;
    await fs.writeFile(recordPath, JSON.stringify(record, null, 2), "utf8");
  } catch {}
}

/**
 * Catat file baru yang dibuat oleh agen agar bisa dihapus saat di-undo.
 */
export async function recordCreatedFile(projectId: string, checkpointId: string, relPath: string): Promise<void> {
  const chkDir = await getCheckpointDir(projectId);
  const recordPath = path.join(chkDir, checkpointId, "checkpoint.json");
  try {
    const raw = await fs.readFile(recordPath, "utf8");
    const record: CheckpointRecord = JSON.parse(raw);
    if (!record.createdFiles.includes(relPath)) {
      record.createdFiles.push(relPath);
      await fs.writeFile(recordPath, JSON.stringify(record, null, 2), "utf8");
    }
  } catch {}
}

/**
 * Hitung perkiraan baris ditambah dan dihapus.
 */
export function computeFileDiffStats(originalContent: string, newContent: string): { additions: number; deletions: number } {
  const origLines = originalContent.split("\n");
  const newLines = newContent.split("\n");
  const origSet = new Set(origLines);
  const newSet = new Set(newLines);

  let additions = 0;
  for (const line of newLines) {
    if (!origSet.has(line)) additions++;
  }
  let deletions = 0;
  for (const line of origLines) {
    if (!newSet.has(line)) deletions++;
  }
  return { additions: Math.max(1, additions), deletions: Math.max(0, deletions) };
}

/**
 * Baca isi file asli sebelum diedit dari checkpoint.
 */
export async function getOriginalContent(projectId: string, checkpointId: string, relPath: string): Promise<string | null> {
  try {
    const chkDir = await getCheckpointDir(projectId);
    const safeName = relPath.replace(/[\\/]/g, "__");
    const backupStoragePath = path.join(chkDir, checkpointId, "files", safeName);
    return await fs.readFile(backupStoragePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Rollback/Undo semua perubahan kode yang dilakukan agen coding.
 */
export async function rollbackCheckpoint(
  projectId: string,
  checkpointId?: string
): Promise<{ success: boolean; restoredFiles: string[]; deletedFiles: string[]; message: string }> {
  const base = await fs.realpath(PROJECTS_BASE);
  const root = path.join(base, projectId);
  const chkDir = await getCheckpointDir(projectId);

  let targetId = checkpointId;
  if (!targetId) {
    const entries = await fs.readdir(chkDir).catch(() => []);
    const checkpoints = entries.filter((e) => e.startsWith("chk_")).sort().reverse();
    if (!checkpoints.length) {
      return {
        success: false,
        restoredFiles: [],
        deletedFiles: [],
        message: "Tidak ada riwayat checkpoint agen coding yang dapat di-undo pada proyek ini.",
      };
    }
    targetId = checkpoints[0];
  }

  const recordPath = path.join(chkDir, targetId, "checkpoint.json");
  let record: CheckpointRecord;
  try {
    record = JSON.parse(await fs.readFile(recordPath, "utf8"));
  } catch {
    return {
      success: false,
      restoredFiles: [],
      deletedFiles: [],
      message: "Data checkpoint tidak ditemukan atau sudah dibatalkan.",
    };
  }

  const restoredFiles: string[] = [];
  const deletedFiles: string[] = [];

  // 1. Kembalikan file yang telah dimodifikasi
  for (const [relPath, backupStorageRel] of Object.entries(record.backupFiles)) {
    try {
      const backupPath = path.join(chkDir, targetId, backupStorageRel);
      const originalContent = await fs.readFile(backupPath, "utf8");
      const targetPath = path.join(root, relPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, originalContent, "utf8");
      restoredFiles.push(relPath);
    } catch {}
  }

  // 2. Hapus file yang baru dibuat oleh agen
  for (const relPath of record.createdFiles) {
    try {
      const targetPath = path.join(root, relPath);
      await fs.rm(targetPath, { force: true });
      deletedFiles.push(relPath);
    } catch {}
  }

  // Bersihkan search index
  invalidateCodeIndex(root);

  // Hapus checkpoint yang telah di-rollback
  await fs.rm(path.join(chkDir, targetId), { recursive: true, force: true }).catch(() => {});

  const fileList = [...restoredFiles.map((f) => `\`${f}\``), ...deletedFiles.map((f) => `(hapus) \`${f}\``)].join(", ");
  return {
    success: true,
    restoredFiles,
    deletedFiles,
    message: `Berhasil mengembalikan project ke kondisi sebelum: "${record.description}". File dipulihkan: ${fileList || "Tidak ada"}.`,
  };
}
