"use client";

import React, { useState } from "react";
import { Message } from "@/lib/types";
import { ArtifactCard } from "./ArtifactCard";
import { Volume2, VolumeX, Copy, Check, Bot, User, Maximize2, X } from "lucide-react";

interface MessageItemProps {
  message: Message;
  onSpeak: (text: string) => void;
  isCurrentSpeaking: boolean;
  onStopSpeaking: () => void;
}

export function MessageItem({
  message,
  onSpeak,
  isCurrentSpeaking,
  onStopSpeaking,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const isAssistant = message.role === "assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`group relative flex gap-3 p-3.5 rounded-[3px] border transition-colors ${
        isAssistant
          ? "bg-[#161820] border-[#252a36] text-[#e5e7eb]"
          : "bg-[#1e1c1a] border-[#362e28] text-[#f3f4f6]"
      }`}
    >
      {/* Role icon avatar */}
      <div
        className={`w-7 h-7 rounded-[3px] shrink-0 flex items-center justify-center text-xs font-mono border ${
          isAssistant
            ? "bg-[#221c18] border-[#ea580c]/50 text-[#f97316]"
            : "bg-[#222732] border-[#394254] text-[#9ca3af]"
        }`}
      >
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between pb-1 text-[11px] font-mono">
          <span className={isAssistant ? "text-[#f97316] font-semibold" : "text-[#d1d5db] font-semibold"}>
            {isAssistant ? "VOX·AI" : "YOU"}
          </span>
          <span className="text-[#646d80] text-[10px]">{formattedTime}</span>
        </div>

        {/* Uploaded Image Preview if attached */}
        {message.imageUri && (
          <div className="my-2 inline-block relative group/img">
            <img
              src={message.imageUri}
              alt="Lampiran pengguna"
              onClick={() => setIsPreviewModalOpen(true)}
              className="max-h-64 max-w-full rounded-[3px] border border-[#3b4356] object-cover cursor-pointer hover:border-[#ea580c] transition-colors"
            />
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              title="Perbesar gambar"
              className="absolute bottom-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-[2px] opacity-0 group-hover/img:opacity-100 transition-opacity"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Text Body */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap select-text text-[#e2e5eb]">
          {message.content}
        </div>

        {/* Action / Execution Artifact Card */}
        {message.artifact && (
          <div className="mt-2.5">
            <ArtifactCard artifact={message.artifact} />
          </div>
        )}

        {/* Action buttons footer */}
        <div className="mt-2.5 pt-2 border-t border-[#222733]/60 flex items-center gap-2">
          {isAssistant && (
            <button
              onClick={() => {
                if (isCurrentSpeaking) {
                  onStopSpeaking();
                } else {
                  onSpeak(message.content);
                }
              }}
              title={isCurrentSpeaking ? "Hentikan Suara" : "Dengarkan Jawaban"}
              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono rounded-[3px] border transition-colors ${
                isCurrentSpeaking
                  ? "bg-[#2b1f1a] border-[#ea580c] text-[#f97316] animate-pulse"
                  : "bg-[#1c202a] border-[#2c3342] text-[#8e97aa] hover:text-[#f3f4f6] hover:border-[#3d4659]"
              }`}
            >
              {isCurrentSpeaking ? (
                <>
                  <VolumeX className="w-3 h-3 text-[#ea580c]" /> Hentikan
                </>
              ) : (
                <>
                  <Volume2 className="w-3 h-3 text-[#f97316]" /> Dengarkan
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCopy}
            title="Salin teks"
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono bg-[#1c202a] border border-[#2c3342] text-[#8e97aa] hover:text-[#f3f4f6] hover:border-[#3d4659] rounded-[3px] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#10b981]" /> Tersalin
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Salin
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fullscreen Image Zoom Modal */}
      {isPreviewModalOpen && message.imageUri && (
        <div
          onClick={() => setIsPreviewModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 cursor-zoom-out animate-fadeIn"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-[#111317] border border-[#2b3345] rounded-[3px] p-2">
            <button
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute -top-3 -right-3 p-1.5 bg-[#ea580c] hover:bg-[#f97316] text-white rounded-[3px] shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={message.imageUri}
              alt="Preview Full"
              className="max-h-[85vh] max-w-full rounded-[2px] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}