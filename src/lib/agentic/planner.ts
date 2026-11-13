import { callLLM } from "../codeAgent";
import { parseLoose } from "../jsonLoose";
import type { AutonomousPlan, SubGoal } from "./types";
import { formatAgentMemoryContext } from "./semanticMemory";

const SYSTEM_PLANNER = `Kamu adalah Autonomous AI Planner untuk asisten eksekutif bernama Vox Omong.
Tugasmu:
1. Menganalisis instruksi pengguna.
2. Menentukan apakah instruksi ini adalah obrolan santai atau "Goal/Tugas Nyata" yang butuh eksekusi mandiri.
3. Jika merupakan Goal, pecah menjadi langkah-langkah terstruktur (Sub-Goals) dengan ketergantungan (DAG / dependsOn).

Pilihan suggestedTool:
- "file_list" | "file_read" | "file_write" | "file_search" (Manajemen file project)
- "terminal_exec" (Jalankan perintah npm, node, git, test, build di project)
- "web_search" (Riset web via DuckDuckGo)
- "browser_fetch" (Buka dan baca URL spesifik via browser Playwright)
- "create_artifact" (Buat slide, doc, sheet, invoice, atau video)
- "visual_critic" (Periksa tampilan web/UI dan perbaiki otomatis)
- "general_reasoning" (Berpikir, menganalisis, merangkum, atau membalas)

Format balasan HARUS JSON murni:
{
  "isAutonomousGoal": true/false,
  "goalSummary": "Ringkasan tujuan dalam 1 kalimat",
  "complexity": "simple" | "multi_step" | "complex",
  "steps": [
    {
      "id": "step_1",
      "title": "Judul langkah pendek",
      "description": "Instruksi detail apa yang harus dicapai",
      "suggestedTool": "nama_tool",
      "input": { "arg": "value" },
      "dependsOn": []
    }
  ]
}

Aturan:
- Jangan membuat langkah berlebihan (maksimal 6 langkah).
- Jika user cuma bertanya santai ("halo", "siapa kamu", "apa kabar"), set isAutonomousGoal: false dan steps: [].
- Beri dependsOn yang benar agar langkah berurutan berjalan dengan bahan dari langkah sebelumnya.`;

export async function planAutonomousTask(
  message: string,
  opts: {
    history?: { role: string; content: string }[];
    projectId?: string;
    apiKey?: string;
  } = {}
): Promise<AutonomousPlan> {
  const trimmed = message.trim();

  // Quick fallback for very short greeting
  if (/^(halo|hai|hi|hey|tes|test|p|pagi|siang|malam)\b/i.test(trimmed) && trimmed.split(/\s+/).length <= 3) {
    return {
      isAutonomousGoal: false,
      goalSummary: "Sapaan santai pengguna",
      complexity: "simple",
      steps: [],
    };
  }

  try {
    const memoryContext = await formatAgentMemoryContext(trimmed, opts.apiKey);
    const prompt = [
      memoryContext ? `Konteks Memori Relevan:\n${memoryContext}\n` : "",
      `Instruksi Pengguna: "${trimmed}"`,
      opts.projectId ? `Project Aktif: "${opts.projectId}"` : "",
    ].filter(Boolean).join("\n\n");

    const res = await callLLM({
      system: SYSTEM_PLANNER,
      prompt,
      json: true,
      maxTokens: 400,
      temperature: 0.1,
      fast: true,
      apiKey: opts.apiKey,
      prefer: ["gemini", "groq", "deepseek"],
    });

    const parsed = parseLoose<Partial<AutonomousPlan>>(res.text);

    if (parsed && typeof parsed.isAutonomousGoal === "boolean") {
      const steps: SubGoal[] = Array.isArray(parsed.steps)
        ? parsed.steps.map((s, idx) => ({
            id: s.id || `step_${idx + 1}`,
            title: s.title || `Langkah ${idx + 1}`,
            description: s.description || "",
            suggestedTool: s.suggestedTool || "general_reasoning",
            input: s.input || {},
            dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn : [],
            status: "pending",
          }))
        : [];

      return {
        isAutonomousGoal: parsed.isAutonomousGoal,
        goalSummary: parsed.goalSummary || trimmed.slice(0, 100),
        complexity: parsed.complexity || (steps.length > 3 ? "multi_step" : "simple"),
        steps,
      };
    }
  } catch (err) {
    console.error("[Planner] LLM planner failed, falling back to heuristic:", err);
  }

  // Heuristic Fallback Planner
  const isGoal = trimmed.length > 15 && /\b(buat|bikin|riset|cek|jalankan|analisis|perbaiki|cari|teliti|scraping)\b/i.test(trimmed);
  return {
    isAutonomousGoal: isGoal,
    goalSummary: trimmed.slice(0, 80),
    complexity: isGoal ? "simple" : "simple",
    steps: isGoal
      ? [
          {
            id: "step_1",
            title: "Eksekusi Tugas Utama",
            description: trimmed,
            suggestedTool: "general_reasoning",
            input: { query: trimmed },
            dependsOn: [],
            status: "pending",
          },
        ]
      : [],
  };
}
