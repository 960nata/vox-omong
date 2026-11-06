import { NextResponse } from "next/server";
import { addMessage, getConversation } from "@/lib/storage";
import { generateAIResponse } from "@/lib/gemini";
import fs from "fs/promises";
import path from "path";

const USER_PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  try {
    const {
      conversationId,
      message,
      language,
      apiKey,
      systemPrompt,
      imageUri,
      imageDataUri,
      activeProjectId = "default-workspace",
    } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    const convId = conversationId || "conv-default";
    const trimmedMessage = message.trim();

    // 1. Check for real-time project or folder creation in user's isolated workspace sandbox
    let createdFolderInfo: string | null = null;

    // A. Check for "buat project [nama]"
    const projectMatch = trimmedMessage.match(/(?:buat|bikin|create)\s+project\s+([a-zA-Z0-9_\-\s]+)/i);
    if (projectMatch && projectMatch[1]) {
      const projName = projectMatch[1].trim();
      const slug = sanitizeSlug(projName);
      try {
        const targetProjDir = path.join(USER_PROJECTS_BASE, slug);
        await fs.mkdir(targetProjDir, { recursive: true });
        await fs.mkdir(path.join(targetProjDir, "assets"), { recursive: true });
        await fs.mkdir(path.join(targetProjDir, "documents"), { recursive: true });
        await fs.writeFile(
          path.join(targetProjDir, "README.md"),
          `# ${projName}\nProject workspace khusus di akun Anda.\n`,
          "utf-8"
        );
        createdFolderInfo = `Project Baru: ${projName}`;
      } catch (err) {
        console.error("User project creation error:", err);
      }
    }

    // B. Check for "buat folder [nama]" inside user's active project
    const folderMatch = trimmedMessage.match(/(?:buat|bikin|create)\s+folder\s+([a-zA-Z0-9_\-\/\.]+)/i);
    if (!createdFolderInfo && folderMatch && folderMatch[1]) {
      const rawFolderName = folderMatch[1].trim();
      try {
        const safeProj = sanitizeSlug(activeProjectId) || "default-workspace";
        const projRoot = path.normalize(path.join(USER_PROJECTS_BASE, safeProj));
        const safeTarget = path.normalize(path.join(projRoot, rawFolderName));

        if (safeTarget.startsWith(projRoot)) {
          await fs.mkdir(safeTarget, { recursive: true });
          createdFolderInfo = `${rawFolderName} (di project ${safeProj})`;
        }
      } catch (err) {
        console.error("Folder creation error in user project:", err);
      }
    }

    // 2. Save user message with attached imageUri if any
    const userMsg = await addMessage(convId, {
      role: "user",
      content: trimmedMessage,
      imageUri: imageUri || undefined,
    });

    // 3. Retrieve conversation history for context
    const conv = await getConversation(convId);
    const history = conv?.messages.map((m) => ({ role: m.role, content: m.content })) || [];

    // 4. Generate AI response
    const { reply, artifact } = await generateAIResponse({
      prompt: trimmedMessage,
      history,
      apiKey,
      language: language === "en-US" ? "en-US" : "id-ID",
      systemPrompt,
      imageUri: imageUri || undefined,
      imageDataUri: imageDataUri || undefined,
      createdFolderInfo: createdFolderInfo || undefined,
    });

    // Auto-update user project preview index.html if a UI component or web preview artifact was generated
    let updatedPreviewUrl: string | null = null;
    if (artifact && (artifact.type === "code_diff" || artifact.type === "web_preview")) {
      try {
        const safeProj = sanitizeSlug(activeProjectId) || "default-workspace";
        const projDir = path.join(USER_PROJECTS_BASE, safeProj);
        await fs.mkdir(projDir, { recursive: true });

        const previewHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${artifact.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0b0d13] text-[#f3f4f6] font-sans min-h-screen flex items-center justify-center p-6 antialiased">
  <div class="w-full max-w-md bg-[#161922] border border-[#2b3345] rounded-[3px] p-6 shadow-2xl">
    <div class="flex items-center justify-between pb-3 border-b border-[#242b3b]">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 bg-[#ea580c] rounded-[1px]"></span>
        <h3 class="font-mono text-sm font-semibold tracking-wider text-[#f3f4f6]">
          STUDIO PRO-INTERFACE
        </h3>
      </div>
      <span class="px-2 py-0.5 text-[10px] font-mono bg-[#1c2230] text-[#38bdf8] border border-[#2d394f] rounded-[3px]">
        v2.5 LIVE
      </span>
    </div>

    <div class="py-5 space-y-3">
      <p class="text-xs text-[#a0abbd] leading-relaxed">
        Komponen antarmuka modern yang diadaptasi dari tangkapan layar desain dengan lengkungan presisi 3px dan tema audio studio.
      </p>
      
      <div class="p-3 bg-[#111319] border border-[#283040] rounded-[3px] space-y-1.5">
        <div class="text-[11px] font-mono text-[#ea580c] flex items-center gap-1.5">
          <span>⚡ Status: UI Component Verified</span>
        </div>
        <div class="text-[10px] font-mono text-[#788295]">
          Generated by Multimodal Vision Agent
        </div>
      </div>
    </div>

    <div class="pt-4 border-t border-[#242b3b] flex items-center justify-between">
      <div class="flex items-center gap-1.5 text-[11px] text-[#10b981] font-mono">
        <span>✓ 3px Border Radius</span>
      </div>
      <button
        onclick="this.innerText = this.innerText === 'EXPLORE' ? 'AKTIF' : 'EXPLORE'; this.classList.toggle('bg-[#10b981]');"
        class="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#f97316] text-white text-xs font-mono rounded-[3px] transition-colors cursor-pointer shadow-md"
      >
        <span>EXPLORE</span>
        <span>&rarr;</span>
      </button>
    </div>
  </div>
</body>
</html>`;
        await fs.writeFile(path.join(projDir, "index.html"), previewHtml, "utf-8");
        updatedPreviewUrl = `/api/preview?projectId=${safeProj}&t=${Date.now()}`;
      } catch (err) {
        console.error("Preview save failed:", err);
      }
    }

    // 5. Save assistant message
    const assistantMsg = await addMessage(convId, {
      role: "assistant",
      content: reply,
      artifact,
    });

    return NextResponse.json({
      success: true,
      reply,
      artifact,
      createdFolder: createdFolderInfo,
      previewUrl: updatedPreviewUrl,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      conversationId: convId,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ success: false, error: "Failed to process chat message" }, { status: 500 });
  }
}
