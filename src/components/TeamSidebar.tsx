"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  FolderPlus,
  GraduationCap,
  History,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Orbit,
  Palette,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import type { PipelineStage, Team, TeamKind, TeamSession } from "@/lib/teamTypes";

export interface TeamChatSelection { teamId: string; memberId?: string }

interface TeamSidebarProps {
  projectId: string;
  onSelectProject?: (projectId: string, conversationId?: string) => void;
  selectedChat: TeamChatSelection | null;
  onSelectTeam: (selection: TeamChatSelection) => void;
  onGeneralChat: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, event?: React.MouseEvent) => void;
  isOpen: boolean;
  isDrawer?: boolean;
  onClose: () => void;
}

export const statusLabels: Record<string, string> = {
  idle: "Siap",
  working: "Bekerja",
  done: "Laporan siap",
  failed: "Perlu bantuan",
  running: "Berjalan",
  completed: "Selesai",
  partial: "Sebagian selesai",
};

export const pipelineStageLabels: Record<PipelineStage, { label: string; icon: string; desc: string }> = {
  ideation: { label: "Ideation", icon: "💡", desc: "Perumusan ide mentah & eksplorasi konsep" },
  prd: { label: "Perumusan PRD", icon: "📄", desc: "Tim Founder merumuskan spesifikasi produk & pasar" },
  board_vote: { label: "Sidang Dewan Direksi", icon: "🗳️", desc: "Para ketua divisi voting konsensus kelayakan" },
  development: { label: "Eksekusi Developer", icon: "⚡", desc: "Tim Developer mengimplementasi kode & UI" },
  ready: { label: "Siap & Live", icon: "✅", desc: "Produk selesai dan terverifikasi" },
};

const divisionChoices = [
  { kind: "developer" as TeamKind, label: "Developer", desc: "Frontend, Backend, UI/UX", Icon: Code2 },
  { kind: "founder" as TeamKind, label: "Founder", desc: "CEO, Riset Pasar, GTM, PRD", Icon: Rocket },
  { kind: "marketing" as TeamKind, label: "Marketing", desc: "Growth, Copywriting, Konten", Icon: Megaphone },
  { kind: "creative" as TeamKind, label: "Kreatif", desc: "Art Director, Motion, Story", Icon: Palette },
  { kind: "research" as TeamKind, label: "Riset", desc: "Investigator, Fact-Checker", Icon: GraduationCap },
  { kind: "trading" as TeamKind, label: "Trading", desc: "Analisis Teknikal & Risiko", Icon: TrendingUp },
  { kind: "career" as TeamKind, label: "Karier", desc: "ATS Resume, Interview Coach", Icon: Briefcase },
] as const;

export const avatarPresets = [
  { id: "initials", label: "Inisial", Icon: null },
  { id: "orbit", label: "Orbit", Icon: Orbit },
  { id: "bolt", label: "Petir", Icon: Zap },
  { id: "palette", label: "Palet", Icon: Palette },
  { id: "code", label: "Kode", Icon: Code2 },
  { id: "megaphone", label: "Megafon", Icon: Megaphone },
  { id: "sparkle", label: "Bintang", Icon: Sparkles },
] as const;

export function MemberAvatar({ name, avatar, className = "" }: { name: string; avatar?: string; className?: string }) {
  const Icon = avatarPresets.find(preset => preset.id === avatar)?.Icon;
  return (
    <span aria-hidden="true" className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-hover border border-line text-[10px] font-medium ${className}`}>
      {Icon ? <Icon className="w-4 h-4 text-accent" /> : name.split(" ").map(part => part[0]).join("").slice(0, 2)}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
        status === "working" || status === "running"
          ? "bg-accent animate-pulse"
          : status === "failed"
          ? "bg-danger"
          : status === "done" || status === "completed"
          ? "bg-emerald-500"
          : "bg-fg-4"
      }`}
    />
  );
}

export async function teamRequest(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json();
  if (!response.ok || !data.team) throw new Error(data.error || "Tim belum bisa dihubungi. Coba lagi.");
  return data.team as Team;
}

export function TeamSidebar({
  projectId,
  onSelectProject,
  selectedChat,
  onSelectTeam,
  onGeneralChat,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  isDrawer = false,
  onClose,
}: TeamSidebarProps) {
  const [tab, setTab] = useState<"workspace" | "history">("workspace");
  const [sessions, setSessions] = useState<TeamSession[]>([]);
  const [currentSession, setCurrentSession] = useState<TeamSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Menus & Panels
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [showAddDivision, setShowAddDivision] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<TeamSession | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const floating = isDrawer || isMobile;

  // 1. Muat daftar semua sesi (Riwayat Proyek)
  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/teams?action=sessions", { signal, cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        const match = data.sessions.find((s: TeamSession) => s.id === projectId);
        if (match) {
          setCurrentSession(match);
        } else if (data.sessions.length > 0 && (!projectId || projectId === "default-workspace")) {
          const first = data.sessions[0];
          setCurrentSession(first);
          onSelectProject?.(first.id, first.conversationId);
        }
      }
    } catch (err: any) {
      if (!signal?.aborted) setError(err.message);
    }
  }, [projectId, onSelectProject]);

  // 2. Muat daftar tim di sesi aktif
  const loadTeams = useCallback(async (signal?: AbortSignal) => {
    const targetId = projectId || currentSession?.id || "default-workspace";
    const response = await fetch(`/api/teams?projectId=${encodeURIComponent(targetId)}`, { signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.teams)) throw new Error(data.error || "Daftar grup belum bisa dimuat.");
    if (signal?.aborted) return;
    setTeams(data.teams);
    setError(null);
  }, [projectId, currentSession?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(async () => {
        await loadSessions(controller.signal);
        await loadTeams(controller.signal);
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadSessions, loadTeams]);

  // Auto-poll jika ada tugas yang berjalan
  const hasOtherRunningTasks = teams.some(team => team.id !== selectedChat?.teamId && team.tasks.some(task => task.status === "running"));
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await loadTeams(controller.signal);
        await loadSessions(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, hasOtherRunningTasks ? 2500 : 5000);
    };
    timer = setTimeout(poll, hasOtherRunningTasks ? 2500 : 5000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [hasOtherRunningTasks, loadTeams, loadSessions]);

  // Event listener untuk update tim
  useEffect(() => {
    const controller = new AbortController();
    const refresh = (event: Event) => {
      const team = (event as CustomEvent<{ team?: Team }>).detail?.team;
      if (team && team.projectId === (projectId || currentSession?.id)) {
        setTeams(previous => (previous.some(item => item.id === team.id) ? previous.map(item => (item.id === team.id ? team : item)) : [...previous, team]));
      } else {
        void loadTeams(controller.signal).catch(() => {});
        void loadSessions(controller.signal).catch(() => {});
      }
    };
    window.addEventListener("vox_teams_updated", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("vox_teams_updated", refresh);
    };
  }, [loadTeams, loadSessions, projectId, currentSession?.id]);

  useEffect(() => {
    if (!floating || !isOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [floating, isOpen, onClose]);

  const openChat = (selection: TeamChatSelection) => {
    onSelectTeam(selection);
    if (floating) onClose();
  };

  // Buat Proyek Baru Langsung Bersih (Tanpa Popup Modal)
  const handleQuickNewProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_session", title: "Proyek Baru" }),
      });
      const data = await res.json();
      if (!res.ok || !data.session) throw new Error(data.error || "Gagal membuat proyek");

      setSessions(prev => [data.session, ...prev]);
      setCurrentSession(data.session);
      if (typeof window !== "undefined") {
        (window as any).__activeVoxProject = data.session.id;
      }
      onSelectProject?.(data.session.id, data.session.conversationId);
      setTeams(data.teams || []);
      setShowSessionSelector(false);
      onGeneralChat(); // Langsung ke ruang chat bersih
      if (floating) onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Hapus Riwayat / Sesi (Reset Bersih Grup & Kontak)
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_session", sessionId: sessionToDelete.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.deleted) throw new Error(data.error || "Gagal menghapus sesi");

      const remaining = sessions.filter(s => s.id !== sessionToDelete.id);
      setSessions(remaining);
      setSessionToDelete(null);

      if (remaining.length > 0) {
        const next = remaining[0];
        setCurrentSession(next);
        onSelectProject?.(next.id, next.conversationId);
      } else {
        setCurrentSession(null);
        setTeams([]);
        onGeneralChat();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [customDivisionPrompt, setCustomDivisionPrompt] = useState("");
  const [generatingCustom, setGeneratingCustom] = useState(false);

  // Tambah Divisi ke Riwayat Ini
  const handleAddDivision = async (
    kind: TeamKind,
    customName?: string,
    customMembers?: { name: string; role: string }[]
  ) => {
    const targetSessionId = projectId || currentSession?.id;
    if (!targetSessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          projectId: targetSessionId,
          kind,
          name: customName,
          members: customMembers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.team) throw new Error(data.error || "Gagal menambah divisi");

      await loadTeams();
      setShowAddDivision(false);
      setCustomDivisionPrompt("");
      openChat({ teamId: data.team.id });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateAndAddCustomDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = customDivisionPrompt.trim();
    if (!prompt) return;
    setGeneratingCustom(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_division", prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.division) throw new Error(data.error || "Gagal merancang divisi kustom");

      await handleAddDivision("custom", data.division.name, data.division.members);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingCustom(false);
    }
  };

  if (!isOpen) return null;

  const execTeam = teams.find(t => t.kind === "executive");
  const otherTeams = teams.filter(t => t.kind !== "executive");

  return (
    <>
      {floating && <button className="fixed inset-x-0 top-14 bottom-0 z-40 bg-scrim/40" aria-label="Tutup panel tim" onClick={onClose} />}
      <aside
        aria-label="Riwayat proyek, grup, dan kontak AI"
        className={`${floating ? "fixed top-14 bottom-0 left-0 z-50 w-84 max-w-[92vw] shadow-2xl" : "relative h-full w-80 shrink-0 z-20"} bg-canvas border-r border-line flex flex-col min-h-0 min-w-0`}
      >
        {/* Header Panel */}
        <div className="px-4 pt-3.5 pb-2.5 flex justify-between items-center gap-2 border-b border-line/40">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-fg">Ruang Kolaborasi AI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Virtual Org</span>
            </div>
            <p className="text-[11px] text-fg-3 mt-0.5">Riwayat proyek & divisi otonom</p>
          </div>
          <button onClick={onClose} className="icon-btn shrink-0" aria-label="Sembunyikan panel">
            <PanelLeftClose className="w-4 h-4 hidden md:block" />
            <X className="w-4 h-4 md:hidden" />
          </button>
        </div>

        {/* Tab Switcher: Riwayat Proyek vs Obrolan Suara */}
        <div className="mx-3 mt-2 mb-2 grid grid-cols-2 gap-1 rounded-xl bg-hover/70 p-1" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "workspace"}
            onClick={() => setTab("workspace")}
            className={`flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors font-medium ${
              tab === "workspace" ? "bg-canvas text-fg shadow-sm" : "text-fg-3 hover:text-fg"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Riwayat & Divisi
          </button>
          <button
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={`flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors font-medium ${
              tab === "history" ? "bg-canvas text-fg shadow-sm" : "text-fg-3 hover:text-fg"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Sesi Suara
          </button>
        </div>

        {tab === "history" ? (
          /* TAB 2: Riwayat Sesi Percakapan Suara Klasik */
          <>
            <button
              onClick={() => {
                onGeneralChat();
                if (floating) onClose();
              }}
              className={`mx-3 mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors ${
                !selectedChat ? "bg-accent/10 text-accent font-medium" : "text-fg-3 hover:bg-hover/60"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat Umum Suara AI
            </button>
            <button onClick={onNew} className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs hover:bg-hover transition-colors">
              <Plus className="w-3.5 h-3.5" /> Sesi Suara Baru
            </button>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
              {conversations.length === 0 && (
                <p className="text-xs text-fg-3 py-8 px-2 text-center leading-relaxed">Belum ada sesi suara.</p>
              )}
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  className={`group flex items-center rounded-xl mb-1 ${
                    activeId === conversation.id && !selectedChat ? "bg-hover text-fg" : "text-fg-3 hover:bg-hover/60"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelect(conversation.id);
                      if (floating) onClose();
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2 py-2.5 pl-3 pr-1 text-left text-xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{conversation.title}</span>
                  </button>
                  <button
                    className="p-1.5 mr-1 rounded-lg hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={event => onDelete(conversation.id, event)}
                    aria-label={`Hapus sesi ${conversation.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* TAB 1: RIWAYAT PROYEK, GRUP & KONTAK (CONTAINER HIERARKIS) */
          <>
            {/* Project/Session Selector Box */}
            <div className="mx-3 mb-2">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-medium text-fg-3 uppercase tracking-wider">Proyek Aktif</span>
                <button
                  onClick={handleQuickNewProject}
                  disabled={busy}
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium disabled:opacity-50"
                  title="Mulai obrolan proyek baru kosongan tanpa popup"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  <span>+ Proyek Baru</span>
                </button>
              </div>

              {/* Dropdown Card Proyek */}
              <div className="relative">
                <button
                  onClick={() => setShowSessionSelector(!showSessionSelector)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-hover/80 hover:bg-hover border border-line px-3 py-2 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">
                      {currentSession?.kind === "website" ? "🌐" : currentSession?.kind === "launch" ? "🎯" : "🚀"}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold truncate text-fg">
                        {currentSession?.title || "Pilih atau Buat Proyek"}
                      </span>
                      <span className="block text-[10px] text-fg-3 truncate">
                        {currentSession?.kind === "website"
                          ? "Website Project"
                          : currentSession?.kind === "launch"
                          ? "Product Launch"
                          : "SaaS / Startup"}
                        {teams.length > 0 ? ` · ${teams.length} divisi` : ""}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-fg-3 shrink-0 transition-transform ${showSessionSelector ? "rotate-180" : ""}`} />
                </button>

                {/* Dropdown List Riwayat */}
                {showSessionSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-canvas border border-line rounded-xl shadow-xl p-1 max-h-60 overflow-y-auto">
                    <div className="px-2 py-1 text-[10px] font-semibold text-fg-3 uppercase tracking-wider border-b border-line/60 flex justify-between items-center">
                      <span>Daftar Riwayat Proyek</span>
                      <span className="text-[9px]">{sessions.length} sesi</span>
                    </div>
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        className={`group flex items-center justify-between gap-1 px-2 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          currentSession?.id === s.id ? "bg-accent/10 text-accent font-medium" : "hover:bg-hover text-fg"
                        }`}
                        onClick={() => {
                          setCurrentSession(s);
                          if (typeof window !== "undefined") {
                            (window as any).__activeVoxProject = s.id;
                          }
                          onSelectProject?.(s.id, s.conversationId);
                          setShowSessionSelector(false);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{s.kind === "website" ? "🌐" : s.kind === "launch" ? "🎯" : "🚀"}</span>
                          <span className="truncate">{s.title}</span>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSessionToDelete(s);
                          }}
                          className="p-1 rounded text-fg-3 hover:text-danger hover:bg-danger/10 opacity-70 group-hover:opacity-100"
                          title="Hapus proyek (reset grup & kontak)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleQuickNewProject}
                      disabled={busy}
                      className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-lg border border-dashed border-line text-xs text-accent hover:bg-hover font-medium disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Mulai Proyek Baru (Bersih)
                    </button>
                  </div>
                )}
              </div>

              {/* Pipeline Tracker Bar */}
              {currentSession && (
                <div className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-hover/40 border border-line/60">
                  <div className="flex items-center justify-between text-[10px] text-fg-3 mb-1">
                    <span className="font-medium">Tahapan Proyek</span>
                    <span className="font-semibold text-accent">
                      {pipelineStageLabels[currentSession.pipelineStage]?.label || "Ideation"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["ideation", "prd", "board_vote", "development", "ready"] as PipelineStage[]).map((st, idx) => {
                      const stages: PipelineStage[] = ["ideation", "prd", "board_vote", "development", "ready"];
                      const currentIdx = stages.indexOf(currentSession.pipelineStage);
                      const isDone = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <div
                          key={st}
                          title={`${pipelineStageLabels[st].label}: ${pipelineStageLabels[st].desc}`}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            isDone ? "bg-emerald-500" : isCurrent ? "bg-accent animate-pulse" : "bg-line"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="mx-3 mb-2 rounded-xl bg-danger-wash px-3 py-2 text-xs text-danger leading-relaxed">
                {error}
                <button
                  onClick={() => {
                    void loadTeams().catch((err: Error) => setError(err.message));
                  }}
                  className="flex items-center gap-1 mt-1.5 underline"
                >
                  <RefreshCw className="w-3 h-3" /> Muat ulang
                </button>
              </div>
            )}

            {/* List Grup & Kontak di dalam Riwayat ini */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 overscroll-contain space-y-3">
              {loading ? (
                <p className="flex items-center justify-center gap-2 px-2 py-8 text-xs text-fg-3">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" /> Memuat grup & kontak...
                </p>
              ) : teams.length === 0 ? (
                <div className="text-center py-6 px-3 bg-hover/30 rounded-2xl border border-line/60 mx-1">
                  <span className="text-2xl block mb-2">💬</span>
                  <p className="text-xs font-semibold text-fg mb-1">
                    Proyek ini masih bersih & kosongan
                  </p>
                  <p className="text-[11px] text-fg-3 leading-relaxed mb-3">
                    Ceritain langsung idemu di ruang chat. AI bakal dengerin dulu dan ngasih rekomendasi divisi yang cocok!
                  </p>
                  <button
                    onClick={() => {
                      onGeneralChat();
                      if (floating) onClose();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-accent text-white font-semibold shadow-sm hover:opacity-90"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Mulai Ngobrol di Chat
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. DEWAN DIREKSI (EXECUTIVE BOARD) */}
                  {execTeam && (
                    <section className="rounded-xl border border-accent/30 bg-accent/5 p-2 shadow-sm">
                      <button
                        onClick={() => openChat({ teamId: execTeam.id })}
                        className={`w-full flex items-center gap-2.5 text-left rounded-lg p-2 transition-colors ${
                          selectedChat?.teamId === execTeam.id && !selectedChat.memberId ? "bg-accent/20" : "hover:bg-accent/10"
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Orbit className="w-4 h-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate text-fg">Dewan Direksi</span>
                            <span className="text-[9px] px-1 rounded bg-accent/20 text-accent font-semibold">Board</span>
                          </div>
                          <span className="block text-[10px] text-fg-3 truncate">
                            Forum Para Ketua · Sidang & Voting Konsensus
                          </span>
                        </div>
                        {execTeam.tasks.some(t => t.status === "running") && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        )}
                      </button>

                      {/* Anggota Dewan Direksi */}
                      <div className="mt-1 pl-2 border-l border-accent/30 space-y-0.5">
                        {execTeam.members.map(person => (
                          <button
                            key={person.id}
                            onClick={() => openChat({ teamId: execTeam.id, memberId: person.id })}
                            className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                              selectedChat?.teamId === execTeam.id && selectedChat.memberId === person.id
                                ? "bg-accent/20 text-fg"
                                : "hover:bg-accent/10 text-fg-3 hover:text-fg"
                            }`}
                          >
                            <MemberAvatar name={person.name} avatar="orbit" className="w-6 h-6 text-[9px]" />
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-medium truncate">{person.name}</span>
                              <span className="block text-[9px] text-fg-4 truncate">{person.role}</span>
                            </div>
                            <StatusDot status={person.status} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 2. DIVISI LAIN (Developer, Founder, Marketing, Kreatif, dll.) */}
                  <div className="space-y-3">
                    {otherTeams.map(team => {
                      const Icon = divisionChoices.find(d => d.kind === team.kind)?.Icon || Users;
                      return (
                        <section key={team.id} className="rounded-xl border border-line bg-canvas p-1.5">
                          {/* Header Tim / Grup */}
                          <button
                            onClick={() => openChat({ teamId: team.id })}
                            className={`w-full flex items-center gap-2.5 text-left rounded-lg p-2 transition-colors ${
                              selectedChat?.teamId === team.id && !selectedChat.memberId ? "bg-accent/10" : "hover:bg-hover"
                            }`}
                          >
                            <span className="w-8 h-8 rounded-lg bg-hover border border-line flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-accent" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-semibold truncate text-fg">{team.name}</span>
                              <span className="block text-[10px] text-fg-3 truncate">
                                Grup · {team.members.length} anggota
                                {team.tasks.some(t => t.status === "running") ? " · Bekerja" : ""}
                              </span>
                            </div>
                            {team.tasks.some(t => t.status === "running") && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                            )}
                          </button>

                          {/* Kontak Anggota di bawah Divisi ini */}
                          <div className="mt-1 pl-2 border-l border-line/70 space-y-0.5">
                            {team.members.map(person => (
                              <button
                                key={person.id}
                                onClick={() => openChat({ teamId: team.id, memberId: person.id })}
                                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                                  selectedChat?.teamId === team.id && selectedChat.memberId === person.id
                                    ? "bg-hover text-fg font-medium"
                                    : "hover:bg-hover/60 text-fg-3 hover:text-fg"
                                }`}
                              >
                                <MemberAvatar name={person.name} avatar={person.avatar} className="w-6 h-6 text-[9px]" />
                                <div className="flex-1 min-w-0">
                                  <span className="block text-xs truncate">{person.name}</span>
                                  <span className="block text-[9px] text-fg-4 truncate">{person.role}</span>
                                </div>
                                <StatusDot status={person.status} />
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                  {/* Tombol Tambah Divisi Manual ke Riwayat Ini */}
                  <div className="pt-1">
                    <button
                      onClick={() => setShowAddDivision(!showAddDivision)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-fg-2 hover:bg-hover hover:text-fg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Divisi Manual</span>
                    </button>

                    {showAddDivision && (
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-hover/40 border border-line">
                          {divisionChoices.map(choice => {
                            const alreadyAdded = teams.some(t => t.kind === choice.kind);
                            return (
                              <button
                                key={choice.kind}
                                disabled={busy || alreadyAdded}
                                onClick={() => handleAddDivision(choice.kind)}
                                className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${
                                  alreadyAdded
                                    ? "border-transparent opacity-40 cursor-not-allowed bg-canvas"
                                    : "border-line bg-canvas hover:border-accent/40 hover:bg-hover"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <choice.Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                                  <span className="text-xs font-medium truncate">{choice.label}</span>
                                </div>
                                <span className="text-[9px] text-fg-4 mt-0.5 line-clamp-1">{choice.desc}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Builder Divisi Kustom Bebas */}
                        <div className="p-3 rounded-xl bg-hover/50 border border-line">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-fg flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-accent" /> Rancang Divisi Kustom Bebas
                            </span>
                            <span className="text-[9px] text-accent font-medium px-1.5 py-0.5 rounded bg-accent/10">Bebas & Fleksibel</span>
                          </div>
                          <form onSubmit={handleGenerateAndAddCustomDivision} className="space-y-2">
                            <input
                              type="text"
                              value={customDivisionPrompt}
                              onChange={(e) => setCustomDivisionPrompt(e.target.value)}
                              placeholder="Ketik divisi apa saja (contoh: Tim Legal OJK, Tim CS, Tim Keamanan Siber)..."
                              className="w-full text-xs rounded-xl border border-line bg-canvas px-3 py-2 outline-none focus:border-accent/50 placeholder:text-fg-4"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={generatingCustom || busy || !customDivisionPrompt.trim()}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all shadow-sm"
                              >
                                {generatingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                <span>{generatingCustom ? "Merancang Struktur..." : "Rancang Struktur AI ✨"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy || !customDivisionPrompt.trim()}
                                onClick={() => handleAddDivision("custom", customDivisionPrompt.trim())}
                                className="px-3 py-2 rounded-xl border border-line bg-canvas hover:bg-hover text-xs text-fg-2 font-medium disabled:opacity-40 transition-all"
                              >
                                Buat Instan
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Keterangan */}
            <div className="border-t border-line px-4 py-2.5 bg-hover/20">
              <p className="text-[10px] text-fg-4 leading-relaxed">
                💡 Menghapus riwayat akan mereset seluruh grup & kontak di dalamnya.
              </p>
            </div>
          </>
        )}
      </aside>

      {/* DIALOG KONFIRMASI HAPUS RIWAYAT PROYEK */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4">
          <div className="bg-canvas border border-line rounded-2xl shadow-2xl w-full max-w-md p-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-danger mb-3">
              <span className="p-2.5 rounded-xl bg-danger-wash">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-fg">Hapus Riwayat Proyek Ini?</h3>
                <p className="text-xs text-fg-3">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-fg-2 leading-relaxed mb-4 bg-hover/40 p-3 rounded-xl border border-line">
              Menghapus proyek <strong>&quot;{sessionToDelete.title}&quot;</strong> akan me-reset dan menghapus seluruh grup, kontak divisi, chat, serta dokumen kerja di dalamnya secara permanen.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-xs rounded-xl border border-line hover:bg-hover text-fg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmDeleteSession}
                className="px-4 py-2 text-xs rounded-xl bg-danger text-white font-medium hover:opacity-90 flex items-center gap-1.5 shadow-sm"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Ya, Hapus & Reset Bersih</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
