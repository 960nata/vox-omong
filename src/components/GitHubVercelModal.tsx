"use client";

import React, { useState, useEffect } from "react";
import { X, GitBranch, Cloud, Check, AlertCircle, Loader2, ArrowUpRight, UploadCloud, RefreshCw } from "lucide-react";

interface GitHubVercelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceFeedback?: (text: string) => void;
}

export function GitHubVercelModal({ isOpen, onClose, onVoiceFeedback }: GitHubVercelModalProps) {
  const [activeTab, setActiveTab] = useState<"github" | "vercel">("github");

  // Git state
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [commitMsg, setCommitMsg] = useState("feat: update project via VOX·AI Studio");
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [gitResult, setGitResult] = useState<{ success: boolean; message: string } | null>(null);

  // Vercel state
  const [vercelToken, setVercelToken] = useState("");
  const [isVercelLoading, setIsVercelLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; url?: string } | null>(null);

  // Load stored tokens
  useEffect(() => {
    try {
      const storedGitToken = localStorage.getItem("vox_github_token") || "";
      const storedRepoUrl = localStorage.getItem("vox_github_repo") || "";
      const storedVercelToken = localStorage.getItem("vox_vercel_token") || "";
      if (storedGitToken) setGitToken(storedGitToken);
      if (storedRepoUrl) setRepoUrl(storedRepoUrl);
      if (storedVercelToken) setVercelToken(storedVercelToken);
    } catch {}
  }, []);

  const fetchGitStatus = async () => {
    try {
      const res = await fetch("/api/git");
      const data = await res.json();
      if (data.success) {
        setGitStatus(data);
        if (data.remoteUrl && !repoUrl) {
          setRepoUrl(data.remoteUrl);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch git status:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGitStatus();
    }
  }, [isOpen]);

  const handleInitGit = async () => {
    setIsGitLoading(true);
    setGitResult(null);
    try {
      const res = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init" }),
      });
      const data = await res.json();
      setGitResult({ success: data.success, message: data.message || data.error });
      fetchGitStatus();
    } catch (e: any) {
      setGitResult({ success: false, message: e.message });
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleSetRemote = async () => {
    if (!repoUrl.trim()) return;
    setIsGitLoading(true);
    setGitResult(null);
    try {
      localStorage.setItem("vox_github_repo", repoUrl.trim());
      if (gitToken) localStorage.setItem("vox_github_token", gitToken.trim());

      const res = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_remote",
          repoUrl: repoUrl.trim(),
          token: gitToken.trim(),
        }),
      });
      const data = await res.json();
      setGitResult({ success: data.success, message: data.message || data.error });
      fetchGitStatus();
    } catch (e: any) {
      setGitResult({ success: false, message: e.message });
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleCommitAndPush = async () => {
    setIsGitLoading(true);
    setGitResult(null);
    try {
      const res = await fetch("/api/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_and_push",
          commitMessage: commitMsg.trim(),
          token: gitToken.trim(),
        }),
      });
      const data = await res.json();
      setGitResult({ success: data.success, message: data.message || data.error });
      fetchGitStatus();
      if (onVoiceFeedback && data.success) {
        onVoiceFeedback("Perubahan kode berhasil di-commit dan di-push ke GitHub.");
      }
    } catch (e: any) {
      setGitResult({ success: false, message: e.message });
    } finally {
      setIsGitLoading(false);
    }
  };

  const handleDeployVercel = async (isProd: boolean) => {
    setIsVercelLoading(true);
    setDeployResult(null);
    try {
      if (vercelToken) localStorage.setItem("vox_vercel_token", vercelToken.trim());

      const res = await fetch("/api/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: vercelToken.trim(),
          isProd,
        }),
      });
      const data = await res.json();
      setDeployResult({
        success: data.success,
        message: data.message || data.error,
        url: data.deployUrl,
      });

      if (onVoiceFeedback && data.success) {
        onVoiceFeedback(`Deploy ke Vercel berhasil! Website Anda sudah online.`);
      }
    } catch (e: any) {
      setDeployResult({ success: false, message: e.message });
    } finally {
      setIsVercelLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-xl bg-[#14161b] border border-[#2e3340] rounded-[3px] p-6 shadow-2xl text-[#e4e6ea]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252a35]">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#ea580c]" />
            <h2 className="text-base font-semibold tracking-wide text-[#f3f4f6]">
              Koneksi GitHub &amp; Vercel Deployment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8b93a4] hover:text-white hover:bg-[#20242e] rounded-[3px] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-[#252a35] mt-4">
          <button
            onClick={() => setActiveTab("github")}
            className={`py-2 px-4 text-xs font-mono font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "github"
                ? "border-[#ea580c] text-[#f97316]"
                : "border-transparent text-[#8b93a4] hover:text-[#f3f4f6]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            GitHub Repository (Push/Pull)
          </button>
          <button
            onClick={() => setActiveTab("vercel")}
            className={`py-2 px-4 text-xs font-mono font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "vercel"
                ? "border-[#ea580c] text-[#f97316]"
                : "border-transparent text-[#8b93a4] hover:text-[#f3f4f6]"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Vercel Deployment
          </button>
        </div>

        {/* Tab 1: GitHub */}
        {activeTab === "github" && (
          <div className="mt-4 space-y-4 text-xs">
            {/* Status overview */}
            <div className="p-3 bg-[#191d26] border border-[#2b3240] rounded-[3px] flex items-center justify-between">
              <div>
                <span className="text-[#8892a4]">Status Git Lokal: </span>
                <span className="font-semibold text-[#f3f4f6]">
                  {gitStatus?.isInitialized ? "Terkoneksi (Git Ready)" : "Belum Diinisialisasi"}
                </span>
                {gitStatus?.branch && (
                  <span className="ml-2 px-1.5 py-0.5 bg-[#252b38] text-[#38bdf8] rounded-[2px] font-mono text-[10px]">
                    branch: {gitStatus.branch}
                  </span>
                )}
              </div>
              {!gitStatus?.isInitialized && (
                <button
                  onClick={handleInitGit}
                  disabled={isGitLoading}
                  className="px-2.5 py-1 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] text-[11px] font-mono"
                >
                  Init Git
                </button>
              )}
            </div>

            {/* GitHub Token & Repo URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#a1a7b5] uppercase">
                GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                placeholder="ghp_... atau github_pat_..."
                value={gitToken}
                onChange={(e) => setGitToken(e.target.value)}
                className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] font-mono outline-hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#a1a7b5] uppercase">
                Repository GitHub URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://github.com/username/voice-ai.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="flex-1 bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] font-mono outline-hidden"
                />
                <button
                  onClick={handleSetRemote}
                  disabled={!repoUrl.trim() || isGitLoading}
                  className="px-3 py-2 bg-[#222734] hover:bg-[#2c3344] text-[#c0c6d4] hover:text-white rounded-[3px] border border-[#333c4f] font-mono text-xs transition-colors"
                >
                  Set Remote
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#a1a7b5] uppercase">
                Pesan Commit
              </label>
              <input
                type="text"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] font-mono outline-hidden"
              />
            </div>

            {/* Git Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCommitAndPush}
                disabled={isGitLoading}
                className="flex-1 py-2.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGitLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>Commit &amp; Push ke GitHub</span>
              </button>
              <button
                onClick={fetchGitStatus}
                title="Cek Status"
                className="p-2.5 bg-[#1e232d] hover:bg-[#29303d] text-[#cbd5e1] border border-[#2e3544] rounded-[3px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Status result */}
            {gitResult && (
              <div
                className={`p-3 rounded-[3px] border text-xs flex items-center gap-2 ${
                  gitResult.success
                    ? "bg-[#102419] border-[#10b981] text-[#10b981]"
                    : "bg-[#291717] border-[#ef4444] text-[#ef4444]"
                }`}
              >
                {gitResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{gitResult.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Vercel */}
        {activeTab === "vercel" && (
          <div className="mt-4 space-y-4 text-xs">
            <div className="p-3 bg-[#191d26] border border-[#2b3240] rounded-[3px] space-y-1">
              <div className="text-[#8892a4]">Vercel CLI Engine:</div>
              <div className="font-mono text-[#38bdf8] text-[11px] truncate">
                /Users/indragandi/npm-global/bin/vercel (Ready)
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-[#a1a7b5] uppercase">
                Vercel Token (Opsional jika sudah login via CLI)
              </label>
              <input
                type="password"
                placeholder="Masukkan Vercel Token untuk deploy instan..."
                value={vercelToken}
                onChange={(e) => setVercelToken(e.target.value)}
                className="w-full bg-[#1b1e25] border border-[#2e3442] focus:border-[#ea580c] rounded-[3px] px-3 py-2 text-xs text-[#f3f4f6] font-mono outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleDeployVercel(false)}
                disabled={isVercelLoading}
                className="py-2.5 bg-[#1f2430] hover:bg-[#2b3242] text-[#f3f4f6] border border-[#333d50] rounded-[3px] font-mono font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isVercelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ea580c]" /> : <Cloud className="w-3.5 h-3.5" />}
                <span>Deploy Preview</span>
              </button>

              <button
                onClick={() => handleDeployVercel(true)}
                disabled={isVercelLoading}
                className="py-2.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {isVercelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>Deploy Production</span>
              </button>
            </div>

            {/* Deploy result banner */}
            {deployResult && (
              <div
                className={`p-3 rounded-[3px] border text-xs space-y-1.5 ${
                  deployResult.success
                    ? "bg-[#102419] border-[#10b981] text-[#10b981]"
                    : "bg-[#291717] border-[#ef4444] text-[#ef4444]"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {deployResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{deployResult.message}</span>
                </div>
                {deployResult.url && (
                  <a
                    href={deployResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-white bg-[#0e1014] px-2.5 py-1 rounded-[2px] font-mono hover:underline mt-1"
                  >
                    <span>{deployResult.url}</span>
                    <ArrowUpRight className="w-3 h-3 text-[#f97316]" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#252a35] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-[#1a1c22] hover:bg-[#222630] text-[#9ca3af] hover:text-white rounded-[3px] border border-[#2e3442] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
