"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe,
  Folder,
  FolderOpen,
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
}

interface TerminalLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
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
}: RightWorkspacePanelProps) {
  // --- 1. Resizing state ---
  const [panelWidth, setPanelWidth] = useState(520);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("vox_workspace_width");
      if (savedWidth) {
        const num = parseInt(savedWidth, 10);
        if (num >= 340 && num <= 900) setPanelWidth(num);
      }
    } catch {}
  }, []);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 340 && newWidth <= window.innerWidth * 0.75) {
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
  }, [isResizing]);

  // --- 2. Preview Tab State ---
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (initialUrl && initialUrl !== previewUrl) {
      setPreviewUrl(initialUrl);
      setInputUrl(initialUrl);
    }
  }, [initialUrl]);

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `http://${target}`;
    }
    setPreviewUrl(target);
    setInputUrl(target);
    if (onUrlChange) onUrlChange(target);
    setIframeKey((k) => k + 1);
  };

  // --- 3. Project Explorer Tab State ---
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([
    { id: "default-workspace", name: "DEFAULT WORKSPACE" },
  ]);
  const [activeProjectId, setActiveProjectId] = useState<string>("default-workspace");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

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

  const fetchTree = async (pId?: string) => {
    setTreeLoading(true);
    const targetProject = pId || activeProjectId || "default-workspace";
    try {
      const res = await fetch(`/api/fs?projectId=${encodeURIComponent(targetProject)}`);
      const data = await res.json();
      if (data.success) {
        setTree(data.tree || []);
        if (data.projects) setProjects(data.projects);
        if (data.activeProject) setActiveProjectId(data.activeProject);
      }
    } catch (e) {
      console.warn("Failed to fetch tree:", e);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "explorer") {
      fetchTree();
    }
  }, [isOpen, activeTab]);

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

  const renderFileNode = (node: FileNode, level = 0) => {
    const isExpanded = !!expandedFolders[node.relativePath];

    if (node.isDirectory) {
      return (
        <div key={node.relativePath} className="select-none">
          <div
            className={`group flex items-center justify-between px-2 py-1.5 hover:bg-[#1d222e] rounded-[3px] cursor-pointer text-xs transition-colors ${
              selectedParent === node.relativePath ? "bg-[#242b3b] text-[#f3f4f6]" : "text-[#c2cad7]"
            }`}
            style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
            onClick={() => {
              toggleFolder(node.relativePath);
              setSelectedParent(node.relativePath);
            }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[#6c7689] shrink-0">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#ea580c] shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#f97316]/80 shrink-0" />
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
                className="p-1 hover:bg-[#2b3345] text-[#9ca3af] hover:text-[#f3f4f6] rounded-[2px]"
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
                className="p-1 hover:bg-[#2b3345] text-[#9ca3af] hover:text-[#f3f4f6] rounded-[2px]"
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
                className="p-1 hover:bg-[#3d1e1e] text-[#ef4444] rounded-[2px]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="border-l border-[#242a38] ml-3">
              {node.children.map((child) => renderFileNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const ext = node.name.split(".").pop()?.toLowerCase();
    const icon =
      ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" ? (
        <FileCode className="w-3 h-3 text-[#38bdf8]" />
      ) : ext === "json" ? (
        <FileJson className="w-3 h-3 text-[#fbbf24]" />
      ) : ext === "md" || ext === "txt" ? (
        <FileText className="w-3 h-3 text-[#9ca3af]" />
      ) : (
        <File className="w-3 h-3 text-[#6b7280]" />
      );

    return (
      <div
        key={node.relativePath}
        className="group flex items-center justify-between px-2 py-1 hover:bg-[#1a1e28] rounded-[3px] text-xs transition-colors"
        style={{ paddingLeft: `${Math.max(6, level * 14 + 18)}px` }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {icon}
          <span className="font-mono text-[#d1d5db] truncate">{node.name}</span>
          {typeof node.size === "number" && (
            <span className="text-[10px] text-[#5d677a] font-mono">
              ({node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleDeleteItem(node.relativePath)}
          title="Hapus file"
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3d1e1e] text-[#ef4444] rounded-[2px]"
        >
          <Trash2 className="w-3 h-3" />
        </button>
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
        body: JSON.stringify({ command: cmdToRun.trim() }),
      });
      const data = await res.json();
      const newLog: TerminalLog = {
        id: `term-${Date.now()}`,
        command: cmdToRun.trim(),
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? (data.success ? 0 : 1),
        durationMs: data.durationMs || Date.now() - start,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLogs((prev) => [...prev, newLog]);
      setInputCmd("");
      if (onTriggerVoiceFeedback) {
        if (data.success) {
          onTriggerVoiceFeedback(`Perintah selesai dijalankan.`);
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
      const res = await fetch("/api/git");
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
      // Step 1: Git auto commit
      setAutoDeployStep("1/3: Menyimpan perubahan (git add & commit)...");
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const commitRes = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_and_push",
          commitMessage: `auto-deploy: sync project at ${timeStr} via VOX·AI`,
        }),
      });
      const commitData = await commitRes.json();

      // Step 2: Push if remote exists
      setAutoDeployStep("2/3: Sinkronisasi ke GitHub origin main...");
      if (repoUrl.trim()) {
        try {
          await fetch("/api/git", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "set_remote",
              repoUrl: repoUrl.trim(),
              token: gitToken.trim(),
            }),
          });
        } catch {}
      }

      // Step 3: Vercel deploy
      setAutoDeployStep("3/3: Deploy ke server cloud Vercel...");
      const vercelRes = await fetch("/api/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: vercelToken.trim() || undefined,
          isProd: true,
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
      style={{ width: `${panelWidth}px` }}
      className="relative flex flex-col h-full bg-[#101217] border-l border-[#242936] shadow-2xl shrink-0 z-20 select-text overflow-hidden transition-all duration-75"
    >
      {/* Draggable Divider Handle (Left Border) */}
      <div
        onMouseDown={handleMouseDownResize}
        title="Geser ke kiri/kanan untuk menyesuaikan lebar panel"
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 group hover:bg-[#ea580c]/30 flex items-center justify-center transition-colors"
      >
        <div className="w-0.5 h-10 rounded-[1px] bg-[#3b4458] group-hover:bg-[#ea580c] transition-colors" />
      </div>

      {/* Top Tab Bar */}
      <div className="h-11 bg-[#141720] border-b border-[#232835] px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono text-xs">
          {/* Tab 1: Preview */}
          <button
            onClick={() => onTabChange("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border transition-colors ${
              activeTab === "preview"
                ? "bg-[#221c18] border-[#ea580c] text-[#f97316] font-semibold"
                : "bg-[#181c25] border-transparent text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#1f2430]"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>WEBSITE PREVIEW</span>
          </button>

          {/* Tab 2: Explorer */}
          <button
            onClick={() => onTabChange("explorer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border transition-colors ${
              activeTab === "explorer"
                ? "bg-[#221c18] border-[#ea580c] text-[#f97316] font-semibold"
                : "bg-[#181c25] border-transparent text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#1f2430]"
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>FOLDER PROJECT</span>
          </button>

          {/* Tab 3: Terminal */}
          <button
            onClick={() => onTabChange("terminal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border transition-colors ${
              activeTab === "terminal"
                ? "bg-[#221c18] border-[#ea580c] text-[#f97316] font-semibold"
                : "bg-[#181c25] border-transparent text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#1f2430]"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-[#10b981]" />
            <span>TERMINAL</span>
          </button>

          {/* Tab 4: Deploy */}
          <button
            onClick={() => onTabChange("deploy")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border transition-colors ${
              activeTab === "deploy"
                ? "bg-[#221c18] border-[#ea580c] text-[#f97316] font-semibold"
                : "bg-[#181c25] border-transparent text-[#9ca3af] hover:text-[#f3f4f6] hover:bg-[#1f2430]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#ea580c]" />
            <span>AUTO DEPLOY</span>
          </button>
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={onClose}
            title="Tutup Panel Workspace"
            className="p-1.5 text-[#8892a4] hover:text-[#f3f4f6] hover:bg-[#202533] rounded-[3px] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ================= TAB 1: WEBSITE PREVIEW ================= */}
        {activeTab === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
            {/* Browser Control Bar */}
            <div className="p-2 bg-[#141720] border-b border-[#232835] flex items-center gap-2 text-xs font-mono">
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                title="Reload Preview"
                className="p-1.5 bg-[#1b1f2a] hover:bg-[#252c3c] text-[#a0abbd] hover:text-[#f3f4f6] border border-[#2c3445] rounded-[3px] transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <form onSubmit={handleApplyUrl} className="flex-1 flex items-center relative">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="http://localhost:3000 atau https://..."
                  className="w-full bg-[#0d0f14] border border-[#2b3345] focus:border-[#ea580c] text-[#e2e8f0] text-xs font-mono rounded-[3px] px-2.5 py-1.5 pr-7 outline-hidden transition-colors"
                />
                <button
                  type="submit"
                  title="Buka URL"
                  className="absolute right-1 p-1 text-[#8b95a8] hover:text-[#f3f4f6]"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Viewport switchers */}
              <div className="flex items-center bg-[#181c26] border border-[#2b3345] rounded-[3px] p-0.5">
                <button
                  onClick={() => setViewportMode("desktop")}
                  title="Desktop (100%)"
                  className={`p-1 rounded-[2px] transition-colors ${
                    viewportMode === "desktop" ? "bg-[#252d3d] text-[#38bdf8]" : "text-[#717b8f]"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewportMode("tablet")}
                  title="Tablet (768px)"
                  className={`p-1 rounded-[2px] transition-colors ${
                    viewportMode === "tablet" ? "bg-[#252d3d] text-[#38bdf8]" : "text-[#717b8f]"
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewportMode("mobile")}
                  title="Mobile (375px)"
                  className={`p-1 rounded-[2px] transition-colors ${
                    viewportMode === "mobile" ? "bg-[#252d3d] text-[#38bdf8]" : "text-[#717b8f]"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>

              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                title="Buka di tab browser baru"
                className="p-1.5 bg-[#1b1f2a] hover:bg-[#252c3c] text-[#a0abbd] hover:text-[#f3f4f6] border border-[#2c3445] rounded-[3px] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 flex items-center justify-center p-2 bg-[#0a0c10] overflow-auto">
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
                className="bg-white rounded-[3px] shadow-2xl overflow-hidden border border-[#2b3345] transition-all"
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
          <div className="flex-1 flex flex-col overflow-hidden bg-[#101217]">
            {/* Project Workspace Selector Bar */}
            <div className="p-2.5 bg-[#151922] border-b border-[#242b3a] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                <span className="text-[#848fa5] text-[10px] shrink-0 uppercase font-semibold">PROJECT AKUN:</span>
                <select
                  value={activeProjectId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setActiveProjectId(newId);
                    fetchTree(newId);
                  }}
                  className="bg-[#0f1118] border border-[#2b3447] text-[#f3f4f6] text-xs font-mono rounded-[3px] px-2 py-1 outline-hidden focus:border-[#ea580c] truncate max-w-[200px]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="px-2.5 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white text-[11px] font-mono rounded-[3px] shrink-0 flex items-center gap-1 transition-colors"
                title="Buat Project Baru Khusus di Akun Anda"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Project Baru</span>
              </button>
            </div>

            {/* Create Project Inline Form */}
            {isCreatingProject && (
              <form
                onSubmit={handleCreateProject}
                className="p-2.5 bg-[#1a1f2b] border-b border-[#2d364a] flex items-center gap-2 text-xs font-mono animate-fadeIn"
              >
                <span className="text-[#ea580c] font-semibold text-xs shrink-0">Nama Project:</span>
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Contoh: Kasir Cafe / Landing Page / Toko Online"
                  className="flex-1 bg-[#101218] border border-[#374258] rounded-[3px] px-2.5 py-1 text-white outline-hidden focus:border-[#ea580c]"
                />
                <button type="submit" className="px-3 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px]">
                  Buat Project
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-2 py-1 bg-[#232835] text-[#9ca3af] rounded-[3px]"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Explorer Toolbar */}
            <div className="p-2.5 bg-[#141720] border-b border-[#232835] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedParent("");
                    setIsCreatingFolder(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1c2230] hover:bg-[#273042] text-[#e2e8f0] border border-[#2f394d] hover:border-[#ea580c] rounded-[3px] transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-[#ea580c]" />
                  <span>+ Folder</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedParent("");
                    setIsCreatingFile(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1c2230] hover:bg-[#273042] text-[#e2e8f0] border border-[#2f394d] hover:border-[#38bdf8] rounded-[3px] transition-colors"
                >
                  <FilePlus className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>+ File</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#6b768c] font-mono hidden sm:inline">
                  /{activeProjectId}
                </span>
                <button
                  onClick={() => fetchTree()}
                  disabled={treeLoading}
                  title="Refresh File Tree"
                  className="p-1 text-[#8b95a8] hover:text-[#f3f4f6]"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${treeLoading ? "animate-spin text-[#ea580c]" : ""}`} />
                </button>
              </div>
            </div>

            {/* Feedback Message */}
            {explorerMsg && (
              <div
                className={`px-3 py-1.5 text-xs font-mono border-b flex items-center justify-between ${
                  explorerMsg.ok
                    ? "bg-[#112418] border-[#166534] text-[#4ade80]"
                    : "bg-[#271212] border-[#7f1d1d] text-[#f87171]"
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
                className="p-2.5 bg-[#181c26] border-b border-[#2a3244] flex items-center gap-2 text-xs font-mono animate-fadeIn"
              >
                <FolderPlus className="w-4 h-4 text-[#ea580c] shrink-0" />
                <span className="text-[#8894a8] shrink-0">{selectedParent ? `${selectedParent}/` : ""}</span>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="nama_folder_baru"
                  className="flex-1 bg-[#111319] border border-[#343e54] rounded-[3px] px-2 py-1 text-white outline-hidden focus:border-[#ea580c]"
                />
                <button type="submit" className="px-2.5 py-1 bg-[#ea580c] text-white rounded-[3px]">
                  Buat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-2 py-1 bg-[#232835] text-[#9ca3af] rounded-[3px]"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Create File Inline Form */}
            {isCreatingFile && (
              <form
                onSubmit={handleCreateFile}
                className="p-2.5 bg-[#181c26] border-b border-[#2a3244] flex items-center gap-2 text-xs font-mono animate-fadeIn"
              >
                <FilePlus className="w-4 h-4 text-[#38bdf8] shrink-0" />
                <span className="text-[#8894a8] shrink-0">{selectedParent ? `${selectedParent}/` : ""}</span>
                <input
                  type="text"
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="nama_file.ts"
                  className="flex-1 bg-[#111319] border border-[#343e54] rounded-[3px] px-2 py-1 text-white outline-hidden focus:border-[#38bdf8]"
                />
                <button type="submit" className="px-2.5 py-1 bg-[#0284c7] text-white rounded-[3px]">
                  Buat
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFile(false)}
                  className="px-2 py-1 bg-[#232835] text-[#9ca3af] rounded-[3px]"
                >
                  Batal
                </button>
              </form>
            )}

            {/* Tree View List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
              {treeLoading && tree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#67738a]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ea580c] mb-2" />
                  <span className="text-xs font-mono">Memuat struktur direktori...</span>
                </div>
              ) : tree.length === 0 ? (
                <div className="text-center py-16 text-xs font-mono text-[#67738a]">
                  Direktori kosong atau belum terindeks.
                </div>
              ) : (
                tree.map((node) => renderFileNode(node, 0))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: TERMINAL ================= */}
        {activeTab === "terminal" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0e13] font-mono text-xs">
            {/* Quick Command Pills */}
            <div className="p-2 bg-[#141720] border-b border-[#232835] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
              <button
                onClick={() => executeCommand("git status")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] shrink-0"
              >
                git status
              </button>
              <button
                onClick={() => executeCommand("git add -A && git status")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] shrink-0 text-[#10b981]"
              >
                git add all
              </button>
              <button
                onClick={() => executeCommand("npm run build")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] shrink-0 text-[#38bdf8]"
              >
                npm build
              </button>
              <button
                onClick={() => executeCommand("vercel --version")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] shrink-0"
              >
                vercel info
              </button>
              <button
                onClick={() => executeCommand("ls -la")}
                disabled={isRunningCmd}
                className="px-2 py-0.5 bg-[#1b1f28] hover:bg-[#252a36] text-[#9ca3af] hover:text-[#f3f4f6] border border-[#2e3444] rounded-[3px] shrink-0"
              >
                ls -la
              </button>
            </div>

            {/* Terminal Output Log */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[#7d889b] text-[10px]">
                    <span className="text-[#ea580c] font-semibold">$ {log.command}</span>
                    <span>
                      {log.timestamp} ({log.durationMs}ms)
                    </span>
                  </div>

                  {log.stdout && (
                    <pre className="text-[#d8dde6] bg-[#12151c] p-2.5 rounded-[3px] whitespace-pre-wrap leading-relaxed border border-[#202533] text-[11px]">
                      {log.stdout}
                    </pre>
                  )}

                  {log.stderr && (
                    <pre className="text-[#f87171] bg-[#221313] p-2.5 rounded-[3px] whitespace-pre-wrap leading-relaxed border border-[#3d1e1e] text-[11px]">
                      {log.stderr}
                    </pre>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px]">
                    {log.exitCode === 0 ? (
                      <span className="text-[#10b981] flex items-center gap-1">
                        <Check className="w-3 h-3" /> Exited 0
                      </span>
                    ) : (
                      <span className="text-[#ef4444] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Exited {log.exitCode}
                      </span>
                    )}
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
              className="h-10 bg-[#12151c] border-t border-[#232835] px-3 flex items-center gap-2"
            >
              <span className="text-[#ea580c] font-bold select-none text-xs">$&gt;</span>
              <input
                type="text"
                value={inputCmd}
                onChange={(e) => setInputCmd(e.target.value)}
                disabled={isRunningCmd}
                placeholder="Ketik perintah terminal (git, npm, vercel)..."
                className="flex-1 bg-transparent text-[#f3f4f6] outline-hidden placeholder-[#525b6c] text-xs font-mono"
              />
              <button
                type="submit"
                disabled={!inputCmd.trim() || process.env.NODE_ENV === "test" || isRunningCmd}
                className="px-3 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] font-mono text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {isRunningCmd ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 4: AUTO DEPLOY (GIT & VERCEL) ================= */}
        {activeTab === "deploy" && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-[#0d0f14] space-y-4 font-mono text-xs">
            {/* Big 1-Click Auto Deploy Hero */}
            <div className="p-4 bg-linear-to-b from-[#201c18] to-[#161820] border border-[#ea580c]/50 rounded-[3px] shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[3px] bg-[#ea580c] text-white flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#f3f4f6]">AUTO-SYNC &amp; VERCEL DEPLOY</h3>
                    <p className="text-[11px] text-[#9ca3af]">
                      Otomatis commit ke Git, push ke GitHub, dan deploy ke Vercel
                    </p>
                  </div>
                </div>
              </div>

              {isAutoDeploying && (
                <div className="p-2.5 bg-[#251e18] border border-[#ea580c] rounded-[3px] flex items-center gap-2.5 text-xs text-[#f97316] animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{autoDeployStep || "Menjalankan proses auto-deploy..."}</span>
                </div>
              )}

              {deployResult && (
                <div
                  className={`p-3 rounded-[3px] border text-xs space-y-1.5 ${
                    deployResult.ok
                      ? "bg-[#112418] border-[#166534] text-[#4ade80]"
                      : "bg-[#281313] border-[#7f1d1d] text-[#f87171]"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {deployResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{deployResult.msg}</span>
                  </div>
                  {deployResult.url && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[#a7f3d0] truncate font-sans text-xs underline">
                        {deployResult.url}
                      </span>
                      <button
                        onClick={() => {
                          setPreviewUrl(deployResult.url!);
                          setInputUrl(deployResult.url!);
                          onTabChange("preview");
                        }}
                        className="px-2 py-0.5 bg-[#166534] text-white text-[10px] rounded-[2px]"
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
                className="w-full py-2.5 bg-[#ea580c] hover:bg-[#f97316] text-white font-semibold rounded-[3px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-xs tracking-wider"
              >
                {isAutoDeploying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>MENJALANKAN AUTO-DEPLOY...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>⚡ JALANKAN AUTO DEPLOY SEKARANG</span>
                  </>
                )}
              </button>
            </div>

            {/* GitHub Info Card */}
            <div className="p-3.5 bg-[#141720] border border-[#232835] rounded-[3px] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#f3f4f6]">
                  <GitBranch className="w-4 h-4 text-[#38bdf8]" />
                  <span className="font-semibold">GitHub Integration</span>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] bg-[#1d2331] text-[#38bdf8] border border-[#2a354b] rounded-[2px]">
                  Branch: {gitStatus?.branch || "main"}
                </span>
              </div>

              <div>
                <label className="text-[10px] text-[#7d8799] uppercase block mb-1">
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
                  className="w-full bg-[#0c0e13] border border-[#2c3445] rounded-[3px] px-2.5 py-1.5 text-white text-xs outline-hidden focus:border-[#38bdf8]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#7d8799] uppercase block mb-1">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => {
                    setGitToken(e.target.value);
                    localStorage.setItem("vox_github_token", e.target.value);
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[#0c0e13] border border-[#2c3445] rounded-[3px] px-2.5 py-1.5 text-white text-xs outline-hidden focus:border-[#38bdf8]"
                />
              </div>
            </div>

            {/* Vercel Info Card */}
            <div className="p-3.5 bg-[#141720] border border-[#232835] rounded-[3px] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#f3f4f6]">
                  <Cloud className="w-4 h-4 text-[#ea580c]" />
                  <span className="font-semibold">Vercel Deployment CLI</span>
                </div>
                <span className="px-1.5 py-0.5 text-[10px] bg-[#1d2331] text-[#10b981] border border-[#2a354b] rounded-[2px]">
                  CLI Active
                </span>
              </div>

              <div>
                <label className="text-[10px] text-[#7d8799] uppercase block mb-1">
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
                  className="w-full bg-[#0c0e13] border border-[#2c3445] rounded-[3px] px-2.5 py-1.5 text-white text-xs outline-hidden focus:border-[#ea580c]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
