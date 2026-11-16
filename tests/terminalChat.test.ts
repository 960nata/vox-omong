import { describe, it, expect } from "vitest";
import { isBareCommand, handleTerminalMessage } from "../src/lib/terminalRuntime";

describe("perintah terminal dari chat", () => {
  it.each(["npm install", "npm run dev", "pip install flask", "git status", "python3 app.py", "node server.js", "python -m http.server"])(
    "mengenali %s",
    (m) => expect(isBareCommand(m)).toBe(true),
  );

  it.each([
    "make a landing page for my coffee shop",
    "go ahead",
    "find me a good name",
    "cat itu hewan apa",
    "echo chamber itu apa",
    "head of marketing butuh slide",
    "python itu bahasa apa",
    "node itu apa?",
    "git itu apa?",
    "Make it shorter",
  ])("tidak menjalankan kalimat biasa: %s", async (m) => {
    expect(isBareCommand(m)).toBe(false);
    expect(await handleTerminalMessage({ message: m })).toBeNull();
  });
});
