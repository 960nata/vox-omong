"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Conversation, Message, VoiceSettings } from "@/lib/types";
import { VoiceVisualizer } from "@/components/VoiceVisualizer";
import { AudioControls } from "@/components/AudioControls";
import { ConversationSidebar } from "@/components/ConversationSidebar";
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
} from "lucide-react";
import { useTheme } from "@/lib/theme";

const DEFAULT_SETTINGS: VoiceSettings = {
  apiKey: "", // kosong = server memakai AI_GATEWAY_KEY dari .env.local
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
  const activeProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);


  // ---- Suara: diputar kalimat per kalimat (streaming + prefetch) supaya terasa seperti ngobrol
  const fillerAudioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedRef = useRef<HTMLAudioElement[]>([]);

  const ttsUrl = (text: string) =>
    `/api/tts?${new URLSearchParams({
      text,
      voice: settingsRef.current.neuralVoice || "id-ID-GadisNeural",
      rate: String(settingsRef.current.rate || 1),
      pitch: String(settingsRef.current.pitch || 1),
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

    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (fillerAudioRef.current) {
      fillerAudioRef.current.pause();
      fillerAudioRef.current = null;
    }
    prefetchedRef.current.forEach((a) => {
      a.pause();
      a.removeAttribute("src");
    });
    prefetchedRef.current = [];

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  const resumeHandsFree = () => {
    if (jarvisModeRef.current && !isProcessingRef.current) {
      setTimeout(() => {
        playJarvisSound("listen");
        startListening();
      }, 250);
    }
  };

  /** Pecah jawaban jadi kalimat; kalimat pendek digabung supaya intonasi natural. */
  const splitSentences = (text: string) => {
    const raw = text.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    const out: string[] = [];
    for (const r of raw) {
      if (out.length && (out[out.length - 1].length < 40 || r.length < 12)) out[out.length - 1] += " " + r;
      else out.push(r);
    }
    // batasi supaya jawaban panjang tidak dibacakan semuanya
    let total = 0;
    return out.filter((x) => (total += x.length) <= 650 || x === out[0]);
  };

  const speakText = async (text: string, opts: { afterFiller?: boolean } = {}) => {
    if (opts.afterFiller) await waitForFiller();
    stopSpeaking();
    if (!text || !text.trim()) return;

    const cleanSpeech = text
      .replace(/```[\s\S]*?```/g, " Kodenya udah aku tampilkan di layar. ")
      .replace(/https?:\/\/\S+/g, "tautan")
      .replace(/[*#_~`>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleanSpeech) return;

    const currentSessionId = ++speechSessionIdRef.current;

    // 1. Edge Neural TTS: antrean kalimat, kalimat berikutnya di-prefetch selagi kalimat sekarang diputar
    if (settingsRef.current.ttsProvider === "neural") {
      const sentences = splitSentences(cleanSpeech);
      const make = (k: number) => {
        const a = new Audio(ttsUrl(sentences[k]));
        a.preload = "auto";
        prefetchedRef.current.push(a);
        return a;
      };
      const audios: (HTMLAudioElement | undefined)[] = [];
      audios[0] = make(0);
      if (sentences.length > 1) audios[1] = make(1);

      setIsSpeaking(true);
      isSpeakingRef.current = true;

      const finish = () => {
        if (speechSessionIdRef.current !== currentSessionId) return;
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        currentAudioRef.current = null;
        prefetchedRef.current = [];
        resumeHandsFree();
      };

      const playAt = (k: number): Promise<boolean> =>
        new Promise((resolve) => {
          if (speechSessionIdRef.current !== currentSessionId) return resolve(false);
          const a = audios[k] || (audios[k] = make(k));
          if (k + 1 < sentences.length && !audios[k + 1]) audios[k + 1] = make(k + 1);
          currentAudioRef.current = a;
          a.onended = () => resolve(true);
          a.onerror = () => resolve(k > 0); // kalimat pertama gagal → pakai suara browser
          a.play().catch(() => resolve(k > 0));
        });

      for (let k = 0; k < sentences.length; k++) {
        const ok = await playAt(k);
        if (speechSessionIdRef.current !== currentSessionId) return;
        if (!ok && k === 0) break; // jatuh ke fallback di bawah
        if (k === sentences.length - 1) return finish();
      }
      if (speechSessionIdRef.current !== currentSessionId) return;
    }

    // 2. Fallback: SpeechSynthesis bawaan browser
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanSpeech.slice(0, 650));
    utterance.lang = settingsRef.current.language;
    utterance.rate = settingsRef.current.rate || 1.0;
    utterance.pitch = settingsRef.current.pitch || 1.0;
    if (settingsRef.current.voiceURI) {
      const matched = availableVoices.find((v) => v.voiceURI === settingsRef.current.voiceURI);
      if (matched) utterance.voice = matched;
    }
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
        resumeHandsFree();
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
  const handleSendMessage = async (text: string, imageUri?: string, dataUri?: string, fromVoice = false) => {
    if (!text.trim() || isProcessing) return;

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
        /slide|presentasi|ppt|pitch/.test(q)
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

    const cleanQuery = text.toLowerCase().trim();

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
    } else if (
      cleanQuery.includes("website") ||
      cleanQuery.includes("preview") ||
      cleanQuery.includes("tampilkan web") ||
      cleanQuery.includes("lihat website")
    ) {
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

    // Optimistically append user message with imageUri if present
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: targetConvId,
      role: "user",
      content: text,
      imageUri: imageUri || dataUri,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: targetConvId,
          message: text,
          language: settingsRef.current.language,
          apiKey: settingsRef.current.apiKey,
          systemPrompt: settingsRef.current.systemPrompt,
          imageUri: imageUri,
          imageDataUri: dataUri,
          activeProjectId,
        }),
      });

      const data = await res.json();
      if (data.success && data.assistantMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);

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
          setWorkspaceTab("preview");
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
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  // Initialize JARVIS Continuous Speech Recognition with VAD (Voice Activity Detection)
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    const SILENCE_THRESHOLD_MS = settingsRef.current.silenceTimeoutMs || 1200;

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
        stopListening();
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

  // Conversation operations
  const handleNewConversation = async () => {
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
    <div className="relative flex flex-col h-dvh w-full bg-canvas text-fg font-sans overflow-hidden antialiased">
      {/* Live Interactive Acoustic Background Animation */}
      <AcousticBackground isListening={isListening} isSpeaking={isSpeaking} />

      {/* Header — gaya nav studio: wordmark, link teks bergaris, status, CTA pill */}
      <header className="h-14 w-full border-b border-line bg-canvas/85 backdrop-blur-xl px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-pressed={isSidebarOpen}
            className="icon-btn"
            title={isSidebarOpen ? "Sembunyikan riwayat sesi" : "Tampilkan riwayat sesi"}
            aria-label="Riwayat sesi"
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
          <Btn size="sm" onClick={handleNewConversation} className="hidden sm:inline-flex ml-1">
            Sesi baru
          </Btn>
        </div>
      </header>

      {/* Main Studio Workspace Row (Under unbroken global navbar) */}
      <div className="flex-1 flex w-full h-[calc(100dvh-3.5rem)] overflow-hidden relative z-10 min-w-0">
        {/* Sidebar: Conversation history */}
        <ConversationSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => {
            setActiveConvId(id);
            setSettings((s) => (s.systemPrompt ? { ...s, systemPrompt: "" } : s));
            if (isSidebarDrawer) setIsSidebarOpen(false);
          }}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          isDrawer={isSidebarDrawer}
        />

        {/* Central Workspace (Chat Area - Responsive Fluid Grid) */}
        <main className="relative flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <ChatBackground isListening={isListening} isSpeaking={isSpeaking} isProcessing={isProcessing} />
          <div className="relative z-10 flex-1 flex flex-col px-3 sm:px-6 pt-3 pb-3 overflow-hidden gap-3 w-full max-w-4xl mx-auto min-w-0">
          {/* Top Audio Waveform Monitor */}
          {(messages.length > 0 || isListening || isSpeaking || isProcessing) && (
          <VoiceVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
            audioStream={audioStream}
          />
          )}

          {/* Chat Message Stream */}
          <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden space-y-5 px-1">
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
                  {["Ngomong.", "Bikin.", "Rilis."].map((w, i) => (
                    <span key={w} className="intro-mask">
                      <span className="intro-line" style={{ ["--d" as string]: `${0.15 + i * 0.09}s` }}>
                        {i === 2 ? (
                          <>
                            Rilis<span className="text-accent">.</span>
                          </>
                        ) : (
                          w
                        )}
                      </span>
                    </span>
                  ))}
                </h2>

                <p className="intro mt-6 max-w-md text-[15px] leading-relaxed text-fg-3" style={{ ["--d" as string]: "0.5s" }}>
                  Asisten suara yang ngoding website, nyusun slide, bikin invoice, dan jalanin terminal — cukup diomongin.
                </p>

                <div className="intro mt-8 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "0.6s" }}>
                  <Btn size="sm" onClick={handleToggleMic} disabled={isProcessing} icon={<Mic className="w-[0.9em] h-[0.9em]" strokeWidth={1.75} />}>
                    {isListening ? "Stop dengerin" : "Mulai ngomong"}
                  </Btn>
                  <Btn size="sm"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={() => handleSendMessage("Bikinin landing page buat kedai kopi lokal yang modern")}
                  >
                    Bikin website
                  </Btn>
                </div>

                {/* Kartu bernomor */}
                <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2">
                  {[
                    { t: "Landing page kedai kopi", d: "Website full page + kode bisa dicek", q: "Bikinin landing page buat kedai kopi" },
                    { t: "Slide presentasi AI", d: "5 halaman, siap unduh .pptx", q: "Buat slide presentasi 5 halaman tentang AI" },
                    { t: "Invoice desain logo", d: "Rapi, siap kirim ke klien", q: "Bikin invoice untuk jasa desain logo" },
                    { t: "Terminal", d: "Jalanin perintah pakai suara", q: "Buka terminal" },
                  ].map((c, i) => (
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
                  onSpeak={speakText}
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
            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Voice & Text Controller with Image Upload & JARVIS Mode */}
          <AudioControls
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
            onOpenExplorer={() => {
              setIsRightPanelOpen(true);
              setWorkspaceTab("explorer");
            }}
          />
        </div>
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
        onProjectChange={setActiveProjectId}
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
    </div>
  );
}
