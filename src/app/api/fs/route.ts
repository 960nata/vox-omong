import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();

// Helper to safely resolve path within project root
function getSafePath(relativePath: string = "") {
  const safe = path.normalize(path.join(ROOT_DIR, relativePath));
  if (!safe.startsWith(ROOT_DIR)) {
    throw new Error("Access outside project root is not permitted");
  }
  return safe;
}

const IGNORED_NAMES = new Set(["node_modules", ".git", ".next", ".cache", "dist"]);

interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

async function scanDirectory(dir: string, baseDir: string = "", depth: number = 0): Promise<FileNode[]> {
  if (depth > 4) return []; // prevent deep recursion

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT_DIR, fullPath);

      if (entry.isDirectory()) {
        const children = await scanDirectory(fullPath, relPath, depth + 1);
        nodes.push({
          name: entry.name,
          relativePath: relPath,
          isDirectory: true,
          children,
        });
      } else {
        const stats = await fs.stat(fullPath).catch(() => null);
        nodes.push({
          name: entry.name,
          relativePath: relPath,
          isDirectory: false,
          size: stats?.size || 0,
          updatedAt: stats?.mtime?.toISOString(),
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.error("Error reading directory:", err);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subpath = searchParams.get("path") || "";
    const targetDir = getSafePath(subpath);

    const tree = await scanDirectory(targetDir);

    return NextResponse.json({
      success: true,
      root: path.basename(ROOT_DIR),
      currentPath: subpath,
      tree,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, folderPath, filePath, content = "" } = await req.json();

    if (action === "create_folder") {
      if (!folderPath || typeof folderPath !== "string") {
        return NextResponse.json({ success: false, error: "Nama folder diperlukan" }, { status: 400 });
      }

      const target = getSafePath(folderPath.trim());
      await fs.mkdir(target, { recursive: true });

      return NextResponse.json({
        success: true,
        message: `Folder "${folderPath.trim()}" berhasil dibuat!`,
        folderPath: folderPath.trim(),
      });
    }

    if (action === "create_file") {
      if (!filePath || typeof filePath !== "string") {
        return NextResponse.json({ success: false, error: "Nama file diperlukan" }, { status: 400 });
      }

      const target = getSafePath(filePath.trim());
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");

      return NextResponse.json({
        success: true,
        message: `File "${filePath.trim()}" berhasil dibuat!`,
        filePath: filePath.trim(),
      });
    }

    if (action === "delete") {
      const targetPath = folderPath || filePath;
      if (!targetPath) {
        return NextResponse.json({ success: false, error: "Path diperlukan" }, { status: 400 });
      }

      const target = getSafePath(targetPath);
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        await fs.rm(target, { recursive: true, force: true });
      } else {
        await fs.unlink(target);
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${targetPath}`,
      });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/fs error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
