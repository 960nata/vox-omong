/**
 * Menjalankan keputusan decideFlow (lib/teamFlow.ts): memanggil model, membentuk/menghapus tim,
 * dan menyimpan state sesi. Semua kalimat balasan berasal dari teamFlow.ts.
 */
import { analyzeProjectIdea, createTeam, deleteTeam, listTeams, saveSession, syncExecutiveBoard, TEAM_NAMES } from "./agentTeams";
import { callLLM } from "./codeAgent";
import type { TeamKind, TeamSession } from "./teamTypes";
import type { TeamPicker } from "./types";
import {
  analysisFailedMessage,
  buildTeamPicker,
  clarifyMessage,
  fallbackSummary,
  DEFAULT_RECOMMENDATION,
  divisionName,
  formatAnalysis,
  formatIdeas,
  helpMessage,
  ideaFailedMessage,
  ideaSystem,
  nextStepsMessage,
  nudgeMessage,
  outOfRangeMessage,
  parseIdeas,
  pickerIntroMessage,
  resetMessage,
  stepOf,
  styleNote,
  teamListMessage,
  teamsFormedMessage,
  teamsRemovedMessage,
  type FlowAction,
  type FlowCtx,
  type Voice,
} from "./teamFlow";

export interface FlowResult {
  reply: string;
  picker?: TeamPicker;
}

const touch = (s: TeamSession) => {
  s.updatedAt = new Date().toISOString();
  return saveSession(s);
};

/** Konteks keputusan dari sesi + tim yang sudah ada. */
export async function flowContext(session: TeamSession, projectId: string, hasFolder: boolean): Promise<FlowCtx> {
  const teams = await listTeams(projectId).catch(() => []);
  return {
    stage: session.pipelineStage,
    existingKinds: teams.filter((t) => t.kind !== "executive").map((t) => t.kind),
    ideaOptions: session.ideaOptions || [],
    pendingBrief: session.pendingBrief,
    hasRecommendation: !!session.recommendedDivisions?.length,
    lastBrief: session.lastBrief,
    hasFolder,
  };
}

export async function runTeamFlow(
  action: FlowAction,
  opts: { session: TeamSession; projectId: string; ctx: FlowCtx; voice: Voice; apiKey?: string; folderSnippet?: string },
): Promise<FlowResult> {
  const { session, ctx, voice: v, apiKey } = opts;
  const { projectId } = opts;

  switch (action.type) {
    case "help":
      return { reply: helpMessage(stepOf(ctx), v) };

    case "nudge":
      return { reply: nudgeMessage(stepOf(ctx), v) };

    case "nextSteps": {
      const teams = (await listTeams(projectId)).filter((t) => t.kind !== "executive");
      return { reply: nextStepsMessage(teams.map((t) => t.name), v) };
    }

    case "reset": {
      const teams = (await listTeams(projectId)).filter((t) => t.kind !== "executive");
      session.ideaOptions = undefined;
      session.rejectedIdeas = undefined;
      session.pendingBrief = undefined;
      session.recommendedDivisions = undefined;
      if (!teams.length) session.pipelineStage = "ideation";
      await touch(session);
      return { reply: resetMessage(teams.map((t) => t.name), v) };
    }

    case "pickOutOfRange":
      return { reply: outOfRangeMessage(action.count, v) };

    case "clarify":
      session.pendingBrief = action.brief.slice(0, 500);
      await touch(session);
      return { reply: clarifyMessage(v) };

    case "suggest": {
      const exclude = [...new Set([...(session.rejectedIdeas || []), ...(session.ideaOptions || []).map((i) => i.title)])].slice(-15);
      try {
        const out = await callLLM({
          system: ideaSystem(v, exclude),
          prompt: `Permintaan user: """${(action.preference || "belum punya ide, bebas bidangnya").slice(0, 600)}"""`,
          apiKey,
          json: true,
          fast: true,
          temperature: 0.8,
          maxTokens: 900,
          timeoutMs: 45_000,
        });
        const ideas = parseIdeas(out.text);
        if (!ideas.length) throw new Error("balasan model tidak berisi ide");
        const again = (session.ideaOptions?.length || 0) > 0;
        session.rejectedIdeas = exclude;
        session.ideaOptions = ideas;
        session.pendingBrief = undefined;
        await touch(session);
        return { reply: formatIdeas(ideas, v, again) };
      } catch (err) {
        return { reply: ideaFailedMessage((err as Error).message, v) };
      }
    }

    case "analyze": {
      try {
        const analysis = await analyzeProjectIdea(action.brief, apiKey, opts.folderSnippet, styleNote(v));
        session.lastBrief = action.brief.slice(0, 1500);
        if (!analysis.fallback && analysis.projectTitle && analysis.projectTitle !== "Proyek Inovasi Baru" && !session.title.includes(":")) {
          session.title = analysis.projectTitle;
        }
        const divisions = analysis.recommendedDivisions.filter((d) => d.kind !== "executive");
        session.recommendedDivisions = divisions.map((d) => d.kind);
        session.ideaOptions = undefined;
        session.pendingBrief = undefined;
        await touch(session);
        return {
          reply: formatAnalysis(
            {
              title: session.title,
              summary: analysis.fallback ? fallbackSummary(v) : analysis.executiveSummary,
              strengths: analysis.strengths?.length ? analysis.strengths : ["Masalah yang mau diselesaikan cukup jelas dan banyak dialami orang."],
              weaknesses: analysis.weaknesses?.length ? analysis.weaknesses : ["Belum terbukti ada orang yang mau bayar. Perlu dicek dulu ke calon pengguna."],
              divisions: divisions.map((d) => ({ name: d.name, reason: d.reason })),
            },
            v,
          ),
          picker: buildTeamPicker(divisions.map((d) => ({ kind: d.kind, reason: d.reason }))),
        };
      } catch (err) {
        return { reply: analysisFailedMessage((err as Error).message, v) };
      }
    }

    case "showPicker": {
      const rec = session.recommendedDivisions?.length ? session.recommendedDivisions : DEFAULT_RECOMMENDATION;
      return {
        reply: pickerIntroMessage(action.reason, action.unknown, v),
        picker: buildTeamPicker(rec.filter((k) => !ctx.existingKinds.includes(k)).map((kind) => ({ kind }))),
      };
    }

    case "formRecommended":
    case "formTeams": {
      const kinds = (action.type === "formTeams" ? action.kinds : session.recommendedDivisions || DEFAULT_RECOMMENDATION).filter((k) => k !== "executive") as TeamKind[];
      const existing = await listTeams(projectId);
      const created: string[] = [];
      const already: string[] = [];
      for (const k of kinds) {
        if (existing.some((t) => t.kind === k)) already.push(TEAM_NAMES[k] || divisionName(k));
        else {
          await createTeam(projectId, k);
          created.push(TEAM_NAMES[k] || divisionName(k));
        }
      }
      const total = (await listTeams(projectId)).filter((t) => t.kind !== "executive").length;
      const withBoard = total >= 2;
      if (withBoard && created.length) await syncExecutiveBoard(projectId);
      if (created.length) {
        session.pipelineStage = withBoard ? "prd" : "development";
        await touch(session);
      }
      return { reply: teamsFormedMessage({ created, already, withBoard: withBoard && created.length > 0 }, v) };
    }

    case "listTeams": {
      const teams = (await listTeams(projectId)).filter((t) => t.kind !== "executive");
      return { reply: teamListMessage(session.title, teams.map((t) => ({ name: t.name, members: t.members.map((m) => m.name) })), v) };
    }

    case "removeTeams": {
      const teams = await listTeams(projectId);
      const removed: string[] = [];
      const missing: string[] = [];
      const busy: string[] = [];
      for (const k of action.kinds) {
        const team = teams.find((t) => t.kind === k);
        if (!team) {
          missing.push(divisionName(k));
          continue;
        }
        try {
          await deleteTeam(team.id);
          removed.push(team.name);
        } catch {
          busy.push(team.name);
        }
      }
      const left = (await listTeams(projectId)).filter((t) => t.kind !== "executive");
      if (!left.length) {
        // Dewan Direksi tidak berarti tanpa divisi: ikut dihapus
        for (const board of (await listTeams(projectId)).filter((t) => t.kind === "executive")) await deleteTeam(board.id).catch(() => {});
        session.pipelineStage = "ideation";
        await touch(session);
      }
      return { reply: teamsRemovedMessage({ removed, missing, busy, left: left.map((t) => t.name) }, v) };
    }
  }
}
