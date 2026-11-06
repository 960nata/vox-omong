import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

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

  if (!target.startsWith(projectDir)) {
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
        const children = await scanProjectDir(fullPath, baseDir, depth + 1);
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

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} — User Workspace</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0f1117] text-[#f3f4f6] font-sans min-h-screen p-8">
  <div class="max-w-2xl mx-auto bg-[#181b24] border border-[#2b3345] rounded-[3px] p-6 shadow-2xl">
    <div class="flex items-center gap-2 mb-4 pb-3 border-b border-[#252c3c]">
      <span class="w-2.5 h-2.5 bg-[#ea580c] rounded-[1px]"></span>
      <h1 class="text-xl font-bold font-mono tracking-wide">${projectName}</h1>
    </div>
    <p class="text-sm text-[#9ca3af] leading-relaxed mb-4">
      Ruang kerja proyek pengguna yang terisolasi aman. Anda dapat menambahkan file HTML, CSS, JavaScript, atau dokumen invoice & laporan di sini.
    </p>
    <div class="bg-[#101218] p-3 rounded-[3px] border border-[#232938] text-xs font-mono text-[#38bdf8]">
      Status: Project Workspace Active & Ready
    </div>
  </div>
</body>
</html>`;

  const readmeContent = `# ${projectName}

Ruang kerja proyek akun khusus di VOX·AI Studio.
Dibuat pada: ${new Date().toLocaleDateString("id-ID")}

## Struktur Direktori
- \`index.html\`: Halaman antarmuka utama
- \`assets/\`: Direktori gambar & ikon
- \`documents/\`: Dokumen PDF, invoice, dan laporan
`;

  await fs.writeFile(path.join(projectDir, "index.html"), htmlContent, "utf-8");
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

    const { projectDir } = getSafeProjectPath(activeProject.id);

    // Make sure projectDir exists
    await fs.mkdir(projectDir, { recursive: true });

    // Read project file tree
    const tree = await scanProjectDir(projectDir, projectDir);

    return NextResponse.json({
      success: true,
      projects,
      activeProject: activeProject.id,
      projectName: activeProject.name,
      tree,
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
    if (action === "create_file") {
      if (!filePath || typeof filePath !== "string") {
        return NextResponse.json({ success: false, error: "Nama file diperlukan" }, { status: 400 });
      }

      const { target } = getSafeProjectPath(projectId, filePath.trim());
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");

      return NextResponse.json({
        success: true,
        message: `File "${filePath.trim()}" berhasil dibuat di dalam project ${projectId}!`,
        filePath: filePath.trim(),
        projectId,
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

      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${relPath}`,
      });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/fs error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
