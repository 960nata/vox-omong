/**
 * Menyambung mesin orkestrasi ke runtime VOX yang sudah ada.
 *
 * Di sini step `agent` pada workflow, eksekutor thread, dan daftar agent untuk automation
 * dipasang ke jalur yang sudah dipakai proyek: terminal → tim agent → skill → pembuat website.
 * Dipanggil sekali per proses (idempoten), dari route API yang butuh mesinnya.
 */

import { buildWebsite, detectCodeIntent, hasGeneratedSite } from "@/lib/codeAgent";
import { handleTeamMessage, listSessions } from "@/lib/agentTeams";
import { detectSkill, runSkill } from "@/lib/skillAgent";
import { isSkillTask, runSkillEngine } from "@/lib/skillEngine";
import { resolveSkill } from "@/lib/skillHub";
import { handleTerminalMessage } from "@/lib/terminalRuntime";
import { listProjects } from "@/lib/projects";
import { setAutomationAgents } from "./automation";
import { setRoutinePromptRunner } from "./scheduler";
import { setThreadExecutor } from "./threads";
import { registerStepRunner } from "./workflow";

const g = globalThis as unknown as { __voxEngineReady?: boolean };

export interface PromptRun {
  reply: string;
  previewUrl?: string | null;
  via: "terminal" | "team" | "skill" | "skill-engine" | "website";
}

class Aborted extends Error {
  constructor() {
    super("Dibatalkan");
    this.name = "Aborted";
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Aborted();
}

/**
 * Jalankan satu prompt lewat jalur yang sama dengan chat utama, lalu kembalikan jawabannya.
 * `onStep` dipakai untuk progres thread/workflow.
 */
export async function runPrompt(input: {
  prompt: string;
  projectId: string;
  apiKey?: string;
  signal?: AbortSignal;
  onStep?: (step: string, progress?: number) => void;
}): Promise<PromptRun> {
  const { prompt, projectId, apiKey, signal, onStep } = input;

  onStep?.("Terminal", 10);
  checkAbort(signal);
  const terminal = await handleTerminalMessage({ message: prompt, projectId });
  if (terminal) {
    return { reply: terminal.spoken || terminal.reply, previewUrl: terminal.previewUrl ?? null, via: "terminal" };
  }

  onStep?.("Tim agent", 25);
  checkAbort(signal);
  const team = await handleTeamMessage({ message: prompt, projectId, apiKey });
  if (team) {
    return { reply: team.spoken || team.reply, previewUrl: team.previewUrl ?? null, via: "team" };
  }

  checkAbort(signal);
  const siteExists = await hasGeneratedSite(projectId);
  const intent = detectCodeIntent(prompt, siteExists);

  if (!intent) {
    const skill = detectSkill(prompt);
    if (skill) {
      onStep?.("Menyusun dokumen", 45);
      const out = await runSkill(skill, prompt);
      return { reply: `${out.artifact.title}. ${out.reply}`, via: "skill" };
    }

    const resolved = await resolveSkill(prompt).catch(() => null);
    if (resolved && isSkillTask(prompt)) {
      onStep?.(`Skill ${resolved.skill?.skill ?? resolved.skill?.repo ?? ""}`.trim(), 50);
      const out = await runSkillEngine({
        message: prompt,
        resolved,
        onStep: (step) => {
          checkAbort(signal);
          onStep?.(step);
        },
      });
      if (out) return { reply: out.reply, via: "skill-engine" };
    }
  }

  onStep?.("Membangun website", 60);
  checkAbort(signal);
  let turns = 0;
  const site = await buildWebsite({
    request: prompt,
    mode: intent ?? "create",
    projectId,
    onProgress: (turn) => {
      checkAbort(signal);
      turns++;
      onStep?.(`${turn.agent}: ${turn.note.slice(0, 90)}`, Math.min(92, 60 + turns * 6));
    },
  });
  const warn = site.warnings.length ? ` Perhatian: ${site.warnings.join(" ")}` : "";
  return {
    reply: `${site.title}. ${site.summary} (${site.lines} baris, skor review ${site.score ?? "-"}/10).${warn}`.trim(),
    previewUrl: site.previewUrl,
    via: "website",
  };
}

/** Pasang semua sambungan mesin. Aman dipanggil berkali-kali. */
export function bootEngine(): void {
  if (g.__voxEngineReady) return;
  g.__voxEngineReady = true;

  // Step `agent` di workflow: prompt + project, jawabannya jadi field `reply`.
  registerStepRunner("agent", async ({ input, signal, step }) => {
    const prompt = typeof input.prompt === "string" ? input.prompt : "";
    if (!prompt.trim()) throw new Error(`Step "${step.id}" butuh field \`prompt\`.`);
    const projectId = typeof input.projectId === "string" ? input.projectId : "default-workspace";
    const run = await runPrompt({
      prompt,
      projectId,
      apiKey: typeof input.apiKey === "string" ? input.apiKey : undefined,
      signal,
    });
    return { reply: run.reply, previewUrl: run.previewUrl ?? null, via: run.via };
  });

  // Thread: satu prompt per thread, progres dilaporkan ke UI.
  setThreadExecutor(async ({ thread, update, signal }) => {
    const run = await runPrompt({
      prompt: thread.prompt,
      projectId: thread.agent || "default-workspace",
      signal,
      onStep: (step, progress) => update({ step, progress }),
    });
    return run.reply;
  });

  // Routine bertarget agent: prompt dijalankan di jalur yang sama dengan chat.
  setRoutinePromptRunner(async (routine) => {
    const run = await runPrompt({ prompt: routine.target.prompt, projectId: routine.target.agent });
    return run.reply;
  });

  // Automation hanya boleh menyebut project/sesi yang memang ada.
  setAutomationAgents(async () => {
    const [projects, sessions] = await Promise.all([
      listProjects().catch(() => []),
      listSessions().catch(() => []),
    ]);
    return [...new Set([...projects.map((p) => p.id), ...sessions.map((s) => s.id)])];
  });
}
