import fs from "fs/promises";
import path from "path";
import { Conversation, Message } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "conversations.json");

interface DatabaseSchema {
  conversations: Conversation[];
}

const DEFAULT_WELCOME: Conversation = {
  id: "conv-default",
  title: "Sesi Perdana Voice AI",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [
    {
      id: "msg-welcome",
      conversationId: "conv-default",
      role: "assistant",
      content:
        "Halo! Saya asisten Voice AI kamu. Tekan tombol mikrofon di bawah atau tahan untuk mulai berbicara. Kamu bisa bertanya apa saja dalam Bahasa Indonesia atau Inggris!",
      timestamp: new Date().toISOString(),
    },
  ],
};

async function ensureDb(): Promise<DatabaseSchema> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const content = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(content) as DatabaseSchema;
  } catch {
    const initialData: DatabaseSchema = {
      conversations: [DEFAULT_WELCOME],
    };
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write initial db file:", err);
    }
    return initialData;
  }
}

async function writeDb(data: DatabaseSchema): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function getConversations(): Promise<Conversation[]> {
  const db = await ensureDb();
  return db.conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await ensureDb();
  return db.conversations.find((c) => c.id === id) || null;
}

export async function createConversation(title?: string): Promise<Conversation> {
  const db = await ensureDb();
  const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newConv: Conversation = {
    id,
    title: title || "Percakapan Baru",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `msg-${Date.now()}`,
        conversationId: id,
        role: "assistant",
        content: "Halo! Saya siap mendengar. Ada yang bisa saya bantu hari ini?",
        timestamp: now,
      },
    ],
  };

  db.conversations.unshift(newConv);
  await writeDb(db);
  return newConv;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const db = await ensureDb();
  const initialLen = db.conversations.length;
  db.conversations = db.conversations.filter((c) => c.id !== id);
  if (db.conversations.length === 0) {
    db.conversations.push(DEFAULT_WELCOME);
  }
  await writeDb(db);
  return db.conversations.length !== initialLen;
}

export async function addMessage(
  conversationId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    artifact?: any;
    imageUri?: string;
  }
): Promise<Message> {
  const db = await ensureDb();
  let conv = db.conversations.find((c) => c.id === conversationId);

  if (!conv) {
    conv = await createConversation();
  }

  const now = new Date().toISOString();
  const newMessage: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    conversationId: conv.id,
    role: message.role,
    content: message.content,
    timestamp: now,
    artifact: message.artifact,
    imageUri: message.imageUri,
  };

  conv.messages.push(newMessage);
  conv.updatedAt = now;

  // Auto-generate title from first user query if still default
  if (message.role === "user" && (conv.title === "Percakapan Baru" || conv.title === "Sesi Perdana Voice AI")) {
    conv.title = message.content.slice(0, 36) + (message.content.length > 36 ? "..." : "");
  }

  await writeDb(db);
  return newMessage;
}
