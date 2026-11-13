"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Conversation, Message, VoiceSettings } from "@/lib/types";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import { AudioControls } from "@/components/AudioControls";
import { TeamSidebar, type TeamChatSelection } from "@/components/TeamSidebar";
import { TeamChatPanel } from "@/components/TeamChatPanel";
import { MessageItem } from "@/components/MessageItem";
import { SettingsModal, NEURAL_VOICES } from "@/components/SettingsModal";
import { RightWorkspacePanel, WorkspaceTab } from "@/components/RightWorkspacePanel";
import { CoworkerCursorOperator } from "@/components/CoworkerCursorOperator";
import { Logo } from "@/components/Logo";
import { Btn, ArrowIcon } from "@/components/Btn";
import { WebsiteStudio } from "@/components/WebsiteStudio";
import { AcousticBackground } from "@/components/AcousticBackground";
import { ChatBackground } from "@/components/ChatBackground";
import { playJarvisSound } from "@/lib/jarvisSounds";
import { detectBrowserTask } from "@/lib/browserIntent";
import { syncSavedLocalProject, writeAgentChangesToLocalFolder } from "@/lib/browserLocalProject";
import {
  Menu,
  Mic,
  Settings as SettingsIcon,
  Zap,
  Terminal,
  GitBranch,
  HardDrive,
  Globe,
  PanelRight,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Sparkles,
  Brain,
  Feather,
  Code2,
  Phone,
  Shield,
  Cpu,
  Sliders,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { AIMode } from "@/lib/types";

const AI_MODES: Array<{
  id: AIMode;
  name: string;
  Icon: React.ElementType;
}> = [
  // Cepat & Daily
  { id: "flash", name: "DeepSeek Flash", Icon: Feather },
  { id: "user-private", name: "Gateway Pribadi (aigw)", Icon: Shield },
  { id: "coding-china-auto", name: "Coding China (Auto)", Icon: Zap },
  { id: "coding-us-auto", name: "Coding US (Auto)", Icon: Zap },
  { id: "duo", name: "Duo Engine", Icon: Zap },

  // Coding & Reasoning Cepat
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", Icon: Cpu },
  { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", Icon: Code2 },
  { id: "qwen-plus", name: "Qwen 3.7 Plus", Icon: Zap },
  { id: "glm-5.3-flash", name: "GLM 5.3 Flash", Icon: Feather },
  { id: "minimax-m3", name: "MiniMax M3", Icon: Zap },
  { id: "hy3", name: "Hy3 Hunyuan", Icon: Cpu },

  // Flagship Sultan
  { id: "sonnet-5.5", name: "Claude Sonnet 5.5", Icon: Code2 },
  { id: "opus-5.5", name: "Claude Opus 5.5", Icon: Brain },
  { id: "claude-fable-5", name: "Claude Fable 5", Icon: Brain },
  { id: "gpt-6-astra", name: "GPT-6 Astra", Icon: Brain },
  { id: "gpt-6-sol", name: "GPT-6 Sol", Icon: Brain },
  { id: "grok-4.7", name: "Grok 4.7", Icon: Brain },
  { id: "qwen-max", name: "Qwen 3.8 Max", Icon: Cpu },

  // Vision & 100% Gratis
  { id: "haiku-5.5", name: "Claude Haiku 5.5", Icon: Sparkles },
  { id: "kai-baik", name: "Kai Grant (Free)", Icon: Sparkles },
  { id: "nemotron-3.5-super-vl:free", name: "Nemotron Super VL (Free)", Icon: Feather },
  { id: "nemotron-3-nano-omni:free", name: "Nemotron Nano Omni (Free)", Icon: Feather },
  { id: "north-mini-code:free", name: "North Mini Code (Free)", Icon: Code2 },
  { id: "free-nemotron", name: "Nemotron 3.5 (Free)", Icon: Feather },
  { id: "free-solar", name: "Solar Mini 4 (Free)", Icon: Feather },
  { id: "gemma-4-31b:free", name: "Gemma 4 31B (Free)", Icon: Feather },
  { id: "lfm-3-1.7b:free", name: "LFM 3 1.7B (Free)", Icon: Zap },
  { id: "hybrid", name: "Hybrid Engine", Icon: Sparkles },
];

const DEFAULT_SETTINGS: VoiceSettings = {
  apiKey: "", // kosong = server memakai AI_GATEWAY_KEY dari .env.local
  aiMode: "flash", // Mode default: DeepSeek Flash (Super Irit & Anti Boncos)
  agentMode: "interactive",
  agentPermission: "manual",
  language: "id-ID",
  ttsProvider: "neural",
  neuralVoice: "id-ID-GadisNeural",
  voiceURI: "",
  pitch: 1.0,
  rate: 1.0,
  autoSpeak: true,
  systemPrompt: "",
  jarvisMode: true,
  silenceTimeoutMs: 1200,
  mcpEnabled: [],
};

export default function VoiceAiStudio() {
  const { resolved: theme, setTheme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Audio / Speech States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Lagi mikir…");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [jarvisMode, setJarvisMode] = useState(true);

  // Settings & Panels
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("preview");
  const [previewUrl, setPreviewUrl] = useState("/api/preview?projectId=default-workspace");
  const [activeProjectId, setActiveProjectId] = useState("default-workspace");
  const [pendingLocalWrite, setPendingLocalWrite] = useState<{ projectId: string; paths: string[] } | null>(null);
  const [localWriteStatus, setLocalWriteStatus] = useState("");
  const [projectRestored, setProjectRestored] = useState(false);

  // Studio PIN Protection (untuk akses remote / HP)
  const [pinRequired, setPinRequired] = useState(false);
  const [pinAuthorized, setPinAuthorized] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinChecking, setPinChecking] = useState(false);

  useEffect(() => {
    fetch("/api/auth/pin")
      .then((r) => r.json())
      .then((data) => {
        if (data.required) {
          setPinRequired(true);
          setPinAuthorized(data.authorized === true);
        }
      })
      .catch(() => {});
  }, []);

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) return;
    setPinChecking(true);
    setPinError("");
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setPinAuthorized(true);
      } else {
        setPinError(data.error || "PIN tidak sesuai");
      }
    } catch {
      setPinError("Gagal menghubungi server");
    } finally {
      setPinChecking(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("vox_active_project");
    if (saved && /^[a-z0-9_-]+$/.test(saved)) {
      setActiveProjectId(saved);
      if (saved.startsWith("session-")) {
        fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_session", sessionId: saved }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.session?.conversationId) {
              setActiveConvId(data.session.conversationId);
            }
          })
          .catch(() => {});
      }
    }
    setProjectRestored(true);
  }, []);
  useEffect(() => {
    if (projectRestored) localStorage.setItem("vox_active_project", activeProjectId);
    if (typeof window !== "undefined") {
      (window as any).__activeVoxProject = activeProjectId;
    }
  }, [activeProjectId, projectRestored]);

  // Deteksi otomatis: Jika project masih kosongan, buka tab Explorer. Jika ada website, buka Preview otomatis!
  useEffect(() => {
    fetch(`/api/fs?projectId=${encodeURIComponent(activeProjectId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          const hasWebsite = data.files.some((f: any) => f.path === "index.html" || f.path.endsWith("/index.html"));
          if (hasWebsite) {
            setWorkspaceTab("preview");
          } else {
            setWorkspaceTab("explorer");
          }
        }
      })
      .catch(() => {});
  }, [activeProjectId]);
  const [selectedTeamChat, setSelectedTeamChat] = useState<(TeamChatSelection & { projectId: string }) | null>(null);
  const [pendingTeamFolder, setPendingTeamFolder] = useState<{ projectId: string; teamId: string; name: string; itemCount: number } | null>(null);
  const activeTeamChat = selectedTeamChat?.projectId === activeProjectId ? selectedTeamChat : null;
  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModeOpen(false);
    };
    if (isModeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModeOpen]);

  // Window viewport width & adaptive layout management
  // Mulai dari nilai tetap agar render server & client sama (hindari hydration mismatch)
  const [windowWidth, setWindowWidth] = useState<number>(1280);

  // Di HP, buka dengan chat penuh: sidebar & panel workspace ditutup dulu
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsRightPanelOpen(false);
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isNarrowScreen = windowWidth < 1180;
  const isSidebarDrawer = isNarrowScreen && isRightPanelOpen;

  // Auto-collapse sidebar on narrow screen when right workspace panel is open
  useEffect(() => {
    if (windowWidth < 1180 && isRightPanelOpen) {
      setIsSidebarOpen(false);
    }
  }, [windowWidth, isRightPanelOpen]);

  // Refs for Speech Recognition & Audio
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isTeamCalling, setIsTeamCalling] = useState(false);
  const teamCallRef = useRef<{ teamId: string; memberId: string; voice?: string } | null>(null);
  const teamVoiceAbortRef = useRef<AbortController | null>(null);
  const audioDoneRef = useRef<(() => void) | null>(null);
  const activeConvRef = useRef<string | null>(activeConvId);
  const settingsRef = useRef<VoiceSettings>(settings);

  // Audio Mutex & Controller for Double-Voice Prevention & Fast Response
  const speechSessionIdRef = useRef<number>(0);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);

  // JARVIS VAD (Voice Activity Detection) & State Refs
  const transcriptAccumulatorRef = useRef<string>("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const jarvisModeRef = useRef<boolean>(true);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const wantListeningRef = useRef<boolean>(false);

  activeConvRef.current = activeConvId;
  settingsRef.current = settings;
  isSpeakingRef.current = isSpeaking;
  isProcessingRef.current = isProcessing;
  jarvisModeRef.current = jarvisMode;

  // Kartu website di chat bisa minta panel Preview dibuka
  useEffect(() => {
    const onOpen = (e: Event) => {
      const url = (e as CustomEvent<{ url?: string }>).detail?.url;
      if (url) setPreviewUrl(url);
      setIsRightPanelOpen(true);
      setWorkspaceTab("preview");
    };
    window.addEventListener("vox_open_preview", onOpen);
    return () => window.removeEventListener("vox_open_preview", onOpen);
  }, []);

  // Load saved settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vox_ai_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Jika apiKey yang tersimpan di browser adalah format lama/dummy (misal "aigw_..." atau bukan sk_live_/AIzaSy),
        // bersihkan otomatis agar langsung memakai kuota server 775 Juta Kredit (.env.local) tanpa error 401.
        const cleanApiKey = parsed.apiKey && (parsed.apiKey.startsWith("sk_live_") || parsed.apiKey.startsWith("AIzaSy"))
          ? parsed.apiKey
          : "";
        if (parsed.apiKey && !cleanApiKey) {
          localStorage.setItem("vox_ai_settings", JSON.stringify({ ...parsed, apiKey: "" }));
        }
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          apiKey: cleanApiKey,
          // prompt tambahan berlaku per sesi: tidak pernah dipulihkan dari sesi sebelumnya
          systemPrompt: "",
          ttsProvider: parsed.ttsProvider || "neural",
          neuralVoice: parsed.neuralVoice || "id-ID-GadisNeural",
          // default lama 2.2 detik terasa lambat → pakai 1.2 detik
          silenceTimeoutMs: !parsed.silenceTimeoutMs || parsed.silenceTimeoutMs === 2200 ? 1200 : parsed.silenceTimeoutMs,
        });
        if (typeof parsed.jarvisMode === "boolean") {
          setJarvisMode(parsed.jarvisMode);
        }
      }
    } catch (e) {
      console.warn("Could not load stored settings", e);
    }
  }, []);

  // Save settings helper
  const handleSaveSettings = (newSettings: VoiceSettings) => {
    stopSpeaking();
    setSettings(newSettings);
    try {
      // prompt tambahan sesi tidak disimpan permanen
      localStorage.setItem("vox_ai_settings", JSON.stringify({ ...newSettings, systemPrompt: "" }));
    } catch (e) {
      console.warn("Could not save settings to localStorage", e);
    }
  };

  // Populate browser synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Fetch conversations on load
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (data.conversations && data.conversations.length > 0) {
        setConversations(data.conversations);
        if (!activeConvRef.current) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${activeConvId}`);
        const data = await res.json();
        if (data.conversation) {
          setMessages(data.conversation.messages || []);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };

    fetchMessages();
  }, [activeConvId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    const chat = chatScrollRef.current;
    chat?.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  }, [messages, liveTranscript]);


  // Satu stream per balasan menjaga intonasi dan karakter suara sepanjang ucapan.
  const fillerAudioRef = useRef<HTMLAudioElement | null>(null);

  const ttsUrl = (text: string, voiceSettings = settingsRef.current) =>
    `/api/tts?${new URLSearchParams({
      text,
      voice: voiceSettings.neuralVoice || (voiceSettings.language === "en-US" ? "en-US-JennyNeural" : "id-ID-GadisNeural"),
      rate: String(voiceSettings.rate || 1),
      pitch: String(voiceSettings.pitch || 1),
    })}`;

  const FILLERS_QUICK = ["Oke, bentar ya.", "Hmm, oke.", "Siap, aku cek dulu.", "Oke, sebentar."];
  const FILLERS_WORK = ["Siap, aku kerjain sekarang. Tunggu sebentar ya.", "Oke, tim AI-nya lagi rapat dulu. Bentar ya."];

  // Panaskan cache audio pengisi supaya bisa diputar instan
  useEffect(() => {
    if (settings.ttsProvider !== "neural") return;
    [...FILLERS_QUICK, ...FILLERS_WORK].forEach((f) => {
      fetch(ttsUrl(f)).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.neuralVoice, settings.rate, settings.pitch, settings.ttsProvider]);

  /** Respons instan "oke, bentar ya" sementara AI berpikir. */
  const playFiller = (heavy: boolean) => {
    if (settingsRef.current.ttsProvider !== "neural" || !settingsRef.current.autoSpeak) return;
    const pool = heavy ? FILLERS_WORK : FILLERS_QUICK;
    const a = new Audio(ttsUrl(pool[Math.floor(Math.random() * pool.length)]));
    fillerAudioRef.current = a;
    a.onended = () => {
      if (fillerAudioRef.current === a) fillerAudioRef.current = null;
    };
    a.play().catch(() => {});
  };

  const waitForFiller = () =>
    new Promise<void>((resolve) => {
      const a = fillerAudioRef.current;
      if (!a || a.paused || a.ended) return resolve();
      const done = () => resolve();
      a.addEventListener("ended", done, { once: true });
      a.addEventListener("error", done, { once: true });
      setTimeout(done, 3000);
    });

  // Stop currently playing audio or speech synthesis
  const stopSpeaking = () => {
    speechSessionIdRef.current++;
    audioDoneRef.current?.();
    audioDoneRef.current = null;

    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.removeAttribute("src");
      currentAudioRef.current = null;
    }
    if (fillerAudioRef.current) {
      fillerAudioRef.current.pause();
      fillerAudioRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  const resumeHandsFree = () => {
    const session = speechSessionIdRef.current;
    if ((teamCallRef.current || jarvisModeRef.current) && !isProcessingRef.current) {
      setTimeout(() => {
        if (speechSessionIdRef.current !== session || isProcessingRef.current) return;
        playJarvisSound("listen");
        startListening();
      }, teamCallRef.current ? 0 : 250);
    }
  };

  const speakText = async (text: string, opts: { afterFiller?: boolean; voice?: string; noResume?: boolean } = {}) => {
    const voiceSettings: VoiceSettings = { ...settingsRef.current, ...(opts.voice ? { ttsProvider: "neural", neuralVoice: opts.voice } : {}) };
    const waitingSession = speechSessionIdRef.current;
    if (opts.afterFiller) await waitForFiller();
    if (speechSessionIdRef.current !== waitingSession) return;
    stopSpeaking();
    setSpeechError(null);
    if (!text || !text.trim()) return;

    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, " Kodenya udah aku tampilkan di layar. ")
      .replace(/https?:\/\/\S+/g, "tautan")
      .replace(/[*#_~`>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleanSpeech) return;

    const currentSessionId = ++speechSessionIdRef.current;

    // Gagal Neural tetap memakai pilihan user: tampilkan status, jangan pindah karakter suara.
    if (voiceSettings.ttsProvider === "neural") {
      const audio = new Audio(ttsUrl(cleanSpeech.slice(0, 650), voiceSettings));
      currentAudioRef.current = audio;
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      const ok = await new Promise<boolean>((resolve) => {
        audioDoneRef.current = () => resolve(false);
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
      audio.onended = null;
      audio.onerror = null;
      if (speechSessionIdRef.current !== currentSessionId) return;
      audioDoneRef.current = null;
      currentAudioRef.current = null;
      audio.removeAttribute("src");
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      if (!ok) setSpeechError("Suara pilihanmu gagal diputar. Coba putar ulang pesan.");
      if (!opts.noResume) resumeHandsFree();
      return;
    }

    // Suara browser hanya dipakai ketika dipilih di Pengaturan.
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanSpeech.slice(0, 650));
    utterance.lang = voiceSettings.language;
    utterance.rate = voiceSettings.rate || 1.0;
    utterance.pitch = voiceSettings.pitch || 1.0;
    const voices = window.speechSynthesis.getVoices();
    const matched = voiceSettings.voiceURI
      ? voices.find((v) => v.voiceURI === voiceSettings.voiceURI)
      : voices.filter((v) => v.lang === voiceSettings.language).sort((a, b) => a.voiceURI.localeCompare(b.voiceURI))[0];
    if (!matched) {
      setSpeechError("Suara browser pilihanmu belum tersedia. Pilih suara di Pengaturan.");
      if (!opts.noResume) resumeHandsFree();
      return;
    }
    utterance.voice = matched;
    utterance.onstart = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      }
    };
    utterance.onend = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        if (!opts.noResume) resumeHandsFree();
      }
    };
    utterance.onerror = () => {
      if (speechSessionIdRef.current === currentSessionId) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  // Send message to backend
  const handleSendMessage = async (text: string, imageUri?: string, dataUri?: string, fromVoice = false, attachedItem?: any) => {
    if (!text.trim() || isProcessingRef.current) return;
    if (fromVoice && teamCallRef.current) {
      const target = teamCallRef.current;
      const controller = new AbortController();
      teamVoiceAbortRef.current = controller;
      const current = () => !controller.signal.aborted && teamCallRef.current === target;
      setIsProcessing(true);
      isProcessingRef.current = true;
      setLiveTranscript(text);
      let queue = Promise.resolve();
      let pending = "";
      let received = false;
      let complete = false;
      let spokenChars = 0;
      const play = (chunk: string) => {
        const phrase = chunk.trim().slice(0, 650 - spokenChars);
        if (!phrase) return;
        spokenChars += phrase.length;
        queue = queue.then(async () => {
          if (current()) await speakText(phrase, { voice: target.voice, noResume: true });
        });
      };
      try {
        const response = await fetch("/api/teams/voice", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ teamId: target.teamId, memberId: target.memberId, message: text, apiKey: settingsRef.current.apiKey || undefined }),
        });
        if (!response.ok || !response.body) throw new Error("Panggilan belum bisa terhubung ke AI.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (current()) {
            const result = await reader.read();
            buffer += result.done ? decoder.decode() : decoder.decode(result.value, { stream: true });
            let boundary: number;
            while ((boundary = buffer.indexOf("\n\n")) >= 0) {
              const block = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              if (!block.startsWith("data: ")) continue;
              const event = JSON.parse(block.slice(6));
              if (event.type === "error") throw new Error(event.error || "AI belum bisa membalas.");
              if (event.type === "team") {
                complete = true;
                window.dispatchEvent(new CustomEvent("vox_teams_updated", { detail: { team: event.team } }));
                if (!received) {
                  const reply = event.team?.messages?.findLast((m: { channel: string; role: string; memberId: string }) => m.channel === "direct" && m.role === "assistant" && m.memberId === target.memberId);
                  if (reply?.content) pending += reply.content;
                }
              }
              if (event.type === "text" && typeof event.text === "string") {
                received = true;
                pending += event.text;
                const sentence = pending.match(/^([\s\S]{35,180}?[.!?…])(?:\s|$)/);
                const cut = sentence?.[1].length || (pending.length > 200 ? Math.max(120, pending.lastIndexOf(" ", 175)) : 0);
                if (cut) { play(pending.slice(0, cut)); pending = pending.slice(cut); }
              }
            }
            if (result.done) break;
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        if (current() && !complete) throw new Error("Balasan suara terputus.");
        play(pending);
        await queue;
      } catch (error) {
        if (current()) {
          stopSpeaking();
          setSpeechError((error as Error).message);
          controller.abort();
        }
      } finally {
        if (teamVoiceAbortRef.current === controller) {
          teamVoiceAbortRef.current = null;
          setIsProcessing(false);
          isProcessingRef.current = false;
          if (teamCallRef.current === target) resumeHandsFree();
        }
      }
      return;
    }
    const cleanQuery = text.toLowerCase().trim();
    const isScanRequest = /\b(?:scan(?:ning)?|pindai)\b|ambil.*(?:section|komponen)|tiru.*(?:section|hero)/i.test(text);
    const isBrowserRequest = detectBrowserTask(text) !== null;
    const isTeamRequest = /\b(?:team|tim|grup|rapat)\b/i.test(text);

    stopSpeaking();
    setIsProcessing(true);
    isProcessingRef.current = true;
    setLiveTranscript("");
    if (fromVoice) {
      playFiller(/web|landing|halaman|dashboard|aplikasi|app|game|slide|presentasi|dokumen|laporan|proposal|invoice|tabel|ubah|ganti|tambah/i.test(text));
    }
    {
      const q = text.toLowerCase();
      setProcessingLabel(
        isScanRequest
          ? "Memindai referensi website…"
          : isBrowserRequest
            ? "Membaca halaman browser…"
            : isTeamRequest
              ? "Menghubungi tim AI…"
              : /slide|presentasi|ppt|pitch/.test(q)
          ? "Lagi nyusun slide presentasi… (±20–40 detik)"
          : /invoice|tagihan|faktur/.test(q)
            ? "Lagi bikin invoice…"
            : /excel|spreadsheet|tabel|csv|cashflow/.test(q)
              ? "Lagi nyusun tabel…"
              : /dokumen|laporan|proposal|surat|pdf|artikel/.test(q)
                ? "Lagi nulis dokumen… (±20–40 detik)"
                : /web|landing|halaman|dashboard|aplikasi|app|game|kalkulator|ubah|ganti|tambah/.test(q)
                  ? "Lagi nulis kode website… (±20–60 detik)"
                  : "Lagi mikir…"
      );
    }

    // JARVIS Wake Word Quick Response
    if (cleanQuery === "jarvis" || cleanQuery === "halo jarvis" || cleanQuery === "hey jarvis" || cleanQuery === "hai jarvis") {
      const jarvisGreet = "Ya cuy, Jarvis online dan standby! Mau ngerjain coding, dokumen, terminal, atau deploy apa sekarang?";
      const targetConvId = activeConvId || "conv-default";
      const userMsg: Message = {
        id: `usr-${Date.now()}`,
        conversationId: targetConvId,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        conversationId: targetConvId,
        role: "assistant",
        content: jarvisGreet,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      speakText(jarvisGreet);
      setIsProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    // Voice / text command panel switches
    if (cleanQuery.includes("terminal") || cleanQuery.includes("buka terminal") || cleanQuery.includes("cek terminal")) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("terminal");
    } else if (
      cleanQuery.includes("buka explorer") ||
      cleanQuery.includes("folder") ||
      cleanQuery.includes("lihat file") ||
      cleanQuery.includes("file explorer")
    ) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("explorer");
    } else if (!isScanRequest && !isBrowserRequest && !isTeamRequest && (
      cleanQuery.includes("website") ||
      cleanQuery.includes("preview") ||
      cleanQuery.includes("tampilkan web") ||
      cleanQuery.includes("lihat website")
    )) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("preview");
    } else if (
      cleanQuery.includes("deploy") ||
      cleanQuery.includes("vercel") ||
      cleanQuery.includes("github") ||
      cleanQuery.includes("auto deploy")
    ) {
      setIsRightPanelOpen(true);
      setWorkspaceTab("deploy");
    }

    if (
      cleanQuery.includes("coworker") ||
      cleanQuery.includes("kursor") ||
      cleanQuery.includes("cursor") ||
      cleanQuery.includes("kendali kursor") ||
      cleanQuery.includes("demo otomatis") ||
      cleanQuery.includes("tour otomatis")
    ) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vox_trigger_coworker"));
      }
    }

    const targetConvId = activeConvId || "conv-default";

    // Optimistically append user message with imageUri or attachedItem if present
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: targetConvId,
      role: "user",
      content: text,
      imageUri: imageUri || dataUri,
      attachedItem,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      await syncSavedLocalProject(activeProjectId);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConvId,
          message: text,
          language: settingsRef.current.language,
          apiKey: settingsRef.current.apiKey,
          aiMode: settingsRef.current.aiMode || "duo",
          agentMode: settingsRef.current.agentMode || "interactive",
          agentPermission: settingsRef.current.agentPermission || "manual",
          systemPrompt: settingsRef.current.systemPrompt,
          imageUri: imageUri,
          imageDataUri: dataUri,
          attachedItem,
          activeProjectId,
          mcpEnabled: settingsRef.current.mcpEnabled || [],
        }),
      });

      const data = await res.json();
      if (data.success && data.assistantMessage) {
        if (data.teamUpdated === true) {
          window.dispatchEvent(new CustomEvent("vox_teams_updated"));
        }
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);
        if (activeProjectId.startsWith("local-") && Array.isArray(data.codingChangedFiles) && data.codingChangedFiles.length) {
          const paths = data.codingChangedFiles.filter((item: unknown): item is string => typeof item === "string");
          try {
            const applied = await writeAgentChangesToLocalFolder(activeProjectId, paths);
            if (applied.written.length) setLocalWriteStatus(`${applied.written.length} file hasil agen tersimpan ke folder Mac.`);
            if (applied.conflicts.length) setLocalWriteStatus(`File asli berubah sejak dibaca: ${applied.conflicts.join(", ")}. VOX tidak menimpanya; hasil agen tetap ada di salinan project.`);
            if (applied.needsPermission) {
              setPendingLocalWrite({ projectId: activeProjectId, paths });
              setLocalWriteStatus("Hasil edit ada di project VOX. Beri izin tulis untuk menyimpannya ke folder Mac.");
            } else setPendingLocalWrite(null);
          } catch (error) {
            setPendingLocalWrite({ projectId: activeProjectId, paths });
            setLocalWriteStatus(`Belum tersimpan ke folder Mac: ${(error as Error).message}`);
          }
        }

        // Website baru → buka full page. Kalau user minta lihat kode/struktur, langsung tab Kode.
        const art = data.assistantMessage.artifact;
        if (art?.type === "website" && art.website) {
          const wantCode = /\b(kode|code|struktur|file|source)\b/i.test(text);
          window.dispatchEvent(new CustomEvent("vox_open_studio", { detail: { artifact: art, tab: wantCode ? "code" : "preview" } }));
        }

        // Project dibuat/dibuka lewat suara atau teks: jadikan aktif dan tampilkan isinya
        if (typeof data.projectId === "string" && data.projectId !== activeProjectIdRef.current) {
          setActiveProjectId(data.projectId);
        }
        if (data.projectAction === "created" || data.projectAction === "opened") {
          setPreviewUrl(`/api/preview?projectId=${encodeURIComponent(data.projectId)}&t=${Date.now()}`);
          setIsRightPanelOpen(true);
          setWorkspaceTab(data.projectAction === "created" ? "explorer" : "preview");
        }

        // If folder created, switch to explorer tab
        if (data.createdFolder) {
          setIsRightPanelOpen(true);
          setWorkspaceTab("explorer");
        }

        // If preview URL updated with generated component/page, reload preview tab
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setIsRightPanelOpen(true);
          setWorkspaceTab((current) => current === "explorer" ? current : "preview");
        }

        // Auto speak if enabled
        if (settingsRef.current.autoSpeak) {
          speakText(data.assistantMessage.content, { afterFiller: fromVoice });
        }

        // Refresh conversation list to update titles/timestamps
        loadConversations();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, {
        id: `local-error-${Date.now()}`,
        conversationId: targetConvId,
        role: "assistant",
        content: (err as Error).message || "Gagal membaca project lokal.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  // Event listener untuk tombol aksi UI (seperti tombol Undo perubahan agen)
  useEffect(() => {
    const onSend = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (text) handleSendMessage(text);
    };
    window.addEventListener("vox_send_chat", onSend);
    return () => window.removeEventListener("vox_send_chat", onSend);
  }, [activeConvId, activeProjectId, settings]);
  const startListening = async () => {
    stopSpeaking();
    playJarvisSound("wake");

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    transcriptAccumulatorRef.current = "";

    // 1. Acquire microphone stream for real-time visualizer
    try {
      if (!audioStreamRef.current) {
        const call = teamCallRef.current;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (call && call !== teamCallRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        audioStreamRef.current = stream;
        setAudioStream(stream);
      }
    } catch (err) {
      console.warn("Could not capture microphone stream for visualizer:", err);
    }

    // 2. Setup Web SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser Anda belum mendukung Web Speech API. Silakan gunakan Google Chrome atau Edge.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = settingsRef.current.language;
    recognition.continuous = true; // JARVIS: Continuous listening, DO NOT abort on micro-pauses!
    recognition.interimResults = true;

    wantListeningRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript("");
    };

    // VAD Silence Timeout: 2.2 seconds allows the user to pause, breathe, or think without premature cutoff
    const SILENCE_THRESHOLD_MS = teamCallRef.current ? 550 : settingsRef.current.silenceTimeoutMs || 1200;

    recognition.onresult = (event: any) => {
      // Natural Barge-In: if JARVIS is talking while user speaks, interrupt immediately!
      if (isSpeakingRef.current) {
        stopSpeaking();
        playJarvisSound("interrupt");
      }

      let currentFinal = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (currentFinal) {
        transcriptAccumulatorRef.current += currentFinal;
      }

      const fullSpoken = (transcriptAccumulatorRef.current + " " + interim).trim();
      setLiveTranscript(fullSpoken);

      // Reset the silence debounce timer on every spoken syllable
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Only schedule finalization when user actually pauses for SILENCE_THRESHOLD_MS
      if (fullSpoken.length > 0) {
        silenceTimerRef.current = setTimeout(() => {
          const candidate = (transcriptAccumulatorRef.current + " " + interim).trim();
          if (candidate && !isProcessingRef.current) {
            playJarvisSound("sent");
            stopListening();
            transcriptAccumulatorRef.current = "";
            handleSendMessage(candidate, undefined, undefined, true);
          }
        }, SILENCE_THRESHOLD_MS);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        if (teamCallRef.current) {
          endTeamCall();
          setSpeechError(event.error === "not-allowed" ? "Izinkan mikrofon untuk memulai panggilan." : "Mikrofon atau pengenalan suara belum tersedia.");
        } else stopListening();
      }
    };

    recognition.onend = () => {
      // In JARVIS continuous mode, auto-restart if still listening and not processing
      // (state `isListening` di closure ini selalu basi, jadi pakai ref)
      if (wantListeningRef.current && recognitionRef.current === recognition && !isProcessingRef.current) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition start failed:", e);
    }
  };

  const stopListening = () => {
    wantListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setAudioStream(null);
    setIsListening(false);
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const endTeamCall = () => {
    if (!teamCallRef.current) return;
    teamCallRef.current = null;
    if (teamVoiceAbortRef.current) {
      teamVoiceAbortRef.current.abort();
      teamVoiceAbortRef.current = null;
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
    stopListening();
    stopSpeaking();
    setIsTeamCalling(false);
    setLiveTranscript("");
  };

  const startTeamCall = (voice?: string) => {
    if (!activeTeamChat?.memberId || isProcessingRef.current) return;
    if (!("SpeechRecognition" in window) && !("webkitSpeechRecognition" in window)) {
      setSpeechError("Panggilan suara membutuhkan browser dengan pengenalan suara, seperti Chrome.");
      return;
    }
    stopListening();
    stopSpeaking();
    setSpeechError(null);
    teamCallRef.current = { teamId: activeTeamChat.teamId, memberId: activeTeamChat.memberId, voice };
    setIsTeamCalling(true);
    void startListening();
  };

  // Conversation operations
  const handleNewConversation = async () => {
    endTeamCall();
    setSelectedTeamChat(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sesi Suara Baru" }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setMessages([]);
        // sesi baru = mulai kosong: prompt tambahan dari sesi sebelumnya dibuang
        setSettings((s) => ({ ...s, systemPrompt: "" }));
      }
    } catch (err) {
      console.error("Failed to create new conversation:", err);
    }
  };

  const handleDeleteConversation = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConvId(remaining[0].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  return (
    <div className="relative flex flex-col h-dvh w-full bg-canvas text-fg font-sans overflow-hidden antialiased" suppressHydrationWarning>
      {/* Live Interactive Acoustic Background Animation */}
      <AcousticBackground isListening={isListening} isSpeaking={isSpeaking} />

      {/* Header — gaya nav studio: wordmark, link teks bergaris, status, CTA pill */}
      <header className="relative isolate h-14 w-full border-b border-line bg-canvas/85 backdrop-blur-xl px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-pressed={isSidebarOpen}
            className="icon-btn"
            title={isSidebarOpen ? "Sembunyikan tim AI dan riwayat" : "Tampilkan tim AI dan riwayat"}
            aria-label="Tim AI dan riwayat"
          >
            <Menu className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2 min-w-0 select-none">
            <Logo active={isListening || isSpeaking || isProcessing} className="w-7 h-7" />
            <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-fg leading-none">
              vox<span className="text-accent">.</span>ai
            </h1>
          </div>
        </div>

        {/* Nav teks (desktop) */}
        <nav aria-label="Workspace" className="hidden md:flex items-center gap-7 text-[13px]">
          {(
            [
              { tab: "preview", label: "Preview" },
              { tab: "explorer", label: "File" },
              { tab: "terminal", label: "Terminal" },
              { tab: "deploy", label: "Deploy" },
            ] as { tab: WorkspaceTab; label: string }[]
          ).map(({ tab, label }) => {
            const active = isRightPanelOpen && workspaceTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  if (active) setIsRightPanelOpen(false);
                  else {
                    setIsRightPanelOpen(true);
                    setWorkspaceTab(tab);
                  }
                }}
                aria-pressed={active}
                className="nav-link cursor-pointer"
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Ikon workspace (mobile) */}
          <div className="flex md:hidden items-center">
            {(
              [
                { tab: "preview", label: "Preview website", Icon: Globe },
                { tab: "explorer", label: "File project", Icon: HardDrive },
                { tab: "terminal", label: "Terminal", Icon: Terminal },
                { tab: "deploy", label: "Deploy", Icon: Zap },
              ] as { tab: WorkspaceTab; label: string; Icon: typeof Globe }[]
            ).map(({ tab, label, Icon }) => {
              const active = isRightPanelOpen && workspaceTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    if (active) setIsRightPanelOpen(false);
                    else {
                      setIsRightPanelOpen(true);
                      setWorkspaceTab(tab);
                    }
                  }}
                  aria-pressed={active}
                  title={label}
                  aria-label={label}
                  className="icon-btn"
                >
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </button>
              );
            })}
          </div>

          {/* Custom Sleek AI Mode Dropdown (Muncul tepat di bawah header, no emoji, full SVG) */}
          <div className="relative flex items-center h-full" ref={modeMenuRef}>
            {(() => {
              const currentMode = AI_MODES.find((m) => m.id === (settings.aiMode || "duo")) || AI_MODES[0];
              const CurrentIcon = currentMode.Icon;
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsModeOpen(!isModeOpen)}
                    aria-expanded={isModeOpen}
                    aria-haspopup="true"
                    className="h-8 px-2.5 sm:px-3 rounded-full text-xs font-medium bg-raised hover:bg-hover border border-line-strong hover:border-accent text-fg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer select-none"
                    title="Pilih mode kolaborasi AI"
                  >
                    <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                      <CurrentIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </span>
                    <span className="truncate max-w-[85px] sm:max-w-none tracking-tight">{currentMode.name}</span>
                    <ChevronDown
                      className={`w-3 h-3 text-fg-3 transition-transform duration-200 shrink-0 ${isModeOpen ? "rotate-180 text-accent" : ""}`}
                      strokeWidth={2}
                    />
                  </button>

                  {isModeOpen && (
                    <div
                      role="menu"
                      className="absolute top-full right-0 mt-2 w-[340px] sm:w-[540px] max-w-[calc(100vw-24px)] max-h-[75vh] overflow-y-auto p-2 rounded-2xl bg-raised/95 backdrop-blur-xl border border-line-strong shadow-2xl z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin"
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-fg-4 border-b border-line sticky top-0 bg-raised/95 backdrop-blur-sm z-10 flex items-center justify-between">
                        <span>Pilih Model AI (2 Kolom)</span>
                        <span className="text-[9px] font-mono text-accent font-semibold">{AI_MODES.length} Model Aktif</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {AI_MODES.map(({ id, name, Icon }) => {
                          const active = (settings.aiMode || "duo") === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                const updated = { ...settings, aiMode: id };
                                setSettings(updated);
                                settingsRef.current = updated;
                                try {
                                  localStorage.setItem("vox_ai_settings", JSON.stringify(updated));
                                } catch {}
                                setIsModeOpen(false);
                              }}
                              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                                active
                                  ? "bg-accent/10 border-accent/40 text-accent font-semibold shadow-xs"
                                  : "bg-base/40 border-line/40 text-fg-2 hover:bg-hover hover:border-line hover:text-fg"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                    active
                                      ? "bg-accent/20 border-accent/40 text-accent"
                                      : "bg-raised border-line text-fg-3"
                                  }`}
                                >
                                  <Icon className="w-3 h-3" strokeWidth={2} />
                                </span>
                                <span className={`text-[11px] sm:text-xs truncate ${active ? "text-accent font-semibold" : "text-fg font-medium"}`}>
                                  {name}
                                </span>
                              </div>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" strokeWidth={2.5} />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 mt-1 border-t border-line">
                        <button
                          type="button"
                          onClick={() => {
                            setIsModeOpen(false);
                            setIsSettingsOpen(true);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] text-fg-4 hover:text-accent hover:bg-hover/60 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-accent" />
                            <span>Buka Pengaturan Lengkap & Detail Kredit</span>
                          </span>
                          <span className="text-accent text-xs">➔</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {jarvisMode && (
            <span
              className="hidden lg:inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-medium tracking-[0.04em] text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]"
              title="Mode hands-free: mic otomatis nyala lagi setelah AI selesai ngomong"
            >
              <span className="pulse-dot" /> Hands-free
            </span>
          )}

          <button
            onClick={(e) => setTheme(theme === "dark" ? "light" : "dark", { x: e.clientX, y: e.clientY })}
            className="icon-btn relative overflow-hidden"
            title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"}
          >
            <Sun
              strokeWidth={1.5}
              className={`w-4 h-4 transition-all duration-700 ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
            />
            <Moon
              strokeWidth={1.5}
              className={`w-4 h-4 absolute inset-0 m-auto transition-all duration-700 ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
            />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="icon-btn group" title="Pengaturan (model, suara, API)" aria-label="Pengaturan">
            <SettingsIcon strokeWidth={1.5} className="w-4 h-4 transition-transform duration-700 group-hover:rotate-90" />
          </button>
          <Link
            href="/call"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-700/30 transition transform active:scale-95 ml-1"
            title="Telepon Jarvis via Web Phone"
          >
            <Phone className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">Telepon AI</span>
          </Link>
          <Btn size="sm" onClick={handleNewConversation} className="hidden sm:inline-flex ml-1">
            Sesi baru
          </Btn>
        </div>
      </header>

      {/* Main Studio Workspace Row (Under unbroken global navbar) */}
      <div className="flex-1 flex w-full min-h-0 overflow-hidden relative z-10 min-w-0">
        {/* Tim AI, role contacts, and conversation history */}
        <TeamSidebar
          key={activeProjectId}
          projectId={activeProjectId}
          onSelectProject={async (newProjectId, convId) => {
            endTeamCall();
            stopSpeaking();
            setSelectedTeamChat(null);
            setActiveProjectId(newProjectId);

            // Sinkronkan percakapan chat dengan proyek yang dipilih
            if (convId) {
              setActiveConvId(convId);
              loadConversations();
            } else if (newProjectId.startsWith("session-")) {
              try {
                const res = await fetch("/api/teams", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "get_session", sessionId: newProjectId }),
                });
                const d = await res.json();
                if (d.success && d.session?.conversationId) {
                  setActiveConvId(d.session.conversationId);
                  loadConversations();
                  return;
                }
              } catch {}
              await handleNewConversation();
            }
          }}
          selectedChat={activeTeamChat}
          onSelectTeam={(selection) => {
            endTeamCall();
            stopSpeaking();
            stopListening();
            setPendingTeamFolder(null);
            setSelectedTeamChat({ ...selection, projectId: activeProjectId });
            setIsRightPanelOpen(false);
            if (isSidebarDrawer || windowWidth < 768) setIsSidebarOpen(false);
          }}
          onGeneralChat={() => { endTeamCall(); setSelectedTeamChat(null); }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => {
            endTeamCall();
            setSelectedTeamChat(null);
            setActiveConvId(id);
            setSettings((s) => (s.systemPrompt ? { ...s, systemPrompt: "" } : s));
            if (isSidebarDrawer) setIsSidebarOpen(false);
          }}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          isDrawer={isSidebarDrawer}
        />

        {/* Central Workspace (Chat Area - Responsive Fluid Grid) */}
        <main className="relative flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0">
          {activeTeamChat ? <TeamChatPanel
            key={`${activeProjectId}:${activeTeamChat.teamId}`}
            teamId={activeTeamChat.teamId}
            memberId={activeTeamChat.memberId}
            apiKey={settings.apiKey}
            projectId={activeProjectId}
            aiMode={settings.aiMode}
            initialFolder={pendingTeamFolder?.projectId === activeProjectId && pendingTeamFolder.teamId === activeTeamChat.teamId ? { name: pendingTeamFolder.name, itemCount: pendingTeamFolder.itemCount } : undefined}
            onLocalFolderConnected={(selection) => {
              endTeamCall();
              setPendingTeamFolder({ projectId: selection.projectId, teamId: selection.teamId, name: selection.folderName, itemCount: selection.itemCount });
              setActiveProjectId(selection.projectId);
              setSelectedTeamChat({ projectId: selection.projectId, teamId: selection.teamId });
              setWorkspaceTab("explorer");
              setIsRightPanelOpen(true);
            }}
            onGeneralChat={() => { endTeamCall(); setSelectedTeamChat(null); }}
            onSelectMember={(memberId) => { endTeamCall(); setSelectedTeamChat({ ...activeTeamChat, memberId }); }}
            onSpeak={(t, voice) => speakText(t, { voice, noResume: true })}
            onCall={startTeamCall}
            onStopCall={endTeamCall}
            isCalling={isTeamCalling}
            liveTranscript={liveTranscript}
            callError={speechError || undefined}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            onOpenPreview={(url) => {
              setPreviewUrl(url);
              setIsRightPanelOpen(true);
              setWorkspaceTab("preview");
            }}
          /> : <>
          <ChatBackground isListening={isListening} isSpeaking={isSpeaking} isProcessing={isProcessing} />
          <div className="relative z-10 flex-1 min-h-0 flex flex-col px-3 sm:px-6 pt-4 pb-3 overflow-hidden gap-3 w-full max-w-4xl mx-auto min-w-0">
          {/* Top Audio Waveform Monitor */}
          <VoiceVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            audioStream={audioStream}
            error={speechError}
          />

          {/* Chat Message Stream */}
          <div ref={chatScrollRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain space-y-5 px-1">
            {messages.length === 0 ? (
              <div className="min-h-full flex flex-col justify-center py-8 sm:py-12">
                <span
                  className="intro self-start inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-medium tracking-[0.04em] text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]"
                  style={{ ["--d" as string]: "0.1s" }}
                >
                  <span className="pulse-dot" />
                  {isListening ? "Lagi dengerin" : "Online · siap dengerin"}
                </span>

                <h2 className="mt-6 text-h1 font-medium text-fg">
                  {(activeProjectId.startsWith("session-")
                    ? ["Ceritain.", "Dengerin.", "Eksekusi."]
                    : ["Ngomong.", "Bikin.", "Rilis."]
                  ).map((w, i) => (
                    <span key={w} className="intro-mask">
                      <span className="intro-line" style={{ ["--d" as string]: `${0.15 + i * 0.09}s` }}>
                        {i === 2 ? (
                          <>
                            {w.replace(".", "")}<span className="text-accent">.</span>
                          </>
                        ) : (
                          w
                        )}
                      </span>
                    </span>
                  ))}
                </h2>

                <p className="intro mt-6 max-w-md text-[15px] leading-relaxed text-fg-3" style={{ ["--d" as string]: "0.5s" }}>
                  {activeProjectId.startsWith("session-")
                    ? "Tulis atau ucapkan ide lo secara bebas di sini. AI akan dengerin dulu apa maumu, lalu merekomendasikan divisi AI dan PRD awal yang tepat tanpa ribet popup."
                    : "Asisten suara yang ngoding website, nyusun slide, bikin invoice, dan jalanin terminal — cukup diomongin."}
                </p>

                <div className="intro mt-8 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "0.6s" }}>
                  <Btn size="sm" onClick={handleToggleMic} disabled={isProcessing} icon={<Mic className="w-[0.9em] h-[0.9em]" strokeWidth={1.75} />}>
                    {isListening ? "Stop dengerin" : "Mulai ngomong"}
                  </Btn>
                  <Btn size="sm"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={() => handleSendMessage(
                      activeProjectId.startsWith("session-")
                        ? "Gw mau buat marketplace sewa alat camping di Bandung yang ada asuransi kerusakannya dan rating"
                        : "Bikinin landing page untuk project saya"
                    )}
                  >
                    {activeProjectId.startsWith("session-") ? "Coba kirim ide" : "Bikin website"}
                  </Btn>
                </div>

                {/* Kartu bernomor */}
                <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2">
                  {(activeProjectId.startsWith("session-")
                    ? [
                        { t: "Marketplace Sewa Alat", d: "Sewa camping/kamera + asuransi", q: "Gw mau buat marketplace sewa alat camping di Bandung yang ada asuransi kerusakannya dan sistem rating" },
                        { t: "Platform Kursus Coding", d: "Interaktif dengan live code runner", q: "Gw mau bikin platform kursus coding interaktif dengan live code runner" },
                        { t: "SaaS Kasir AI UMKM", d: "Aplikasi POS kasir multi-outlet", q: "Gw mau bikin SaaS kasir POS AI untuk UMKM kuliner" },
                        { t: "Website & Landing Page", d: "Web modern siap rilis", q: "Gw mau buat website landing page modern untuk studio digital" },
                      ]
                    : [
                        { t: "Landing page project", d: "Website full page + kode bisa dicek", q: "Bikinin landing page untuk project saya" },
                        { t: "Slide presentasi AI", d: "5 halaman, siap unduh .pptx", q: "Buat slide presentasi 5 halaman tentang AI" },
                        { t: "Invoice desain logo", d: "Rapi, siap kirim ke klien", q: "Bikin invoice untuk jasa desain logo" },
                        { t: "Terminal", d: "Jalanin perintah pakai suara", q: "Buka terminal" },
                      ]
                  ).map((c, i) => (
                    <button
                      key={c.t}
                      onClick={() => handleSendMessage(c.q)}
                      disabled={isProcessing}
                      className="num-card card-in group text-left pt-5 pb-6 sm:pr-8 cursor-pointer disabled:opacity-50"
                      style={{ ["--i" as string]: i + 8 }}
                    >
                      <span className="block h-px bg-line relative overflow-hidden">
                        <span className="num-card__rule absolute inset-0 bg-fg" />
                      </span>
                      <span className="mt-4 flex items-start justify-between gap-4">
                        <span>
                          <span className="font-mono text-[11px] text-fg-4">0{i + 1}</span>
                          <span className="mt-1.5 block text-lg font-medium tracking-[-0.02em] text-fg">{c.t}</span>
                          <span className="mt-1 block text-[13px] text-fg-3">{c.d}</span>
                        </span>
                        <span className="num-card__arrow mt-6 grid place-items-center w-6 h-6 rounded-full bg-accent text-white text-[13px]">
                          <ArrowIcon />
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onSpeak={(t) => speakText(t)}
                  isCurrentSpeaking={isSpeaking}
                  onStopSpeaking={stopSpeaking}
                />
              ))
            )}
            {isProcessing && (
              <div className="chat-in flex gap-3 items-end" aria-live="polite">
                <Logo active className="w-7 h-7" />
                <div className="px-4 py-3 rounded-[1.1rem] rounded-bl-md bg-base text-sm text-fg-3 flex items-center gap-3">
                  <span className="chat-dots text-fg-3">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{processingLabel}</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Voice & Text Controller with Image Upload & JARVIS Mode */}
          {localWriteStatus && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-base px-4 py-2 text-xs text-fg-3" role="status">
              <span>{localWriteStatus}</span>
              {pendingLocalWrite?.projectId === activeProjectId && (
                <button type="button" className="shrink-0 rounded-lg bg-fg px-3 py-2 font-semibold text-base" onClick={async () => {
                  const pending = pendingLocalWrite;
                  if (!pending) return;
                  try {
                    const applied = await writeAgentChangesToLocalFolder(pending.projectId, pending.paths, true);
                    if (applied.needsPermission) { setLocalWriteStatus("Izin tulis belum diberikan. Hasil edit tetap aman di project VOX."); return; }
                    setPendingLocalWrite(null);
                    setLocalWriteStatus(applied.conflicts.length
                      ? `${applied.written.length} file tersimpan. ${applied.conflicts.length} file asli berubah; periksa manual sebelum menimpa.`
                      : `${applied.written.length} file hasil agen tersimpan ke folder Mac.`);
                  } catch (error) { setLocalWriteStatus(`Belum tersimpan ke folder Mac: ${(error as Error).message}`); }
                }}>Simpan ke folder Mac</button>
              )}
            </div>
          )}
          <AudioControls
            projectId={activeProjectId}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            liveTranscript={liveTranscript}
            onToggleMic={handleToggleMic}
            onSendMessage={handleSendMessage}
            onStopSpeaking={stopSpeaking}
            language={settings.language}
            jarvisMode={jarvisMode}
            onToggleJarvisMode={() => setJarvisMode(!jarvisMode)}
            agentMode={settings.agentMode || "interactive"}
            agentPermission={settings.agentPermission || "manual"}
            onChangeAgentMode={(m) => {
              const upd = { ...settings, agentMode: m };
              setSettings(upd);
              settingsRef.current = upd;
              try { localStorage.setItem("vox_ai_settings", JSON.stringify(upd)); } catch {}
            }}
            onChangeAgentPermission={(p) => {
              const upd = { ...settings, agentPermission: p };
              setSettings(upd);
              settingsRef.current = upd;
              try { localStorage.setItem("vox_ai_settings", JSON.stringify(upd)); } catch {}
            }}
            onOpenExplorer={() => {
              setIsRightPanelOpen(true);
              setWorkspaceTab("explorer");
            }}
          />
        </div>
          </>}
      </main>

      {/* Resizable Right Workspace Panel: Website Preview, Explorer, Terminal, Auto Deploy */}
      <RightWorkspacePanel
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        activeTab={workspaceTab}
        onTabChange={setWorkspaceTab}
        onTriggerVoiceFeedback={(msg) => {
          if (settings.autoSpeak) speakText(msg);
        }}
        initialUrl={previewUrl}
        onUrlChange={setPreviewUrl}
        projectId={activeProjectId}
        onProjectChange={async (projectId) => {
          endTeamCall();
          stopSpeaking();
          setSelectedTeamChat(null);
          setActiveProjectId(projectId);
          if (projectId.startsWith("session-")) {
            try {
              const res = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "get_session", sessionId: projectId }),
              });
              const d = await res.json();
              if (d.success && d.session?.conversationId) {
                setActiveConvId(d.session.conversationId);
                loadConversations();
              }
            } catch {}
          }
        }}
        isSidebarOpen={isSidebarOpen}
        isSidebarDrawer={isSidebarDrawer}
      />
    </div>

    {/* Studio website full page (preview / struktur file & kode) */}
      <WebsiteStudio />

    {/* Autonomous Coworker Cursor Operator */}
      <CoworkerCursorOperator
        onSpeak={speakText}
        onSwitchTab={setWorkspaceTab}
        onOpenRightPanel={() => setIsRightPanelOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        availableVoices={availableVoices}
      />

      {/* Remote PIN Lock Screen (Aktif hanya jika STUDIO_PIN diset di .env) */}
      {pinRequired && !pinAuthorized && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 text-white">
          <form
            onSubmit={handleVerifyPin}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-2xl">
              🔒
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">VOX·AI Studio Locked</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Masukkan Security PIN untuk membuka akses remote studio dari HP Anda.
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="Masukkan PIN..."
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError("");
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-center text-xl tracking-widest text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}
            </div>
            <button
              type="submit"
              disabled={pinChecking || !pinInput}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {pinChecking ? "Memeriksa..." : "Buka Akses Studio"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
