import { callLLM } from "../codeAgent";
import { parseLoose } from "../jsonLoose";
import { executeAgentTool, getToolDefinitions } from "./toolRegistry";
import { formatAgentMemoryContext, rememberSemantic } from "./semanticMemory";
import type { ArtifactItem } from "../types";
import type { ReActResult, ReActStep, ToolExecutionContext } from "./types";
import { collectEvidence, evidenceNote, goalNeedsEvidence } from "./verify";

const MAX_REACT_STEPS = 8;

const SYSTEM_REACT = `Kamu adalah Autonomous Executive Agent bernama Vox Omong.
Tugasmu adalah menyelesaikan instruksi pengguna secara tuntas dan mandiri dengan siklus ReAct (Reasoning + Acting).

Kamu memiliki akses ke alat-alat berikut:
{{TOOLS}}

Format jawabanmu HARUS SATU objek JSON valid:
{
  "thought": "Alasan singkat dan rencana langkah berikutnya",
  "action": "nama_tool" atau "finish",
  "args": { ... argumen sesuai definisi tool ... }
}

Aturan penting:
1. Jika butuh data/kode, gunakan tool yang tepat (file_read, web_search, terminal_exec, dll).
2. Setelah melihat observasi dari tool, tentukan langkah berikutnya.
3. Jika tugas sudah selesai atau informasi sudah cukup lengkap, pilih action: "finish" dengan args: { "final_answer": "jawaban lengkap untuk pengguna" }.
4. Jangan mengulang aksi yang gagal dengan argumen yang sama persis.
6. Jangan pilih "finish" sebelum hasilnya benar-benar ada. Sistem memeriksa bukti: klaim selesai tanpa alat yang berhasil akan ditolak.
7. Kalau tidak bisa diselesaikan, pilih "finish" dan katakan terus terang apa yang gagal dan kenapa.
5. Gunakan bahasa Indonesia yang santai, lugas, dan solutif.`;

export async function runReActLoop(
  userGoal: string,
  opts: {
    projectId: string;
    conversationId?: string;
    apiKey?: string;
    maxSteps?: number;
    mcpEnabled?: string[];
    /** Pembatalan dari luar (tombol batal tugas background). Dicek sebelum tiap langkah. */
    signal?: AbortSignal;
    onStep?: (step: ReActStep) => void;
  }
): Promise<ReActResult> {
  const maxSteps = opts.maxSteps || MAX_REACT_STEPS;
  const tools = getToolDefinitions();
  const toolDescriptions = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  Parameter: ${JSON.stringify(t.parameters.properties)}`
    )
    .join("\n");

  const system = SYSTEM_REACT.replace("{{TOOLS}}", toolDescriptions);
  const memoryContext = await formatAgentMemoryContext(userGoal, opts.apiKey);

  const steps: ReActStep[] = [];
  const artifacts: ArtifactItem[] = [];
  const scratchpad: string[] = [];

  const context: ToolExecutionContext = {
    projectId: opts.projectId,
    conversationId: opts.conversationId,
    apiKey: opts.apiKey,
    mcpEnabled: opts.mcpEnabled,
  };

  let finalAnswer = "";
  let finished = false;
  let rejectedFinish = 0;
  let badFormat = 0;

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    if (opts.signal?.aborted) {
      finalAnswer = "Dibatalkan sebelum selesai.";
      break;
    }
    // Sliding window scratchpad (hanya simpan 3 langkah terakhir agar hemat token & prompt tidak membengkak)
    const recentScratchpad = scratchpad.slice(-3);

    const prompt = [
      memoryContext ? `Konteks Memori Relevan:\n${memoryContext}\n` : "",
      `Instruksi Pengguna: "${userGoal}"`,
      `Project Workspace: "${opts.projectId}"`,
      `Langkah ke-${stepIndex + 1} dari ${maxSteps}`,
      recentScratchpad.length > 0 ? `Riwayat Tindakan & Observasi Terbaru:\n${recentScratchpad.join("\n\n")}` : "",
      "Tentukan thought dan action berikutnya dalam JSON.",
    ].filter(Boolean).join("\n\n");

    try {
      // Hemat token: Gunakan fast mode (tanpa thinking budget boros) & batas token ketat untuk aksi JSON
      const res = await callLLM({
        system,
        prompt,
        json: true,
        // file_write membawa isi file di dalam JSON; jatah kecil memotong JSON di tengah
        maxTokens: 1600,
        temperature: 0.1,
        fast: true,
        apiKey: opts.apiKey,
        prefer: ["gemini", "groq", "deepseek"],
      });

      const parsed = parseLoose<{
        thought?: string;
        action?: string;
        args?: Record<string, any>;
      }>(res.text);

      if (!parsed || !parsed.action) {
        badFormat++;
        scratchpad.push(`[Langkah ${stepIndex + 1}] Balasanmu bukan JSON yang sah. Balas HANYA satu objek: {"thought":"...","action":"nama_tool","args":{...}}`);
        if (badFormat >= 3) break;
        continue;
      }

      const thought = parsed.thought || "";
      const action = parsed.action;
      const args = parsed.args || {};

      const currentStep: ReActStep = {
        stepNumber: stepIndex + 1,
        thought,
        action,
        args,
        timestamp: new Date().toISOString(),
      };

      // Check if finished
      if (action === "finish") {
        // Klaim selesai untuk tugas kerja tanpa satu pun alat yang berhasil: tolak (maks 2x), suruh kerjakan dulu
        const proof = collectEvidence(userGoal, steps, artifacts);
        if (goalNeedsEvidence(userGoal) && proof.done.length === 0 && rejectedFinish < 2 && stepIndex < maxSteps - 1) {
          rejectedFinish++;
          scratchpad.push(`[Langkah ${stepIndex + 1}] "finish" DITOLAK sistem: belum ada alat yang berhasil dijalankan. Kerjakan tugasnya dengan alat, atau kalau memang mustahil, jelaskan penyebabnya di final_answer.`);
          continue;
        }
        finished = true;
        finalAnswer = String(args.final_answer || args.answer || thought || "Tugas berhasil diselesaikan.");
        currentStep.observation = "Selesai.";
        currentStep.success = true;
        steps.push(currentStep);
        opts.onStep?.(currentStep);

        // Save solution to memory
        void rememberSemantic(userGoal.slice(0, 100), finalAnswer.slice(0, 500), "solution", opts.apiKey);
        break;
      }

      // Execute Tool
      const toolRes = await executeAgentTool(action, args, context);
      currentStep.observation = toolRes.output || toolRes.error || "(tidak ada output)";
      currentStep.success = toolRes.success;

      if (toolRes.artifact) {
        artifacts.push(toolRes.artifact);
      }

      steps.push(currentStep);
      opts.onStep?.(currentStep);

      scratchpad.push(
        `[Langkah ${stepIndex + 1}]\nThought: ${thought}\nAction: ${action}(${JSON.stringify(args)})\nObservation: ${currentStep.observation.slice(0, 2000)}`
      );
    } catch (err) {
      const errMsg = (err as Error).message;
      scratchpad.push(`[Langkah ${stepIndex + 1}] Error saat mengeksekusi LLM/Tool: ${errMsg}`);
    }
  }

  const evidence = collectEvidence(userGoal, steps, artifacts);
  if (!finalAnswer) {
    finalAnswer = steps.length > 0
      ? `Belum selesai: agent berhenti di batas ${maxSteps} langkah.`
      : "Belum selesai: model tidak memberi langkah yang bisa dijalankan (format balasan rusak atau model sedang gagal).";
  }
  const note = evidenceNote(evidence);
  const verified = finished && evidence.ok;
  if (finished && !evidence.ok) finalAnswer = `Selesai sebagian, belum terverifikasi.\n\n${finalAnswer}`;
  if (note) finalAnswer = `${finalAnswer}\n\n${note}`;

  return {
    success: verified,
    finalAnswer,
    steps,
    artifacts: artifacts.filter((a) => a && typeof a === "object" && "type" in a),
  };
}
