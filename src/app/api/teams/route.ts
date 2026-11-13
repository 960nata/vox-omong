import {
  advancePipelineStage,
  analyzeProjectIdea,
  chatTeamMember,
  createSession,
  createTeam,
  deleteSession,
  generateCustomDivision,
  getSession,
  getTeam,
  listSessions,
  listTeams,
  runBoardVote,
  saveSession,
  startTeamTask,
  stopTeamTask,
  syncExecutiveBoard,
  TeamError,
  updateTeam,
  updateTeamMember,
} from "@/lib/agentTeams";

export const runtime = "nodejs";

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (error: unknown) => response({ success: false, error: error instanceof Error ? error.message : "Permintaan tim gagal" }, error instanceof TeamError ? error.status : 500);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (action === "sessions") {
      return response({ success: true, sessions: await listSessions() });
    }
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId) {
      const session = await getSession(sessionId);
      const teams = await listTeams(sessionId);
      return response({ success: true, session, teams });
    }
    const projectId = url.searchParams.get("projectId") || "default-workspace";
    return response({ success: true, teams: await listTeams(projectId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      const input: unknown = await request.json();
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
      body = input as Record<string, unknown>;
    } catch { throw new TeamError("Body JSON tidak valid"); }

    if (body.action === "list_sessions") {
      return response({ success: true, sessions: await listSessions() });
    }
    if (body.action === "get_session") {
      if (typeof body.sessionId !== "string") throw new TeamError("sessionId wajib diisi");
      return response({ success: true, session: await getSession(body.sessionId) });
    }
    if (body.action === "analyze_idea") {
      if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new TeamError("Ide proyek wajib diisi");
      const sanitizedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
      const analysis = await analyzeProjectIdea(body.prompt, sanitizedApiKey);
      return response({ success: true, analysis });
    }
    if (body.action === "create_session") {
      const title = typeof body.title === "string" ? body.title : "Proyek Baru";
      const kind = typeof body.kind === "string" ? (body.kind as any) : undefined;
      const description = typeof body.description === "string" ? body.description : undefined;
      const divisions = Array.isArray(body.divisions) ? (body.divisions as any) : undefined;
      const initialPrdSeed = body.initialPrdSeed && typeof body.initialPrdSeed === "object" ? (body.initialPrdSeed as any) : undefined;
      const created = await createSession({ title, kind, description, divisions, initialPrdSeed });
      return response({ success: true, ...created });
    }
    if (body.action === "delete_session") {
      if (typeof body.sessionId !== "string") throw new TeamError("sessionId wajib diisi");
      const deleted = await deleteSession(body.sessionId);
      return response({ success: true, deleted });
    }
    if (body.action === "board_vote") {
      if (typeof body.sessionId !== "string") throw new TeamError("sessionId wajib diisi");
      const sanitizedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
      const aiMode = typeof body.aiMode === "string" && body.aiMode.trim() ? body.aiMode.trim() : undefined;
      const voteResult = await runBoardVote(body.sessionId, sanitizedApiKey, aiMode);
      return response({ success: true, ...voteResult });
    }
    if (body.action === "advance_pipeline") {
      if (typeof body.sessionId !== "string") throw new TeamError("sessionId wajib diisi");
      if (typeof body.stage !== "string") throw new TeamError("stage wajib diisi");
      const updated = await advancePipelineStage(body.sessionId, body.stage as any);
      return response({ success: true, session: updated });
    }
    if (body.action === "dispatch_sprint") {
      if (typeof body.sessionId !== "string") throw new TeamError("sessionId wajib diisi");
      const session = await getSession(body.sessionId);
      if (!session) throw new TeamError("Sesi proyek tidak ditemukan", 404);
      const teams = await listTeams(body.sessionId);
      const targetKind = (body.target as string) || "developer";
      const sanitizedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
      const aiMode = typeof body.aiMode === "string" && body.aiMode.trim() ? body.aiMode.trim() : undefined;
      
      const targetTeams = targetKind === "all"
        ? teams.filter((t) => t.kind !== "executive" && t.kind !== "founder")
        : teams.filter((t) => t.kind === targetKind);

      if (!targetTeams.length) throw new TeamError(`Divisi ${targetKind} tidak ditemukan di proyek ini`, 404);

      const briefTemplate = (kind: string) => {
        if (kind === "developer") {
          return `Laksanakan mandat implementasi PRD yang telah disetujui Dewan Direksi: Bangun antarmuka modern minimalist fintech untuk ${session.title}, sertakan kalkulator investasi, simulasi virtual account, dan double-entry ledger yang bersih.`;
        }
        if (kind === "marketing") {
          return `Susun strategi kampanye go-to-market, kalender konten peluncuran, dan copywriting landing page waitlist untuk ${session.title} berdasarkan PRD yang telah disetujui.`;
        }
        if (kind === "trading") {
          return `Lakukan pemodelan kuantitatif portofolio, batasan risiko pre-trade gate, dan diversifikasi aset untuk ${session.title} sesuai arahan PRD.`;
        }
        return `Eksekusi rencana kerja sesuai PRD yang telah disetujui Dewan Direksi untuk ${session.title}.`;
      };

      const triggered: string[] = [];
      for (const t of targetTeams) {
        const brief = briefTemplate(t.kind);
        await startTeamTask(t.id, brief, sanitizedApiKey, "work", aiMode);
        triggered.push(t.name);
      }

      return response({ success: true, triggered, session });
    }

    if (body.action === "activate_divisions") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : (body.projectId as string);
      if (!sessionId) throw new TeamError("sessionId wajib diisi");
      const session = await getSession(sessionId);
      const divisions = Array.isArray(body.divisions) ? (body.divisions as any[]) : [];
      if (session && typeof body.title === "string" && body.title.trim()) {
        session.title = body.title.trim();
        session.updatedAt = new Date().toISOString();
        await saveSession(session);
      }
      const existingTeams = await listTeams(sessionId);
      const createdTeams: any[] = [];
      for (const kind of divisions) {
        if (kind !== "executive" && !existingTeams.some(t => t.kind === kind)) {
          const t = await createTeam(sessionId, kind);
          createdTeams.push(t);
        }
      }
      const allActive = await listTeams(sessionId);
      if (allActive.filter(t => t.kind !== "executive").length >= 2) {
        const board = await syncExecutiveBoard(sessionId);
        if (board) createdTeams.unshift(board);
      }
      return response({ success: true, teams: await listTeams(sessionId) });
    }

    if (body.action === "generate_division") {
      if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new TeamError("Topik atau nama divisi wajib diisi");
      const sanitizedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
      const aiMode = typeof body.aiMode === "string" && body.aiMode.trim() ? body.aiMode.trim() : undefined;
      const generated = await generateCustomDivision(body.prompt.trim(), sanitizedApiKey, aiMode);
      return response({ success: true, division: generated });
    }

    if (body.action === "create") {
      const validKinds = ["developer", "marketing", "creative", "founder", "research", "trading", "career", "executive", "custom"];
      if (!validKinds.includes(body.kind as string)) throw new TeamError("Pilih jenis grup yang valid");
      if (body.projectId !== undefined && typeof body.projectId !== "string") throw new TeamError("projectId tidak valid");
      if (body.name !== undefined && typeof body.name !== "string") throw new TeamError("Nama tim tidak valid");
      const customMembers = Array.isArray(body.members) ? (body.members as any[]) : undefined;
      const pId = (body.projectId as string) || "default-workspace";
      const team = await createTeam(pId, body.kind as any, body.name as string | undefined, customMembers);
      if (pId.startsWith("session-")) {
        await syncExecutiveBoard(pId);
      }
      return response({ success: true, team });
    }
    if (body.action !== "status" && body.action !== "run" && body.action !== "discuss" && body.action !== "stop" && body.action !== "update_member" && body.action !== "chat_member" && body.action !== "update_team") throw new TeamError("Aksi tim tidak dikenal");
    if (typeof body.teamId !== "string") throw new TeamError("teamId wajib diisi");
    if (body.action === "stop") return response({ success: true, team: await stopTeamTask(body.teamId) });
    if (body.action === "status") return response({ success: true, team: await getTeam(body.teamId) });
    if (body.action === "update_team") {
      if (typeof body.name !== "string") throw new TeamError("Nama grup wajib diisi");
      return response({ success: true, team: await updateTeam(body.teamId, body.name) });
    }
    if (body.action === "update_member" || body.action === "chat_member") {
      if (typeof body.memberId !== "string") throw new TeamError("memberId wajib diisi");
      if (body.action === "update_member") {
        if (body.name !== undefined && typeof body.name !== "string") throw new TeamError("Nama anggota tidak valid");
        if (body.avatar !== undefined && typeof body.avatar !== "string") throw new TeamError("Avatar tidak valid");
        if (body.voice !== undefined && typeof body.voice !== "string") throw new TeamError("Suara tidak valid");
        if (body.agencyAgentId !== undefined && typeof body.agencyAgentId !== "string") throw new TeamError("Agen Agency tidak valid");
        if (body.skillId !== undefined && typeof body.skillId !== "string") throw new TeamError("Skill tidak valid");
        return response({ success: true, team: await updateTeamMember(body.teamId, body.memberId, { name: body.name as string | undefined, avatar: body.avatar as string | undefined, voice: body.voice as string | undefined, agencyAgentId: body.agencyAgentId as string | undefined, skillId: body.skillId as string | undefined }) });
      }
    }
    if (typeof body.message !== "string") throw new TeamError("message wajib diisi");
    const isStop = /\b(stop|berhenti|batal|cancel|cukup|tahan|hentikan|udahan)\b/i.test(body.message.trim());
    if (isStop && body.action !== "chat_member") {
      return response({ success: true, team: await stopTeamTask(body.teamId as string) });
    }
    if (body.apiKey !== undefined && (typeof body.apiKey !== "string" || body.apiKey.length > 1024)) throw new TeamError("API key tidak valid");
    const sanitizedApiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
    const aiMode = typeof body.aiMode === "string" && body.aiMode.trim() ? body.aiMode.trim() : undefined;
    if (body.action === "chat_member") return response({ success: true, team: await chatTeamMember(body.teamId, body.memberId as string, body.message, sanitizedApiKey, undefined, aiMode) });
    const team = await startTeamTask(body.teamId, body.message, sanitizedApiKey, body.action === "discuss" ? "discuss" : "work", aiMode);
    return response({ success: true, team }, 202);
  } catch (error) { return failure(error); }
}