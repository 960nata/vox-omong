import { NextResponse } from "next/server";
import { addMessage, getConversation } from "@/lib/storage";
import { generateAIResponse } from "@/lib/gemini";
import fs from "fs/promises";
import path from "path";

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
    } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    const convId = conversationId || "conv-default";
    const trimmedMessage = message.trim();

    // 1. Check for real-time folder creation command in project:
    // e.g. "buat folder [nama]" or "bikin folder [nama]" or "create folder [nama]"
    let createdFolderInfo: string | null = null;
    const folderMatch = trimmedMessage.match(/(?:buat|bikin|create)\s+folder\s+([a-zA-Z0-9_\-\/\.]+)/i);
    if (folderMatch && folderMatch[1]) {
      const rawFolderName = folderMatch[1].trim();
      try {
        const root = process.cwd();
        const safeTarget = path.normalize(path.join(root, rawFolderName));
        if (safeTarget.startsWith(root)) {
          await fs.mkdir(safeTarget, { recursive: true });
          createdFolderInfo = rawFolderName;
        }
      } catch (err) {
        console.error("Folder creation error:", err);
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

    // 4. Generate AI response (incorporating multimodal image & folder intent)
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
