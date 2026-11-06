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
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      conversationId: convId,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ success: false, error: "Failed to process chat message" }, { status: 500 });
  }
}
