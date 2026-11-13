import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");

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
    throw new Error("Akses di luar sandbox project dilarang");
  }
  return { projectDir, target, safeId };
}

// Ekstrak cuplikan teks untuk file teks/kode agar chatbot bisa langsung paham
const TEXT_EXTS = new Set([
  ".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx",
  ".html", ".css", ".scss", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".sh", ".yaml", ".yml", ".sql", ".csv"
]);

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // A. Handle JSON with base64 data URI (misal: paste gambar dari clipboard)
    if (contentType.includes("application/json")) {
      const { dataUri, filename = "upload.png", projectId = "default-workspace" } = await req.json();

      if (!dataUri || !dataUri.startsWith("data:image/")) {
        return NextResponse.json({ success: false, error: "Invalid image data URI" }, { status: 400 });
      }

      const match = dataUri.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ success: false, error: "Malformed base64 image" }, { status: 400 });
      }

      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const buffer = Buffer.from(match[2], "base64");
      const name = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;

      // Simpan di public/uploads untuk direct URL
      await fs.mkdir(PUBLIC_UPLOADS, { recursive: true });
      await fs.writeFile(path.join(PUBLIC_UPLOADS, name), buffer);

      // Simpan juga di folder project aktif user (.data/user_projects/<projectId>/assets/)
      const { projectDir } = getSafeProjectPath(projectId);
      const userAssetsDir = path.join(projectDir, "assets");
      await fs.mkdir(userAssetsDir, { recursive: true });
      await fs.writeFile(path.join(userAssetsDir, name), buffer);

      const publicUrl = `/uploads/${name}`;
      return NextResponse.json({
        success: true,
        type: "file",
        name: filename,
        filename: name,
        url: publicUrl,
        dataUri,
        size: buffer.length,
        projectId,
      });
    }

    // B. Handle multipart/form-data (File Tunggal, Banyak File, atau Seluruh Folder)
    const formData = await req.formData();
    const projectIdRaw = (formData.get("projectId") as string) || "default-workspace";
    const uploadType = (formData.get("uploadType") as string) || "file"; // "file" | "folder"
    const parseOnly = formData.get("parseOnly") === "true"; // mode baca lokal tanpa simpan ke project
    const saveToProject = formData.get("saveToProject") === "true";
    const pathsRaw = formData.get("paths") as string; // JSON array of relative paths for folder upload
    const customFolderName = formData.get("folderName") as string;

    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File;
    const fileList: File[] = files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (fileList.length === 0) {
      return NextResponse.json({ success: false, error: "Tidak ada file yang dipilih" }, { status: 400 });
    }

    // --- 0. JIKA MODE BACA LOKAL SAJA (PARSE ONLY — TIDAK DISIMPAN KE PROJECT) ---
    if (parseOnly) {
      const file = fileList[0];
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name).toLowerCase();
      let textSnippet = "";
      if (/\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name)) {
        try {
          const { fileToText } = await import("@/lib/fileText");
          textSnippet = await fileToText(file.name, buffer);
        } catch (e: any) {
          textSnippet = `Gagal mengekstrak teks dokumen: ${e.message}`;
        }
      } else {
        textSnippet = buffer.toString("utf-8");
      }
      return NextResponse.json({
        success: true,
        type: "file",
        name: file.name,
        size: buffer.length,
        textSnippet: textSnippet.slice(0, 15000),
        isLocalFile: true,
      });
    }

    const { projectDir, safeId } = getSafeProjectPath(projectIdRaw);
    await fs.mkdir(projectDir, { recursive: true });

    let relativePaths: string[] = [];
    if (pathsRaw) {
      try {
        relativePaths = JSON.parse(pathsRaw);
      } catch {
        relativePaths = [];
      }
    }

    // --- 1. JIKA UPLOAD SELURUH FOLDER ---
    if (uploadType === "folder" || relativePaths.length > 0) {
      if (fileList.length > 500) {
        return NextResponse.json({ success: false, error: "Folder terlalu besar (maksimal 500 file)." }, { status: 400 });
      }
      // Tentukan nama folder target
      const firstRelPath = relativePaths[0] || fileList[0].name;
      const rootFolderName = customFolderName || firstRelPath.split("/")[0] || `folder-${Date.now()}`;
      if (!/^[a-zA-Z0-9 _-]{1,100}$/.test(rootFolderName)) {
        return NextResponse.json({ success: false, error: "Nama folder tidak aman." }, { status: 400 });
      }

      let totalSize = 0;
      const savedFiles: { name: string; size: number; path: string }[] = [];
      let textSnippets = "";

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const rel = relativePaths[i] || file.name;
        // Pastikan path relatif aman di dalam projectDir
        const parts = rel.replace(/\\/g, "/").split("/");
        if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith(".") || ["node_modules", "dist", "build"].includes(part))) {
          return NextResponse.json({ success: false, error: `Path file tidak aman: ${file.name}` }, { status: 400 });
        }
        const cleanRel = parts.join("/");
        const filePath = path.resolve(projectDir, cleanRel);
        if (!filePath.startsWith(path.resolve(projectDir) + path.sep)) {
          return NextResponse.json({ success: false, error: "File harus berada di dalam project aktif." }, { status: 400 });
        }

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(filePath, buffer);

        totalSize += buffer.length;
        savedFiles.push({
          name: file.name,
          size: buffer.length,
          path: cleanRel,
        });

        // Ambil cuplikan teks dari file kode/teks utama / pptx / dokumen (maks 3 file pertama)
        const ext = path.extname(file.name).toLowerCase();
        if (TEXT_EXTS.has(ext) && textSnippets.length < 3000) {
          try {
            const txt = buffer.toString("utf-8");
            textSnippets += `\n--- [File: ${cleanRel}] ---\n${txt.slice(0, 800)}\n`;
          } catch {}
        } else if (/\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name) && textSnippets.length < 3000) {
          try {
            const { fileToText } = await import("@/lib/fileText");
            const extracted = await fileToText(file.name, buffer);
            textSnippets += `\n--- [Dokumen: ${cleanRel}] ---\n${extracted.slice(0, 800)}\n`;
          } catch {}
        }
      }

      return NextResponse.json({
        success: true,
        type: "folder",
        name: rootFolderName,
        relativePath: rootFolderName,
        projectId: safeId,
        itemCount: savedFiles.length,
        size: totalSize,
        files: savedFiles.slice(0, 50),
        textSnippet: textSnippets.trim(),
        message: `Folder "${rootFolderName}" (${savedFiles.length} file) berhasil disimpan di project ${safeId}`,
      });
    }

    // --- 2. JIKA UPLOAD FILE TUNGGAL / BANYAK FILE BIASA ---
    if (fileList.length === 1) {
      const file = fileList[0];
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(file.name).toLowerCase();
      const isImg = file.type.startsWith("image/");

      let publicUrl: string | undefined;
      let dataUri: string | undefined;

      // Buat nama file aman
      const safeFileName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
      let targetSubpath: string | undefined;

      if (isImg) {
        // Pas upload gambar: simpan di public/uploads untuk direct URL & preview
        const pubName = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
        await fs.mkdir(PUBLIC_UPLOADS, { recursive: true });
        await fs.writeFile(path.join(PUBLIC_UPLOADS, pubName), buffer);
        publicUrl = `/uploads/${pubName}`;
        dataUri = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;

        if (saveToProject) {
          const targetSubdir = "assets";
          targetSubpath = path.join(targetSubdir, safeFileName);
          const fullTargetPath = path.join(projectDir, targetSubpath);
          await fs.mkdir(path.dirname(fullTargetPath), { recursive: true });
          await fs.writeFile(fullTargetPath, buffer);
        }

        return NextResponse.json({
          success: true,
          type: "image",
          name: file.name,
          relativePath: targetSubpath,
          projectId: safeId,
          size: buffer.length,
          url: publicUrl,
          dataUri,
          message: `Gambar "${file.name}" siap di-scan AI`,
        });
      }

      // Simpan file langsung ke root projectDir atau relativeSubpath agar langsung terbaca di lokal
      targetSubpath = safeFileName;
      const fullTargetPath = path.join(projectDir, targetSubpath);
      await fs.mkdir(path.dirname(fullTargetPath), { recursive: true });
      await fs.writeFile(fullTargetPath, buffer);

      let textSnippet = "";
      if (TEXT_EXTS.has(ext)) {
        try {
          textSnippet = buffer.toString("utf-8").slice(0, 15000);
        } catch {}
      } else if (/\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name)) {
        try {
          const { fileToText } = await import("@/lib/fileText");
          const extracted = await fileToText(file.name, buffer);
          textSnippet = extracted.slice(0, 15000);
        } catch (e) {
          console.warn("Failed to extract text from document/pptx:", e);
        }
      }

      return NextResponse.json({
        success: true,
        type: "file",
        name: file.name,
        relativePath: targetSubpath,
        projectId: safeId,
        size: buffer.length,
        url: publicUrl,
        dataUri,
        textSnippet,
        isLocalFile: !saveToProject,
        message: saveToProject
          ? `File "${file.name}" berhasil disimpan di project ${safeId}`
          : `File "${file.name}" berhasil dibaca di lokal`,
      });
    }

    // Banyak file sekaligus
    let totalSize = 0;
    const savedFiles: { name: string; size: number; path: string }[] = [];
    const targetSubdir = "uploads";
    await fs.mkdir(path.join(projectDir, targetSubdir), { recursive: true });

    for (const file of fileList) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeName = file.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
      const rel = path.join(targetSubdir, safeName);
      await fs.writeFile(path.join(projectDir, rel), buffer);
      totalSize += buffer.length;
      savedFiles.push({ name: file.name, size: buffer.length, path: rel });
    }

    return NextResponse.json({
      success: true,
      type: "folder",
      name: `Kumpulan ${fileList.length} File`,
      relativePath: targetSubdir,
      projectId: safeId,
      itemCount: savedFiles.length,
      size: totalSize,
      files: savedFiles,
      message: `${savedFiles.length} file berhasil disimpan di project ${safeId}`,
    });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
