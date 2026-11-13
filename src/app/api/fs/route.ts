import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { invalidateCodeIndex } from "@/lib/localCodeSearch";

// Isolated User Projects Sandbox Directory
// User workspaces are stored STRICTLY inside .data/user_projects/
// The Next.js source code (src/, package.json, node_modules/, etc.) is 100% PROTECTED.
const PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getSafeProjectPath(projectId: string, relativeSubpath: string = "") {
  const safeId = sanitizeSlug(projectId) || "default-workspace";
  const projectDir = path.normalize(path.join(PROJECTS_BASE, safeId));
  const target = path.normalize(path.join(projectDir, relativeSubpath));

  const relative = path.relative(projectDir, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Access outside user project workspace is strictly prohibited");
  }
  return { projectDir, target, safeId };
}

interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

async function scanProjectDir(dir: string, baseDir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // ignore hidden files

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // folder besar hasil install: tampilkan sebagai folder kosong, jangan ditelusuri
        const heavy = ["node_modules", "dist", "build", "vendor", "__pycache__"].includes(entry.name);
        const children = heavy ? [] : await scanProjectDir(fullPath, baseDir, depth + 1);
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
    console.error("Error reading project directory:", err);
    return [];
  }
}

// Seed starter files when a new user project is created
async function seedStarterFiles(projectDir: string, projectName: string) {
  await fs.mkdir(projectDir, { recursive: true });
  await fs.mkdir(path.join(projectDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "documents"), { recursive: true });

  const readmeContent = `# ${projectName}

Ruang kerja proyek akun khusus di VOX·AI Studio.
Dibuat pada: ${new Date().toLocaleDateString("id-ID")}

## Struktur Direktori
- \`index.html\`: Halaman antarmuka utama
- \`assets/\`: Direktori gambar & ikon
- \`documents/\`: Dokumen PDF, invoice, dan laporan
`;

  await fs.writeFile(path.join(projectDir, "README.md"), readmeContent, "utf-8");
}

export async function GET(req: Request) {
  try {
    await fs.mkdir(PROJECTS_BASE, { recursive: true });

    const { searchParams } = new URL(req.url);
    const requestedProject = searchParams.get("projectId") || "default-workspace";

    // 1. List all available projects in user sandbox
    const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true });
    let projects = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        id: e.name,
        name: e.name.replace(/-/g, " ").toUpperCase(),
      }));

    // If no projects exist, initialize default project
    if (projects.length === 0) {
      const defaultDir = path.join(PROJECTS_BASE, "default-workspace");
      await seedStarterFiles(defaultDir, "Default Workspace");
      projects = [{ id: "default-workspace", name: "DEFAULT WORKSPACE" }];
    }

    // Determine active project
    const activeProject =
      projects.find((p) => p.id === requestedProject) || projects[0];

    // Jika parameter filePath diberikan, baca isi file tersebut
    const filePath = searchParams.get("filePath");
    if (filePath) {
      try {
        const { target, safeId } = getSafeProjectPath(activeProject.id, filePath);
        const stat = await fs.stat(target);
        if (stat.isDirectory()) {
          return NextResponse.json({ success: false, error: "Path adalah folder, bukan file" }, { status: 400 });
        }
        const ext = path.extname(filePath).toLowerCase();
        const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".tar", ".gz", ".mp3", ".mp4", ".woff", ".woff2", ".ttf"].includes(ext);
        if (!isBinary && stat.size < 2_000_000) {
          const content = await fs.readFile(target, "utf-8");
          return NextResponse.json({
            success: true,
            projectId: safeId,
            filePath,
            name: path.basename(filePath),
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            content,
            isBinary: false,
          });
        } else {
          return NextResponse.json({
            success: true,
            projectId: safeId,
            filePath,
            name: path.basename(filePath),
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            isBinary: true,
          });
        }
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Gagal membaca file: ${err.message}` }, { status: 404 });
      }
    }

    const { projectDir } = getSafeProjectPath(activeProject.id);

    // Make sure projectDir exists
    await fs.mkdir(projectDir, { recursive: true });

    // Read project file tree
    const tree = await scanProjectDir(projectDir, projectDir);

    // Also flatten files into a flat array for 1-click file pickers
    const flatFiles: { path: string; size: number }[] = [];
    function extractFiles(nodes: FileNode[]) {
      for (const node of nodes) {
        if (!node.isDirectory) {
          flatFiles.push({ path: node.relativePath, size: node.size || 0 });
        } else if (node.children) {
          extractFiles(node.children);
        }
      }
    }
    extractFiles(tree);

    // Jika parameter readFolder=true, rangkum seluruh folder beserta cuplikan file utama
    const readFolder = searchParams.get("readFolder") === "true";
    if (readFolder) {
      let indexHtmlSnippet = "";
      let packageJsonSnippet = "";
      let readmeSnippet = "";

      try {
        const pJson = await fs.readFile(path.join(projectDir, "package.json"), "utf-8");
        packageJsonSnippet = pJson.slice(0, 1000);
      } catch (_) {}

      try {
        const readme = await fs.readFile(path.join(projectDir, "README.md"), "utf-8");
        readmeSnippet = readme.slice(0, 1000);
      } catch (_) {}

      try {
        const html = await fs.readFile(path.join(projectDir, "index.html"), "utf-8");
        indexHtmlSnippet = html.slice(0, 4000);
      } catch (_) {}

      let totalSize = 0;
      flatFiles.forEach((f) => {
        totalSize += f.size;
      });

      const summary =
        `Folder: ${activeProject.id} (${flatFiles.length} file, ${totalSize} bytes)\n` +
        `Daftar File:\n${flatFiles.map((f) => `- ${f.path} (${f.size} B)`).join("\n")}\n\n` +
        (packageJsonSnippet ? `[package.json]\n${packageJsonSnippet}\n\n` : "") +
        (readmeSnippet ? `[README.md]\n${readmeSnippet}\n\n` : "") +
        (indexHtmlSnippet ? `[index.html preview]\n${indexHtmlSnippet}\n` : "");

      return NextResponse.json({
        success: true,
        projectId: activeProject.id,
        projectName: activeProject.name,
        itemCount: flatFiles.length,
        size: totalSize,
        files: flatFiles,
        tree,
        textSnippet: summary,
      });
    }

    return NextResponse.json({
      success: true,
      projects,
      activeProject: activeProject.id,
      projectName: activeProject.name,
      tree,
      files: flatFiles,
    });
  } catch (error: any) {
    console.error("GET /api/fs error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await fs.mkdir(PROJECTS_BASE, { recursive: true });

    const body = await req.json();
    const { action, projectId = "default-workspace", projectName, folderPath, filePath, content = "" } = body;

    // --- A. CREATE NEW USER PROJECT ---
    if (action === "create_project") {
      const rawName = projectName || folderPath;
      if (!rawName || typeof rawName !== "string") {
        return NextResponse.json({ success: false, error: "Nama proyek diperlukan" }, { status: 400 });
      }

      const slug = sanitizeSlug(rawName);
      if (!slug) {
        return NextResponse.json({ success: false, error: "Nama proyek tidak valid" }, { status: 400 });
      }

      const projectDir = path.join(PROJECTS_BASE, slug);
      await seedStarterFiles(projectDir, rawName);

      return NextResponse.json({
        success: true,
        message: `Project khusus "${rawName}" berhasil dibuat di akun Anda!`,
        projectId: slug,
        projectName: rawName,
      });
    }

    // --- B. DELETE ENTIRE USER PROJECT ---
    if (action === "delete_project") {
      const { projectDir, safeId } = getSafeProjectPath(projectId);
      if (safeId === "default-workspace") {
        return NextResponse.json({ success: false, error: "Default workspace tidak dapat dihapus" }, { status: 400 });
      }

      await fs.rm(projectDir, { recursive: true, force: true });
      return NextResponse.json({
        success: true,
        message: `Proyek "${safeId}" berhasil dihapus.`,
      });
    }

    // --- C. CREATE SUBFOLDER INSIDE USER PROJECT ---
    if (action === "create_folder") {
      if (!folderPath || typeof folderPath !== "string") {
        return NextResponse.json({ success: false, error: "Nama folder diperlukan" }, { status: 400 });
      }

      const { target } = getSafeProjectPath(projectId, folderPath.trim());
      await fs.mkdir(target, { recursive: true });

      return NextResponse.json({
        success: true,
        message: `Folder "${folderPath.trim()}" berhasil dibuat di dalam project ${projectId}!`,
        folderPath: folderPath.trim(),
        projectId,
      });
    }

    // --- D. CREATE FILE INSIDE USER PROJECT ---
    if (action === "create_file" || action === "save_file" || action === "write_file") {
      if (!filePath || typeof filePath !== "string") {
        return NextResponse.json({ success: false, error: "Nama file diperlukan" }, { status: 400 });
      }

      const { target, safeId, projectDir } = getSafeProjectPath(projectId, filePath.trim());
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");
      invalidateCodeIndex(projectDir);

      return NextResponse.json({
        success: true,
        message: `File "${filePath.trim()}" berhasil disimpan di dalam project ${safeId}!`,
        filePath: filePath.trim(),
        projectId: safeId,
      });
    }

    // --- E. DELETE FILE OR SUBFOLDER INSIDE USER PROJECT ---
    if (action === "delete") {
      const relPath = folderPath || filePath;
      if (!relPath) {
        return NextResponse.json({ success: false, error: "Path file/folder diperlukan" }, { status: 400 });
      }

      const { target, projectDir } = getSafeProjectPath(projectId, relPath);
      if (target === projectDir) {
        return NextResponse.json({ success: false, error: "Tidak dapat menghapus root project" }, { status: 400 });
      }

      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        await fs.rm(target, { recursive: true, force: true });
      } else {
        await fs.unlink(target);
      }
      invalidateCodeIndex(projectDir);

      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${relPath}`,
      });
    }

    // --- F. OPEN PROJECT FOLDER IN OS FILE MANAGER (FINDER / EXPLORER) ---
    if (action === "open_finder" || action === "open_in_os" || action === "open_folder") {
      const relPath = folderPath || filePath || "";
      const { target } = getSafeProjectPath(projectId, relPath);
      try {
        const { exec } = await import("child_process");
        const cmd = process.platform === "darwin" ? `open "${target}"` : process.platform === "win32" ? `start "" "${target}"` : `xdg-open "${target}"`;
        exec(cmd);
        return NextResponse.json({
          success: true,
          message: `Folder project berhasil dibuka di Finder Mac!`,
          target,
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Gagal membuka folder di sistem: ${err.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/fs error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
