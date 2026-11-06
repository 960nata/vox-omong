"use client";

import React from "react";
import { Conversation } from "@/lib/types";
import { Plus, MessageSquare, Trash2, Radio } from "lucide-react";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  isOpen: boolean;
  onClose?: () => void;
  onCloseMobile?: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
  onCloseMobile,
}: ConversationSidebarProps) {
  const handleClose = onClose || onCloseMobile;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#121418] border-r border-[#242934] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#242934] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[3px] bg-[#221c18] border border-[#ea580c]/40 flex items-center justify-center text-[#f97316]">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-[#f3f4f6]">
                VOX·AI STUDIO
              </div>
              <div className="text-[10px] font-mono text-[#788195] tracking-widest">
                ACOUSTIC AGENT V1
              </div>
            </div>
          </div>
        </div>

        {/* New Session Button */}
        <div className="p-3">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#1e232c] hover:bg-[#282f3c] text-[#f3f4f6] text-xs font-mono tracking-wider border border-[#333b4d] rounded-[3px] transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#ea580c]" />
            SESI BARU
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 scrollbar-thin">
          <div className="px-2 py-1 text-[10px] font-mono tracking-wider uppercase text-[#5a6273]">
            Riwayat Percakapan
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#5a6273]">
              Belum ada percakapan tersimpan
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelect(conv.id);
                    if (handleClose) handleClose();
                  }}
                  className={`group relative flex items-center justify-between p-2.5 text-xs rounded-[3px] cursor-pointer border transition-colors ${
                    isActive
                      ? "bg-[#201d1b] border-[#ea580c]/50 text-[#f97316]"
                      : "bg-[#16191f] border-transparent text-[#9ca3af] hover:bg-[#1b1f26] hover:text-[#d1d5db]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-6">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-[#f97316]" : "text-[#555d6e]"
                      }`}
                    />
                    <span className="truncate font-medium">{conv.title}</span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => onDelete(conv.id, e)}
                    title="Hapus sesi"
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#6e778a] hover:text-[#ef4444] hover:bg-[#282020] rounded-[3px] transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info badge */}
        <div className="p-3 border-t border-[#242934] bg-[#0e1014] text-[11px] font-mono text-[#626a7c] flex justify-between items-center">
          <span>LATENCY: &lt;180ms</span>
          <span className="flex items-center gap-1.5 text-[#10b981]">
            <span className="w-1.5 h-1.5 rounded-[2px] bg-[#10b981]" /> READY
          </span>
        </div>
      </aside>
    </>
  );
}
