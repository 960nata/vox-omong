"use client";

import React, { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  Plus,
  Trash2,
  RefreshCw,
  X,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FilePlus,
  Loader2,
  HardDrive,
  Check,
} from "lucide-react";

interface FileNode {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  updatedAt?: string;
  children?: FileNode[];
}

interface ProjectExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotifyVoice?: (text: string) => void;
}

export function ProjectExplorerModal({
  isOpen,
  onClose,
  onNotifyVoice,
}: ProjectExplorerModalProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [rootName, setRootName] = useState("voice ai");
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    "src/components": true,
    "src/app": true,
  });

  // Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [selectedParentFolder, setSelectedParentFolder] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fs");
      const data = await res.json();
      if (data.success) {
        setTree(data.tree || []);
        if (data.root) setRootName(data.root);
      }
    } catch (err) {
      console.error("Failed to fetch project tree:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTree();
    }
  }, [isOpen]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const fullFolderPath = selectedParentFolder
      ? `${selectedParentFolder}/${newFolderName.trim()}`
      : newFolderName.trim();

    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_folder",
          folderPath: fullFolderPath,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: `Folder "${fullFolderPath}" berhasil dibuat!`, type: "success" });
        setNewFolderName("");
        setIsCreatingFolder(false);
        fetchTree();
        if (onNotifyVoice) {
          onNotifyVoice(`Folder ${fullFolderPath} berhasil dibuat di dalam project.`);
        }
      } else {
        setActionMessage({ text: data.error || "Gagal membuat folder", type: "error" });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: "error" });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const fullFilePath = selectedParentFolder
      ? `${selectedParentFolder}/${newFileName.trim()}`
      : newFileName.trim();

    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_file",
          filePath: fullFilePath,
          content: "// Auto-created via Voice AI Studio\n",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: `File "${fullFilePath}" berhasil dibuat!`, type: "success" });
        setNewFileName("");
        setIsCreatingFile(false);
        fetchTree();
        if (onNotifyVoice) {
          onNotifyVoice(`File ${fullFilePath} berhasil dibuat.`);
        }
      } else {
        setActionMessage({ text: data.error || "Gagal membuat file", type: "error" });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: "error" });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleDeleteItem = async (relPath: string) => {
    if (!confirm(`Hapus item "${relPath}" secara permanen?`)) return;

    try {
      const res = await fetch("/api/fs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          folderPath: relPath,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: `Berhasil menghapus ${relPath}`, type: "success" });
        fetchTree();
      } else {
        setActionMessage({ text: data.error || "Gagal menghapus", type: "error" });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: "error" });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
      case "js":
      case "jsx":
        return <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />;
      case "json":
        return <FileJson className="w-3.5 h-3.5 text-[#fbbf24]" />;
      case "md":
      case "txt":
        return <FileText className="w-3.5 h-3.5 text-[#9ca3af]" />;
      default:
        return <File className="w-3.5 h-3.5 text-[#6b7280]" />;
    }
  };

  const renderNode = (node: FileNode, level = 0) => {
    const isExpanded = !!expandedFolders[node.relativePath];

    if (node.isDirectory) {
      return (
        <div key={node.relativePath} className="select-none">
          <div
            className={`group flex items-center justify-between px-2 py-1.5 hover:bg-[#1f2430] rounded-[3px] cursor-pointer text-xs transition-colors ${
              selectedParentFolder === node.relativePath
                ? "bg-[#252c3c] text-[#f3f4f6]"
                : "text-[#c2cbd8]"
            }`}
            style={{ paddingLeft: `${Math.max(8, level * 16 + 8)}px` }}
            onClick={() => {
              toggleFolder(node.relativePath);
              setSelectedParentFolder(node.relativePath);
            }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[#6c7689] shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-[#ea580c] shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-[#f97316]/80 shrink-0" />
              )}
              <span className="font-mono truncate">{node.name}</span>
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedParentFolder(node.relativePath);
                  setIsCreatingFolder(true);
                }}
                title="Buat subfolder di sini"
                className="p-1 hover:bg-[#2b3345] text-[#9ca3af] hover:text-[#f3f4f6] rounded-[2px]"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedParentFolder(node.relativePath);
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
                title="Hapus folder"
                className="p-1 hover:bg-[#3d1e1e] text-[#ef4444] rounded-[2px]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="border-l border-[#242a38] ml-3.5">
              {node.children.map((child) => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.relativePath}
        className="group flex items-center justify-between px-2 py-1.5 hover:bg-[#1a1e28] rounded-[3px] text-xs transition-colors"
        style={{ paddingLeft: `${Math.max(8, level * 16 + 20)}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {getFileIcon(node.name)}
          <span className="font-mono text-[#d1d5db] truncate">{node.name}</span>
          {typeof node.size === "number" && (
            <span className="text-[10px] text-[#5d677a] font-mono">
              ({node.size > 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`})
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleDeleteItem(node.relativePath)}
          title="Hapus file"
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3d1e1e] text-[#ef4444] rounded-[2px] transition-opacity"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#111318] border border-[#232834] rounded-[3px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#161922] border-b border-[#232834] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[3px] bg-[#221c18] border border-[#ea580c]/50 flex items-center justify-center text-[#f97316]">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#f3f4f6] flex items-center gap-2">
                <span>PROJECT FILE EXPLORER</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1c2230] text-[#38bdf8] border border-[#2b3548] rounded-[3px]">
                  /{rootName}
                </span>
              </div>
              <p className="text-[11px] text-[#788296]">
                Kelola file dan buat folder project via visual tree atau instruksi suara
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchTree}
              disabled={loading}
              title="Refresh Pohon File"
              className="p-1.5 bg-[#1b1f2b] hover:bg-[#252c3c] text-[#a0abbd] hover:text-[#f3f4f6] border border-[#2d3546] rounded-[3px] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#ea580c]" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-[#1b1f2b] hover:bg-[#252c3c] text-[#a0abbd] hover:text-[#f3f4f6] border border-[#2d3546] rounded-[3px] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-4 py-2.5 bg-[#141720] border-b border-[#202532] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedParentFolder("");
                setIsCreatingFolder(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1c2230] hover:bg-[#273042] text-[#e2e8f0] border border-[#2f394d] hover:border-[#ea580c]/60 rounded-[3px] transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#ea580c]" />
              <span>+ Buat Folder Baru</span>
            </button>
            <button
              onClick={() => {
                setSelectedParentFolder("");
                setIsCreatingFile(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1c2230] hover:bg-[#273042] text-[#e2e8f0] border border-[#2f394d] hover:border-[#ea580c]/60 rounded-[3px] transition-colors"
            >
              <FilePlus className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>+ Buat File Baru</span>
            </button>
          </div>

          <div className="text-[11px] text-[#6b7588]">
            {selectedParentFolder ? `Target: /${selectedParentFolder}` : "Root direktori"}
          </div>
        </div>

        {/* Notifications / Alerts */}
        {actionMessage && (
          <div
            className={`px-4 py-2 text-xs font-mono border-b flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-[#112418] border-[#166534] text-[#4ade80]"
                : "bg-[#271212] border-[#7f1d1d] text-[#f87171]"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Modal: Create Folder Form */}
        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="p-3 bg-[#191d28] border-b border-[#293144] flex items-center gap-2 text-xs font-mono animate-fadeIn"
          >
            <FolderPlus className="w-4 h-4 text-[#ea580c] shrink-0" />
            <span className="text-[#8894a8] shrink-0">
              {selectedParentFolder ? `${selectedParentFolder}/` : ""}
            </span>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="nama_folder_baru (cth: components/ui atau services)"
              className="flex-1 bg-[#12141a] border border-[#323b4e] focus:border-[#ea580c] rounded-[3px] px-2.5 py-1 text-white outline-hidden"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] transition-colors"
            >
              Buat
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="px-2 py-1 bg-[#232834] hover:bg-[#2d3444] text-[#a0abbd] rounded-[3px]"
            >
              Batal
            </button>
          </form>
        )}

        {/* Modal: Create File Form */}
        {isCreatingFile && (
          <form
            onSubmit={handleCreateFile}
            className="p-3 bg-[#191d28] border-b border-[#293144] flex items-center gap-2 text-xs font-mono animate-fadeIn"
          >
            <FilePlus className="w-4 h-4 text-[#38bdf8] shrink-0" />
            <span className="text-[#8894a8] shrink-0">
              {selectedParentFolder ? `${selectedParentFolder}/` : ""}
            </span>
            <input
              type="text"
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="nama_file.ts / page.tsx"
              className="flex-1 bg-[#12141a] border border-[#323b4e] focus:border-[#38bdf8] rounded-[3px] px-2.5 py-1 text-white outline-hidden"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-[#0284c7] hover:bg-[#0ea5e9] text-white rounded-[3px] transition-colors"
            >
              Buat
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFile(false)}
              className="px-2 py-1 bg-[#232834] hover:bg-[#2d3444] text-[#a0abbd] rounded-[3px]"
            >
              Batal
            </button>
          </form>
        )}

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-[300px]">
          {loading && tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#647087]">
              <Loader2 className="w-6 h-6 animate-spin text-[#ea580c] mb-2" />
              <span className="text-xs font-mono">Memindai struktur direktori project...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-12 text-xs font-mono text-[#6c7689]">
              Direktori kosong atau tidak ditemukan.
            </div>
          ) : (
            tree.map((node) => renderNode(node, 0))
          )}
        </div>

        {/* Voice Guide Footer */}
        <div className="p-3 bg-[#141720] border-t border-[#232834] flex items-center justify-between text-[11px] font-mono text-[#828da0]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#10b981]" />
            <span>Voice Command Support:</span>
            <span className="text-[#f3f4f6] italic">"buat folder [nama]"</span>
            <span>atau</span>
            <span className="text-[#f3f4f6] italic">"buat folder components/ui"</span>
          </div>
          <span className="text-[#596377]">Batas kedalaman: 4 level</span>
        </div>
      </div>
    </div>
  );
}