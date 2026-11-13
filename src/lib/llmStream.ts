/** Consume an OpenAI-compatible response; tolerate gateways that return normal JSON. */
export async function readOpenAICompletion(
  response: Response,
  onText?: (chunk: string) => void
): Promise<{ text: string; model: string; promptTokens?: number; completionTokens?: number }> {
  if (!onText || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await response.json();
    return {
      text: typeof data?.choices?.[0]?.message?.content === "string" ? data.choices[0].message.content : "",
      model: data?.model || "",
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
    };
  }
  if (!response.body) throw new Error("Stream AI tidak tersedia.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let model = "";
  let ended = false;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  const event = (block: string) => {
    const raw = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!raw) return;
    if (raw.trim() === "[DONE]") { ended = true; return; }
    const data = JSON.parse(raw);
    if (data.error) throw new Error("Provider menghentikan stream AI.");
    if (typeof data.model === "string") model = data.model;
    if (data.usage) {
      promptTokens = data.usage.prompt_tokens;
      completionTokens = data.usage.completion_tokens;
    }
    const delta = data.choices?.[0]?.delta?.content;
    const chunk = typeof delta === "string" ? delta : Array.isArray(delta) ? delta.map(part => typeof part?.text === "string" ? part.text : "").join("") : "";
    if (chunk) { text += chunk; onText(chunk); }
  };
  try {
    while (!ended) {
      const item = await reader.read();
      buffer += item.done ? decoder.decode() : decoder.decode(item.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        event(block);
        if (ended) break;
      }
      if (buffer.length > 256_000) throw new Error("Event stream AI terlalu besar.");
      if (item.done) { if (buffer.trim()) event(buffer); break; }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return {
    text,
    model,
    promptTokens: promptTokens || Math.max(1, Math.round(buffer.length / 4)),
    completionTokens: completionTokens || Math.max(1, Math.round(text.length / 4)),
  };
}
