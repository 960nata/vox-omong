"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  ListTodo,
  Rocket,
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  Settings,
  Check,
} from "lucide-react";
import type { AgentModeType, AgentPermissionType } from "@/lib/types";

interface AgentModeDropdownProps {
  mode: AgentModeType;
  permission: AgentPermissionType;
  onChangeMode: (mode: AgentModeType) => void;
  onChangePermission: (permission: AgentPermissionType) => void;
  direction?: "up" | "down";
  compact?: boolean;
}

const MODES: Array<{
  id: AgentModeType;
  title: string;
  desc: string;
  Icon: React.ElementType;
}> = [
  {
    id: "interactive",
    title: "Interactive",
    desc: "Step-by-step collaboration",
    Icon: MessageSquare,
  },
  {
    id: "plan",
    title: "Plan",
    desc: "Plan first, execute when ready",
    Icon: ListTodo,
  },
  {
    id: "autopilot",
    title: "Autopilot",
    desc: "Works autonomously within permissions",
    Icon: Rocket,
  },
];

const PERMISSIONS: Array<{
  id: AgentPermissionType;
  label: string;
  badge: string;
  desc: string;
  Icon: React.ElementType;
}> = [
  {
    id: "manual",
    label: "Manual",
    badge: "Manual permissions",
    desc: "Minta persetujuan sebelum modifikasi kode & terminal",
    Icon: Settings,
  },
  {
    id: "auto",
    label: "Auto",
    badge: "Auto permissions",
    desc: "Eksekusi otomatis alat baca, visual critic, & riset",
    Icon: Zap,
  },
  {
    id: "sandbox",
    label: "Sandbox",
    badge: "Full sandbox",
    desc: "Otonom penuh di ruang kerja sandbox tanpa interupsi",
    Icon: Shield,
  },
];

export function AgentModeDropdown({
  mode = "interactive",
  permission = "manual",
  onChangeMode,
  onChangePermission,
  direction = "up",
  compact = false,
}: AgentModeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPermMenu, setShowPermMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeModeItem = MODES.find((m) => m.id === mode) || MODES[0];
  const activePermItem = PERMISSIONS.find((p) => p.id === permission) || PERMISSIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPermMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const ActiveModeIcon = activeModeItem.Icon;
  const ActivePermIcon = activePermItem.Icon;

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Pill Button matching user screenshot */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPermMenu(false);
        }}
        aria-expanded={isOpen}
        aria-label="Pilih Mode Agen & Izin Eksekusi"
        className="h-8 px-2.5 sm:px-3 rounded-full text-xs font-medium bg-raised hover:bg-hover border border-line-strong hover:border-accent text-fg flex items-center gap-2 transition-all shadow-xs cursor-pointer select-none"
      >
        <span className="flex items-center gap-1.5 text-accent font-semibold">
          <ActiveModeIcon className="w-3.5 h-3.5" strokeWidth={2} />
          <span>{activeModeItem.title}</span>
        </span>

        <span className="text-fg-4 select-none">|</span>

        <span className="text-fg-3 flex items-center gap-1 font-normal text-[11px] truncate max-w-[120px] sm:max-w-none">
          <ActivePermIcon className="w-3 h-3 text-fg-3" />
          <span>{activePermItem.badge}</span>
        </span>

        <ChevronDown
          className={`w-3 h-3 text-fg-3 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Card matching pixel-style of Cursor / Claude Code */}
      {isOpen && (
        <div
          className={`absolute ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          } left-0 w-72 sm:w-80 rounded-2xl bg-raised/95 backdrop-blur-xl border border-line-strong shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in duration-150 text-fg`}
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 flex items-center justify-between text-xs font-mono uppercase tracking-wider text-fg-3 border-b border-line/60">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-2">
              <ChevronDown className="w-3.5 h-3.5 text-accent" />
              Agent mode
            </span>
            <span className="text-[11px] text-accent font-sans font-medium capitalize">
              {activeModeItem.title}
            </span>
          </div>

          {/* Mode Options */}
          <div className="space-y-0.5 pt-0.5">
            {MODES.map((item) => {
              const isSelected = item.id === mode;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChangeMode(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer group ${
                    isSelected
                      ? "bg-hover text-fg shadow-inner border border-line"
                      : "text-fg-2 hover:bg-hover/60 hover:text-fg border border-transparent"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "bg-base text-fg-3 group-hover:text-fg group-hover:bg-hover border border-line"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-fg flex items-center gap-1.5">
                        {item.title}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={2.5} />
                      )}
                    </div>
                    <p className="text-[11px] text-fg-3 leading-snug mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-line/60 my-0.5" />

          {/* Permissions Toggle Row */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPermMenu(!showPermMenu)}
              className="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-hover transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-fg-2 group-hover:text-fg">
                <ChevronRight
                  className={`w-3.5 h-3.5 text-fg-3 transition-transform ${
                    showPermMenu ? "rotate-90 text-accent" : ""
                  }`}
                />
                <span className="font-medium text-xs">Permissions</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-accent">
                <ActivePermIcon className="w-3.5 h-3.5" />
                <span>{activePermItem.label}</span>
              </div>
            </button>

            {/* Sub-menu Permissions */}
            {showPermMenu && (
              <div className="mt-1 p-1 bg-base/80 border border-line rounded-xl space-y-0.5 animate-in fade-in duration-100">
                {PERMISSIONS.map((perm) => {
                  const isSelected = perm.id === permission;
                  const Icon = perm.Icon;
                  return (
                    <button
                      key={perm.id}
                      type="button"
                      onClick={() => {
                        onChangePermission(perm.id);
                        setShowPermMenu(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-fg-3 hover:text-fg hover:bg-hover"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <div>
                          <div className="text-[11px] font-medium leading-none">{perm.label}</div>
                          <div className="text-[9px] text-fg-4 leading-tight mt-0.5">{perm.desc}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
