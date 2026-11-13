import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import ts from "typescript";
import { PROJECTS_BASE, listProjectFiles } from "./projects";
import { searchProjectCode, invalidateCodeIndex } from "./localCodeSearch";
import { executeTerminal } from "./terminalRuntime";
import { createCheckpoint, backupFileBeforeEdit, recordCreatedFile } from "./gitCheckpoint";

const execFileAsync = promisify(execFile);
const CODE_FILE = /\.(?:tsx?|jsx?|mjs|cjs|json|md|html|css|scss|py|go|rs|java|kt|swift|vue|svelte|astro)$/i;
const DEFAULT_MAX_STEPS = 16;
const MAX_FILE_BYTES = 150_000;

export type Action =
  | { tool: "list_files"; prefix?: string }
  | { tool: "search_code"; query: string }
  | { tool: "read_file"; path: string; startLine?: number }
  | { tool: "replace_text"; path: string; oldText: string; newText: string }
  | { tool: "replace_lines"; path: string; startLine: number; endLine: number; newText: string }
  | { tool: "create_file"; path: string; content: string }
  | { tool: "run_command"; command: string }
  | { tool: "run_check"; path: string }
  | { tool: "run_test"; path: string }
  | { tool: "finish"; summary?: string };

export type CodingDecision = (system: string, prompt: string) => Promise<string>;
export type CodingResult = { reply: string; changedFiles: string[]; checks: string[]; log: string[]; checkpointId?: string };

export interface CodingProgressEvent {
  step: number;
  maxSteps: number;
  tool: string;
  detail: string;
  status: "running" | "done" | "error";
}

export interface CodingOptions {
  maxSteps?: number;
  onProgress?: (event: CodingProgressEvent) => void;
}

function parseAction(raw: string): Action | null {
  try {
    let clean = raw.trim();
    clean = clean.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let value: Record<string, unknown> | null = null;
    try {
      value = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) value = JSON.parse(match[0]);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    if (value.tool === "finish") return { tool: "finish", summary: typeof value.summary === "string" ? value.summary.slice(0, 1000) : undefined };
    if (value.tool === "list_files" && (value.prefix === undefined || typeof value.prefix === "string")) return { tool: "list_files", prefix: value.prefix };
    if (value.tool === "search_code" && typeof value.query === "string") return { tool: "search_code", query: value.query };
    if (value.tool === "read_file" && typeof value.path === "string") return { tool: "read_file", path: value.path, startLine: Number(value.startLine) || 1 };
    if (value.tool === "replace_text" && typeof value.path === "string" && typeof value.oldText === "string" && typeof value.newText === "string") {
      return { tool: "replace_text", path: value.path, oldText: value.oldText, newText: value.newText };
    }
    if (value.tool === "replace_lines" && typeof value.path === "string" && typeof value.newText === "string") {
      const start = Number(value.startLine);
      const end = Number(value.endLine);
      if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start) {
        return { tool: "replace_lines", path: value.path, startLine: Math.floor(start), endLine: Math.floor(end), newText: value.newText };
      }
    }
    if (value.tool === "create_file" && typeof value.path === "string" && typeof value.content === "string") return { tool: "create_file", path: value.path, content: value.content };
    if (value.tool === "run_command" && typeof value.command === "string") return { tool: "run_command", command: value.command };
    if (value.tool === "run_check" && typeof value.path === "string") return { tool: "run_check", path: value.path };
    if (value.tool === "run_test" && typeof value.path === "string") return { tool: "run_test", path: value.path };
    return null;
  } catch {
    return null;
  }
}

function syntaxError(file: string, content: string): string | null {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".json") {
    try {
      JSON.parse(content);
    } catch (error) {
      return String(error);
    }
  }
  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return null;
  const kind = ext === ".tsx" ? ts.ScriptKind.TSX : ext === ".jsx" ? ts.ScriptKind.JSX : ext === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const parsed = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
  const errors = (parsed as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics || [];
  return errors.length ? ts.flattenDiagnosticMessageText(errors[0].messageText, " ") : null;
}

/**
 * Smart Tolerant Patcher:
 * Toleran terhadap CRLF vs LF, spasi trailing, dan variasi indentasi awal.
 */
export function smartApplyPatch(fileContent: string, oldText: string, newText: string): string {
  if (!oldText) throw new Error("oldText tidak boleh kosong.");

  // Strategi 1: Exact string match
  const exactCount = fileContent.split(oldText).length - 1;
  if (exactCount === 1) return fileContent.replace(oldText, newText);
  if (exactCount > 1) {
    throw new Error(`Teks lama cocok ${exactCount} kali. Tambahkan baris konteks sebelum/sesudah agar unik.`);
  }

  // Strategi 2: Normalisasi Line-Ending (\r\n -> \n)
  const isCRLF = fileContent.includes("\r\n");
  const normFile = fileContent.replace(/\r\n/g, "\n");
  const normOld = oldText.replace(/\r\n/g, "\n");
  const normNew = newText.replace(/\r\n/g, "\n");
  const normCount = normFile.split(normOld).length - 1;
  if (normCount === 1) {
    const replaced = normFile.replace(normOld, normNew);
    return isCRLF ? replaced.replace(/\n/g, "\r\n") : replaced;
  }
  if (normCount > 1) {
    throw new Error(`Teks lama cocok ${normCount} kali di baris ternormalisasi. Perlu konteks lebih spesifik.`);
  }

  // Strategi 3: Normalisasi Trailing Whitespace per baris
  const fileLines = normFile.split("\n");
  const oldLines = normOld.split("\n").map((l) => l.trimEnd());
  let matchIdx = -1;
  let matchCount = 0;
  for (let i = 0; i <= fileLines.length - oldLines.length; i++) {
    let matches = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (fileLines[i + j].trimEnd() !== oldLines[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      matchIdx = i;
      matchCount++;
    }
  }
  if (matchCount === 1) {
    const beforeLines = fileLines.slice(0, matchIdx);
    const afterLines = fileLines.slice(matchIdx + oldLines.length);
    const result = [...beforeLines, normNew, ...afterLines].join(isCRLF ? "\r\n" : "\n");
    return result;
  }
  if (matchCount > 1) {
    throw new Error(`Teks lama cocok di ${matchCount} lokasi berbeda (trailing space). Berikan konteks baris unik.`);
  }

  // Strategi 4: Fuzzy Trim per baris (jika lebih dari 1 baris)
  const oldTrimmed = normOld.split("\n").map((l) => l.trim());
  if (oldTrimmed.filter(Boolean).length >= 2) {
    let trimMatchIdx = -1;
    let trimMatchCount = 0;
    for (let i = 0; i <= fileLines.length - oldTrimmed.length; i++) {
      let matches = true;
      for (let j = 0; j < oldTrimmed.length; j++) {
        if (fileLines[i + j].trim() !== oldTrimmed[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        trimMatchIdx = i;
        trimMatchCount++;
      }
    }
    if (trimMatchCount === 1) {
      const baseIndentMatch = fileLines[trimMatchIdx].match(/^(\s*)/);
      const baseIndent = baseIndentMatch ? baseIndentMatch[1] : "";
      const indentedNew = normNew
        .split("\n")
        .map((line, idx) => (idx === 0 || !line ? line : `${baseIndent}${line}`))
        .join("\n");
      const beforeLines = fileLines.slice(0, trimMatchIdx);
      const afterLines = fileLines.slice(trimMatchIdx + oldTrimmed.length);
      return [...beforeLines, indentedNew, ...afterLines].join(isCRLF ? "\r\n" : "\n");
    }
    if (trimMatchCount > 1) {
      throw new Error(`Teks lama cocok di ${trimMatchCount} tempat dengan indentasi berbeda. Berikan konteks lebih unik.`);
    }
  }

  throw new Error("Teks lama tidak ditemukan di dalam file. Gunakan read_file untuk melihat baris yang tepat atau gunakan replace_lines.");
}

/**
 * Replace rentang baris langsung (1-based index).
 */
export function smartReplaceLines(fileContent: string, startLine: number, endLine: number, newText: string): string {
  const isCRLF = fileContent.includes("\r\n");
  const lines = fileContent.replace(/\r\n/g, "\n").split("\n");
  if (startLine < 1 || startLine > lines.length) {
    throw new Error(`startLine ${startLine} di luar rentang baris file (1–${lines.length}).`);
  }
  if (endLine < startLine || endLine > lines.length) {
    throw new Error(`endLine ${endLine} di luar rentang baris file (startLine=${startLine}, max=${lines.length}).`);
  }
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const normNew = newText.replace(/\r\n/g, "\n");
  return [...before, normNew, ...after].join(isCRLF ? "\r\n" : "\n");
}

export async function runCodingHarness(
  projectId: string,
  brief: string,
  decide: CodingDecision,
  options: CodingOptions = {}
): Promise<CodingResult> {
  if (!/^[a-z0-9_-]{1,80}$/.test(projectId)) throw new Error("Project tidak valid");
  const base = await fs.realpath(PROJECTS_BASE);
  const root = await fs.realpath(path.join(base, projectId));
  if (!root.startsWith(base + path.sep)) throw new Error("Project di luar workspace");

  const maxSteps = Math.min(30, Math.max(4, options.maxSteps ?? DEFAULT_MAX_STEPS));
  const entries = (await listProjectFiles(projectId))
    .filter((f) => !f.isDir && f.size <= MAX_FILE_BYTES && CODE_FILE.test(f.path))
    .slice(0, 800);
  const files = new Set(entries.map((f) => f.path));
  const changed = new Set<string>();
  const checks: string[] = [];
  const log: string[] = [];
  const repeated = new Set<string>();
  let summary = "";
  let checkpointId = "";
  try {
    checkpointId = await createCheckpoint(projectId, brief);
  } catch {}

  async function safePath(rel: string): Promise<string> {
    if (!files.has(rel) || rel.split(/[\\/]/).some((part) => part.startsWith("."))) {
      throw new Error("File tidak tersedia untuk agen coding.");
    }
    const target = path.join(root, rel);
    if ((await fs.lstat(target)).isSymbolicLink()) throw new Error("Symlink tidak boleh dibaca atau diubah.");
    const actual = await fs.realpath(target);
    if (!actual.startsWith(root + path.sep)) throw new Error("File di luar project aktif.");
    if ((await fs.stat(actual)).size > MAX_FILE_BYTES) throw new Error("File terlalu besar.");
    return actual;
  }

  async function checkFile(rel: string): Promise<string> {
    const target = await safePath(rel);
    const content = await fs.readFile(target, "utf8");
    const syntax = syntaxError(rel, content);
    if (syntax) throw new Error(`Sintaks gagal: ${syntax}`);
    if (/^tsconfig(?:\.[\w-]+)?\.json$/i.test(path.basename(rel))) {
      try {
        await execFileAsync(process.execPath, [require.resolve("typescript/bin/tsc"), "--noEmit", "--project", target], {
          cwd: root,
          timeout: 30_000,
          maxBuffer: 16_000,
          env: { PATH: path.dirname(process.execPath), NODE_ENV: "test" },
        });
      } catch (error) {
        throw new Error(`typecheck project gagal: ${String(error).slice(0, 500)}`);
      }
      return `Lulus: terminal TypeScript typecheck untuk ${rel}.`;
    }
    const ext = path.extname(target).toLowerCase();
    if ([".js", ".mjs", ".cjs"].includes(ext)) {
      try {
        await execFileAsync(process.execPath, ["--check", target], {
          cwd: root,
          timeout: 10_000,
          maxBuffer: 16_000,
          env: { PATH: path.dirname(process.execPath), NODE_ENV: "test" },
        });
      } catch (error) {
        throw new Error(`node --check gagal: ${String(error).slice(0, 300)}`);
      }
      return `Lulus: parser dan terminal node --check untuk ${rel}.`;
    }
    return `Lulus: pemeriksaan sintaks lokal untuk ${rel}.`;
  }

  const manifest = entries
    .map((f) => f.path)
    .join("\n")
    .slice(0, 3200);

  const systemPrompt = `Kamu adalah Autonomous Coding Agent level profesional (setara Claude Code & Cursor).
Tugasmu: telusuri codebase, analisis masalah, buat/ubah kode secara presisi, lalu jalankan verifikasi terminal sampai tugas tuntas.

Pilih tepat SATU tool per putaran; balas JSON saja tanpa teks pembuka/penutup.
Tools yang tersedia:
- list_files { "tool": "list_files", "prefix": "src/..." }
- search_code { "tool": "search_code", "query": "..." }
- read_file { "tool": "read_file", "path": "...", "startLine": 1 } (membaca ~90 baris mulai startLine)
- replace_text { "tool": "replace_text", "path": "...", "oldText": "...", "newText": "..." } (smart patcher otomatis toleran indentasi & line-ending)
- replace_lines { "tool": "replace_lines", "path": "...", "startLine": 10, "endLine": 25, "newText": "..." } (ganti rentang baris langsung)
- create_file { "tool": "create_file", "path": "...", "content": "..." } (buat file baru di folder yang valid)
- run_command { "tool": "run_command", "command": "npm run build" } (jalankan perintah terminal di root project)
- run_check { "tool": "run_check", "path": "..." } (pemeriksaan sintaks cepat file)
- run_test { "tool": "run_test", "path": "..." } (jalankan file unit test)
- finish { "tool": "finish", "summary": "..." } (selesai dan laporkan ringkasan pekerjaan)

Aturan Kerja Agen:
1. Sebelum mengedit, baca dulu baris file yang relevan menggunakan search_code atau read_file.
2. Saat mengedit, gunakan replace_text dengan beberapa baris konteks unik, atau gunakan replace_lines bila nomor baris sudah jelas.
3. Setelah mengedit, SELALU jalankan run_command (misal npm run build, npm test, npx tsc) atau run_check untuk memastikan kode bebas error.
4. Jika ada error dari run_command atau run_check, periksa pesan errornya lalu perbaiki.
5. Panggil finish bila pekerjaan sudah diverifikasi selesai.`;

  for (let step = 0; step < maxSteps; step++) {
    let action: Action | null;
    try {
      const raw = await decide(
        systemPrompt,
        `TUGAS: ${brief.slice(0, 1200)}\nPROJECT: ${projectId}\nFILE TERSEDIA:\n${manifest}\nRIWAYAT TINDAKAN:\n${log.join("\n").slice(-5000)}\nLANGKAH: ${step + 1}/${maxSteps}`
      );
      action = parseAction(raw);
    } catch (error) {
      log.push(`Model gagal: ${String(error).slice(0, 180)}`);
      break;
    }

    if (!action) {
      log.push("Format tindakan model tidak valid.");
      break;
    }

    if (action.tool === "finish") {
      summary = action.summary || "";
      options.onProgress?.({
        step: step + 1,
        maxSteps,
        tool: "finish",
        detail: summary.slice(0, 120),
        status: "done",
      });
      break;
    }

    const key = JSON.stringify(action);
    if (repeated.has(key)) {
      log.push("Tindakan yang sama berulang; dihentikan.");
      break;
    }
    repeated.add(key);

    options.onProgress?.({
      step: step + 1,
      maxSteps,
      tool: action.tool,
      detail: "path" in action ? action.path : "command" in action ? action.command : "query" in action ? action.query : "",
      status: "running",
    });

    let output = "";
    try {
      if (action.tool === "list_files") {
        output =
          entries
            .filter((f) => f.path.startsWith(action.prefix || ""))
            .slice(0, 100)
            .map((f) => f.path)
            .join("\n") || "Tidak ada file.";
      } else if (action.tool === "search_code") {
        const result = await searchProjectCode(action.query.slice(0, 200), root, 4);
        output =
          result.hits
            .map((hit) => `${hit.file}:${hit.startLine}\n${hit.snippet.slice(0, 900)}`)
            .join("\n\n") || "Tidak ada hasil.";
      } else if (action.tool === "read_file") {
        const target = await safePath(action.path);
        const content = await fs.readFile(target, "utf8");
        if (content.includes("\0")) throw new Error("Bukan file teks.");
        const lines = content.replace(/\r\n/g, "\n").split("\n");
        const start = Math.max(0, Math.min(lines.length - 1, Math.floor(action.startLine || 1) - 1));
        output = lines
          .slice(start, start + 90)
          .map((line, i) => `${start + i + 1}: ${line.slice(0, 300)}`)
          .join("\n");
      } else if (action.tool === "replace_text") {
        const target = await safePath(action.path);
        if (!action.oldText || action.oldText.length > 8000 || action.newText.length > 8000) {
          throw new Error("Potongan edit harus 1–8000 karakter.");
        }
        const before = await fs.readFile(target, "utf8");
        if (before.includes("\0")) throw new Error("Bukan file teks.");

        if (checkpointId) await backupFileBeforeEdit(projectId, checkpointId, action.path);
        const after = smartApplyPatch(before, action.oldText, action.newText);
        if (Buffer.byteLength(after) > MAX_FILE_BYTES) throw new Error("Hasil file terlalu besar.");

        const syntax = syntaxError(action.path, after);
        if (syntax) throw new Error(`Edit dibatalkan karena sintaks: ${syntax}`);

        const temp = path.join(path.dirname(target), `.vox-edit-${randomUUID()}.tmp`);
        try {
          await fs.writeFile(temp, after, { encoding: "utf8", flag: "wx", mode: (await fs.stat(target)).mode });
          await fs.rename(temp, target);
        } finally {
          await fs.rm(temp, { force: true }).catch(() => {});
        }
        invalidateCodeIndex(root);
        changed.add(action.path);
        output = `Berhasil mengubah ${action.path}. Disarankan jalankan run_command atau run_check.`;
      } else if (action.tool === "replace_lines") {
        const target = await safePath(action.path);
        const before = await fs.readFile(target, "utf8");
        if (before.includes("\0")) throw new Error("Bukan file teks.");

        if (checkpointId) await backupFileBeforeEdit(projectId, checkpointId, action.path);
        const after = smartReplaceLines(before, action.startLine, action.endLine, action.newText);
        if (Buffer.byteLength(after) > MAX_FILE_BYTES) throw new Error("Hasil file terlalu besar.");

        const syntax = syntaxError(action.path, after);
        if (syntax) throw new Error(`Edit baris dibatalkan karena sintaks: ${syntax}`);

        const temp = path.join(path.dirname(target), `.vox-edit-${randomUUID()}.tmp`);
        try {
          await fs.writeFile(temp, after, { encoding: "utf8", flag: "wx", mode: (await fs.stat(target)).mode });
          await fs.rename(temp, target);
        } finally {
          await fs.rm(temp, { force: true }).catch(() => {});
        }
        invalidateCodeIndex(root);
        changed.add(action.path);
        output = `Berhasil mengganti baris ${action.startLine}-${action.endLine} di ${action.path}.`;
      } else if (action.tool === "create_file") {
        const rel = action.path.replace(/\\/g, "/");
        if (
          !rel ||
          path.isAbsolute(rel) ||
          rel.split("/").some((part) => !part || part === ".." || part.startsWith(".")) ||
          !CODE_FILE.test(rel)
        ) {
          throw new Error("Path file baru tidak diizinkan.");
        }
        if (action.content.length > 12000 || !action.content.trim() || action.content.includes("\0")) {
          throw new Error("Isi file baru harus berupa teks 1–12000 karakter.");
        }
        const parent = await fs.realpath(path.dirname(path.join(root, rel)));
        if (parent !== root && !parent.startsWith(root + path.sep)) {
          throw new Error("Folder induk di luar project aktif.");
        }
        const target = path.join(parent, path.basename(rel));
        const syntax = syntaxError(rel, action.content);
        if (syntax) throw new Error(`File baru dibatalkan karena sintaks: ${syntax}`);
        if (checkpointId) await recordCreatedFile(projectId, checkpointId, rel);
        await fs.writeFile(target, action.content, { encoding: "utf8", flag: "wx" });
        files.add(rel);
        invalidateCodeIndex(root);
        changed.add(rel);
        output = `Berhasil membuat ${rel}. Disarankan jalankan run_check atau run_command.`;
      } else if (action.tool === "run_command") {
        const res = await executeTerminal({ command: action.command, projectId });
        output = `[Exit code: ${res.exitCode ?? (res.success ? 0 : 1)}]\n${res.stdout || ""}${res.stderr ? `\nSTDERR:\n${res.stderr}` : ""}`
          .trim()
          .slice(-3000);
        const checkLine = res.success
          ? `Lulus terminal: \`${action.command}\``
          : `Gagal terminal: \`${action.command}\` (exit code ${res.exitCode ?? 1})`;
        checks.push(checkLine);
      } else if (action.tool === "run_test") {
        if (!/\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx)$/i.test(action.path)) {
          throw new Error("run_test hanya untuk file tes.");
        }
        const target = await safePath(action.path);
        try {
          const permissionFlag = Number(process.versions.node.split(".")[0]) >= 22 ? "--permission" : "--experimental-permission";
          const run = await execFileAsync(
            process.execPath,
            [permissionFlag, `--allow-fs-read=${root}`, `--allow-fs-write=${root}`, target],
            {
              cwd: root,
              timeout: 30_000,
              maxBuffer: 32_000,
              env: { PATH: path.dirname(process.execPath), NODE_ENV: "test", CI: "1", HOME: root },
            }
          );
          output = `Lulus: terminal menjalankan ${action.path}.\n${run.stdout.slice(-1200)}`;
          checks.push(output);
        } catch (error) {
          throw new Error(`Tes ${action.path} gagal: ${String(error).slice(0, 1200)}`);
        }
      } else {
        output = await checkFile(action.path);
        checks.push(output);
      }
      options.onProgress?.({
        step: step + 1,
        maxSteps,
        tool: action.tool,
        detail: output.slice(0, 120),
        status: "done",
      });
    } catch (error) {
      output = `Gagal: ${(error as Error).message}`;
      options.onProgress?.({
        step: step + 1,
        maxSteps,
        tool: action.tool,
        detail: output.slice(0, 120),
        status: "error",
      });
    }
    log.push(`[${action.tool}${"path" in action ? ` ${action.path}` : "command" in action ? ` ${action.command}` : ""}] ${output.slice(0, 2800)}`);
  }

  const changedFiles = [...changed];
  // Verifikasi akhir setiap file yang diubah bila belum diperiksa
  for (const file of changedFiles) {
    for (let i = checks.length - 1; i >= 0; i--) if (checks[i].includes(file)) checks.splice(i, 1);
    try {
      const result = await checkFile(file);
      checks.push(result);
    } catch (error) {
      checks.push(`Gagal pemeriksaan akhir ${file}: ${(error as Error).message}`);
    }
  }

  const status = changedFiles.length
    ? `File diubah: ${changedFiles.map((file) => `\`${file}\``).join(", ")}.`
    : "Belum ada file yang diubah.";
  const checkStatus = checks.length ? checks.join("\n") : "Belum ada pemeriksaan yang berhasil dijalankan.";
  const issue = log
    .filter((item) => item.includes("Gagal:") || item.includes("tidak valid") || item.includes("berulang"))
    .slice(-2)
    .join("\n");

  const formattedReply = [
    summary ? `### 💡 Ringkasan Perbaikan\n${summary}\n` : "",
    `### 📁 Status File\n${status}\n`,
    `### 🛠️ Hasil Verifikasi & Pemeriksaan\n${checkStatus}`,
    issue ? `\n> ⚠️ **Catatan Penyesuaian:**\n${issue}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { reply: formattedReply, changedFiles, checks, log, checkpointId };
}
