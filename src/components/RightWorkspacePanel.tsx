"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { connectLocalProject } from "@/lib/browserLocalProject";
import {
  Globe,
  Folder,
  FolderOpen,
  Search,
  Terminal as TerminalIcon,
  GitBranch,
  Cloud,
  Play,
  RotateCw,
  ExternalLink,
  Smartphone,
  Monitor,
  Tablet,
  FolderPlus,
  FilePlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  X,
  FileCode,
  FileJson,
  FileText,
  File,
  Zap,
  ArrowRight,
  Maximize2,
  Minimize2,
  Upload,
  FolderUp,
  Copy,
  Save,
  Edit3,
  Eye,
} from "lucide-react";

export type WorkspaceTab = "preview" | "explorer" | "terminal" | "deploy";

interface RightWorkspacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onTriggerVoiceFeedback?: (text: string) => void;
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
  /** Project aktif dari induk (mis. berubah lewat perintah suara). */
  projectId?: string;
  onProjectChange?: (id: string) => void;
  isSidebarOpen?: boolean;
  isSidebarDrawer?: boolean;
}

interface TerminalLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  running?: boolean;
  ready?: boolean;
  previewUrl?: string;
  durationMs: number;
  timestamp: string;
}

interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

export function RightWorkspacePanel({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onTriggerVoiceFeedback,
  initialUrl = "http://localhost:3000",
  onUrlChange,
  projectId,
  onProjectChange,
  isSidebarOpen = false,
  isSidebarDrawer = false,
}: RightWorkspacePanelProps) {
  // Compute maximum allowed width dynamically based on viewport, sidebar, and guaranteed chat min-width (360px)
  const getMaxAllowedWidth = useCallback(() => {
    if (typeof window === "undefined") return 600;
    const effectiveSidebarWidth = (isSidebarOpen && !isSidebarDrawer && window.innerWidth >= 1180) ? 260 : 0;
    const minChatWidth = 360;
    return Math.max(300, window.innerWidth - effectiveSidebarWidth - minChatWidth);
  }, [isSidebarOpen, isSidebarDrawer]);

  // --- 1. Resizing & Responsiveness state ---
  // Nilai awal tetap (sama di server & client), lalu baca preferensi setelah mount
  const [panelWidth, setPanelWidth] = useState(520);
  const [maxPanelWidth, setMaxPanelWidth] = useState(600);

  useEffect(() => {
    let initial = window.innerWidth < 1180 ? Math.floor(window.innerWidth * 0.48) : 520;
    try {
      const saved = localStorage.getItem("vox_workspace_width");
      if (saved) {
        const num = parseInt(saved, 10);
        if (num >= 300 && num <= 1000) initial = num;
      }
    } catch {}
    setPanelWidth(Math.min(initial, getMaxAllowedWidth()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setMaxPanelWidth(getMaxAllowedWidth());
      if (!mobile) {
        const maxAllowed = getMaxAllowedWidth();
        setPanelWidth((prev) => Math.min(prev, maxAllowed));
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [getMaxAllowedWidth]);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const maxAllowed = getMaxAllowedWidth();
      if (newWidth >= 300 && newWidth <= maxAllowed) {
        setPanelWidth(newWidth);
        try {
          localStorage.setItem("vox_workspace_width", newWidth.toString());
        } catch {}
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, getMaxAllowedWidth]);

  // --- Projects State ---
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([
    { id: "default-workspace", name: "DEFAULT WORKSPACE" },
  ]);
  const [internalProjectId, setInternalProjectId] = useState<string>("default-workspace");
  const activeProjectId = projectId ?? internalProjectId;
  const setActiveProjectId = (id: string) => {
    setInternalProjectId(id);
    if (id !== activeProjectId) onProjectChange?.(id);
  };
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // --- 2. Preview Tab State ---
  const defaultInitial =
    initialUrl && initialUrl !== "http://localhost:3000" && initialUrl !== "http://localhost:3000/"
      ? initialUrl
      : "/api/preview?projectId=default-workspace";

  const [previewUrl, setPreviewUrl] = useState(defaultInitial);
  const [inputUrl, setInputUrl] = useState(defaultInitial);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (initialUrl && initialUrl !== previewUrl) {
      const clean =
        initialUrl === "http://localhost:3000" || initialUrl === "http://localhost:3000/"
          ? `/api/preview?projectId=${activeProjectId}`
          : initialUrl;
      setPreviewUrl(clean);
      setInputUrl(clean);
    }
  }, [initialUrl, activeProjectId]);

  const handleApplyUrl = (e?: React.FormEvent, customTarget?: string) => {
    if (e) e.preventDefault();
    let target = (customTarget !== undefined ? customTarget : inputUrl).trim();
    if (!target) return;

    // Prevent recursive Droste loop
    if (
      target === "http://localhost:3000" ||
      target === "http://localhost:3000/" ||
      target === "localhost:3000" ||
      target === "/"
    ) {
      target = `/api/preview?projectId=${activeProjectId}`;
    } else if (!target.startsWith("http://") && !target.startsWith("https://") && !target.startsWith("/")) {
      target = `https://${target}`;
    }

    setPreviewUrl(target);
    setInputUrl(target);
    if (onUrlChange) onUrlChange(target);
    setIframeKey((k) => k + 1);
  };

  // --- 3. Project Explorer Tab State ---
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    assets: true,
    documents: true,
  });
  const [selectedParent, setSelectedParent] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [explorerMsg, setExplorerMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Code search state (Lumen & Codebase search mandiri tanpa Ollama)
  const [codeSearchQuery, setCodeSearchQuery] = useState("");
  const [codeSearchResults, setCodeSearchResults] = useState<{
    stats?: { files: number; symbols: number; chunks: number };
    hits: Array<{
      file: string;
      startLine: number;
      endLine: number;
      score: number;
      symbols: { name: string; kind: string; line: number }[];
      importedBy: string[];
      snippet: string;
    }>;
  } | null>(null);
  const [isSearchingCode, setIsSearchingCode] = useState(false);

  useEffect(() => {
    const q = codeSearchQuery.trim();
    if (!q) {
      setCodeSearchResults(null);
      setIsSearchingCode(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCode(true);
      try {
        const res = await fetch(`/api/codesearch?q=${encodeURIComponent(q)}&projectId=${encodeURIComponent(activeProjectId)}`);
        const data = await res.json();
        if (data.ok) {
          setCodeSearchResults(data);
        }
      } catch (err) {
        console.error("Code search error:", err);
      } finally {
        setIsSearchingCode(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [codeSearchQuery, activeProjectId]);

  // Active File Viewer/Editor state
  const [activeFile, setActiveFile] = useState<{
    relativePath: string;
    name: string;
    content: string;
    isBinary: boolean;
    size: number;
    isEditing?: boolean;
  } | null>(null);
  const [activeFileLoading, setActiveFileLoading] = useState(false);
  const [isUploadingExplorer, setIsUploadingExplorer] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const treeRequestRef = useRef(0);

  const fetchTree = async (pId?: string) => {
    const requestId = ++treeRequestRef.current;
    setTreeLoading(true);
    const targetProject = pId || activeProjectId || "default-workspace";
    try {
      const res = await fetch(`/api/fs?projectId=${encodeURIComponent(targetProject)}`);
      const data = await res.json();
      if (requestId === treeRequestRef.current && data.success) {
        setTree(data.tree || []);
        if (data.projects) setProjects(data.projects);
      }
    } catch (e) {
      console.warn("Failed to fetch tree:", e);
    } finally {
      if (requestId === treeRequestRef.current) setTreeLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "explorer") {
      fetchTree();
    }
  }, [isOpen, activeTab]);

  // Project berganti dari luar (perintah suara): muat ulang daftar project & file
  useEffect(() => {
    if (projectId) fetchTree(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Sync preview when activeProjectId changes
  useEffect(() => {
    if (previewUrl.startsWith("/api/preview")) {
      const nextUrl = `/api/preview?projectId=${activeProjectId}`;
      setPreviewUrl(nextUrl);
      setInputUrl(nextUrl);
      if (onUrlChange) onUrlChange(nextUrl);
      setIframeKey((k) => k + 1);
    }
  }, [activeProjectId]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_project",
          projectName: newProjectName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `Project "${newProjectName.trim()}" berhasil dibuat di akun Anda!`, ok: true });
        setNewProjectName("");
        setIsCreatingProject(false);
        if (data.projectId) {
          setActiveProjectId(data.projectId);
          fetchTree(data.projectId);
        }
        if (onTriggerVoiceFeedback) {
          onTriggerVoiceFeedback(`Project ${newProjectName.trim()} berhasil dibuat di akun Anda.`);
        }
      } else {
        setExplorerMsg({ text: data.error || "Gagal membuat project", ok: false });
      }
    } catch (err: any) {
      setExplorerMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setExplorerMsg(null), 3500);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const fullPath = selectedParent ? `${selectedParent}/${newFolderName.trim()}` : newFolderName.trim();
    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_folder",
          projectId: activeProjectId,
          folderPath: fullPath,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `Folder "${fullPath}" berhasil dibuat!`, ok: true });
        setNewFolderName("");
        setIsCreatingFolder(false);
        fetchTree();
        if (onTriggerVoiceFeedback) onTriggerVoiceFeedback(`Folder ${fullPath} berhasil dibuat.`);
      } else {
        setExplorerMsg({ text: data.error || "Gagal membuat folder", ok: false });
      }
    } catch (err: any) {
      setExplorerMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setExplorerMsg(null), 3500);
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const fullPath = selectedParent ? `${selectedParent}/${newFileName.trim()}` : newFileName.trim();
    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_file",
          projectId: activeProjectId,
          filePath: fullPath,
          content: "// Auto-created in user project workspace\n",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `File "${fullPath}" berhasil dibuat!`, ok: true });
        setNewFileName("");
        setIsCreatingFile(false);
        fetchTree();
        if (onTriggerVoiceFeedback) onTriggerVoiceFeedback(`File ${fullPath} berhasil dibuat.`);
      } else {
        setExplorerMsg({ text: data.error || "Gagal membuat file", ok: false });
      }
    } catch (err: any) {
      setExplorerMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setExplorerMsg(null), 3500);
  };

  const handleDeleteItem = async (relPath: string) => {
    if (!confirm(`Hapus "${relPath}" secara permanen dari project ini?`)) return;
    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          projectId: activeProjectId,
          folderPath: relPath,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `Berhasil menghapus ${relPath}`, ok: true });
        fetchTree();
      } else {
        setExplorerMsg({ text: data.error || "Gagal menghapus", ok: false });
      }
    } catch (e: any) {
      setExplorerMsg({ text: e.message, ok: false });
    }
    setTimeout(() => setExplorerMsg(null), 3500);
  };

  const openFilePath = async (filePath: string) => {
    setActiveFileLoading(true);
    try {
      const res = await fetch(
        `/api/fs?projectId=${encodeURIComponent(activeProjectId)}&filePath=${encodeURIComponent(filePath)}`
      );
      const data = await res.json();
      if (data.success) {
        const name = filePath.split("/").pop() || filePath;
        setActiveFile({
          relativePath: filePath,
          name,
          content: data.content ?? "",
          isBinary: !!data.isBinary,
          size: data.size || 0,
          isEditing: false,
        });
      } else {
        setExplorerMsg({ text: data.error || "Gagal membuka file", ok: false });
      }
    } catch (e: any) {
      setExplorerMsg({ text: e.message, ok: false });
    } finally {
      setActiveFileLoading(false);
    }
  };

  const handleOpenFile = async (node: FileNode) => {
    await openFilePath(node.relativePath);
  };

  const handleSaveActiveFile = async () => {
    if (!activeFile) return;
    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_file",
          projectId: activeProjectId,
          filePath: activeFile.relativePath,
          content: activeFile.content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `File "${activeFile.name}" berhasil disimpan!`, ok: true });
        setActiveFile((prev) => (prev ? { ...prev, isEditing: false } : null));
        fetchTree();
      } else {
        setExplorerMsg({ text: data.error || "Gagal menyimpan file", ok: false });
      }
    } catch (e: any) {
      setExplorerMsg({ text: e.message, ok: false });
    }
    setTimeout(() => setExplorerMsg(null), 3500);
  };

  const handleExplorerUpload = async (e: React.ChangeEvent<HTMLInputElement>, isFolder = false) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    setIsUploadingExplorer(true);
    try {
      let fileArray = Array.from(rawFiles);
      if (isFolder) {
        // Abaikan folder raksasa node_modules, .git, .next agar browser tidak crash/membeku
        fileArray = fileArray.filter((f) => {
          const parts = (f.webkitRelativePath || f.name).split("/");
          return !parts.some((part) => part.startsWith(".") || ["node_modules", "dist", "build"].includes(part));
        });
        if (!fileArray.length) throw new Error("Folder ini tidak punya file yang bisa diimpor.");
        if (fileArray.length > 500) {
          throw new Error("Folder terlalu besar (maksimal 500 file sekaligus).");
        }
      }

      const fd = new FormData();
      fd.append("projectId", activeProjectId);
      fd.append("uploadType", isFolder ? "folder" : "file");
      if (isFolder) {
        const paths = fileArray.map((f) => f.webkitRelativePath || f.name);
        fd.append("paths", JSON.stringify(paths));
      }
      fileArray.forEach((file) => fd.append("files", file));

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setExplorerMsg({ text: `Berhasil mengunggah ${isFolder ? "folder" : "file"} ke project!`, ok: true });
        fetchTree();
      } else {
        setExplorerMsg({ text: data.error || "Upload gagal", ok: false });
      }
    } catch (err: any) {
      setExplorerMsg({ text: err.message, ok: false });
    } finally {
      setIsUploadingExplorer(false);
      e.target.value = "";
      setTimeout(() => setExplorerMsg(null), 3500);
    }
  };

  const handleConnectLocal = async () => {
    try {
      setIsUploadingExplorer(true);
      const id = await connectLocalProject();
      setActiveProjectId(id);
      await fetchTree(id);
      setExplorerMsg({ text: `Folder lokal terhubung ke project ${id}. Perubahan file akan dibaca sebelum chat.`, ok: true });
    } catch (error) {
      if ((error as Error).name !== "AbortError") setExplorerMsg({ text: (error as Error).message, ok: false });
    } finally {
      setIsUploadingExplorer(false);
      setTimeout(() => setExplorerMsg(null), 5000);
    }
  };

  const renderFileNode = (node: FileNode, level = 0) => {
    const isExpanded = !!expandedFolders[node.relativePath];

    if (node.isDirectory) {
      return (
        <div key={node.relativePath} className="select-none">
          <div
            className={`group flex items-center justify-between px-2 py-1.5 hover:bg-hover rounded-lg cursor-pointer text-xs transition-colors ${
              selectedParent === node.relativePath ? "bg-hover text-fg" : "text-fg"
            }`}
            style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
            onClick={() => {
              toggleFolder(node.relativePath);
              setSelectedParent(node.relativePath);
            }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-fg-3 shrink-0">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-accent-hi/80 shrink-0" />
              )}
              <span className="font-mono truncate">{node.name}</span>
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedParent(node.relativePath);
                  setIsCreatingFolder(true);
                }}
                title="Buat folder di sini"
                className="p-1 hover:bg-hover text-fg-2 hover:text-fg rounded-md"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedParent(node.relativePath);
                  setIsCreatingFile(true);
                }}
                title="Buat file di sini"
                className="p-1 hover:bg-hover text-fg-2 hover:text-fg rounded-md"
              >
                <FilePlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteItem(node.relativePath);
                }}
                title="Hapus"
                className="p-1 hover:bg-danger-wash text-danger rounded-md"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="border-l border-line ml-3">
              {node.children.map((child) => renderFileNode(child, level + 1))}
            </div>
          )}
          {isExpanded && (!node.children || node.children.length === 0) && (
            <div className="border-l border-line ml-3 pl-4 py-1 text-[11px] text-fg-4 italic">
              (Folder kosong)
            </div>
          )}
        </div>
      );
    }

    const ext = node.name.split(".").pop()?.toLowerCase();
    const icon =
      ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" ? (
        <FileCode className="w-3 h-3 text-lagoon" />
      ) : ext === "json" ? (
        <FileJson className="w-3 h-3 text-glow" />
      ) : ext === "md" || ext === "txt" ? (
        <FileText className="w-3 h-3 text-fg-2" />
      ) : (
        <File className="w-3 h-3 text-fg-3" />
      );

    return (
      <div
        key={node.relativePath}
        onClick={() => handleOpenFile(node)}
        className="group flex items-center justify-between px-2 py-1 hover:bg-hover rounded-lg text-xs transition-colors cursor-pointer"
        style={{ paddingLeft: `${Math.max(6, level * 14 + 18)}px` }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {icon}
          <span className="font-mono text-fg group-hover:text-accent transition-colors truncate">{node.name}</span>
          {typeof node.size === "number" && (
            <span className="text-[10px] text-fg-3 font-mono">
              ({node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenFile(node);
            }}
            title="Buka file"
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-hover text-fg-2 hover:text-fg rounded-md"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteItem(node.relativePath);
            }}
            title="Hapus file"
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger-wash text-danger rounded-md"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // --- 4. Terminal Tab State ---
  const [logs, setLogs] = useState<TerminalLog[]>([
    {
      id: "term-init",
      command: "echo 'VOX·AI Integrated Runtime Ready.'",
      stdout: "VOX·AI Integrated Runtime Ready.\nWorkspace loaded in root directory.",
      stderr: "",
      exitCode: 0,
      durationMs: 2,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputCmd, setInputCmd] = useState("");
  const [isRunningCmd, setIsRunningCmd] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const monitoredLogId = logs.findLast((entry) => entry.running)?.id;

  useEffect(() => {
    if (activeTab !== "terminal" || !monitoredLogId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/terminal?projectId=${encodeURIComponent(activeProjectId)}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (response.ok && !controller.signal.aborted) setLogs((previous) => previous.map((entry) => entry.id === monitoredLogId ? { ...entry, stdout: data.stdout || "", stderr: data.stderr || data.error || "", exitCode: data.exitCode ?? null, running: !!data.running, ready: !!data.ready, previewUrl: data.previewUrl } : entry));
      } catch { /* Coba lagi saat koneksi lokal kembali tersedia. */ }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeTab, activeProjectId, monitoredLogId]);

  useEffect(() => {
    if (activeTab === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  const executeCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isRunningCmd) return;
    setIsRunningCmd(true);
    const start = Date.now();

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(/^status server$/i.test(cmdToRun.trim()) ? { action: "status" } : /^stop server$/i.test(cmdToRun.trim()) ? { action: "stop" } : { command: cmdToRun.trim() }), projectId: activeProjectId }),
      });
      const data = await res.json();
      const newLog: TerminalLog = {
        id: `term-${Date.now()}`,
        command: cmdToRun.trim(),
        stdout: data.stdout || "",
        stderr: data.stderr || data.error || "",
        exitCode: data.exitCode === null ? null : data.exitCode ?? (data.success ? 0 : 1),
        running: !!data.running,
        ready: !!data.ready,
        previewUrl: data.previewUrl,
        durationMs: data.durationMs || Date.now() - start,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLogs((prev) => [...prev, newLog]);
      setInputCmd("");
      if (onTriggerVoiceFeedback) {
        if (data.success) {
          onTriggerVoiceFeedback(data.running ? data.ready ? "Server sudah berjalan dan merespons." : "Proses berjalan, menunggu server siap." : "Perintah selesai dijalankan.");
        } else {
          onTriggerVoiceFeedback(`Perintah selesai dengan kode error.`);
        }
      }
    } catch (e: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: `term-${Date.now()}`,
          command: cmdToRun.trim(),
          stdout: "",
          stderr: e.message || "Execution error",
          exitCode: 1,
          durationMs: Date.now() - start,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsRunningCmd(false);
    }
  };

  // --- 5. Auto Deploy (Git & Vercel) State ---
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [isAutoDeploying, setIsAutoDeploying] = useState(false);
  const [autoDeployStep, setAutoDeployStep] = useState<string>("");
  const [deployResult, setDeployResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null);

  useEffect(() => {
    try {
      const gTok = localStorage.getItem("vox_github_token") || "";
      const gRepo = localStorage.getItem("vox_github_repo") || "";
      const vTok = localStorage.getItem("vox_vercel_token") || "";
      if (gTok) setGitToken(gTok);
      if (gRepo) setRepoUrl(gRepo);
      if (vTok) setVercelToken(vTok);
    } catch {}
  }, []);

  const fetchGitInfo = async () => {
    try {
      const res = await fetch(`/api/git?projectId=${encodeURIComponent(activeProjectId)}`);
      const data = await res.json();
      if (data.success) {
        setGitStatus(data);
        if (data.remoteUrl && !repoUrl) setRepoUrl(data.remoteUrl);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen && activeTab === "deploy") {
      fetchGitInfo();
    }
  }, [isOpen, activeTab]);

  const handleAutoDeploy = async () => {
    setIsAutoDeploying(true);
    setDeployResult(null);

    try {
      const post = (body: Record<string, unknown>) =>
        fetch("/api/git", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, projectId: activeProjectId }),
        });

      // Step 1: pasang remote GitHub dulu (kalau diisi), supaya push berikutnya punya tujuan
      setAutoDeployStep("1/3: Menyiapkan repo project (git init & remote)...");
      await post({ action: "init" });
      if (repoUrl.trim()) {
        try {
          await post({ action: "set_remote", repoUrl: repoUrl.trim(), token: gitToken.trim() });
        } catch {}
      }

      // Step 2: commit lalu push (push dilewati otomatis kalau belum ada remote)
      setAutoDeployStep("2/3: Menyimpan perubahan dan sinkronisasi ke GitHub...");
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await post({ action: "commit_and_push", commitMessage: `auto-deploy: sync project at ${timeStr} via VOX·AI` });

      // Step 3: Vercel deploy
      setAutoDeployStep("3/3: Deploy ke server cloud Vercel...");
      const vercelRes = await fetch("/api/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: vercelToken.trim() || undefined,
          isProd: true,
          projectId: activeProjectId,
        }),
      });
      const vercelData = await vercelRes.json();

      if (vercelData.success) {
        const liveUrl = vercelData.deployUrl || previewUrl;
        setDeployResult({
          ok: true,
          msg: "Proyek berhasil di-deploy ke Vercel secara otomatis!",
          url: liveUrl,
        });

        if (liveUrl) {
          setPreviewUrl(liveUrl);
          setInputUrl(liveUrl);
          if (onUrlChange) onUrlChange(liveUrl);
          // Switch to preview tab to immediately view live website
          onTabChange("preview");
        }

        if (onTriggerVoiceFeedback) {
          onTriggerVoiceFeedback(
            "Auto-deploy ke Vercel berhasil cuy! Website kamu sudah live dan langsung tampil di panel preview."
          );
        }
      } else {
        setDeployResult({
          ok: false,
          msg: vercelData.error || "Gagal deploy ke Vercel.",
        });
      }
    } catch (err: any) {
      setDeployResult({ ok: false, msg: err.message });
    } finally {
      setIsAutoDeploying(false);
      setAutoDeployStep("");
      fetchGitInfo();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={!isMobile ? { width: `${panelWidth}px`, maxWidth: `${maxPanelWidth}px` } : undefined}
      className={`enter-right bg-base/90 backdrop-blur-xl border-l border-line shadow-[-20px_0_40px_-30px_rgba(0,0,0,0.5)] z-30 select-text overflow-hidden transition-all duration-75 flex flex-col ${
        isMobile
          ? "fixed inset-0 w-full h-full"
          : "relative h-full shrink-0"
      }`}
    >
      {/* Draggable Divider Handle (Left Border on Desktop) */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDownResize}
          title="Geser ke kiri/kanan untuk menyesuaikan lebar panel"
          className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 group hover:bg-accent/30 flex items-center justify-center transition-colors"
        >
          <div className="w-0.5 h-10 rounded-sm bg-line group-hover:bg-accent transition-colors" />
        </div>
      )}

      {/* Tab workspace */}
      <div className="h-12 bg-base/80 backdrop-blur border-b border-line px-2 flex items-center justify-between gap-2 shrink-0">
        <div role="tablist" className="flex items-center gap-0.5 p-1 rounded-2xl bg-hover/60 overflow-x-auto [scrollbar-width:none] text-[13px] min-w-0">
          {(
            [
              { tab: "preview", label: "Preview", Icon: Globe },
              { tab: "explorer", label: "File", Icon: Folder },
              { tab: "terminal", label: "Terminal", Icon: TerminalIcon },
              { tab: "deploy", label: "Deploy", Icon: Zap },
            ] as { tab: WorkspaceTab; label: string; Icon: typeof Globe }[]
          ).map(({ tab, label, Icon }) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? "bg-raised text-fg font-medium shadow-[0_4px_12px_-8px_rgba(0,0,0,0.8)]"
                    : "text-fg-3 hover:text-fg"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-accent" : ""}`} />
                {label}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          title="Tutup panel workspace"
          aria-label="Tutup panel workspace"
          className="p-1.5 text-fg-3 hover:text-fg hover:bg-hover rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ================= TAB 1: WEBSITE PREVIEW ================= */}
        {activeTab === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Bar browser: muat ulang · alamat · ukuran layar · buka tab baru */}
            <div className="px-2.5 py-2 border-b border-line flex items-center gap-1.5">
              <button
                onClick={() => {
                  handleApplyUrl(undefined, `/api/preview?projectId=${activeProjectId}&t=${Date.now()}`);
                }}
                title="Muat ulang preview"
                aria-label="Muat ulang preview"
                className="lift p-2 rounded-xl text-fg-3 hover:text-fg hover:bg-hover cursor-pointer group"
              >
                <RotateCw className="w-4 h-4 transition-transform duration-500 group-active:rotate-180" />
              </button>

              <form onSubmit={handleApplyUrl} className="flex-1 min-w-0 flex items-center relative">
                <Globe className="absolute left-3 w-3.5 h-3.5 text-fg-4 pointer-events-none" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Alamat atau URL website"
                  aria-label="Alamat preview"
                  className="w-full bg-raised/80 border border-line focus:border-accent text-fg text-[13px] rounded-full pl-8 pr-9 py-1.5 outline-hidden transition-colors"
                />
                <button type="submit" title="Buka alamat" aria-label="Buka alamat" className="absolute right-1.5 p-1 rounded-full text-fg-3 hover:text-fg hover:bg-hover cursor-pointer">
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-hover/70" role="group" aria-label="Ukuran layar">
                {(
                  [
                    ["desktop", Monitor, "Desktop"],
                    ["tablet", Tablet, "Tablet (768px)"],
                    ["mobile", Smartphone, "HP (375px)"],
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    onClick={() => setViewportMode(mode)}
                    title={label}
                    aria-label={label}
                    aria-pressed={viewportMode === mode}
                    className={`p-1.5 rounded-[10px] transition-all cursor-pointer ${
                      viewportMode === mode ? "bg-raised text-accent shadow-[0_2px_8px_-4px_rgba(0,0,0,0.6)]" : "text-fg-3 hover:text-fg"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                title="Buka di tab baru"
                aria-label="Buka di tab baru"
                className="lift p-2 rounded-xl text-fg-3 hover:text-fg hover:bg-hover"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 flex items-center justify-center p-2.5 overflow-auto">
              <div
                style={{
                  width:
                    viewportMode === "mobile"
                      ? "375px"
                      : viewportMode === "tablet"
                      ? "768px"
                      : "100%",
                  height: "100%",
                }}
                className="bg-white rounded-2xl overflow-hidden border border-line shadow-[0_24px_50px_-30px_rgba(0,0,0,0.6)] transition-[width] duration-500 ease-out"
              >
                <iframe
                  key={iframeKey}
                  src={previewUrl}
                  title="Live Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PROJECT EXPLORER ================= */}
        {activeTab === "explorer" && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Hidden upload input for Explorer (file tunggal/banyak file, tanpa webkitdirectory) */}
            <input
              ref={fileUploadRef}
              type="file"
              multiple
              onChange={(e) => handleExplorerUpload(e, false)}
              className="hidden"
            />
            <input
              ref={(node) => {
                folderUploadRef.current = node;
                node?.setAttribute("webkitdirectory", "");
              }}
              type="file"
              multiple
              onChange={(e) => handleExplorerUpload(e, true)}
              className="hidden"
            />

            {/* Pilih project + aksi */}
            <div className="px-3 py-2.5 border-b border-line flex items-center gap-2">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Project</span>
                <select
                  value={activeProjectId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setActiveProjectId(newId);
                    fetchTree(newId);
                  }}
                  className="w-full appearance-none bg-raised/80 border border-line hover:border-line-strong focus:border-accent text-fg text-sm font-medium rounded-xl pl-3 pr-8 py-2 outline-hidden cursor-pointer transition-colors truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3 pointer-events-none" />
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="lift px-3 py-2 bg-fg text-raised hover:bg-accent text-xs font-medium rounded-xl shrink-0 flex items-center gap-1.5 cursor-pointer"
                title="Buat project baru"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Project baru
              </button>
            </div>

            {/* Create Project Inline Form */}
            {isCreatingProject && (
              <form
                onSubmit={handleCreateProject}
                className="px-3 py-2.5 border-b border-line flex items-center gap-2 text-xs animate-rise"
              >
                <span className="text-accent font-semibold text-xs shrink-0">Nama Project:</span>
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Contoh: Kasir Cafe / Landing Page / Toko Online"
                  className="flex-1 bg-base border border-line-strong rounded-lg px-2.5 py-1 text-fg outline-hidden focus:border-accent"
                />
                <button type="submit" className="px-3 py-1 bg-accent hover:bg-accent-hi text-on-accent rounded-lg">
                  Buat Project
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-2 py-1 bg-hover text-fg-2 rounded-lg"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Toolbar file */}
            <div className="px-3 py-1.5 border-b border-line flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedParent("");
                    setIsCreatingFolder(true);
                  }}
                  className="lift flex items-center gap-1 px-2 py-1 rounded-lg text-fg-2 hover:text-fg hover:bg-hover cursor-pointer"
                  title="Buat folder baru"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-glow" />
                  +Folder
                </button>
                <button
                  onClick={() => {
                    setSelectedParent("");
                    setIsCreatingFile(true);
                  }}
                  className="lift flex items-center gap-1 px-2 py-1 rounded-lg text-fg-2 hover:text-fg hover:bg-hover cursor-pointer"
                  title="Buat file baru"
                >
                  <FilePlus className="w-3.5 h-3.5 text-lagoon" />
                  +File
                </button>

                <div className="h-3.5 w-px bg-line mx-0.5" />

                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  disabled={isUploadingExplorer}
                  title="Impor file dari komputer ke project ini"
                  className="lift flex items-center gap-1 px-2 py-1 rounded-lg text-fg-2 hover:text-fg hover:bg-hover cursor-pointer"
                >
                  {isUploadingExplorer ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  ) : (
                    <FilePlus className="w-3.5 h-3.5 text-moss" />
                  )}
                  Impor File
                </button>

                <button
                  type="button"
                  onClick={handleConnectLocal}
                  disabled={isUploadingExplorer}
                  title="Hubungkan folder asli di komputer; perubahan file dibaca sebelum chat"
                  className="lift flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Hubungkan Folder Lokal
                </button>

                <button
                  type="button"
                  onClick={() => folderUploadRef.current?.click()}
                  disabled={isUploadingExplorer}
                  title="Pilih folder lokal dan salin filenya ke project aktif agar AI bisa membacanya"
                  className="lift flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs cursor-pointer shadow-xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Impor Folder Lokal
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/api/fs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "open_finder", projectId: activeProjectId }),
                      });
                      setExplorerMsg({ text: "Membuka folder project di Finder Mac...", ok: true });
                    } catch (e: any) {
                      setExplorerMsg({ text: e.message, ok: false });
                    }
                  }}
                  title="Buka folder project langsung di Finder Mac"
                  className="lift flex items-center gap-1 px-2 py-1 rounded-lg text-fg-2 hover:text-fg hover:bg-hover cursor-pointer text-fg-3"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Finder Mac
                </button>
              </div>

              <button
                onClick={() => fetchTree()}
                disabled={treeLoading}
                title="Muat ulang daftar file"
                aria-label="Muat ulang daftar file"
                className="p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-hover cursor-pointer shrink-0"
              >
                <RotateCw className={`w-3.5 h-3.5 ${treeLoading ? "animate-spin text-accent" : ""}`} />
              </button>
            </div>

            {/* Feedback Message */}
            {explorerMsg && (
              <div
                className={`px-3 py-1.5 text-xs font-mono border-b flex items-center justify-between ${
                  explorerMsg.ok
                    ? "bg-moss-wash border-moss text-moss"
                    : "bg-danger-wash border-danger text-danger"
                }`}
              >
                <span>{explorerMsg.text}</span>
                <button onClick={() => setExplorerMsg(null)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Create Folder Inline Form */}
            {isCreatingFolder && (
              <form
                onSubmit={handleCreateFolder}
                className="px-3 py-2.5 border-b border-line flex items-center gap-2 text-xs animate-rise"
              >
                <FolderPlus className="w-4 h-4 text-accent shrink-0" />
                <span className="text-fg-3 shrink-0">{selectedParent ? `${selectedParent}/` : ""}</span>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="nama_folder_baru"
                  className="flex-1 bg-raised border border-line-strong rounded-lg px-2 py-1 text-fg outline-hidden focus:border-accent"
                />
                <button type="submit" className="px-2.5 py-1 bg-accent text-on-accent rounded-lg">
                  Buat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-1 bg-hover text-fg-2 rounded-lg"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Create File Inline Form */}
            {isCreatingFile && (
              <form
                onSubmit={handleCreateFile}
                className="px-3 py-2.5 border-b border-line flex items-center gap-2 text-xs animate-rise"
              >
                <FilePlus className="w-4 h-4 text-lagoon shrink-0" />
                <span className="text-fg-3 shrink-0">{selectedParent ? `${selectedParent}/` : ""}</span>
                <input
                  type="text"
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="nama_file.ts"
                  className="flex-1 bg-raised border border-line-strong rounded-lg px-2 py-1 text-fg outline-hidden focus:border-lagoon"
                />
                <button type="submit" className="px-2.5 py-1 bg-lagoon text-on-accent rounded-lg">
                  Buat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFile(false)}
                  className="px-2 py-1 bg-hover text-fg-2 rounded-lg"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Code Search Bar (Lumen/Codebase engine mandiri tanpa Ollama) */}
            <div className="px-3 py-1.5 border-b border-line flex items-center gap-2 text-xs bg-base/50">
              <Search className={`w-3.5 h-3.5 shrink-0 ${isSearchingCode ? "animate-pulse text-accent" : "text-fg-3"}`} />
              <input
                type="text"
                value={codeSearchQuery}
                onChange={(e) => setCodeSearchQuery(e.target.value)}
                placeholder="Cari simbol, fungsi, class di kode..."
                className="flex-1 bg-transparent text-fg placeholder:text-fg-3 text-xs outline-hidden"
              />
              {codeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setCodeSearchQuery("")}
                  className="p-0.5 text-fg-3 hover:text-fg rounded cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Code Search Results OR Tree View */}
            {codeSearchQuery.trim() ? (
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {isSearchingCode && !codeSearchResults ? (
                  <div className="flex flex-col items-center justify-center py-12 text-fg-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent mb-2" />
                    <span className="text-xs font-mono">Mencari simbol di kode...</span>
                  </div>
                ) : !codeSearchResults || codeSearchResults.hits.length === 0 ? (
                  <div className="text-center py-12 text-xs font-mono text-fg-3">
                    Tidak ditemukan kode dengan kata kunci &quot;{codeSearchQuery}&quot;
                  </div>
                ) : (
                  <>
                    <div className="px-1 text-[11px] font-mono text-fg-3 flex items-center justify-between">
                      <span>Ditemukan {codeSearchResults.hits.length} cuplikan ({codeSearchResults.stats?.symbols || 0} simbol di {codeSearchResults.stats?.files || 0} file)</span>
                    </div>
                    {codeSearchResults.hits.map((hit, idx) => (
                      <div
                        key={`${hit.file}-${hit.startLine}-${idx}`}
                        className="rounded-xl border border-line bg-raised/50 hover:bg-raised transition-colors overflow-hidden"
                      >
                        <div
                          onClick={() => openFilePath(hit.file)}
                          className="px-3 py-1.5 bg-base/60 border-b border-line/60 flex items-center justify-between gap-2 cursor-pointer hover:bg-hover"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileCode className="w-3.5 h-3.5 text-lagoon shrink-0" />
                            <span className="text-xs font-mono font-medium text-fg truncate">{hit.file}</span>
                            <span className="text-[10px] text-fg-3 font-mono shrink-0">L{hit.startLine}-{hit.endLine}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono shrink-0">
                            skor {hit.score}
                          </span>
                        </div>

                        {hit.symbols.length > 0 && (
                          <div className="px-3 py-1 bg-base/30 border-b border-line/40 flex flex-wrap gap-1">
                            {hit.symbols.map((sym, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-hover text-fg-2 font-mono flex items-center gap-1"
                              >
                                <span className="text-accent">{sym.kind}</span>
                                <span className="font-semibold">{sym.name}</span>
                                <span className="text-fg-3">:{sym.line}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {hit.importedBy.length > 0 && (
                          <div className="px-3 py-0.5 text-[10px] text-fg-3 font-mono bg-base/20 border-b border-line/40 truncate">
                            Diimpor oleh: {hit.importedBy.join(", ")}
                          </div>
                        )}

                        <pre
                          onClick={() => openFilePath(hit.file)}
                          className="p-2.5 text-[11px] font-mono text-fg-2 overflow-x-auto whitespace-pre cursor-pointer hover:bg-hover/30"
                        >
                          {hit.snippet}
                        </pre>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              /* Tree View List */
              <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
                {treeLoading && tree.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-fg-3">
                    <Loader2 className="w-6 h-6 animate-spin text-accent mb-2" />
                    <span className="text-xs font-mono">Memuat struktur direktori...</span>
                  </div>
                ) : tree.length === 0 ? (
                  <div className="text-center py-16 text-xs font-mono text-fg-3">
                    Direktori kosong atau belum terindeks.
                  </div>
                ) : (
                  tree.map((node) => renderFileNode(node, 0))
                )}
              </div>
            )}

            {/* Modal / Overlay File Viewer & Editor */}
            {activeFile && (
              <div className="absolute inset-0 z-50 bg-raised/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
                {/* Header Modal */}
                <div className="px-3.5 py-2.5 border-b border-line flex items-center justify-between gap-3 bg-base/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-4 h-4 text-lagoon shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-fg truncate">{activeFile.name}</div>
                      <div className="text-[10px] text-fg-3 font-mono truncate">
                        {activeFile.relativePath} • {activeFile.size > 1024 ? `${(activeFile.size / 1024).toFixed(1)} KB` : `${activeFile.size} B`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!activeFile.isBinary && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activeFile.content);
                            setExplorerMsg({ text: "Konten file disalin!", ok: true });
                            setTimeout(() => setExplorerMsg(null), 2000);
                          }}
                          className="lift px-2 py-1 rounded-lg text-fg-2 hover:text-fg hover:bg-hover text-xs flex items-center gap-1 cursor-pointer"
                          title="Salin isi file"
                        >
                          <Copy className="w-3 h-3" />
                          Salin
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (activeFile.isEditing) {
                              handleSaveActiveFile();
                            } else {
                              setActiveFile((prev) => (prev ? { ...prev, isEditing: true } : null));
                            }
                          }}
                          className={`lift px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${
                            activeFile.isEditing
                              ? "bg-accent text-on-accent hover:bg-accent-hi"
                              : "text-fg-2 hover:text-fg hover:bg-hover"
                          }`}
                          title={activeFile.isEditing ? "Simpan perubahan" : "Edit file"}
                        >
                          {activeFile.isEditing ? (
                            <>
                              <Save className="w-3 h-3" />
                              Simpan
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveFile(null)}
                      className="p-1 rounded-lg text-fg-3 hover:text-fg hover:bg-hover cursor-pointer"
                      title="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Konten File */}
                <div className="flex-1 overflow-auto p-3.5 font-mono text-xs">
                  {activeFileLoading ? (
                    <div className="h-full flex items-center justify-center text-fg-3 gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span>Membuka file...</span>
                    </div>
                  ) : activeFile.isBinary ? (
                    <div className="h-full flex flex-col items-center justify-center text-fg-3 gap-2">
                      <AlertCircle className="w-6 h-6 text-glow" />
                      <p>Pratinjau langsung tidak tersedia untuk format biner ({activeFile.name}).</p>
                    </div>
                  ) : activeFile.isEditing ? (
                    <textarea
                      value={activeFile.content}
                      onChange={(e) => {
                        const nextContent = e.target.value;
                        setActiveFile((prev) => (prev ? { ...prev, content: nextContent } : null));
                      }}
                      className="w-full h-full bg-base border border-line-strong rounded-xl p-3 text-fg font-mono text-xs outline-hidden focus:border-accent resize-none leading-relaxed"
                      autoFocus
                    />
                  ) : (
                    <pre className="text-fg whitespace-pre-wrap break-all leading-relaxed select-text">
                      <code>{activeFile.content}</code>
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: TERMINAL ================= */}
        {activeTab === "terminal" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-base font-mono text-xs">
            {/* Quick Command Pills */}
            <div className="p-2 bg-raised border-b border-line flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
              <button onClick={() => executeCommand("npm run dev")} disabled={isRunningCmd} className="px-2 py-0.5 bg-raised hover:bg-hover text-accent border border-line-strong rounded-lg shrink-0">npm dev</button>
              <button onClick={() => executeCommand("status server")} disabled={isRunningCmd} className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 border border-line-strong rounded-lg shrink-0">Status server</button>
              <button onClick={() => executeCommand("stop server")} disabled={isRunningCmd} className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 border border-line-strong rounded-lg shrink-0">Stop server</button>
              <button
                onClick={() => executeCommand("node -v && npm -v")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0 text-accent font-medium"
                title="Cek versi Node.js & NPM di sistem"
              >
                node & npm
              </button>
              <button
                onClick={() => executeCommand("npm init -y")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0 text-glow"
                title="Inisialisasi package.json di folder project aktif"
              >
                npm init
              </button>
              <button
                onClick={() => executeCommand("npm install")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0 text-moss"
                title="Install semua dependensi package.json"
              >
                npm install
              </button>
              <button
                onClick={() => executeCommand("npm run build")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0 text-lagoon"
              >
                npm build
              </button>
              <button
                onClick={() => executeCommand("git status")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0"
              >
                git status
              </button>
              <button
                onClick={() => executeCommand("git add -A && git status")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0"
              >
                git add all
              </button>
              <button
                onClick={() => executeCommand("ls -la")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-2 hover:text-fg border border-line-strong rounded-lg shrink-0"
              >
                ls -la
              </button>
              <button
                onClick={() => setLogs([])}
                className="px-2 py-0.5 bg-raised hover:bg-hover text-fg-3 hover:text-fg border border-line-strong rounded-lg shrink-0 ml-auto"
                title="Bersihkan log output terminal"
              >
                clear
              </button>
            </div>

            {/* Terminal Output Log */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="space-y-1">
                  <div className="flex items-center justify-between text-fg-3 text-[10px]">
                    <span className="text-accent font-semibold">$ {log.command}</span>
                    <span>
                      {log.timestamp} ({log.durationMs}ms)
                    </span>
                  </div>

                  {log.stdout && (
                    <pre className="text-fg bg-raised p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed border border-line text-[11px]">
                      {log.stdout}
                    </pre>
                  )}

                  {log.stderr && (
                    <pre className="text-danger bg-danger-wash p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed border border-danger text-[11px]">
                      {log.stderr}
                    </pre>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px]">
                    {log.running ? <span className="text-accent">{log.ready ? "Server berjalan · HTTP diperiksa" : "Proses berjalan · menunggu server siap"}</span> : log.exitCode === null ? <span className="text-fg-3">Proses berhenti / tidak aktif</span> : log.exitCode === 0 ? (
                      <span className="text-moss flex items-center gap-1">
                        <Check className="w-3 h-3" /> Exited 0
                      </span>
                    ) : (
                      <span className="text-danger flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Exited {log.exitCode}
                      </span>
                    )}
                    {log.previewUrl && <a href={log.previewUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-accent underline">Buka server</a>}
                  </div>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeCommand(inputCmd);
              }}
              className="h-10 bg-raised border-t border-line px-3 flex items-center gap-2"
            >
              <span className="text-accent font-bold select-none text-xs">$&gt;</span>
              <input
                type="text"
                value={inputCmd}
                onChange={(e) => setInputCmd(e.target.value)}
                disabled={isRunningCmd}
                placeholder="Ketik perintah terminal (contoh: npm i lucide-react, npm run dev, git status)..."
                className="flex-1 bg-transparent text-fg outline-hidden placeholder-fg-4 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={!inputCmd.trim() || process.env.NODE_ENV === "test" || isRunningCmd}
                className="px-3 py-1 bg-accent hover:bg-accent-hi text-on-accent rounded-lg font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {isRunningCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 4: AUTO DEPLOY (GIT & VERCEL) ================= */}
        {activeTab === "deploy" && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-base space-y-4 font-mono text-xs">
            {/* Big 1-Click Auto Deploy Hero */}
            <div className="p-4 bg-linear-to-b from-raised to-raised border border-accent/50 rounded-lg shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent text-on-accent flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-fg">AUTO-SYNC &amp; VERCEL DEPLOY</h3>
                    <p className="text-[11px] text-fg-2">
                      Otomatis commit ke Git, push ke GitHub, dan deploy ke Vercel
                    </p>
                  </div>
                </div>
              </div>

              {isAutoDeploying && (
                <div className="p-2.5 bg-accent-wash border border-accent rounded-lg flex items-center gap-2.5 text-xs text-accent-hi animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{autoDeployStep || "Menjalankan proses auto-deploy..."}</span>
                </div>
              )}

              {deployResult && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    deployResult.ok
                      ? "bg-moss-wash border-moss text-moss"
                      : "bg-danger-wash border-danger text-danger"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {deployResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{deployResult.msg}</span>
                  </div>
                  {deployResult.url && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-moss truncate font-sans text-xs underline">
                        {deployResult.url}
                      </span>
                      <button
                        onClick={() => {
                          setPreviewUrl(deployResult.url!);
                          setInputUrl(deployResult.url!);
                          onTabChange("preview");
                        }}
                        className="px-2 py-0.5 bg-moss text-on-accent text-[10px] rounded-md"
                      >
                        Buka di Preview
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleAutoDeploy}
                disabled={isAutoDeploying}
                className="w-full py-2.5 bg-accent hover:bg-accent-hi text-on-accent font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-xs tracking-wider"
              >
                {isAutoDeploying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>MENJALANKAN AUTO-DEPLOY...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>JALANKAN AUTO DEPLOY SEKARANG</span>
                  </>
                )}
              </button>
            </div>

            {/* GitHub Info Card */}
            <div className="p-3.5 bg-raised border border-line rounded-lg space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-fg">
                  <GitBranch className="w-4 h-4 text-lagoon" />
                  <span className="font-semibold">GitHub Integration</span>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] bg-hover text-lagoon border border-line-strong rounded-md">
                  Branch: {gitStatus?.branch || "main"}
                </span>
              </div>

              <div>
                <label className="text-[10px] text-fg-3 uppercase block mb-1">
                  GitHub Repository URL
                </label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    localStorage.setItem("vox_github_repo", e.target.value);
                  }}
                  placeholder="https://github.com/username/project.git"
                  className="w-full bg-base border border-line-strong rounded-lg px-2.5 py-1.5 text-fg text-xs outline-hidden focus:border-lagoon"
                />
              </div>

              <div>
                <label className="text-[10px] text-fg-3 uppercase block mb-1">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => {
                    setGitToken(e.target.value);
                    localStorage.setItem("vox_github_token", e.target.value);
                  }}
                  placeholder="Tempel API key di sini"
                  className="w-full bg-base border border-line-strong rounded-lg px-2.5 py-1.5 text-fg text-xs outline-hidden focus:border-lagoon"
                />
              </div>
            </div>

            {/* Vercel Info Card */}
            <div className="p-3.5 bg-raised border border-line rounded-lg space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-fg">
                  <Cloud className="w-4 h-4 text-accent" />
                  <span className="font-semibold">Vercel Deployment CLI</span>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] bg-hover text-moss border border-line-strong rounded-md">
                  CLI Active
                </span>
              </div>

              <div>
                <label className="text-[10px] text-fg-3 uppercase block mb-1">
                  Vercel Token (Opsional jika sudah login via CLI)
                </label>
                <input
                  type="password"
                  value={vercelToken}
                  onChange={(e) => {
                    setVercelToken(e.target.value);
                    localStorage.setItem("vox_vercel_token", e.target.value);
                  }}
                  placeholder="Isi Vercel Token untuk deploy tanpa interaksi login"
                  className="w-full bg-base border border-line-strong rounded-lg px-2.5 py-1.5 text-fg text-xs outline-hidden focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
