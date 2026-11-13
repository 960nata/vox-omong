import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

type Source = { path: string; content: string; lines: string[] };
type Chunk = { file: string; start: number; end: number; terms: Map<string, number>; length: number };
type SymbolRef = { name: string; file: string; line: number; kind: string };
type Index = { signature: string; sources: Map<string, Source>; chunks: Chunk[]; symbols: SymbolRef[]; importers: Map<string, string[]>; documentFrequency: Map<string, number>; averageLength: number };

const cache = new Map<string, Index>();
const pending = new Map<string, Promise<Index>>();
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".tools", "dist", "build", "coverage", "vendor", ".venv", "venv", "__pycache__", "documents", "assets"]);
const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|html|css|scss|vue|svelte|astro|md|ya?ml)$/i;
const STOP = new Set("yang untuk dari pada dalam dengan bisa mau gue gw coba tolong analisis analyze audit review periksa cek baca lihat scan file project proyek folder kode code lokal ini itu adalah dan atau the a an of to in on for how what where is are do does please me my your di ke dari nya cuy".split(" "));
const ALIASES: Record<string, string[]> = {
  folder: ["directory", "path"], proyek: ["project", "workspace"], project: ["workspace"],
  akses: ["access", "permission"], pilih: ["select", "picker"], cari: ["search", "find"],
  baca: ["read"], simpan: ["save", "write"], unggah: ["upload"], sambung: ["connect", "sync"],
  sinkron: ["sync"], biaya: ["cost", "token"], token: ["usage", "context"],
  browser: ["browser", "page"], tim: ["team", "member"], fungsi: ["function"],
};

function terms(text: string): string[] {
  const withBreaks = text.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
  const pieces = withBreaks.toLowerCase().match(/[a-z_$][a-z0-9_$]{1,}|[\p{L}]{3,}/gu) || [];
  const exact = text.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g)?.map((item) => item.toLowerCase()) || [];
  return [...pieces, ...exact];
}

function queryTerms(query: string): string[] {
  const base = [...new Set(terms(query).filter((term) => !STOP.has(term) && term.length <= 64))].slice(0, 18);
  return [...new Set([...base, ...base.flatMap((term) => ALIASES[term] || [])])].slice(0, 24);
}

function exactSymbolMatches(index: Index, query: string, limit: number): SymbolRef[] {
  const names = new Set((query.match(/[A-Za-z_$][A-Za-z0-9_$]{3,}/g) || []).map((name) => name.toLowerCase()).filter((name) => !STOP.has(name)));
  return index.symbols.filter((symbol) => names.has(symbol.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length).slice(0, limit);
}

function snippetStart(source: Source, chunk: Chunk, query: string, symbols: SymbolRef[]): number {
  const named = symbols.find((symbol) => symbol.file === chunk.file && symbol.line > chunk.start && symbol.line <= chunk.end);
  if (named) return Math.max(chunk.start, named.line - 3);
  const words = queryTerms(query).sort((a, b) => b.length - a.length);
  const hit = source.lines.findIndex((line, index) => index >= chunk.start && index < chunk.end && words.some((word) => line.toLowerCase().includes(word)));
  return hit < 0 ? chunk.start : Math.max(chunk.start, hit - 2);
}

async function inventory(root: string) {
  const found: { file: string; size: number; mtimeMs: number }[] = [];
  let totalBytes = 0;
  async function walk(dir: string, depth: number) {
    if (depth > 8 || found.length >= 600 || totalBytes >= 8_000_000) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= 600 || totalBytes >= 8_000_000) break;
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full, depth + 1);
      } else if (entry.isFile() && (SOURCE_EXT.test(entry.name) || entry.name === "package.json")) {
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || stat.size > 120_000 || totalBytes + stat.size > 8_000_000) continue;
        found.push({ file: path.relative(root, full), size: stat.size, mtimeMs: stat.mtimeMs });
        totalBytes += stat.size;
      }
    }
  }
  await walk(root, 0);
  return found;
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function extractSymbols(source: Source): { symbols: SymbolRef[]; imports: string[] } {
  const symbols: SymbolRef[] = [];
  const imports: string[] = [];
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/i.test(source.path)) {
    const tree = ts.createSourceFile(source.path, source.content, ts.ScriptTarget.Latest, true, scriptKind(source.path));
    const add = (name: string, pos: number, kind: string) => {
      if (name) symbols.push({ name, file: source.path, line: tree.getLineAndCharacterOfPosition(pos).line + 1, kind });
    };
    for (const node of tree.statements) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node.name.getStart(tree), "function");
      else if (ts.isClassDeclaration(node) && node.name) {
        add(node.name.text, node.name.getStart(tree), "class");
        for (const member of node.members) if (ts.isMethodDeclaration(member) && member.name) add(member.name.getText(tree), member.name.getStart(tree), "method");
      } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) add(node.name.text, node.name.getStart(tree), "type");
      else if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations) if (ts.isIdentifier(item.name)) add(item.name.text, item.name.getStart(tree), "variable");
    }
  } else if (/\.(?:py|go|rs|java|kt|swift)$/i.test(source.path)) {
    for (const [index, line] of source.lines.entries()) {
      const match = line.match(/^\s*(?:(?:export|public|private|static|async|pub)\s+)*(?:def|func|fn|class|interface|struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match) symbols.push({ name: match[1], file: source.path, line: index + 1, kind: "symbol" });
    }
  }
  return { symbols, imports };
}

function resolveImport(from: string, specifier: string, available: Set<string>): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  for (const candidate of [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].map((ext) => base + ext), ...["index.ts", "index.tsx", "index.js"].map((name) => `${base}/${name}`)]) {
    if (available.has(candidate)) return candidate;
  }
  return null;
}

async function build(root: string, files: Awaited<ReturnType<typeof inventory>>, signature: string): Promise<Index> {
  const sources = new Map<string, Source>();
  const chunks: Chunk[] = [];
  const symbols: SymbolRef[] = [];
  const rawImports = new Map<string, string[]>();
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;
  for (const item of files) {
    const content = await fs.readFile(path.join(root, item.file), "utf8").catch(() => "");
    if (!content || content.includes("\u0000")) continue;
    const source: Source = { path: item.file, content, lines: content.split("\n") };
    sources.set(item.file, source);
    const extracted = extractSymbols(source);
    symbols.push(...extracted.symbols);
    rawImports.set(item.file, extracted.imports);
    for (let start = 0; start < source.lines.length; start += 20) {
      const end = Math.min(start + 28, source.lines.length);
      const counts = new Map<string, number>();
      for (const term of terms(`${item.file} ${source.lines.slice(start, end).join(" ")}`)) counts.set(term, Math.min(8, (counts.get(term) || 0) + 1));
      const length = [...counts.values()].reduce((sum, count) => sum + count, 0);
      chunks.push({ file: item.file, start, end, terms: counts, length });
      totalLength += length;
      for (const term of counts.keys()) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  const available = new Set(sources.keys());
  const importers = new Map<string, string[]>();
  for (const [from, specs] of rawImports) for (const spec of specs) {
    const target = resolveImport(from, spec, available);
    if (target) importers.set(target, [...new Set([...(importers.get(target) || []), from])]);
  }
  return { signature, sources, chunks, symbols, importers, documentFrequency, averageLength: totalLength / Math.max(1, chunks.length) };
}

async function getIndex(projectDir: string): Promise<Index> {
  const root = await fs.realpath(projectDir);
  const appRoot = await fs.realpath(process.cwd());
  if (root !== appRoot && !root.startsWith(appRoot + path.sep)) throw new Error("Project di luar workspace aplikasi");
  const files = await inventory(root);
  const signature = files.map((item) => `${item.file}:${item.size}:${item.mtimeMs}`).join("|");
  const cached = cache.get(root);
  if (cached?.signature === signature) {
    cache.delete(root);
    cache.set(root, cached);
    return cached;
  }
  const running = pending.get(root);
  if (running) return running;
  const task = build(root, files, signature).then((index) => {
    cache.delete(root);
    cache.set(root, index);
    if (cache.size > 4) cache.delete(cache.keys().next().value!);
    return index;
  });
  pending.set(root, task);
  try { return await task; } finally { pending.delete(root); }
}

export async function searchLocalCode(query: string, projectDir: string): Promise<string> {
  const index = await getIndex(projectDir);
  const wanted = queryTerms(query);
  if (!wanted.length || !index.chunks.length) return "";
  const N = index.chunks.length;
  const ranked = index.chunks.map((chunk) => {
    let score = 0;
    for (const term of wanted) {
      const frequency = chunk.terms.get(term) || 0;
      if (!frequency) continue;
      const df = index.documentFrequency.get(term) || 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * chunk.length / Math.max(1, index.averageLength)));
      if (chunk.file.toLowerCase().includes(term)) score += 1.5;
    }
    return { chunk, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const exactSymbols = exactSymbolMatches(index, query, 3);
  const selected: Chunk[] = [];
  const seen = new Set<string>();
  for (const symbol of exactSymbols) {
    const chunk = index.chunks.find((item) => item.file === symbol.file && item.start <= symbol.line - 1 && item.end > symbol.line - 1);
    if (chunk && !seen.has(chunk.file)) { selected.push(chunk); seen.add(chunk.file); }
  }
  for (const item of ranked) {
    if (selected.length >= 4) break;
    if (!seen.has(item.chunk.file)) { selected.push(item.chunk); seen.add(item.chunk.file); }
  }
  const out = [`📦 Indeks kode: ${index.sources.size} file, ${index.symbols.length} simbol terdeteksi.`];
  for (const chunk of selected) {
    const source = index.sources.get(chunk.file)!;
    const start = snippetStart(source, chunk, query, exactSymbols);
    const lines = source.lines.slice(start, Math.min(chunk.end, start + 10)).map((line, offset) => `${start + offset + 1}: ${line.slice(0, 170)}`);
    const names = index.symbols.filter((symbol) => symbol.file === chunk.file && symbol.line >= chunk.start + 1 && symbol.line <= chunk.end).slice(0, 3).map((symbol) => `${symbol.kind} ${symbol.name} (baris ${symbol.line})`);
    const users = (index.importers.get(chunk.file) || []).slice(0, 3);
    out.push(`\n${chunk.file}:${start + 1}${names.length ? ` — ${names.join(", ")}` : ""}${users.length ? `\nDiimpor oleh: ${users.join(", ")}` : ""}\n${lines.join("\n")}`);
  }
  return out.join("\n").slice(0, 3200);
}

// ─── Structured JSON search result (for API & UI) ─────────────────────────────
export interface CodeSearchResult {
  stats: { files: number; symbols: number; chunks: number };
  hits: {
    file: string;
    startLine: number;
    endLine: number;
    score: number;
    symbols: { name: string; kind: string; line: number }[];
    importedBy: string[];
    snippet: string;
  }[];
}

export async function searchProjectCode(query: string, projectDir: string, maxHits = 8): Promise<CodeSearchResult> {
  const index = await getIndex(projectDir);
  const wanted = queryTerms(query);

  if (!wanted.length || !index.chunks.length) {
    return { stats: { files: index.sources.size, symbols: index.symbols.length, chunks: index.chunks.length }, hits: [] };
  }

  const N = index.chunks.length;
  const ranked = index.chunks
    .map((chunk) => {
      let score = 0;
      for (const term of wanted) {
        const frequency = chunk.terms.get(term) || 0;
        if (!frequency) continue;
        const df = index.documentFrequency.get(term) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * chunk.length / Math.max(1, index.averageLength)));
        if (chunk.file.toLowerCase().includes(term)) score += 1.5;
      }
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const exactSymbols = exactSymbolMatches(index, query, 4);
  const selected: { chunk: Chunk; score: number }[] = [];
  const seen = new Set<string>();

  for (const sym of exactSymbols) {
    const c = index.chunks.find((ch) => ch.file === sym.file && ch.start <= sym.line - 1 && ch.end > sym.line - 1);
    if (c && !seen.has(`${c.file}:${c.start}`)) {
      selected.push({ chunk: c, score: 999 });
      seen.add(`${c.file}:${c.start}`);
    }
  }
  for (const item of ranked) {
    if (selected.length >= maxHits) break;
    const key = `${item.chunk.file}:${item.chunk.start}`;
    if (!seen.has(key)) { selected.push(item); seen.add(key); }
  }

  const hits = selected.map(({ chunk, score }) => {
    const source = index.sources.get(chunk.file)!;
    const start = snippetStart(source, chunk, query, exactSymbols);
    const snippet = source.lines
      .slice(start, Math.min(chunk.end, start + 20))
      .map((line, offset) => `${start + offset + 1}: ${line.slice(0, 200)}`)
      .join("\n");
    const syms = index.symbols
      .filter((s) => s.file === chunk.file && s.line >= chunk.start + 1 && s.line <= chunk.end)
      .slice(0, 5)
      .map(({ name, kind, line }) => ({ name, kind, line }));
    const importedBy = (index.importers.get(chunk.file) || []).slice(0, 5);
    return { file: chunk.file, startLine: start + 1, endLine: Math.min(chunk.end, start + 20), score: Math.round(score * 100) / 100, symbols: syms, importedBy, snippet };
  });

  return { stats: { files: index.sources.size, symbols: index.symbols.length, chunks: index.chunks.length }, hits };
}

// Invalidate index cache when files change (called by file write endpoints)
export function invalidateCodeIndex(projectDir: string): void {
  const root = path.resolve(projectDir);
  cache.delete(root);
  pending.delete(root);
}
