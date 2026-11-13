"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  VolumeX,
  Sparkles,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  X,
  FileText,
  Presentation,
  Film,
  Code2,
  ChevronUp,
  AppWindow,
  Gamepad2,
  Globe,
  LayoutDashboard,
  Receipt,
  Rocket,
  Sheet,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FolderUp,
  HardDrive,
} from "lucide-react";
import { ArrowIcon } from "./Btn";
import { AgentModeDropdown } from "./AgentModeDropdown";
import type { AgentModeType, AgentPermissionType } from "@/lib/types";

interface AttachedUploadItem {
  type: "file" | "folder" | "image";
  name: string;
  size?: number;
  itemCount?: number;
  relativePath?: string;
  url?: string;
  dataUri?: string;
  files?: { name?: string; size: number; path: string }[];
  textSnippet?: string;
  isLocalFile?: boolean;
  isProjectFile?: boolean;
}

interface AudioControlsProps {
  projectId?: string;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  onToggleMic: () => void;
  onSendMessage: (text: string, imageUri?: string, dataUri?: string, fromVoice?: boolean, attachedItem?: any) => void;
  onStopSpeaking: () => void;
  language: "id-ID" | "en-US";
  onOpenExplorer?: () => void;
  jarvisMode?: boolean;
  onToggleJarvisMode?: () => void;
  agentMode?: AgentModeType;
  agentPermission?: AgentPermissionType;
  onChangeAgentMode?: (mode: AgentModeType) => void;
  onChangeAgentPermission?: (perm: AgentPermissionType) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

const CLAUDE_SKILLS_ID = [
  { icon: Sparkles, label: "Anatomy · Brand", prompt: "pakai skill anatomy" },
  { icon: Globe, label: "Landing page", prompt: "Bikinin landing page untuk brand kopi lokal 'Senja Seduh' lengkap dengan hero, menu, testimoni, dan lokasi" },
  { icon: LayoutDashboard, label: "Dashboard", prompt: "Buat dashboard penjualan toko online dengan kartu KPI, grafik interaktif, dan tabel pesanan terbaru" },
  { icon: Gamepad2, label: "Mini game", prompt: "Bikin game tebak angka yang seru dengan skor, level kesulitan, dan animasi" },
  { icon: AppWindow, label: "Aplikasi", prompt: "Buat aplikasi to-do list dengan kategori, filter, dan data tersimpan di browser" },
  { icon: Presentation, label: "Slide presentasi", prompt: "Buatkan slide presentasi pitch deck untuk startup aplikasi les privat online" },
  { icon: FileText, label: "Dokumen / laporan", prompt: "Tulis proposal kegiatan bazar UMKM di kampus lengkap dengan latar belakang, tujuan, anggaran, dan jadwal" },
  { icon: Receipt, label: "Invoice", prompt: "Buatkan invoice untuk jasa desain logo dan branding untuk klien PT Maju Jaya" },
  { icon: Sheet, label: "Spreadsheet", prompt: "Buat tabel rencana anggaran bulanan mahasiswa dengan kategori, estimasi, dan realisasi" },
  { icon: Rocket, label: "Deploy", prompt: "Auto deploy proyek website ini ke Vercel sekarang" },
];

const CLAUDE_SKILLS_EN = [
  { icon: Sparkles, label: "Anatomy · Brand", prompt: "use skill anatomy" },
  { icon: Globe, label: "Landing page", prompt: "Build a landing page for a local coffee brand 'Dusk Brew' with hero, menu, testimonials, and location" },
  { icon: LayoutDashboard, label: "Dashboard", prompt: "Build an online store sales dashboard with KPI cards, interactive charts, and a recent orders table" },
  { icon: Gamepad2, label: "Mini game", prompt: "Build a fun number guessing game with score, difficulty levels, and animations" },
  { icon: AppWindow, label: "App", prompt: "Build a to-do list app with categories, filters, and data saved in the browser" },
  { icon: Presentation, label: "Slide deck", prompt: "Create a pitch deck presentation for an online tutoring startup" },
  { icon: FileText, label: "Document", prompt: "Write a proposal for a campus small-business bazaar with background, goals, budget, and schedule" },
  { icon: Receipt, label: "Invoice", prompt: "Create an invoice for logo and branding design services for client Acme Corp" },
  { icon: Sheet, label: "Spreadsheet", prompt: "Create a monthly student budget table with categories, estimates, and actuals" },
  { icon: Rocket, label: "Deploy", prompt: "Trigger auto deployment of current workspace to Vercel" },
];

export function AudioControls({
  projectId = "default-workspace",
  isListening,
  isSpeaking,
  isProcessing,
  liveTranscript,
  onToggleMic,
  onSendMessage,
  onStopSpeaking,
  language,
  onOpenExplorer,
  jarvisMode = true,
  onToggleJarvisMode,
  agentMode = "interactive",
  agentPermission = "manual",
  onChangeAgentMode,
  onChangeAgentPermission,
}: AudioControlsProps) {
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    dataUri: string;
    url?: string;
    name: string;
  } | null>(null);
  const [attachedItem, setAttachedItem] = useState<AttachedUploadItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSkillsMenu, setShowSkillsMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectFileList, setProjectFileList] = useState<{ path: string; size: number }[]>([]);
  const [loadingProjectFiles, setLoadingProjectFiles] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "default-workspace");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Close attach menu on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [showAttachMenu]);

  // Preload project files when project changes
  useEffect(() => {
    fetch(`/api/fs?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          setProjectFileList(data.files);
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Load project files when attach menu is open
  useEffect(() => {
    if (!showAttachMenu) return;
    setLoadingProjectFiles(true);
    fetch(`/api/fs?projectId=${encodeURIComponent(projectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          setProjectFileList(data.files);
        }
      })
      .catch((err) => console.error("Gagal memuat file proyek:", err))
      .finally(() => setLoadingProjectFiles(false));
  }, [showAttachMenu, projectId]);

  useEffect(() => {
    const handleGlobalOpenFolder = (e: Event) => {
      const customEvt = e as CustomEvent<{ projectId?: string }>;
      const targetId = customEvt.detail?.projectId || projectId || "default-workspace";
      void handleOpenProjectFolder(targetId);
    };
    window.addEventListener("vox:open_project_folder", handleGlobalOpenFolder);
    return () => window.removeEventListener("vox:open_project_folder", handleGlobalOpenFolder);
  }, [projectId]);

  // Auto trigger file picker when voice command mentions "upload gambar" / "unggah gambar"
  useEffect(() => {
    if (!liveTranscript) return;
    const lt = liveTranscript.toLowerCase();
    if (
      lt.includes("upload gambar") ||
      lt.includes("unggah gambar") ||
      lt.includes("lampirkan gambar") ||
      lt.includes("pilih gambar") ||
      lt.includes("buka gambar") ||
      lt.includes("ambil gambar")
    ) {
      if (imageInputRef.current) {
        imageInputRef.current.click();
      }
    } else if (
      lt.includes("buka folder") ||
      lt.includes("lihat folder") ||
      lt.includes("folder project") ||
      lt.includes("folder proyek") ||
      lt.includes("pilih folder")
    ) {
      void fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_finder", projectId }),
      }).catch(() => {});
      if (onOpenExplorer) {
        onOpenExplorer();
      }
    }
  }, [liveTranscript, projectId, onOpenExplorer]);

  const openProjectFolderInMac = async () => {
    setShowAttachMenu(false);
    try {
      await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_finder", projectId: projectId || "default-workspace" }),
      });
      if (onOpenExplorer) onOpenExplorer();
    } catch (e) {
      console.error("Gagal membuka folder di Mac:", e);
    }
  };

  // 1. Handle File Baca Langsung di Lokal (Teks, Kode, Dokumen — TANPA simpan ke folder project)
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
        // File teks/kode: dibaca 100% lokal oleh browser, 0 latency, tanpa upload ke project!
        const text = await file.text();
        setAttachedItem({
          type: "file",
          name: file.name,
          size: file.size,
          textSnippet: text.slice(0, 15000),
          isLocalFile: true,
        });
      }
      setAttachedImage(null);
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
      fd.append("projectId", projectId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal memproses gambar");

      const dataUri = data.dataUri || "";
      const url = data.url || dataUri;
      setAttachedImage({ dataUri, url, name: file.name });
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
        files: data.files || [],
        textSnippet: data.textSnippet || "",
      });
      setAttachedImage(null);

      if (!inputText.trim()) {
        setInputText(`Tolong baca dan analisis seluruh struktur dan kode dalam folder project "${pId}".`);
      }
    } catch (err: any) {
      setUploadError(err.message || "Gagal membuka folder");
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Buka Folder Lokal Mac (100% lokal via File System Access API, 0 upload, tombol bawaan OS adalah "Buka")
  const handlePickLocalFolderFromMac = async () => {
    setShowAttachMenu(false);
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        setIsUploading(true);
        const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
        const folderName = dirHandle.name;
        const files: { path: string; size: number }[] = [];
        let snippet = `Folder Mac Lokal: ${folderName}\n`;
        let totalSize = 0;

        async function scanDir(handle: any, currentPath: string = "") {
          for await (const entry of handle.values()) {
            const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (
              entry.name.startsWith(".") ||
              entry.name === "node_modules" ||
              entry.name === ".next" ||
              entry.name === "dist"
            ) {
              continue;
            }
            if (entry.kind === "file") {
              const file = await entry.getFile();
              totalSize += file.size;
              files.push({ path: entryPath, size: file.size });
              if (files.length <= 15 && /\.(html|js|jsx|ts|tsx|json|css|md|txt)$/i.test(entry.name)) {
                try {
                  const text = await file.text();
                  snippet += `\n--- [${entryPath}] ---\n${text.slice(0, 800)}\n`;
                } catch (_) {}
              }
            } else if (entry.kind === "directory") {
              await scanDir(entry, entryPath);
            }
          }
        }

        await scanDir(dirHandle);
        setAttachedItem({
          type: "folder",
          name: folderName,
          itemCount: files.length,
          size: totalSize,
          files: files,
          textSnippet: snippet,
        });
        setAttachedImage(null);

        if (!inputText.trim()) {
          setInputText(`Tolong baca dan analisis folder "${folderName}" dari Mac ini.`);
        }
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
        setAttachedImage(null);
      } else {
        setUploadError(data.error || "Gagal membaca file proyek");
      }
    } catch (err: any) {
      setUploadError(err.message || "Gagal membaca file proyek");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const typed = inputText.trim();
    const defaultText = attachedItem
      ? attachedItem.type === "image" || attachedImage
        ? "Analisis gambar ini dan bantu buatkan tampilan atau kode yang sesuai"
        : attachedItem.type === "folder"
        ? `Tolong analisis dan bantu kerjakan folder "${attachedItem.name}" yang baru saya lampirkan di project ini.`
        : attachedItem.isLocalFile
        ? `Tolong baca dan analisis file lokal "${attachedItem.name}" berikut.`
        : `Tolong periksa dan proses file "${attachedItem.name}" dari project ini.`
      : attachedImage
      ? "Analisis gambar ini dan buatkan kode atau solusinya"
      : "";

    const textToSend = typed || defaultText;
    if (!textToSend || isProcessing || isUploading) return;

    onSendMessage(
      textToSend,
      attachedImage?.url || attachedImage?.dataUri,
      attachedImage?.dataUri,
      false,
      attachedItem || undefined
    );

    setInputText("");
    setAttachedImage(null);
    setAttachedItem(null);
    setUploadError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = async (evt) => {
            const dataUri = evt.target?.result as string;
            setAttachedImage({
              dataUri,
              url: dataUri,
              name: `clipboard-${Date.now()}.png`,
            });
            setAttachedItem({
              type: "file",
              name: `clipboard-${Date.now()}.png`,
              dataUri,
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const skills = language === "id-ID" ? CLAUDE_SKILLS_ID : CLAUDE_SKILLS_EN;

  return (
    <div className="intro w-full shrink-0 space-y-2.5 pb-1" style={{ ["--d" as string]: "0.3s" }}>
      {/* Hidden File Input (Baca Lokal) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={handleLocalFileSelect}
        className="hidden"
      />

      {/* Hidden Image Input (Scan Gambar / UI) */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Transkrip langsung saat mic aktif */}
      {(isListening || liveTranscript) && (
        <div className="chat-in h-11 px-4 bg-base rounded-full flex items-center gap-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="pulse-dot shrink-0" style={{ background: "var(--accent)" }} />
          <span className={`min-w-0 flex-1 truncate ${liveTranscript ? "text-fg font-medium" : "text-fg-3 italic"}`}>
            {liveTranscript || "Ngomong aja, santai. Diam sebentar buat ngirim."}
            {isListening && <span className="chat-caret" />}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-3">
            {jarvisMode ? "Hands-free" : "Live"}
          </span>
        </div>
      )}

      {/* Chip Lampiran File / Folder / Gambar Aktif */}
      {attachedItem && (
        <div className="animate-rise px-3 py-2 bg-raised border border-line-strong rounded-2xl flex items-center justify-between gap-3 shadow-md">
          <div className="min-w-0 flex items-center gap-2.5">
            {attachedItem.dataUri ? (
              <img
                src={attachedItem.dataUri}
                alt={attachedItem.name}
                className="w-8 h-8 rounded-xl border border-line object-cover shrink-0"
              />
            ) : attachedItem.type === "folder" ? (
              <span className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4" strokeWidth={1.75} />
              </span>
            ) : attachedItem.isLocalFile ? (
              <span className="w-8 h-8 rounded-xl bg-base border border-line text-lagoon flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" strokeWidth={1.75} />
              </span>
            ) : (
              <span className="w-8 h-8 rounded-xl bg-base border border-line text-moss flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4" strokeWidth={1.75} />
              </span>
            )}
            <div className="min-w-0">
              <div className="text-xs text-fg truncate font-semibold">
                {attachedItem.name}
              </div>
              <div className="text-[10px] text-fg-3 flex items-center gap-1.5 font-mono">
                {attachedItem.type === "folder" ? (
                  <span className="text-accent font-medium">{attachedItem.itemCount || 0} file ({formatBytes(attachedItem.size || 0)})</span>
                ) : (
                  <span className="text-moss font-medium">{formatBytes(attachedItem.size || 0)}</span>
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
            onClick={() => {
              setAttachedItem(null);
              setAttachedImage(null);
            }}
            aria-label="Hapus lampiran"
            className="p-1 hover:bg-danger-wash text-fg-3 hover:text-danger rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Upload bila ada */}
      {uploadError && (
        <div className="animate-rise px-3 py-1.5 bg-danger-wash border border-danger/40 rounded-xl text-danger text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError("")} className="p-0.5 hover:text-fg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Skill cepat */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] w-full min-w-0">
        {skills.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(s.prompt)}
            disabled={isProcessing}
            className="chip shrink-0"
          >
            <s.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="relative bg-base rounded-[1.5rem] shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1px_var(--line-strong)] transition-shadow duration-300">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isProcessing}
          rows={1}
          aria-label="Pesan"
          placeholder={
            attachedItem
              ? `Ketik instruksi untuk ${attachedItem.type === "folder" ? "folder" : "file"} ini…`
              : language === "id-ID"
              ? "Ketik perintah, lampirkan file/folder, atau ngomong…"
              : "Type a command, attach file/folder, or speak…"
          }
          className="w-full bg-transparent text-fg text-[14px] px-4 pt-3 pb-0.5 outline-none focus:outline-none focus:ring-0 border-none shadow-none placeholder:text-fg-4 resize-none leading-relaxed"
        />

        <div className="px-2.5 pb-2.5 pl-3 flex flex-wrap items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            {/* Tombol Lampiran dengan Pilihan File / Folder */}
            <div className="relative" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                disabled={isProcessing || isUploading}
                title="Lampirkan File atau Seluruh Folder ke Project"
                aria-label="Lampirkan file atau folder"
                className={`icon-btn transition-colors ${showAttachMenu || attachedItem ? "text-accent bg-hover" : ""}`}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                ) : (
                  <Paperclip className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>

              {/* Menu Pilihan: File Proyek Lokal, Pindai Gambar, File Komputer, Folder Proyek */}
              {showAttachMenu && (
                <div className="chat-in absolute bottom-full left-0 mb-2 w-80 bg-raised/95 backdrop-blur-xl border border-line-strong rounded-2xl shadow-2xl p-2 z-40 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                        <div className="text-[9px] text-fg-4">Pilih folder Mac tanpa upload (0 transfer)</div>
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

            {/* Agent Mode Trigger matching user screenshot */}
            <AgentModeDropdown
              mode={agentMode}
              permission={agentPermission}
              onChangeMode={(m) => onChangeAgentMode?.(m)}
              onChangePermission={(p) => onChangeAgentPermission?.(p)}
              direction="up"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSkillsMenu(!showSkillsMenu)}
                aria-expanded={showSkillsMenu}
                className="chip h-9"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Skills</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${showSkillsMenu ? "rotate-180" : ""}`} />
              </button>

              {showSkillsMenu && (
                <div className="chat-in absolute bottom-full left-0 mb-2 w-64 bg-raised border border-line rounded-2xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] p-1.5 z-30">
                  <div className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-3">
                    Dokumen &amp; coding
                  </div>
                  {skills.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setShowSkillsMenu(false);
                        onSendMessage(s.prompt);
                      }}
                      className="w-full text-left px-2.5 py-2 text-sm text-fg-2 hover:text-fg hover:bg-hover rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <s.icon className="w-4 h-4 shrink-0 text-accent" strokeWidth={1.5} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleJarvisMode}
              aria-pressed={jarvisMode}
              title={jarvisMode ? "Hands-free aktif: mic nyala lagi otomatis setelah AI ngomong" : "Nyalakan mode hands-free"}
              className="chip h-9"
            >
              <span className={`w-6 h-3.5 rounded-full relative transition-colors ${jarvisMode ? "bg-accent" : "bg-line-strong"} transition-colors duration-500`}>
                <span
                  className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all duration-500 ${jarvisMode ? "left-3" : "left-0.5"}`}
                />
              </span>
              <span className="hidden sm:inline">Hands-free</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSpeaking && (
              <button
                type="button"
                onClick={onStopSpeaking}
                title="Hentikan suara AI"
                className="chip chat-in h-11"
              >
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">Stop suara</span>
              </button>
            )}

            {/* Tombol mic: aksi utama */}
            <button
              type="button"
              onClick={onToggleMic}
              disabled={isProcessing}
              aria-pressed={isListening}
              title={isListening ? "Matikan mikrofon" : "Ngomong ke AI"}
              aria-label={isListening ? "Matikan mikrofon" : "Nyalakan mikrofon"}
              data-accent={isListening ? "" : undefined}
              className={`round-btn !overflow-visible ${isListening ? "bg-accent text-white" : "bg-ink text-on-ink"}`}
            >
              {isListening && <span className="absolute inset-0 -z-10 rounded-full bg-accent" style={{ animation: "pulse-ring 2s var(--ease-out-expo) infinite" }} />}
              {isListening ? <MicOff className="w-[14px] h-[14px]" strokeWidth={1.75} /> : <Mic className="w-[14px] h-[14px]" strokeWidth={1.75} />}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={(!inputText.trim() && !attachedImage && !attachedItem) || isProcessing || isUploading}
              title="Kirim (Enter)"
              aria-label="Kirim pesan"
              data-accent=""
              className="round-btn !overflow-visible bg-ink text-on-ink disabled:opacity-30 disabled:pointer-events-none transition-opacity"
            >
              <ArrowIcon />
            </button>
          </div>
        </div>
      </div>

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
                      {formatBytes(item.size)}
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
    </div>
  );
}
