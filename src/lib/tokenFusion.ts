import { searchLocalCode } from "./localCodeSearch";

type Message = { role: string; content: string };

// Headroom's local proxy exposes POST /v1/compress. Never send prompts to a remote URL.
export async function compressWithHeadroom(messages: Message[], model: string): Promise<Message[]> {
  if (process.env.HEADROOM_ENABLED !== "true") return messages;
  const url = process.env.HEADROOM_URL || "http://127.0.0.1:8787";
  const target = new URL(url);
  if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname)) return messages;
  try {
    const response = await fetch(new URL("/v1/compress", target), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model, config: { compress_user_messages: true, protect_analysis_context: true } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return messages;
    const result = await response.json();
    if (!Array.isArray(result.messages) || result.messages.length !== messages.length) return messages;
    const compressed = result.messages as Message[];
    if (compressed.some((entry, index) => entry.role !== messages[index].role || typeof entry.content !== "string")) return messages;
    if (Number.isFinite(result.tokens_saved ?? result.tokensSaved)) {
      console.info("Headroom tokens saved:", result.tokens_saved ?? result.tokensSaved);
    }
    return compressed;
  } catch {
    return messages;
  }
}

// Repository search runs inside this app without Ollama or external binaries.
export async function localCodeContext(query: string, projectDir: string): Promise<string> {
  if (process.env.CODE_CONTEXT_FUSION === "false") return "";
  return searchLocalCode(query.slice(0, 500), projectDir).catch(() => "");
}
