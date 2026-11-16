import fs from "fs/promises";
import path from "path";
import { Conversation, Message } from "./types";
import { nextState, stateOf } from "./conversationState";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "conversations.json");
const DB_BAK = path.join(DATA_DIR, "conversations.json.bak");

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

// Antrean Mutex in-memory untuk mencegah race conditions saat banyak request masuk bersamaan
let dbQueue: Promise<unknown> = Promise.resolve();

function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbQueue.then(fn, fn);
  dbQueue = next.catch(() => {});
  return next as Promise<T>;
}

async function ensureDb(): Promise<DatabaseSchema> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  // 1. Coba baca file utama
  try {
    const content = await fs.readFile(DB_FILE, "utf-8");
    if (content.trim().length > 0) {
      const parsed = JSON.parse(content) as DatabaseSchema;
      if (Array.isArray(parsed?.conversations)) {
        return parsed;
      }
    }
  } catch (err: any) {
    console.warn("[storage] Warning: Gagal membaca/parse conversations.json:", err?.message);
  }

  // 2. Jika file utama rusak/kosong, coba pulihkan dari cadangan otomatis (.bak)
  try {
    const bakContent = await fs.readFile(DB_BAK, "utf-8");
    if (bakContent.trim().length > 0) {
      const parsedBak = JSON.parse(bakContent) as DatabaseSchema;
      if (Array.isArray(parsedBak?.conversations)) {
        console.warn("[storage] Berhasil memulihkan conversations.json dari backup .bak lokal!");
        await writeDbRaw(parsedBak);
        return parsedBak;
      }
    }
  } catch {
    // Tidak ada file backup atau backup juga kosong
  }

  // 3. Jika file utama ada isinya tapi corrupt, amankan salinan sebelum di-reset
  try {
    const stat = await fs.stat(DB_FILE);
    if (stat.size > 0) {
      const corruptFile = path.join(DATA_DIR, `conversations.corrupted.${Date.now()}.json`);
      await fs.copyFile(DB_FILE, corruptFile);
      console.error(`[storage] File rusak disimpan ke ${corruptFile} untuk inspeksi forensik.`);
    }
  } catch {
    // File memang belum pernah dibuat sebelumnya (fresh setup)
  }

  const initialData: DatabaseSchema = {
    conversations: [DEFAULT_WELCOME],
  };
  await writeDbRaw(initialData);
  return initialData;
}

/** Tulis ke disk secara atomic (.tmp -> rename) dan perbarui backup */
async function writeDbRaw(data: DatabaseSchema): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = path.join(
    DATA_DIR,
    `conversations.json.${process.pid}.${Date.now()}-${Math.random().toString(36).substring(2, 7)}.tmp`
  );

  const serialized = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpFile, serialized, "utf-8");

  // Jika file utama saat ini valid dan ada isi, simpan snapshot ke .bak
  try {
    const current = await fs.readFile(DB_FILE, "utf-8");
    if (current.trim().length > 0) {
      await fs.writeFile(DB_BAK, current, "utf-8");
    }
  } catch {
    // Belum ada DB_FILE sebelumnya
  }

  // Atomic rename (POSIX atomic guarantee)
  await fs.rename(tmpFile, DB_FILE);
}

export async function getConversations(): Promise<Conversation[]> {
  return withDbLock(async () => {
    const db = await ensureDb();
    return db.conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return withDbLock(async () => {
    const db = await ensureDb();
    return db.conversations.find((c) => c.id === id) || null;
  });
}

export async function createConversation(title?: string, empty?: boolean): Promise<Conversation> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id,
      title: title || "Percakapan Baru",
      createdAt: now,
      updatedAt: now,
      messages: empty
        ? []
        : [
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
    await writeDbRaw(db);
    return newConv;
  });
}

export async function deleteConversation(id: string): Promise<boolean> {
  return withDbLock(async () => {
    const db = await ensureDb();
    const initialLen = db.conversations.length;
    db.conversations = db.conversations.filter((c) => c.id !== id);
    if (db.conversations.length === 0) {
      db.conversations.push(DEFAULT_WELCOME);
    }
    await writeDbRaw(db);
    return db.conversations.length !== initialLen;
  });
}

export async function addMessage(
  conversationId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    artifact?: any;
    artifacts?: any[];
    imageUri?: string;
    attachedItem?: any;
    teamPicker?: Message["teamPicker"];
  }
): Promise<Message> {
  return withDbLock(async () => {
    const db = await ensureDb();
    let conv = db.conversations.find((c) => c.id === conversationId);

    const now = new Date().toISOString();

    // Sesi belum ada: buat di snapshot `db` yang sama (dengan id dari klien) agar tidak tertimpa saat writeDb
    if (!conv) {
      conv = {
        id: conversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: "Percakapan Baru",
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      db.conversations.unshift(conv);
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      conversationId: conv.id,
      role: message.role,
      content: message.content,
      timestamp: now,
      artifact: message.artifact,
      ...(message.artifacts?.length ? { artifacts: message.artifacts } : {}),
      imageUri: message.imageUri,
      attachedItem: message.attachedItem,
      ...(message.teamPicker ? { teamPicker: message.teamPicker } : {}),
    };

    // State disimpan di tulisan yang sama dengan pesan asisten: tidak ada jeda di mana pesan dan state tidak cocok
    if (message.role === "assistant") conv.state = nextState(stateOf(conv), message.artifact, newMessage.id, now);
    conv.messages.push(newMessage);
    conv.updatedAt = now;

    // Auto-generate title from first user query if still default
    if (message.role === "user" && (conv.title === "Percakapan Baru" || conv.title === "Sesi Perdana Voice AI")) {
      conv.title = message.content.slice(0, 36) + (message.content.length > 36 ? "..." : "");
    }

    await writeDbRaw(db);
    return newMessage;
  });
}
