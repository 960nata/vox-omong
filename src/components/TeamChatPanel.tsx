"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Loader2, MessageCircle, Pencil, PhoneCall, PhoneOff, Play, Send, Sparkles, Users, Volume2, Vote, X, Paperclip, Folder, FolderOpen, FolderUp, File, FileCode, HardDrive, FileText, Image as ImageIcon, Square } from "lucide-react";
import type { Team, TeamAvatar, TeamSession } from "@/lib/teamTypes";
import { MessageContent } from "./MessageContent";
import { ChatBackground } from "./ChatBackground";
import { NEURAL_VOICES } from "./SettingsModal";
import { avatarPresets, MemberAvatar, pipelineStageLabels, StatusDot, statusLabels, teamRequest } from "./TeamSidebar";
import { connectLocalProject, syncSavedLocalProject, writeAgentChangesToLocalFolder } from "@/lib/browserLocalProject";
import { AGENCY_AGENTS, agencyAgent } from "@/lib/agencyAgents";

interface TeamChatPanelProps {
  teamId: string;
  memberId?: string;
  apiKey?: string;
  projectId?: string;
  onGeneralChat: () => void;
  onSelectMember: (memberId?: string) => void;
  onSpeak: (text: string, voice?: string) => void | Promise<void>;
  onCall?: (voice?: string) => void;
  onStopCall?: () => void;
  isCalling?: boolean;
  liveTranscript?: string;
  callError?: string | null;
  isListening?: boolean;
  isSpeaking?: boolean;
  isProcessing?: boolean;
  onOpenPreview: (url: string) => void;
  onLocalFolderConnected: (selection: { projectId: string; teamId: string; folderName: string; itemCount: number }) => void;
  initialFolder?: { name: string; itemCount: number };
  aiMode?: string;
}

function messageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

export function TeamChatPanel({ teamId, memberId, apiKey, projectId = "default-workspace", onGeneralChat, onSelectMember, onSpeak, onOpenPreview, onLocalFolderConnected, initialFolder, onCall, onStopCall, isCalling = false, liveTranscript = "", callError, isListening = false, isSpeaking = false, isProcessing = false, aiMode }: TeamChatPanelProps) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [groupMode, setGroupMode] = useState<"discuss" | "run">("discuss");
  const [sending, setSending] = useState(false);
  const [pendingContext, setPendingContext] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<TeamAvatar>("initials");
  const [editVoice, setEditVoice] = useState("id-ID-GadisNeural");
  const [editAgencyAgentId, setEditAgencyAgentId] = useState("");
  const [editSkillId, setEditSkillId] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [attachedItem, setAttachedItem] = useState<{
    type: "file" | "folder" | "image";
    name: string;
    size?: number;
    itemCount?: number;
    relativePath?: string;
    files?: Array<{ path: string; size: number }>;
    textSnippet?: string;
    dataUri?: string;
    url?: string;
    isLocalFile?: boolean;
    isProjectFile?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!initialFolder) return;
    setAttachedItem({ type: "folder", name: initialFolder.name, itemCount: initialFolder.itemCount, relativePath: "." });
    setDrafts((previous) => ({ ...previous, group: previous.group || `Tolong baca dan analisis seluruh folder project "${initialFolder.name}" ini. Gunakan file yang benar-benar tersedia.` }));
  }, [initialFolder?.name, initialFolder?.itemCount]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectFileList, setProjectFileList] = useState<{ path: string; size: number }[]>([]);
  const [loadingProjectFiles, setLoadingProjectFiles] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "default-workspace");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [localWriteStatus, setLocalWriteStatus] = useState("");
  const [pendingLocalWrite, setPendingLocalWrite] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const member = team?.members.find(person => person.id === memberId);
  const contextKey = memberId || "group";
  const message = drafts[contextKey] || "";
  const latestTask = team?.tasks.at(-1);
  const running = team?.tasks.some(task => task.status === "running") ?? false;
  const messages = team?.messages.filter(entry => memberId ? entry.channel === "direct" && entry.memberId === memberId : entry.channel !== "direct") || [];
  const editing = editingId === contextKey;
  const [session, setSession] = useState<TeamSession | null>(null);
  const [voting, setVoting] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    if (!projectId || !projectId.startsWith("session-")) return;
    try {
      const res = await fetch(`/api/teams?sessionId=${encodeURIComponent(projectId)}`, { signal, cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.session && !signal?.aborted) setSession(data.session);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSession(controller.signal);
    return () => controller.abort();
  }, [loadSession]);

  const handleTriggerVote = async () => {
    if (!projectId || !projectId.startsWith("session-")) return;
    setVoting(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "board_vote", sessionId: projectId, apiKey, aiMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voting Dewan Direksi gagal");
      if (data.session) setSession(data.session);
      await loadTeam();
      window.dispatchEvent(new CustomEvent("vox_teams_updated"));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVoting(false);
    }
  };

  const handleDispatchSprint = async (target: string = "developer") => {
    if (!projectId || !projectId.startsWith("session-")) return;
    setDispatching(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispatch_sprint", sessionId: projectId, target, apiKey, aiMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal meluncurkan sprint divisi");
      await loadTeam();
      window.dispatchEvent(new CustomEvent("vox_teams_updated"));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDispatching(false);
    }
  };

  const commitTeam = useCallback((next: Team) => {
    setTeam(next);
    window.dispatchEvent(new CustomEvent("vox_teams_updated", { detail: { team: next } }));
  }, []);

  const loadTeam = useCallback(async (signal?: AbortSignal) => {
    const next = await teamRequest({ action: "status", teamId }, signal);
    if (!signal?.aborted) commitTeam(next);
  }, [teamId, commitTeam]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return loadTeam(controller.signal); }).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadTeam]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await loadTeam(controller.signal); }
      catch (err) { if (!controller.signal.aborted) setError((err as Error).message); }
      if (!controller.signal.aborted) timer = setTimeout(poll, running ? 2500 : 4000);
    };
    timer = setTimeout(poll, running ? 2500 : 4000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [running, loadTeam]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = (event: Event) => {
      const next = (event as CustomEvent<{ team?: Team }>).detail?.team;
      if (next) {
        if (next.id === teamId) setTeam(next);
      } else {
        void loadTeam(controller.signal).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); });
      }
    };
    window.addEventListener("vox_teams_updated", refresh);
    return () => { controller.abort(); window.removeEventListener("vox_teams_updated", refresh); };
  }, [teamId, loadTeam]);

  useEffect(() => {
    const handleGlobalOpenFolder = (e: Event) => {
      const customEvt = e as CustomEvent<{ projectId?: string }>;
      const targetId = customEvt.detail?.projectId || projectId || "default-workspace";
      void handleOpenProjectFolder(targetId);
    };
    window.addEventListener("vox:open_project_folder", handleGlobalOpenFolder);
    return () => window.removeEventListener("vox:open_project_folder", handleGlobalOpenFolder);
  }, [projectId]);

  // Otomatis buka preview saat task tim selesai menghasilkan website (tanpa perlu klik manual!)
  const lastOpenedTaskPreviewRef = useRef<string | null>(null);
  useEffect(() => {
    if (latestTask?.previewUrl && latestTask.status === "completed" && lastOpenedTaskPreviewRef.current !== latestTask.id) {
      lastOpenedTaskPreviewRef.current = latestTask.id;
      onOpenPreview(latestTask.previewUrl);
    }
  }, [latestTask?.previewUrl, latestTask?.status, latestTask?.id, onOpenPreview]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [memberId, messages.length, sending]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachMenu]);

  // Preload project files when project changes
  useEffect(() => {
    fetch(`/api/fs?projectId=${encodeURIComponent(projectId || "default-workspace")}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          setProjectFileList(data.files);
        }
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!showAttachMenu) return;
    setLoadingProjectFiles(true);
    fetch(`/api/fs?projectId=${encodeURIComponent(projectId || "default-workspace")}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          setProjectFileList(data.files);
        }
      })
      .catch((err) => console.error("Gagal memuat file proyek:", err))
      .finally(() => setLoadingProjectFiles(false));
  }, [showAttachMenu, projectId]);

  // 1. Handle File Baca Langsung di Lokal (Teks/Kode/Dokumen — TANPA simpan ke folder project)
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      if (isImg) {
        await processImageFile(file);
        return;
      }

      const isBinaryDoc = /\.(pdf|docx|xlsx|xlsm|pptx)$/i.test(file.name);
      if (isBinaryDoc) {
        // Dokumen biner: ekstrak teks via API tanpa simpan ke project
        const fd = new FormData();
        fd.append("file", file);
        fd.append("parseOnly", "true");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Gagal membaca dokumen");
        setAttachedItem({
          type: "file",
          name: file.name,
          size: file.size,
          textSnippet: data.textSnippet || "",
          isLocalFile: true,
        });
      } else {
        // File teks/kode: dibaca 100% lokal oleh browser, 0 latency, tidak masuk folder project!
        const text = await file.text();
        setAttachedItem({
          type: "file",
          name: file.name,
          size: file.size,
          textSnippet: text.slice(0, 15000),
          isLocalFile: true,
        });
      }
    } catch (err: any) {
      setUploadError(err.message || "Gagal membaca file lokal");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // 2. Handle Upload Gambar / Scan UI ("pas upload gambar baru cuy")
  const processImageFile = async (file: File) => {
    setIsUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId || "default-workspace");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal memproses gambar");

      const dataUri = data.dataUri || "";
      const url = data.url || dataUri;
      setAttachedItem({
        type: "image",
        name: file.name,
        size: file.size,
        dataUri,
        url,
      });
    } catch (err: any) {
      setUploadError(err.message || "Gagal memproses gambar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
    e.target.value = "";
  };

  // 3. Buka Seluruh Folder Proyek ke Chat
  const handleOpenProjectFolder = async (targetId?: string) => {
    const pId = targetId || selectedProjectId || projectId || "default-workspace";
    setIsUploading(true);
    setUploadError("");
    setShowAttachMenu(false);
    setShowProjectPicker(false);

    try {
      const res = await fetch(`/api/fs?projectId=${encodeURIComponent(pId)}&readFolder=true`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal membuka folder proyek");

      setAttachedItem({
        type: "folder",
        name: data.projectId || pId,
        itemCount: data.itemCount || (data.files ? data.files.length : 0),
        size: data.size || 0,
        relativePath: ".",
        files: data.files || [],
        textSnippet: data.textSnippet || "",
      });

      setDrafts((prev) => {
        const cur = prev[contextKey] || "";
        if (!cur.trim()) {
          return { ...prev, [contextKey]: `Tolong baca dan analisis seluruh struktur dan kode dalam folder project "${pId}".` };
        }
        return prev;
      });
    } catch (err: any) {
      setUploadError(err.message || "Gagal membuka folder");
    } finally {
      setIsUploading(false);
    }
  };

  // Bind the Mac folder as a new active project, then open the same team kind there.
  const handlePickLocalFolderFromMac = async () => {
    setShowAttachMenu(false);
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        setIsUploading(true);
        if (!team) throw new Error("Tim belum siap. Tunggu sebentar lalu coba lagi.");
        const nextProjectId = await connectLocalProject();
        const response = await fetch(`/api/fs?projectId=${encodeURIComponent(nextProjectId)}&readFolder=true`, { cache: "no-store" });
        const folder = await response.json();
        if (!response.ok || !folder.success) throw new Error(folder.error || "Folder project belum bisa dibaca.");
        const nextTeam = await teamRequest({ action: "create", projectId: nextProjectId, kind: team.kind });
        onLocalFolderConnected({ projectId: nextProjectId, teamId: nextTeam.id, folderName: nextProjectId.slice(6), itemCount: folder.itemCount || 0 });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setUploadError("Gagal memilih folder: " + err.message);
        }
      } finally {
        setIsUploading(false);
      }
    } else {
      openProjectFilePicker();
    }
  };

  // 5. Handle Pilih File dari Workspace Project
  const openProjectFilePicker = async () => {
    setShowAttachMenu(false);
    setShowProjectPicker(true);
    setLoadingProjectFiles(true);
    try {
      const pId = selectedProjectId || projectId || "default-workspace";
      const res = await fetch(`/api/fs?projectId=${encodeURIComponent(pId)}`);
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.files)) setProjectFileList(data.files);
        if (Array.isArray(data.projects)) setAvailableProjects(data.projects);
      }
    } catch (e) {
      console.error("Gagal mengambil file proyek:", e);
    } finally {
      setLoadingProjectFiles(false);
    }
  };

  const selectProjectFile = async (filePath: string) => {
    setShowProjectPicker(false);
    setIsUploading(true);
    try {
      const pId = selectedProjectId || projectId || "default-workspace";
      const res = await fetch(`/api/fs?projectId=${encodeURIComponent(pId)}&filePath=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.success) {
        setAttachedItem({
          type: "file",
          name: filePath,
          size: data.size || (data.content ? data.content.length : 0),
          textSnippet: (data.content || "").slice(0, 15000),
          isProjectFile: true,
        });
      } else {
        setUploadError(data.error || "Gagal membaca file proyek");
      }
    } catch (err: any) {
      setUploadError(err.message || "Gagal membaca file proyek");
    } finally {
      setIsUploading(false);
    }
  };

  // 6. Buka Folder Project Langsung di Mac (Finder) tanpa browser upload
  const openProjectFolderInMac = async () => {
    setShowAttachMenu(false);
    try {
      await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_finder", projectId: projectId || "default-workspace" }),
      });
    } catch (err: any) {
      setUploadError(err.message || "Gagal membuka folder di Mac");
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError("");
    try {
      const paths = Array.from(files).map((f) => f.webkitRelativePath || f.name);
      const fd = new FormData();
      fd.append("projectId", projectId || "default-workspace");
      fd.append("uploadType", "folder");
      fd.append("paths", JSON.stringify(paths));
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal mengunggah folder");
      setAttachedItem({
        type: "folder",
        name: data.name,
        size: data.size,
        itemCount: data.itemCount,
        relativePath: data.relativePath,
        files: data.files,
        textSnippet: data.textSnippet,
      });
    } catch (err: any) {
      setUploadError(err.message || "Gagal mengunggah folder");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!team || (!message.trim() && !attachedItem) || sending) return;

    // Fitur Rem Darurat via Chat: jika sedang jalan dan user ketik kata kunci stop/berhenti/batal
    const isStopCommand = /\b(stop|berhenti|batal|cancel|cukup|tahan|hentikan|udahan)\b/i.test(message.trim());
    if (running && isStopCommand) {
      setDrafts((prev) => ({ ...prev, [contextKey]: "" }));
      await stopTask();
      return;
    }

    if ((!memberId && running) || (memberId && !member)) return;
    const target = contextKey;
    setSending(true); setPendingContext(target); setError(null);
    try {
      await syncSavedLocalProject(projectId);
      let finalMsg = message.trim();
      if (attachedItem) {
        if (attachedItem.type === "image" || attachedItem.dataUri) {
          finalMsg = `${finalMsg ? `${finalMsg}\n\n` : ""}[USER LAMPIRKAN GAMBAR / UI]: "${attachedItem.name}" (Analisis gambar ini dengan kapabilitas Vision)`;
        } else if (attachedItem.type === "folder") {
          finalMsg = `${finalMsg ? `${finalMsg}\n\n` : ""}[LAMPIRAN FOLDER PROYEK: "${attachedItem.name}" (${attachedItem.itemCount || 0} file)]\n[PATH FOLDER PROJECT: ${attachedItem.relativePath || "."}]`;
        } else if (attachedItem.isLocalFile) {
          finalMsg = `${finalMsg ? `${finalMsg}\n\n` : ""}[FILE LOKAL DIBACA: "${attachedItem.name}" (${attachedItem.size || 0}B)] — File ini dibaca langsung dari komputer lokal pengguna tanpa di-upload ke project.\nIsi file:\n${attachedItem.textSnippet || ""}`;
        } else {
          finalMsg = `${finalMsg ? `${finalMsg}\n\n` : ""}[FILE PROYEK: "${attachedItem.name}" (${attachedItem.size || 0}B)] dari workspace project ${projectId}.\nIsi file:\n${attachedItem.textSnippet || ""}`;
        }
      }
      const next = await teamRequest({
        action: memberId ? "chat_member" : groupMode,
        teamId,
        ...(memberId ? { memberId } : {}),
        message: finalMsg,
        apiKey: apiKey && apiKey.trim() ? apiKey.trim() : undefined,
        aiMode,
      });
      commitTeam(next);
      const changedFiles = next.messages.at(-1)?.changedFiles;
      if (projectId.startsWith("local-") && changedFiles?.length) {
        try {
          const applied = await writeAgentChangesToLocalFolder(projectId, changedFiles);
          if (applied.needsPermission) {
            setPendingLocalWrite(changedFiles);
            setLocalWriteStatus("Hasil edit ada di project VOX. Beri izin tulis untuk menyimpannya ke folder Mac.");
          } else {
            setPendingLocalWrite(null);
            setLocalWriteStatus(applied.conflicts.length
              ? `${applied.written.length} file tersimpan. ${applied.conflicts.length} file asli berubah; periksa manual sebelum menimpa.`
              : `${applied.written.length} file hasil agen tersimpan ke folder Mac.`);
          }
        } catch (error) {
          setPendingLocalWrite(changedFiles);
          setLocalWriteStatus(`Belum tersimpan ke folder Mac: ${(error as Error).message}`);
        }
      }
      setDrafts(previous => ({ ...previous, [target]: "" }));
      setAttachedItem(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSending(false); setPendingContext(null); }
  };

  const editProfile = () => {
    if (!team) return;
    setEditName(member?.name || team.name);
    setEditAvatar(member?.avatar || "initials");
    setEditVoice(member?.voice || "id-ID-GadisNeural");
    setEditAgencyAgentId(member?.agencyAgentId || "");
    setEditSkillId(member?.skillId || "");
    setEditingId(editing ? null : contextKey);
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!team || saving || !editName.trim()) return;
    setSaving(true); setError(null);
    try {
      const next = await teamRequest({ action: memberId ? "update_member" : "update_team", teamId, ...(memberId ? { memberId, avatar: editAvatar, voice: editVoice, agencyAgentId: editAgencyAgentId, skillId: editSkillId } : {}), name: editName.trim() });
      commitTeam(next); setEditingId(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const hearProgress = async () => {
    if (reading) return;
    setReading(true); setError(null);
    try {
      const fresh = await teamRequest({ action: "status", teamId });
      commitTeam(fresh);
      const person = fresh.members.find(item => item.id === memberId);
      const task = fresh.tasks.at(-1);
      const text = person ? `${person.name}, ${person.role}. Status: ${statusLabels[person.status]}. ${person.report || "Belum ada laporan pekerjaan."}` : `${fresh.name}. ${task ? `Tugas terakhir: ${task.message}. Status: ${statusLabels[task.status]}. ${task.error || task.result || fresh.members.filter(item => item.status === "working").map(item => `${item.name} sedang bekerja sebagai ${item.role}`).join(". ") || "Tim sedang menyiapkan laporan."}` : "Belum ada tugas. Tim siap menerima arahan."}`;
      await onSpeak(text.slice(0, 4000), person?.voice || fresh.members.find(item => item.id === fresh.leaderId)?.voice);
    } catch (err) { setError((err as Error).message); }
    finally { setReading(false); }
  };

  const previewVoice = async () => {
    if (reading) return;
    setReading(true); setError(null);
    try { await onSpeak(`Halo, aku ${editName || member?.name || "asistenmu"}. Aku siap membantu dan melaporkan perkembangan pekerjaan.`, editVoice); }
    catch (err) { setError((err as Error).message); }
    finally { setReading(false); }
  };

  const hearMessage = async (text: string, voice?: string) => {
    if (reading) return;
    setReading(true); setError(null);
    try { await onSpeak(text, voice); }
    catch (err) { setError((err as Error).message); }
    finally { setReading(false); }
  };

  const mention = (name: string) => {
    setDrafts(previous => ({ ...previous, group: `${previous.group || ""}${previous.group?.endsWith(" ") || !previous.group ? "" : " "}@${name} ` }));
    composerRef.current?.focus();
  };

  const stopTask = async () => {
    if (!team) return;
    try {
      const next = await teamRequest({ action: "stop", teamId });
      commitTeam(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center gap-3 text-sm text-fg-3"><Loader2 className="w-5 h-5 animate-spin" />Membuka percakapan…</div>;
  if (!team) return <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-sm text-danger">{error || "Percakapan belum tersedia."}</p><button onClick={onGeneralChat} className="text-sm text-accent underline">Kembali ke Chat umum</button></div>;
  if (memberId && !member) return <div className="p-6 text-sm text-fg-3">Kontak tidak ditemukan. <button onClick={() => onSelectMember()} className="text-accent underline">Buka grup</button></div>;

  return <section className="relative isolate z-10 flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-canvas" aria-label={member ? `Percakapan pribadi ${member.name}` : `Percakapan grup ${team.name}`}>
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true"><ChatBackground isListening={isListening} isSpeaking={isSpeaking || reading} isProcessing={isProcessing || sending || running} /></div>
    <header className="relative z-10 shrink-0 border-b border-line bg-canvas/85 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <button onClick={onGeneralChat} className="icon-btn shrink-0" title="Chat umum" aria-label="Kembali ke Chat umum"><ArrowLeft className="w-4 h-4" /></button>
        {member ? <MemberAvatar name={member.name} avatar={member.avatar} className="!w-10 !h-10 !text-sm" /> : <span className="w-10 h-10 rounded-xl bg-accent/10 shrink-0 grid place-items-center"><Users className="w-5 h-5 text-accent" /></span>}
        <div className="min-w-0"><h2 className="text-sm sm:text-base font-semibold tracking-tight truncate">{member?.name || team.name}</h2><p className="text-[11px] text-fg-3 mt-0.5 truncate">{member ? `${member.role}${agencyAgent(member.agencyAgentId) ? ` · Agency: ${agencyAgent(member.agencyAgentId)!.name}` : ""}${member.skillId ? ` · Skill: ${member.skillId}` : ""} · Chat pribadi` : `Grup · ${team.members.length} anggota${running ? " · Sedang bekerja" : ""}`}</p></div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {running && (
          <button
            onClick={stopTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 rounded-full text-xs font-semibold transition-colors animate-pulse"
            title="Hentikan tugas tim sekarang"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Hentikan Tim</span>
          </button>
        )}
        <button onClick={editProfile} className="icon-btn" aria-label={member ? `Ubah profil ${member.name}` : "Ubah nama grup"} aria-expanded={editing} title={member ? "Ubah nama dan avatar" : "Ubah nama grup"}><Pencil className="w-4 h-4" /></button>
        <button onClick={hearProgress} disabled={reading} className="flex items-center gap-2 border border-line rounded-full p-2 sm:px-3 hover:bg-hover text-xs disabled:opacity-40" aria-label="Dengar progres lewat suara" title="Dengar laporan terbaru lewat suara aplikasi">{reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4 text-accent" />}<span className="hidden sm:inline">Dengar progres</span></button>
        {member && onCall && <button onClick={() => isCalling ? onStopCall?.() : onCall(member.voice)} className={`flex items-center justify-center w-9 h-9 rounded-full ${isCalling ? "bg-danger text-white" : "bg-accent text-white"}`} aria-label={isCalling ? `Akhiri panggilan ${member.name}` : `Telepon ${member.name}`} title={isCalling ? "Akhiri panggilan suara di aplikasi" : `Telepon ${member.name} lewat suara aplikasi`}>{isCalling ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}</button>}
      </div>
    </header>

    {session && (
      <div className="relative z-10 shrink-0 border-b border-line bg-hover/30 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">
            {session.kind === "website" ? "🌐" : session.kind === "launch" ? "🎯" : "🚀"}
          </span>
          <span className="font-semibold text-fg truncate">{session.title}</span>
          <span className="text-fg-4">·</span>
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium text-[11px] flex items-center gap-1">
            <span>{pipelineStageLabels[session.pipelineStage]?.icon || "💡"}</span>
            <span>{pipelineStageLabels[session.pipelineStage]?.label || session.pipelineStage}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {team.kind === "executive" && (
            <button
              type="button"
              disabled={voting || running}
              onClick={handleTriggerVote}
              className="flex items-center gap-1.5 px-3 py-1 bg-accent text-white rounded-full text-xs font-semibold hover:opacity-90 disabled:opacity-50 shadow-sm transition-all"
              title="Kumpulkan suara ketua divisi untuk persetujuan PRD/eksekusi"
            >
              {voting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Vote className="w-3.5 h-3.5" />}
              <span>{voting ? "Sidang Berlangsung..." : "Mulai Sidang Voting Direksi"}</span>
            </button>
          )}
          {session.pipelineStage === "board_vote" && team.kind !== "executive" && (
            <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
              <span>🗳️</span> Menunggu Sidang Dewan Direksi
            </span>
          )}
          {session.pipelineStage === "development" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                <span>✅</span> Disetujui Direksi (Tahap Dev)
              </span>
              {team.kind === "executive" && (
                <button
                  type="button"
                  disabled={dispatching || running}
                  onClick={() => handleDispatchSprint("developer")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  title="Tugaskan Tim Developer langsung memulai sprint PRD"
                >
                  {dispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>🚀 Mulai Sprint Dev</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}

    {editing && <form onSubmit={saveProfile} className="relative z-10 shrink-0 border-b border-line bg-hover/30 backdrop-blur-sm px-4 sm:px-6 py-4">
      <div className="mx-auto max-w-3xl"><div className="flex justify-between items-center mb-2"><label htmlFor="team-contact-name" className="text-xs font-medium">{member ? "Nama dan avatar kontak" : "Nama grup"}</label><button type="button" onClick={() => setEditingId(null)} aria-label="Tutup pengaturan kontak" className="text-fg-3"><X className="w-4 h-4" /></button></div>
      <div className="flex gap-2"><input id="team-contact-name" value={editName} onChange={event => setEditName(event.target.value)} required maxLength={60} className="flex-1 min-w-0 rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent/50" /><button disabled={saving || !editName.trim()} className="flex items-center gap-1.5 rounded-xl bg-fg text-canvas px-3 text-xs disabled:opacity-40">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Simpan</button></div>
      {member && <fieldset className="mt-3"><legend className="sr-only">Avatar kontak</legend><div className="flex flex-wrap gap-2">{avatarPresets.map(preset => <button key={preset.id} type="button" onClick={() => setEditAvatar(preset.id)} aria-label={`Avatar ${preset.label}`} aria-pressed={editAvatar === preset.id} title={preset.label} className={`rounded-full p-0.5 border ${editAvatar === preset.id ? "border-accent bg-accent/10" : "border-transparent"}`}><MemberAvatar name={editName || member.name} avatar={preset.id} /></button>)}</div></fieldset>}
      {member && <div className="mt-3"><label htmlFor="team-contact-voice" className="block mb-1.5 text-xs font-medium">Suara {member.name}</label><div className="flex gap-2"><select id="team-contact-voice" value={editVoice} onChange={event => setEditVoice(event.target.value)} className="flex-1 min-w-0 rounded-xl border border-line bg-canvas px-3 py-2 text-xs outline-none focus:border-accent/50">{NEURAL_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select><button type="button" onClick={previewVoice} disabled={reading} className="shrink-0 rounded-xl border border-line px-3 text-xs hover:bg-hover disabled:opacity-40" aria-label="Coba suara kontak"><Volume2 className="w-4 h-4" /></button></div></div>}
      {member && <div className="mt-3"><label htmlFor="team-contact-agency" className="block mb-1.5 text-xs font-medium">Keahlian Agency Agents</label><select id="team-contact-agency" value={editAgencyAgentId} onChange={event => setEditAgencyAgentId(event.target.value)} disabled={running} className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-xs outline-none focus:border-accent/50 disabled:opacity-50"><option value="">Tanpa profil Agency</option>{AGENCY_AGENTS.filter(agent => agent.kind === team.kind).map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><p className="mt-1.5 text-[10px] text-fg-4">Panduan kerja agen dipakai saat chat dan tugas berikutnya.{running ? " Tunggu tugas berjalan selesai untuk mengganti profil." : ""}</p>{agencyAgent(editAgencyAgentId) && <a href={`https://github.com/msitarzewski/agency-agents/blob/main/${agencyAgent(editAgencyAgentId)!.source}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-accent underline">Lihat sumber profil</a>}</div>}
      {member && <div className="mt-3"><label htmlFor="team-contact-skill" className="block mb-1.5 text-xs font-medium">Keahlian Khusus (Skill ID)</label><input id="team-contact-skill" value={editSkillId} onChange={event => setEditSkillId(event.target.value)} placeholder="Contoh: founder-skills, academic-research, trading-skills, career-ops, hyperframes" className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-xs outline-none focus:border-accent/50" /><p className="mt-1 text-[10px] text-fg-4">Skill yang diprioritaskan untuk anggota ini saat menjalankan riset dan tugas tim.</p></div>}
      <p className="text-[10px] text-fg-4 mt-2">Perubahan profil disimpan tanpa panggilan AI.</p></div>
    </form>}

    {!member && <div className="relative z-10 shrink-0 border-b border-line px-4 sm:px-6 py-2.5">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">{team.members.map(person => <button key={person.id} onClick={() => onSelectMember(person.id)} className="flex items-center gap-1.5 shrink-0 rounded-full hover:bg-hover pr-2 py-0.5" title={`Chat pribadi: ${person.name}, ${person.role}`}><MemberAvatar name={person.name} avatar={person.avatar} className="!w-6 !h-6 !text-[8px]" /><span className="text-[11px] text-fg-3">{person.name}</span></button>)}</div><button onClick={() => setMembersOpen(!membersOpen)} className="text-fg-3 shrink-0 p-1.5" aria-label="Lihat anggota dan peran" aria-expanded={membersOpen}><ChevronDown className={`w-4 h-4 transition-transform ${membersOpen ? "rotate-180" : ""}`} /></button></div>
      {membersOpen && <div className="grid sm:grid-cols-2 gap-2 py-3 max-h-56 overflow-y-auto">{team.members.map(person => <button key={person.id} onClick={() => onSelectMember(person.id)} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left hover:bg-hover"><MemberAvatar name={person.name} avatar={person.avatar} /><span className="flex-1 min-w-0"><span className="block text-xs font-medium">{person.name}{person.id === team.leaderId && <span className="text-accent ml-1.5 text-[10px]">Ketua</span>}</span><span className="block text-[10px] text-fg-3">{person.role}</span>{person.model && <span className="block text-[9px] text-fg-4 font-mono truncate">{person.model}</span>}</span><StatusDot status={person.status} /></button>)}</div>}
    </div>}
    {member && <div className="relative z-10 shrink-0 px-4 sm:px-6 py-2 border-b border-line flex items-center justify-between gap-3 text-[11px] text-fg-3"><button onClick={() => onSelectMember()} className="flex items-center gap-1.5 hover:text-fg"><Users className="w-3.5 h-3.5" />Kembali ke {team.name}</button>{member.model && <span className="font-mono text-[9px] max-w-[45%] truncate" title={member.model}>{member.model}</span>}</div>}

    {member && isCalling && <div className="relative z-10 shrink-0 border-b border-accent/20 bg-accent/5 px-4 sm:px-6 py-3" role="status" aria-live="polite"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-accent animate-pulse" />Panggilan suara di aplikasi · {member.name}</p><button onClick={onStopCall} className="rounded-full bg-danger-wash px-3 py-1.5 text-xs text-danger">Akhiri</button></div><p className="mt-2 text-xs text-fg-3 leading-relaxed">{liveTranscript || `Bicara untuk mengirim pesan suara ke ${member.name}.`}</p></div>}
    {member && callError && <div role="alert" className="relative z-10 shrink-0 border-b border-danger/20 bg-danger-wash px-4 sm:px-6 py-3 text-xs text-danger">{callError}</div>}

    {error && <div role="alert" className="relative z-10 mx-4 sm:mx-6 mt-3 flex items-start justify-between gap-3 rounded-xl border border-danger/25 bg-danger-wash px-4 py-3 text-xs text-danger"><p>{error}</p><button onClick={() => setError(null)} aria-label="Tutup pesan error"><X className="w-3.5 h-3.5" /></button></div>}
    <div ref={scrollRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto w-full space-y-5" role="log" aria-label={member ? `Pesan pribadi ${member.name}` : "Pesan grup"} aria-live="polite">
        {!member && session?.pipelineStage === "development" && team.kind !== "executive" && (
          <div className="p-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in mb-3">
            <div className="text-left">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Mandat Resmi Dewan Direksi Siap Dieksekusi
              </span>
              <p className="text-[11px] text-fg-3 mt-0.5">
                PRD disetujui konsensus. Tekan tombol untuk langsung memulai tugas {team.name.split("-")[0].trim()} tanpa perlu ketik manual.
              </p>
            </div>
            <button
              type="button"
              disabled={running || dispatching}
              onClick={() => handleDispatchSprint(team.kind)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {dispatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              <span>Eksekusi Sprint {team.name.split("-")[0].trim()} 🚀</span>
            </button>
          </div>
        )}
        {messages.length === 0 && <div className="min-h-52 flex flex-col justify-center items-center text-center px-3 py-8"><span className="w-14 h-14 mb-4 grid place-items-center rounded-2xl bg-accent/10 text-accent">{member ? <MessageCircle className="w-6 h-6" /> : <Users className="w-6 h-6" />}</span><h3 className="text-lg font-medium">{member ? `Ngobrol dengan ${member.name}` : `Selamat datang di ${team.name}`}</h3><p className="mt-2 text-sm text-fg-3 leading-relaxed max-w-md">{member ? `${member.name} membantu sebagai ${member.role}. Tanya langsung di sini; satu AI menjawab pesan pribadimu.` : "Satu ruang untuk diskusi, membagi pekerjaan, dan laporan tim. Pilih Rapat untuk berdiskusi atau Kerjakan untuk mulai membuat hasil."}</p></div>}
        {messages.map(entry => {
          const isUser = entry.role === "user" || entry.memberId === "user";
          const author = isUser ? undefined : team.members.find(person => person.id === entry.memberId);
          if (entry.memberId === "system") return <div key={entry.id} className="text-center text-[11px] text-fg-4 py-1"><span className="font-medium">Aktivitas</span> · {entry.content}<time className="ml-2 text-[10px]">{messageTime(entry.createdAt)}</time></div>;
          const name = isUser ? "Kamu" : author?.name || "Tim";
          return <article key={entry.id} className={`flex items-end gap-2.5 sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
            <MemberAvatar name={name} avatar={author?.avatar} className={isUser ? "!bg-accent/10" : ""} />
            <div className={`max-w-[88%] sm:max-w-[82%] min-w-0 ${isUser ? "items-end" : "items-start"} flex flex-col`}><div className="flex items-center gap-2 mb-1.5 px-1"><span className="text-[11px] font-medium text-fg-2">{name}</span>{author && <span className="text-[10px] text-fg-4 hidden sm:inline">{author.role}</span>}<time className="text-[10px] text-fg-4">{messageTime(entry.createdAt)}</time>{!isUser && <button type="button" onClick={() => hearMessage(entry.content, author?.voice)} disabled={reading} className="text-fg-4 hover:text-accent disabled:opacity-40" aria-label={`Dengarkan pesan ${name}`} title={`Dengar dengan suara ${name}`}><Volume2 className="w-3.5 h-3.5" /></button>}</div><div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] max-w-full ${isUser ? "bg-accent/10 rounded-br-md" : "bg-hover/60 border border-line rounded-bl-md"}`}><MessageContent content={entry.content} /></div></div>
          </article>;
        })}
        {sending && pendingContext === contextKey && <div className="flex items-center gap-2.5 text-xs text-fg-3 px-1"><Loader2 className="w-4 h-4 animate-spin" />{member ? `${member.name} sedang menjawab…` : "Mengirim pesan ke grup…"}</div>}
        {!member && running && <div className="flex items-center gap-2.5 text-xs text-fg-3 rounded-xl bg-hover/50 p-3"><Loader2 className="w-4 h-4 animate-spin text-accent" /><span>{latestTask?.mode === "discuss" ? "Rapat sedang berlangsung. Tanggapan anggota muncul di percakapan ini." : "Tim sedang bekerja. Laporan tiap peran muncul di percakapan ini."}</span></div>}
        {!member && latestTask?.previewUrl && <button onClick={() => onOpenPreview(latestTask.previewUrl!)} className="rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-xs text-accent">Buka hasil pekerjaan</button>}
        {member && member.report && <details className="rounded-xl border border-line px-4 py-3"><summary className="text-xs cursor-pointer text-fg-3">Laporan pekerjaan {member.name}</summary><div className="mt-3 text-sm text-fg-3"><MessageContent content={member.report} /></div></details>}
      </div>
    </div>

    {localWriteStatus && <div className="px-4 py-2 text-xs text-fg-3" role="status">{localWriteStatus}{pendingLocalWrite && <button type="button" className="ml-3 rounded-lg border border-line px-3 py-1" onClick={async () => {
      try {
        const applied = await writeAgentChangesToLocalFolder(projectId, pendingLocalWrite, true);
        if (applied.needsPermission) { setLocalWriteStatus("Izin tulis belum diberikan. Hasil edit tetap aman di project VOX."); return; }
        setPendingLocalWrite(null);
        setLocalWriteStatus(applied.conflicts.length ? `${applied.written.length} file tersimpan; ${applied.conflicts.length} file perlu diperiksa manual.` : `${applied.written.length} file tersimpan ke folder Mac.`);
      } catch (error) { setLocalWriteStatus(`Belum tersimpan ke folder Mac: ${(error as Error).message}`); }
    }}>Simpan ke folder Mac</button>}</div>}
    <form onSubmit={sendMessage} className="relative z-10 shrink-0 border-t border-line bg-canvas/70 backdrop-blur-sm px-4 sm:px-6 pt-3 pb-4">
      {/* Hidden File and Image Inputs (tanpa input upload folder) */}
      <input ref={fileInputRef} type="file" multiple onChange={handleLocalFileSelect} className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

      <div className="max-w-3xl mx-auto">
        {/* Attachment preview chip if item attached */}
        {attachedItem && (
          <div className="mb-2 p-2 rounded-xl border border-line bg-raised flex items-center justify-between gap-2 text-xs animate-rise">
            <div className="flex items-center gap-2 min-w-0">
              {attachedItem.dataUri ? (
                <img
                  src={attachedItem.dataUri}
                  alt={attachedItem.name}
                  className="w-8 h-8 rounded-lg border border-line object-cover shrink-0"
                />
              ) : attachedItem.type === "folder" ? (
                <span className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shrink-0">
                  <Folder className="w-4 h-4" />
                </span>
              ) : attachedItem.isLocalFile ? (
                <span className="w-8 h-8 rounded-lg bg-base border border-line text-lagoon flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </span>
              ) : (
                <span className="w-8 h-8 rounded-lg bg-base border border-line text-moss flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4" />
                </span>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-xs text-fg truncate">{attachedItem.name}</div>
                <div className="text-[10px] text-fg-3 flex items-center gap-1.5 font-mono">
                  {attachedItem.type === "folder" ? (
                    <span className="text-accent">{attachedItem.itemCount || 0} file</span>
                  ) : (
                    <span>{typeof attachedItem.size === "number" ? (attachedItem.size > 1024 ? `${(attachedItem.size / 1024).toFixed(1)} KB` : `${attachedItem.size} B`) : "File"}</span>
                  )}
                  <span>•</span>
                  <span className="text-fg-3 flex items-center gap-0.5">
                    {attachedItem.isLocalFile ? (
                      <span className="text-lagoon font-sans font-medium">File Lokal (Langsung Dibaca)</span>
                    ) : attachedItem.dataUri ? (
                      <span className="text-accent font-sans font-medium">Gambar Scan AI</span>
                    ) : (
                      <span className="text-moss font-sans font-medium"><HardDrive className="w-2.5 h-2.5 inline" /> {projectId}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedItem(null)}
              className="p-1 hover:bg-danger-wash text-fg-3 hover:text-danger rounded-lg transition-colors cursor-pointer"
              title="Hapus lampiran"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload error banner */}
        {uploadError && (
          <div className="mb-2 px-3 py-1.5 bg-danger-wash border border-danger/40 rounded-xl text-danger text-xs flex items-center justify-between animate-rise">
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError("")} className="p-0.5 hover:text-fg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!memberId && <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5"><div className="flex gap-1 rounded-full bg-hover/70 p-1" aria-label="Mode percakapan grup">{([{ value: "discuss", label: "Rapat" }, { value: "run", label: "Kerjakan" }] as const).map(mode => <button key={mode.value} type="button" onClick={() => setGroupMode(mode.value)} aria-pressed={groupMode === mode.value} className={`rounded-full px-4 py-1.5 text-xs ${groupMode === mode.value ? "bg-canvas text-fg shadow-sm" : "text-fg-3"}`}>{mode.label}</button>)}</div><span className="text-[10px] text-fg-4">{groupMode === "discuss" ? "Diskusi dan keputusan bersama" : "Bagi tugas dan buat hasil"}</span></div>}
        {!memberId && groupMode === "discuss" && <div className="flex items-center gap-1.5 overflow-x-auto mb-2.5 pb-0.5"><span className="text-[10px] text-fg-4 shrink-0">Panggil</span><button type="button" onClick={() => mention("everyone")} className="text-[10px] px-2 py-1 rounded-full border border-line hover:bg-hover shrink-0">@semua</button>{team.members.map(person => <button key={person.id} type="button" onClick={() => mention(person.name)} className="text-[10px] px-2 py-1 rounded-full border border-line hover:bg-hover shrink-0">@{person.name}</button>)}</div>}
        <label htmlFor="team-message" className="sr-only">{member ? `Pesan untuk ${member.name}` : `Pesan ke grup ${team.name}`}</label>
        
        <div className="flex items-end gap-2 rounded-2xl border border-line hover:border-line-strong focus-within:border-line-strong bg-hover/30 px-3 py-2 transition-colors">
          {/* Tombol Paperclip Lampirkan File / Folder */}
          <div className="relative mb-0.5 shrink-0" ref={attachMenuRef}>
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              disabled={sending || isUploading}
              title="Lampirkan File atau Folder Proyek ke Sandbox"
              className={`flex h-9 w-9 items-center justify-center rounded-xl hover:bg-hover text-fg-3 hover:text-fg transition-colors cursor-pointer ${showAttachMenu || attachedItem ? "text-accent bg-accent/10" : ""}`}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            {/* Menu Dropdown Lampiran */}
            {showAttachMenu && (
              <div className="chat-in absolute bottom-full left-0 mb-2 w-80 bg-raised border border-line-strong rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-fg-4 border-b border-line flex items-center justify-between">
                  <span>Folder Proyek Sandbox</span>
                  <span className="text-[9px] text-accent font-sans font-medium">{selectedProjectId || projectId}</span>
                </div>

                {/* Tombol Utama: BUKA SELURUH FOLDER PROYEK */}
                <button
                  type="button"
                  onClick={() => handleOpenProjectFolder(selectedProjectId || projectId)}
                  className="w-full text-left p-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent text-on-accent flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-fg flex items-center gap-1.5">
                        <span>Buka Folder Proyek</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent/20 text-accent font-mono">1 Proyek</span>
                      </div>
                      <div className="text-[10px] text-fg-3 truncate">
                        Baca seluruh struktur & kode ({selectedProjectId || projectId})
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-accent px-2.5 py-1 bg-accent/15 group-hover:bg-accent group-hover:text-on-accent rounded-lg shrink-0 transition-colors">
                    Buka
                  </span>
                </button>

                {/* Daftar File Proyek Lokal — Klik Langsung Terpilih! */}
                <div className="max-h-40 overflow-y-auto p-1 space-y-0.5 [scrollbar-width:thin] border-t border-line/60 pt-1">
                  <div className="px-1.5 pb-1 text-[10px] text-fg-4 flex items-center justify-between">
                    <span>Atau pilih file spesifik:</span>
                    <button
                      type="button"
                      onClick={openProjectFilePicker}
                      className="text-accent hover:underline text-[10px]"
                    >
                      Lihat semua
                    </button>
                  </div>
                  {loadingProjectFiles ? (
                    <div className="py-2 text-center text-xs text-fg-3 flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> Memuat file...
                    </div>
                  ) : projectFileList.length === 0 ? (
                    <div className="py-2 text-center text-[11px] text-fg-4">
                      Belum ada file di proyek ini.
                    </div>
                  ) : (
                    projectFileList
                      .filter((f) => !f.path.startsWith("."))
                      .slice(0, 8)
                      .map((file, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setShowAttachMenu(false);
                            selectProjectFile(file.path);
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode className="w-3.5 h-3.5 text-lagoon shrink-0" />
                            <span className="font-mono text-fg text-xs truncate group-hover:text-accent font-medium">
                              {file.path}
                            </span>
                          </div>
                          <span className="text-[9px] text-fg-4 shrink-0 font-mono">
                            {file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}
                          </span>
                        </button>
                      ))
                  )}
                </div>

                {/* Sumber Tambahan */}
                <div className="border-t border-line pt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={openProjectFilePicker}
                    className="w-full text-left px-2 py-1.5 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <HardDrive className="w-3 h-3" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-fg text-[11px] flex items-center justify-between">
                        <span>Pilih & Ganti Folder Proyek...</span>
                        <span className="text-[10px] text-accent font-semibold">Buka</span>
                      </div>
                      <div className="text-[9px] text-fg-4">Buka folder proyek lain di workspace</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handlePickLocalFolderFromMac}
                    className="w-full text-left px-2 py-1.5 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-md bg-base border border-line flex items-center justify-center text-lagoon shrink-0">
                      <Folder className="w-3 h-3" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-fg text-[11px] flex items-center justify-between">
                        <span>Buka Folder dari Komputer (Lokal)</span>
                        <span className="text-[10px] text-lagoon font-semibold">Buka</span>
                      </div>
                      <div className="text-[9px] text-fg-4">Jadikan project aktif dan hubungkan ke tim</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      imageInputRef.current?.click();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <ImageIcon className="w-3 h-3" />
                    </span>
                    <div>
                      <div className="font-semibold text-fg text-[11px]">Pindai Foto / Mockup UI</div>
                      <div className="text-[9px] text-fg-4">Scan screenshot atau gambar desain dengan AI</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-md bg-base border border-line flex items-center justify-center text-fg-3 shrink-0">
                      <FileText className="w-3 h-3" />
                    </span>
                    <div>
                      <div className="font-semibold text-fg text-[11px]">Buka File dari Komputer</div>
                      <div className="text-[9px] text-fg-4">Baca dokumen atau kode dari Mac</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={openProjectFolderInMac}
                    className="w-full text-left px-2 py-1.5 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="w-6 h-6 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <FolderOpen className="w-3 h-3" />
                    </span>
                    <div>
                      <div className="font-semibold text-fg text-[11px]">Buka Folder di Finder Mac</div>
                      <div className="text-[9px] text-fg-4">Buka folder di desktop Mac tanpa upload</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <textarea
            ref={composerRef}
            id="team-message"
            value={message}
            onChange={event => { const value = event.target.value; setDrafts(previous => ({ ...previous, [contextKey]: value })); }}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
            onPaste={e => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith("image/")) {
                  const f = items[i].getAsFile();
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = async evt => {
                      const dataUri = evt.target?.result as string;
                      setAttachedItem({ type: "image", name: `clipboard-${Date.now()}.png`, dataUri });
                    };
                    reader.readAsDataURL(f);
                    break;
                  }
                }
              }
            }}
            maxLength={memberId ? 6000 : 12000}
            placeholder={
              running
                ? "Tim sedang bekerja... Ketik 'stop' atau tekan Enter untuk membatalkan tim di tengah jalan…"
                : attachedItem
                ? `Ketik instruksi untuk ${attachedItem.type === "folder" ? "folder" : attachedItem.type === "image" ? "gambar" : "file"} ini…`
                : member
                ? `Kirim pesan ke ${member.name}…`
                : groupMode === "discuss"
                ? "Tulis topik rapat, atau @nama untuk memanggil anggota…"
                : "Apa yang harus dikerjakan tim ini?"
            }
            rows={2}
            className="flex-1 min-w-0 resize-none bg-transparent px-1 py-1.5 text-sm leading-relaxed outline-none focus:outline-none focus:ring-0 border-none shadow-none placeholder:text-fg-4"
          />

          {(() => {
            const isStop = running && /\b(stop|berhenti|batal|cancel|cukup|tahan|hentikan|udahan)\b/i.test(message.trim());
            return (
              <button
                type="submit"
                disabled={sending || saving || (!memberId && running && !isStop) || (!message.trim() && !attachedItem)}
                aria-label={isStop ? "Hentikan tim sekarang" : member ? `Kirim ke ${member.name}` : groupMode === "discuss" ? "Kirim pesan rapat" : "Kirim tugas ke tim"}
                title={isStop ? "Hentikan tim sekarang" : undefined}
                className={`mb-0.5 flex h-9 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-30 cursor-pointer ${
                  isStop
                    ? "px-3 gap-1.5 bg-danger text-white hover:bg-danger/90 font-bold shadow-md shadow-danger/20"
                    : "w-9 bg-fg text-canvas hover:bg-accent"
                }`}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isStop ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="text-xs">Stop</span>
                  </>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            );
          })()}
        </div>
        <p className="text-[10px] text-fg-4 mt-2 leading-relaxed">{memberId ? "1 AI untuk chat pribadi · Enter untuk kirim, Shift+Enter untuk baris baru" : groupMode === "discuss" ? "@nama memanggil satu anggota · @semua untuk rapat seluruh 5 anggota tim" : "Seluruh tim bekerja bersama · laporan akan dibuat lengkap oleh semua anggota"}</p>
      </div>
    </form>

    {/* Modal Pemilih Folder & File Proyek */}
    {showProjectPicker && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-raised border border-line-strong rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          {/* Header Modal */}
          <div className="p-3.5 border-b border-line flex items-center justify-between bg-base/60">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-accent" />
              <span className="font-semibold text-sm text-fg">Pilih Folder & File Proyek</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-base border border-line text-accent font-mono">{selectedProjectId || projectId}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowProjectPicker(false)}
              className="p-1 text-fg-3 hover:text-fg rounded-lg hover:bg-hover cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Project Switcher jika ada proyek lain */}
          {availableProjects.length > 1 && (
            <div className="px-3.5 py-2 border-b border-line bg-hover/30 flex items-center gap-2 text-xs">
              <span className="text-fg-3 shrink-0">Pilih Proyek:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedProjectId(newId);
                  fetch(`/api/fs?projectId=${encodeURIComponent(newId)}`)
                    .then((r) => r.json())
                    .then((d) => {
                      if (d.success && d.files) setProjectFileList(d.files);
                    });
                }}
                className="flex-1 bg-base border border-line text-fg rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer"
              >
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Card Utama: BUKA FOLDER LENGKAP dengan tombol BUKA FOLDER */}
          <div className="p-3.5 border-b border-line bg-accent/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-accent text-on-accent flex items-center justify-center shrink-0 shadow-md">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-fg truncate">
                  Folder Proyek: {selectedProjectId || projectId}
                </div>
                <div className="text-[11px] text-fg-3">
                  {projectFileList.length} file • index.html, package.json, dll.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenProjectFolder(selectedProjectId || projectId)}
              className="px-4 py-2 bg-accent hover:bg-accent-hi text-on-accent text-xs font-bold rounded-xl shrink-0 flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              Buka Folder
            </button>
          </div>

          <div className="px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-fg-4 border-b border-line bg-base/20">
            Atau pilih satu file tertentu:
          </div>

          {/* List File Individual */}
          <div className="p-2.5 flex-1 overflow-y-auto space-y-1">
            {loadingProjectFiles ? (
              <div className="p-8 text-center text-xs text-fg-3 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent" /> Memuat daftar file...
              </div>
            ) : projectFileList.length === 0 ? (
              <div className="p-8 text-center text-xs text-fg-4">
                Belum ada file di workspace project ini.
              </div>
            ) : (
              projectFileList.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectProjectFile(item.path)}
                  className="w-full text-left px-3 py-2 text-xs text-fg-2 hover:text-fg hover:bg-hover rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-3.5 h-3.5 text-lagoon shrink-0" />
                    <span className="font-mono text-fg text-xs truncate group-hover:text-accent font-medium">
                      {item.path}
                    </span>
                  </div>
                  <span className="text-[10px] text-fg-4 shrink-0 font-mono">
                    {item.size > 1024 ? `${(item.size / 1024).toFixed(1)} KB` : `${item.size} B`}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer Modal dengan Tombol Buka Seluruh Folder */}
          <div className="p-3 border-t border-line bg-base/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowProjectPicker(false)}
              className="px-3.5 py-2 rounded-xl border border-line text-xs text-fg-2 hover:text-fg hover:bg-hover cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleOpenProjectFolder(selectedProjectId || projectId)}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hi text-on-accent text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              Buka Seluruh Folder Proyek
            </button>
          </div>
        </div>
      </div>
    )}
  </section>;
}
