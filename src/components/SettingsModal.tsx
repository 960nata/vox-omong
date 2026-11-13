"use client";

import React, { useEffect, useState } from "react";
import { VoiceSettings, type McpProviderId, type AIMode } from "@/lib/types";
import { MODEL_PRICING_CATALOG } from "@/lib/tokenPricing";
import {
  X,
  Volume2,
  Key,
  Sliders,
  Globe,
  Sparkles,
  Loader2,
  AudioLines,
  Monitor,
  Zap,
  Brain,
  Feather,
  Cpu,
  CreditCard,
  MessageSquare,
  Wrench,
  Shield,
  RefreshCw,
  Check,
  Server,
  Activity,
  ChevronRight,
  Info,
  ExternalLink,
  Play,
  Trash2,
  Unlink,
  Code2,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onSave: (newSettings: VoiceSettings) => void;
  availableVoices: SpeechSynthesisVoice[];
}

export const NEURAL_VOICES = [
  // Indonesian & Nusantara Voices
  { id: "id-ID-GadisNeural", name: "🇮🇩 Gadis (Wanita · Modern, Ramah, Natural)", lang: "id-ID", desc: "Suara wanita paling populer, santai dan mirip manusia asli" },
  { id: "id-ID-ArdiNeural", name: "🇮🇩 Ardi (Pria · Tenang, Formal & Berwibawa)", lang: "id-ID", desc: "Suara pria profesional untuk presentasi dan bisnis" },
  { id: "jv-ID-SitiNeural", name: "🇮🇩 Siti (Wanita · Lembut & Santun - Jawa)", lang: "id-ID", desc: "Suara wanita halus dan menenangkan" },
  { id: "jv-ID-DimasNeural", name: "🇮🇩 Dimas (Pria · Bersahabat & Santai - Jawa)", lang: "id-ID", desc: "Karakter pria lokal bersahabat" },
  { id: "su-ID-TutiNeural", name: "🇮🇩 Tuti (Wanita · Ceria & Dinamis - Sunda)", lang: "id-ID", desc: "Karakter suara wanita ceria dan ekspresif" },
  { id: "su-ID-JajangNeural", name: "🇮🇩 Jajang (Pria · Hangat & Ramah - Sunda)", lang: "id-ID", desc: "Karakter pria hangat khas Nusantara" },
  { id: "ms-MY-YasminNeural", name: "🇲🇾 Yasmin (Wanita · Elegan & Jernih - Melayu)", lang: "id-ID", desc: "Suara wanita elegan dan jernih" },
  { id: "ms-MY-OsmanNeural", name: "🇲🇾 Osman (Pria · Tegas & Percaya Diri - Melayu)", lang: "id-ID", desc: "Suara pria dengan artikulasi tinggi" },

  // English Voices
  { id: "en-US-JennyNeural", name: "🇺🇸 Jenny (Female · Expressive & Natural)", lang: "en-US", desc: "Conversational everyday English" },
  { id: "en-US-GuyNeural", name: "🇺🇸 Guy (Male · Warm & Conversational)", lang: "en-US", desc: "Warm and engaging male tone" },
  { id: "en-US-AriaNeural", name: "🇺🇸 Aria (Female · Clear Assistant)", lang: "en-US", desc: "Crisp and helpful assistant tone" },
  { id: "en-US-ChristopherNeural", name: "🇺🇸 Christopher (Male · Dynamic Host)", lang: "en-US", desc: "Professional podcast and radio host" },
];

const AI_MODES_INFO: Array<{
  id: AIMode;
  name: string;
  badge: string;
  desc: string;
  costNote: string;
  category: "all" | "auto" | "flagship" | "fast" | "free" | "private";
  Icon: React.ElementType;
}> = [
  // 1. AUTO ROUTERS
  {
    id: "coding-china-auto",
    name: "Coding Plan China (Auto)",
    badge: "FAILOVER OTOMATIS",
    desc: "Otomatis pakai yang tercepat dari DeepSeek, GLM, Kimi, MiniMax, dan Qwen.",
    costNote: "~12.5M kredit in / ~61.6M out (~Rp1.875/1M)",
    category: "auto",
    Icon: Zap,
  },
  {
    id: "coding-us-auto",
    name: "Coding Plan US (Auto)",
    badge: "FAILOVER OTOMATIS",
    desc: "Otomatis pakai yang tercepat dari Claude Opus/Sonnet, Gemini, GPT-6, GPT-5.6, Muse.",
    costNote: "~30M kredit in / ~150M out (~Rp4.500/1M)",
    category: "auto",
    Icon: Zap,
  },
  {
    id: "duo",
    name: "Duo Engine",
    badge: "SEIMBANG",
    desc: "Claude Haiku 5.5 (Perencana Arsitektur) + DeepSeek (Eksekutor Kode).",
    costNote: "Kombinasi cerdas arsitektur & efisiensi (~2k kredit)",
    category: "auto",
    Icon: Sparkles,
  },

  // 2. SERVER PRIBADI (aigw)
  {
    id: "user-private",
    name: "Gateway Pribadi (aigw)",
    badge: "SERVER SENDIRI",
    desc: "Nembak langsung ke server proxy dan model-model internal/gratisan lu.",
    costNote: "0 kredit router (Bebas kuota)",
    category: "private",
    Icon: Shield,
  },

  // 3. CEPAT & CODING (HEMAT)
  {
    id: "flash",
    name: "DeepSeek V4.1 Flash",
    badge: "SUPER CEPAT (2s)",
    desc: "Paling kenceng, stabil, patuh format JSON & tool-calling. Pilihan harian #1!",
    costNote: "~8.3M kredit in / ~30.2M out (~Rp1.250/1M)",
    category: "fast",
    Icon: Feather,
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    badge: "DEEP REASONING",
    desc: "Penalaran lebih dalam untuk coding kompleks, audit logika, dan analisis arsitektur.",
    costNote: "~20.9M kredit in / ~55M out (~Rp3.135/1M)",
    category: "fast",
    Icon: Cpu,
  },
  {
    id: "qwen-plus",
    name: "Qwen 3.7 Plus",
    badge: "SUPER IRIT",
    desc: "Cepat dan sangat irit token dari Alibaba untuk volume chat & coding tinggi.",
    costNote: "~5.4M kredit in / ~24.7M out (~Rp810/1M)",
    category: "fast",
    Icon: Zap,
  },
  {
    id: "kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    badge: "MOONSHOT CODING",
    desc: "Model spesialis coding dari Moonshot AI dengan konteks 250K.",
    costNote: "~8.4M kredit in / ~41.8M out (~Rp1.260/1M)",
    category: "fast",
    Icon: Code2,
  },
  {
    id: "glm-5.3-flash",
    name: "GLM 5.3 Flash",
    badge: "ZHIPU HEMAT",
    desc: "Versi cepat dan sangat hemat dari Zhipu GLM generasi 5.3.",
    costNote: "~7.4M kredit in / ~30.8M out (~Rp1.110/1M)",
    category: "fast",
    Icon: Feather,
  },
  {
    id: "minimax-m3",
    name: "MiniMax M3",
    badge: "MINIMAX 1M",
    desc: "Model umum dari MiniMax dengan konteks 1 Juta token.",
    costNote: "~6M kredit in / ~23.1M out (~Rp900/1M)",
    category: "fast",
    Icon: Zap,
  },
  {
    id: "hy3",
    name: "Hy3 (Tencent Hunyuan)",
    badge: "TENCENT AI",
    desc: "Hunyuan generasi 3 dari Tencent — serbaguna dan hemat.",
    costNote: "~9.9M kredit in / ~49.5M out (~Rp1.485/1M)",
    category: "fast",
    Icon: Server,
  },
  {
    id: "haiku-5.5",
    name: "Claude Haiku 5.5",
    badge: "VISION & UI",
    desc: "Cepat untuk visual, UI/UX mockup, dan arsitektur responsif (konteks 1M).",
    costNote: "~10.8M kredit in / ~33M out (~Rp1.620/1M)",
    category: "fast",
    Icon: Sparkles,
  },

  // 4. FLAGSHIP & SULTAN
  {
    id: "sonnet-5.5",
    name: "Claude Sonnet 5.5",
    badge: "FLAGSHIP CODER",
    desc: "Model coding paling presisi, audit sintaks & refactor masif (Tameng 9s).",
    costNote: "~26.4M kredit in / ~132M out (~Rp3.960/1M)",
    category: "flagship",
    Icon: Code2,
  },
  {
    id: "opus-5.5",
    name: "Claude Opus 5.5",
    badge: "ULTIMATE SULTAN",
    desc: "Reasoning level tertinggi untuk problem solving kelas atas (Tameng 9s).",
    costNote: "~52.8M kredit in / ~264M out (~Rp7.920/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    badge: "TOP TIER",
    desc: "Model Claude kelas teratas untuk tugas paling berat dan riset mutakhir.",
    costNote: "~66M kredit in / ~330M out (~Rp9.900/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    badge: "OPENAI FLAGSHIP",
    desc: "Model flagship OpenAI generasi 6 untuk penalaran berat dan sains.",
    costNote: "~66M kredit in / ~330M out (~Rp9.900/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "gpt-6-sol",
    name: "GPT-6 Sol",
    badge: "OPENAI 1M",
    desc: "GPT-6 seimbang untuk reasoning, coding, dan agen konteks 1M.",
    costNote: "~34.2M kredit in / ~110M out (~Rp5.130/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT 6.1 Sol",
    badge: "OPENAI 1.1M",
    desc: "Model OpenAI GPT 6.1 Sol dengan konteks 1.1 Juta token.",
    costNote: "~34.2M kredit in / ~100M out (~Rp5.130/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    badge: "xAI REASONING",
    desc: "Grok terbaru dari xAI untuk reasoning mandiri dan chat bebas filter.",
    costNote: "~21.1M kredit in / ~66M out (~Rp3.170/1M)",
    category: "flagship",
    Icon: Brain,
  },
  {
    id: "qwen-max",
    name: "Qwen 3.8 Max",
    badge: "ALIBABA PRO",
    desc: "Qwen paling pintar dari Alibaba — reasoning kuat dan coding berat.",
    costNote: "~13.2M kredit in / ~66M out (~Rp1.980/1M)",
    category: "flagship",
    Icon: Cpu,
  },

  // 5. 100% GRATIS & GRANT
  {
    id: "kai-baik",
    name: "Kai Grant (Free DeepSeek)",
    badge: "KREDIT BERSAMA",
    desc: "Kredit gratis dari Kai dipakai bersama semua pengguna sampai habis.",
    costNote: "0 kredit (Gratis dari Kai)",
    category: "free",
    Icon: Sparkles,
  },
  {
    id: "nemotron-3.5-super-vl:free",
    name: "Nemotron 3.5 Super VL (Free)",
    badge: "NVIDIA VISION FREE",
    desc: "Model NVIDIA dengan input gambar dan visual scanning gratis.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning (Free)",
    badge: "NVIDIA KILAT",
    desc: "Model NVIDIA versi cepat gratis untuk tugas harian dan chat.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "solar-mini4:free",
    name: "Solar Mini 4 (Free)",
    badge: "UPSTAGE FREE",
    desc: "Model ringkas dari Upstage untuk tugas harian.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "nemotron-3-nano-omni:free",
    name: "Nemotron 3 Nano Omni (Free)",
    badge: "NVIDIA OMNI VISION",
    desc: "Model kecil multimodal (baca gambar) dari NVIDIA dengan penalaran.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "north-mini-code:free",
    name: "North Mini Code (Free)",
    badge: "COHERE CODING",
    desc: "Model coding ringkas dari Cohere untuk pembuatan fungsi & script gratis.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Code2,
  },
  {
    id: "gemma-4-31b:free",
    name: "Gemma 4 31B (Free)",
    badge: "GOOGLE OPEN",
    desc: "Model terbuka Gemma 4 dari Google yang bisa membaca gambar gratis.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "gemma-4-26b:free",
    name: "Gemma 4 26B (Free)",
    badge: "GOOGLE MOE",
    desc: "Gemma 4 MoE ringan dari Google, bisa membaca gambar secara gratis.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "dots-3-note:free",
    name: "dots 3 Note (Free)",
    badge: "REDNOTE VISION",
    desc: "Model multimodal dots 3 dari rednote untuk teks & visual konteks 512K.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "flint-1.0:free",
    name: "Flint 1.0 (Free)",
    badge: "RECURSIVE AI",
    desc: "Model Flint dari Recursive untuk penalaran ringkas.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
  {
    id: "lfm-3-1.7b:free",
    name: "LFM 3 1.7B (Free)",
    badge: "LIQUID AI ULTRA FAST",
    desc: "Model mini Liquid AI, sangat cepat untuk tugas ringan dan ekstraksi.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Zap,
  },
  {
    id: "longcat-2.5:free",
    name: "LongCat 2.5 (Free)",
    badge: "MEITUAN REASONING",
    desc: "Model LongCat dari Meituan yang kuat untuk penalaran.",
    costNote: "0 kredit (Free quota)",
    category: "free",
    Icon: Feather,
  },
];

type SettingsTab = "models" | "credits" | "voice" | "persona" | "tools" | "security";

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  availableVoices,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [form, setForm] = useState<VoiceSettings>(settings);
  const [modelCatFilter, setModelCatFilter] = useState<string>("all");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // MCP State
  const [mcpProviders, setMcpProviders] = useState<Array<{
    id: McpProviderId;
    name: string;
    purpose: string;
    docs: string;
    env: string;
    configured: boolean;
    locked: boolean;
    isLocal?: boolean;
    hasSavedToken?: boolean;
    authLink?: string;
    authLabel?: string;
  }>>([]);
  const [mcpChecks, setMcpChecks] = useState<Record<string, string>>({});
  const [connectingProviderId, setConnectingProviderId] = useState<McpProviderId | null>(null);
  const [authInputToken, setAuthInputToken] = useState("");
  const [authInputUrl, setAuthInputUrl] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [isStartingLocal, setIsStartingLocal] = useState(false);

  // Token & Credit Usage State
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageData, setUsageData] = useState<{
    initialCredits: number;
    remainingCredits: number;
    totalCreditsUsed: number;
    totalTokensUsed: number;
    totalCalls: number;
    byModel: Record<string, { calls: number; totalTokens: number; estimatedCredits: number }>;
  } | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

  // Load MCP providers on open
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetch("/api/mcp", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted && Array.isArray(data.providers)) {
          setMcpProviders(data.providers);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen]);

  // Load Token Usage
  const fetchTokenUsage = () => {
    setUsageLoading(true);
    fetch("/api/tokens/usage")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setUsageData(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setUsageLoading(false));
  };

  useEffect(() => {
    if (isOpen && activeTab === "credits") {
      fetchTokenUsage();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const testVoice = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestError(null);

    const sampleText =
      form.language === "id-ID"
        ? "Halo! Suara asisten Vox Omong siap digunakan dengan intonasi alami manusia."
        : "Hello! Vox Omong voice assistant is active with natural human-like intonation.";

    try {
      if (form.ttsProvider === "neural") {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sampleText,
            voice: form.neuralVoice || (form.language === "id-ID" ? "id-ID-GadisNeural" : "en-US-JennyNeural"),
            rate: form.rate,
            pitch: form.pitch,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          const done = () => {
            URL.revokeObjectURL(url);
            setIsTesting(false);
          };
          audio.onended = done;
          audio.onerror = () => {
            setTestError("Gagal memutar audio sampel.");
            done();
          };
          await audio.play();
          return;
        }
      }

      // Fallback Browser Speech
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.lang = form.language;
        utterance.rate = form.rate;
        utterance.pitch = form.pitch;
        utterance.onend = () => setIsTesting(false);
        utterance.onerror = () => setIsTesting(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsTesting(false);
      }
    } catch {
      setTestError("Suara belum bisa diputar di browser ini.");
      setIsTesting(false);
    }
  };

  const filteredNeuralVoices = NEURAL_VOICES.filter((v) => v.lang === form.language);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-4xl h-[650px] max-h-[90vh] bg-base border border-line-strong rounded-2xl shadow-2xl overflow-hidden text-fg">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-raised/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 text-accent">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-fg flex items-center gap-2">
                Studio Settings & AI Parameters
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent-wash text-accent border border-accent/20">
                  CLAUDE / GPT SUITE
                </span>
              </h2>
              <p className="text-[11px] text-fg-3">Konfigurasi mendalam model AI, alokasi kredit, memori, suara, dan alat otonom.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-fg-3 hover:text-fg hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Sidebar + Main Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Navigation Sidebar */}
          <div className="w-56 shrink-0 border-r border-line bg-raised/30 p-2.5 flex flex-col justify-between">
            <div className="space-y-1">
              {[
                { id: "models" as SettingsTab, label: "Model & AI Core", icon: Cpu, badge: form.aiMode || "flash" },
                { id: "credits" as SettingsTab, label: "Kredit & Token", icon: CreditCard, badge: "742 Juta" },
                { id: "voice" as SettingsTab, label: "Suara & Audio", icon: Volume2 },
                { id: "persona" as SettingsTab, label: "Persona & Prompt", icon: MessageSquare },
                { id: "tools" as SettingsTab, label: "Alat MCP & Agen", icon: Wrench },
                { id: "security" as SettingsTab, label: "Keamanan & Sync", icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-hover text-accent font-semibold border border-line shadow-xs"
                        : "text-fg-2 hover:bg-hover hover:text-fg border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-fg-3"}`} />
                      {tab.label}
                    </span>
                    {tab.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        isActive ? "bg-accent/15 text-accent" : "bg-hover text-fg-3"
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Credit Status Pill at bottom of sidebar */}
            <div className="p-3 rounded-xl border border-line bg-hover/50 space-y-1 text-[11px]">
              <div className="flex items-center justify-between font-mono text-[10px] text-fg-3">
                <span>SALDO KREDIT</span>
                <span className="text-emerald-400 font-semibold">742 Juta</span>
              </div>
              <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full w-[95.7%]" />
              </div>
              <div className="text-[10px] text-fg-2 font-mono truncate pt-0.5">
                742.000.000 Kredit (≈ Rp111.235)
              </div>
            </div>
          </div>

          {/* Right Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            
            {/* ================================================= TAB 1: MODEL & INTELLIGENCE */}
            {activeTab === "models" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Model Intelligence & Routing</h3>
                  <p className="text-xs text-fg-3">Tentukan model yang menjadi otak pemikir, coding, dan orkestrasi tugas.</p>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: "all", label: "Semua (25+ Model)" },
                    { id: "auto", label: "🤖 Auto Failover" },
                    { id: "flagship", label: "👑 Flagship & Sultan" },
                    { id: "fast", label: "⚡ Cepat & Coding" },
                    { id: "free", label: "🎁 100% Gratis & Grant" },
                    { id: "private", label: "🛡️ Server Pribadi" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setModelCatFilter(cat.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        modelCatFilter === cat.id
                          ? "bg-accent text-accent-fg font-semibold shadow-xs"
                          : "bg-raised border border-line text-fg-3 hover:text-fg hover:border-line-strong"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Model Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {AI_MODES_INFO.filter((item) => modelCatFilter === "all" || item.category === modelCatFilter).map((item) => {
                    const Icon = item.Icon;
                    const isSelected = (form.aiMode || "flash") === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm({ ...form, aiMode: item.id })}
                        className={`p-3.5 text-left rounded-xl border transition-all relative ${
                          isSelected
                            ? "bg-hover border-accent text-fg shadow-xs ring-1 ring-accent/30"
                            : "bg-raised border-line text-fg-2 hover:border-line-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-2 font-semibold text-xs text-fg">
                            <Icon className={`w-4 h-4 ${isSelected ? "text-accent" : "text-fg-3"}`} />
                            {item.name}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            isSelected ? "border-accent/40 bg-accent-wash text-accent font-semibold" : "border-line text-fg-4"
                          }`}>
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-fg-3 leading-relaxed mb-2">{item.desc}</p>
                        <span className="text-[10px] font-mono text-fg-4 block border-t border-line/60 pt-1.5">
                          {item.costNote}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Hyperparameters: Temperature & Max Tokens */}
                <div className="p-4 rounded-xl border border-line bg-raised space-y-4">
                  <div className="text-xs font-semibold uppercase font-mono text-fg-2 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-accent" /> Hyperparameter Model
                  </div>
                  
                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg-2">Temperature (Kreativitas vs Presisi)</span>
                      <span className="font-mono font-semibold text-accent">
                        {(form.temperature ?? 0.2).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={form.temperature ?? 0.2}
                      onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                      className="w-full accent-accent bg-hover h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-fg-4 font-mono">
                      <span>0.0 (Presisi/Kode)</span>
                      <span>0.5 (Seimbang)</span>
                      <span>1.0 (Kreatif/Bebas)</span>
                    </div>
                  </div>

                  {/* Max Output Tokens */}
                  <div className="space-y-1.5 pt-2 border-t border-line/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg-2">Maksimal Token Jawaban (Max Tokens)</span>
                      <span className="font-mono font-semibold text-accent">
                        {(form.maxTokens ?? 2048)} tokens
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[512, 1024, 2048, 4096].map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => setForm({ ...form, maxTokens: tok })}
                          className={`py-1.5 text-xs font-mono rounded-lg border transition-all ${
                            (form.maxTokens ?? 2048) === tok
                              ? "bg-hover border-accent text-accent font-semibold"
                              : "border-line text-fg-3 hover:border-line-strong"
                          }`}
                        >
                          {tok}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* API Gateway Key & Custom URL */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-mono uppercase text-fg-2">
                        <Key className="w-3.5 h-3.5 text-accent" /> API Gateway Key
                      </label>
                      {form.apiKey ? (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, apiKey: "" })}
                          className="text-[11px] text-accent hover:underline font-mono"
                        >
                          Gunakan Kuota Server (.env.local)
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="password"
                      placeholder="Kosongkan untuk kuota server 742 Juta, atau tempel key gratis AIzaSy... / gsk_..."
                      value={form.apiKey || ""}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg font-mono placeholder-fg-4 outline-hidden transition-colors"
                    />
                    {!form.apiKey ? (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Aktif: Kuota Server 742 Juta Kredit (.env.local)
                      </div>
                    ) : form.apiKey.startsWith("AIzaSy") ? (
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Google Gemini Key Aktif (100% Gratis • 0 Kredit ClassAI Terpotong!)
                      </div>
                    ) : form.apiKey.startsWith("sk_live_") ? (
                      <div className="flex items-center gap-2 text-[11px] text-sky-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                        Custom ClassAI Key Terpasang ({form.apiKey.length} karakter)
                      </div>
                    ) : form.apiKey.startsWith("sk-or-") ? (
                      <div className="flex items-center gap-2 text-[11px] text-purple-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        OpenRouter Key Terpasang (Mendukung Model :free)
                      </div>
                    ) : form.apiKey.startsWith("gsk_") ? (
                      <div className="flex items-center gap-2 text-[11px] text-orange-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        Groq Key Terpasang (Free Tier 14.400 req/hari)
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 font-mono">
                        Key kustom terpasang ({form.apiKey.slice(0, 8)}...). Jika target router menolak, sistem otomatis failover ke key server resmi (.env.local).
                      </p>
                    )}
                    <p className="text-[11px] text-fg-3">
                      Bisa diisi key Google AI Studio (<code>AIzaSy...</code>) untuk 100% gratis, atau kosongkan untuk memakai 742 Juta kredit ClassAI.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-mono uppercase text-fg-2">
                      <Server className="w-3.5 h-3.5 text-accent" /> Custom Gateway Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://router.classai.id/v1 atau http://localhost:11434/v1"
                      value={form.customGatewayUrl || ""}
                      onChange={(e) => setForm({ ...form, customGatewayUrl: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg font-mono placeholder-fg-4 outline-hidden transition-colors"
                    />
                    <p className="text-[11px] text-fg-3">
                      Arahkan ke server buatanmu sendiri (vLLM, Ollama, LMStudio) atau router prabayar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================= TAB 2: CREDITS & TOKEN MONITOR */}
            {activeTab === "credits" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-fg">Monitoring Saldo Kredit & Konsumsi API</h3>
                    <p className="text-xs text-fg-3">Periksa pemakaian token dan estimasi pengurangan saldo kredit 742 Juta secara nyata.</p>
                  </div>
                  <button
                    onClick={fetchTokenUsage}
                    disabled={usageLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-line bg-raised hover:bg-hover text-fg-2 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${usageLoading ? "animate-spin text-accent" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Big Credit Summary Card */}
                <div className="p-5 rounded-2xl border border-line bg-gradient-to-br from-raised via-base to-raised shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-fg-3">Estimasi Sisa Kredit</span>
                      <div className="text-2xl font-bold font-mono text-emerald-400 pt-1">
                        {(usageData?.remainingCredits ?? 742_000_000).toLocaleString()} <span className="text-xs font-normal text-fg-3">KREDIT</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-fg-3">Total Panggilan AI</span>
                      <div className="text-xl font-bold font-mono text-fg pt-1">
                        {usageData?.totalCalls ?? 0} <span className="text-xs font-normal text-fg-3">reqs</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-fg-3">Saldo Dashboard: 742 Juta (~Rp111.235)</span>
                      <span className="text-fg-2">Terpakai Sesi Ini: {(usageData?.totalCreditsUsed ?? 0).toLocaleString()} kredit</span>
                    </div>
                    <div className="w-full bg-hover rounded-full h-2 overflow-hidden border border-line">
                      <div className="bg-emerald-400 h-full rounded-full w-[95.7%]" />
                    </div>
                  </div>
                </div>

                {/* Breakdown per Model Table */}
                <div className="rounded-xl border border-line overflow-hidden bg-raised">
                  <div className="px-4 py-2.5 border-b border-line bg-hover/40 text-xs font-mono font-semibold uppercase text-fg-2">
                    Rincian Konsumsi per Model
                  </div>
                  <div className="divide-y divide-line text-xs font-mono">
                    <div className="grid grid-cols-4 px-4 py-2 text-[10px] uppercase text-fg-4">
                      <span>Model</span>
                      <span className="text-center">Panggilan</span>
                      <span className="text-center">Total Token</span>
                      <span className="text-right">Est. Kredit</span>
                    </div>

                    {usageData && Object.keys(usageData.byModel).length > 0 ? (
                      Object.entries(usageData.byModel).map(([mod, item]) => (
                        <div key={mod} className="grid grid-cols-4 px-4 py-2.5 items-center hover:bg-hover/30">
                          <span className="font-semibold text-fg truncate">{mod}</span>
                          <span className="text-center text-fg-2">{item.calls}x</span>
                          <span className="text-center text-fg-2">{item.totalTokens.toLocaleString()}</span>
                          <span className="text-right text-accent font-semibold">~{item.estimatedCredits.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-fg-4 font-sans">
                        Belum ada catatan pemanggilan token di sesi ini. Panggil AI untuk mulai mencatat.
                      </div>
                    )}
                  </div>
                </div>

                {/* Tips Efisiensi */}
                <div className="p-3.5 rounded-xl border border-line bg-accent-wash/30 text-xs space-y-1">
                  <div className="font-semibold text-accent flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Rumus Efisiensi 775 Juta Kredit:
                  </div>
                  <p className="text-[11px] text-fg-2 leading-relaxed">
                    Model <strong>DeepSeek Flash</strong> hanya menghabiskan ~1-2 kredit per token (~600 kredit/panggilan), sanggup bertahan hingga <strong>1.200.000 kali panggilan</strong>. Gunakan Claude Opus hanya saat membutuhkan reasoning tingkat tinggi.
                  </p>
                </div>

                {/* Tabel Ketahanan & Perhitungan Model */}
                <div className="rounded-xl border border-line overflow-hidden bg-raised">
                  <div className="px-4 py-2.5 border-b border-line bg-hover/40 text-xs font-mono font-semibold uppercase text-fg-2 flex items-center justify-between">
                    <span>Katalog & Ketahanan 775 Juta Kredit per Model</span>
                    <span className="text-[10px] text-accent font-sans lowercase">formula: (in × mult) + (out × mult)</span>
                  </div>
                  <div className="divide-y divide-line text-xs font-mono">
                    <div className="grid grid-cols-5 px-4 py-2 text-[10px] uppercase text-fg-4">
                      <span className="col-span-2">Model AI</span>
                      <span className="text-center">Pengali In/Out</span>
                      <span className="text-center">Est. Biaya/Req</span>
                      <span className="text-right">Kapasitas 775M</span>
                    </div>
                    {MODEL_PRICING_CATALOG.map((m) => (
                      <div key={m.id} className="grid grid-cols-5 px-4 py-2.5 items-center hover:bg-hover/30">
                        <div className="col-span-2 min-w-0 pr-2">
                          <div className="font-semibold text-fg text-xs truncate">{m.name}</div>
                          <div className="text-[10px] text-fg-4 truncate font-sans">{m.desc}</div>
                        </div>
                        <div className="text-center text-fg-3 text-[11px]">
                          {m.inMultiplier}x / {m.outMultiplier}x
                        </div>
                        <div className="text-center text-accent text-[11px] font-semibold">
                          {m.costPerCall}
                        </div>
                        <div className="text-right text-emerald-400 text-[11px] font-semibold">
                          {m.capacity775M}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================= TAB 3: VOICE & AUDIO */}
            {activeTab === "voice" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Voice Engine & Audio Modulation</h3>
                  <p className="text-xs text-fg-3">Sesuaikan karakter suara, dialek, dan kecepatan respons audio asisten.</p>
                </div>

                {/* TTS Provider Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-fg-2 flex items-center gap-1.5">
                    <AudioLines className="w-3.5 h-3.5 text-accent" /> Mode Sintesis Suara
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, ttsProvider: "neural" })}
                      className={`p-3 text-left rounded-xl border transition-all ${
                        form.ttsProvider === "neural"
                          ? "bg-hover border-accent text-accent font-semibold shadow-xs"
                          : "border-line text-fg-2 hover:border-line-strong"
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Neural AI Voice (Cloud)
                      </div>
                      <p className="text-[10px] text-fg-3 mt-1">Intonasi alami manusia, emosional, sangat natural.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, ttsProvider: "browser" })}
                      className={`p-3 text-left rounded-xl border transition-all ${
                        form.ttsProvider === "browser"
                          ? "bg-hover border-accent text-accent font-semibold shadow-xs"
                          : "border-line text-fg-2 hover:border-line-strong"
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" /> Browser Speech (Lokal)
                      </div>
                      <p className="text-[10px] text-fg-3 mt-1">Sintesis bawaan OS, bekerja offline tanpa jaringan.</p>
                    </button>
                  </div>
                </div>

                {/* Character Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-fg-2 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-accent" /> Karakter & Dialek Suara
                  </label>
                  {form.ttsProvider === "neural" ? (
                    <select
                      value={form.neuralVoice}
                      onChange={(e) => setForm({ ...form, neuralVoice: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg outline-hidden transition-colors"
                    >
                      {filteredNeuralVoices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={form.voiceURI}
                      onChange={(e) => setForm({ ...form, voiceURI: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg outline-hidden transition-colors"
                    >
                      <option value="">Default Sistem Browser</option>
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Sliders: Rate & Pitch */}
                <div className="p-4 rounded-xl border border-line bg-raised space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-fg-2">Kecepatan Bicara (Speed Rate)</span>
                      <span className="font-mono text-accent font-semibold">{form.rate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.4"
                      step="0.05"
                      value={form.rate}
                      onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) })}
                      className="w-full accent-accent bg-hover h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5 border-t border-line/60 pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-fg-2">Nada Suara (Pitch)</span>
                      <span className="font-mono text-accent font-semibold">{form.pitch.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.05"
                      value={form.pitch}
                      onChange={(e) => setForm({ ...form, pitch: parseFloat(e.target.value) })}
                      className="w-full accent-accent bg-hover h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 border-t border-line pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-fg">Otomatis Membacakan Balasan (Auto-Speak)</div>
                      <div className="text-[11px] text-fg-3">AI langsung bersuara begitu respons teks selesai dibuat.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.autoSpeak}
                      onChange={(e) => setForm({ ...form, autoSpeak: e.target.checked })}
                      className="w-4 h-4 accent-accent cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================================================= TAB 4: PERSONA & PROMPT */}
            {activeTab === "persona" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Persona & System Prompting</h3>
                  <p className="text-xs text-fg-3">Atur gaya bicara, aturan khusus, dan personalisasi memori asisten.</p>
                </div>

                {/* Tone of Voice */}
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-fg-2">Gaya Bahasa (Tone of Voice)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "casual", label: "Santai", desc: "Bahasa sehari-hari" },
                      { id: "formal", label: "Formal", desc: "Resmi & baku" },
                      { id: "expert", label: "Tech Lead", desc: "Ringkas & teknis" },
                      { id: "concise", label: "Minimalis", desc: "Jawaban to the point" },
                    ].map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setForm({ ...form, personaTone: tone.id as any })}
                        className={`p-2 text-left rounded-xl border transition-all ${
                          (form.personaTone || "casual") === tone.id
                            ? "bg-hover border-accent text-accent font-semibold"
                            : "border-line text-fg-2 hover:border-line-strong"
                        }`}
                      >
                        <div className="text-xs font-semibold">{tone.label}</div>
                        <div className="text-[10px] text-fg-4">{tone.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Prompt Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase text-fg-2 flex items-center justify-between">
                    <span>Instruksi Khusus (System Prompt)</span>
                    <span className="text-[10px] text-fg-4">Mempengaruhi seluruh respons AI</span>
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Contoh: Selalu jawab dalam bahasa Indonesia santai. Jangan gunakan format kode jika tidak diminta secara spesifik..."
                    value={form.systemPrompt || ""}
                    onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                    className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl p-3 text-xs text-fg placeholder-fg-4 outline-hidden transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Auto Learn Memory Toggle */}
                <div className="p-4 rounded-xl border border-line bg-raised flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" /> Auto-Learn User Preference
                    </div>
                    <div className="text-[11px] text-fg-3 mt-0.5">
                      Secara otomatis mempelajari kebiasaan coding, warna favorit, dan gaya bahasamu ke memori semantik lokal.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.autoMemoryEnabled ?? true}
                    onChange={(e) => setForm({ ...form, autoMemoryEnabled: e.target.checked })}
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================================================= TAB 5: MCP & AGENT TOOLS */}
            {activeTab === "tools" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Alat Eksternal MCP & Agen Otonom</h3>
                  <p className="text-xs text-fg-3">Pilih server Model Context Protocol yang diizinkan untuk diakses agen mandiri.</p>
                </div>

                {/* Autonomous ReAct Steps Slider */}
                <div className="p-4 rounded-xl border border-line bg-raised space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-2 font-semibold flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-accent" /> Batas Maksimal Langkah Agen (ReAct Steps)
                    </span>
                    <span className="font-mono text-accent font-semibold">{form.agentMaxSteps ?? 8} iterasi</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="12"
                    step="1"
                    value={form.agentMaxSteps ?? 8}
                    onChange={(e) => setForm({ ...form, agentMaxSteps: parseInt(e.target.value) })}
                    className="w-full accent-accent bg-hover h-1.5 rounded-lg cursor-pointer"
                  />
                  <p className="text-[10px] text-fg-4">
                    Membatasi berapa kali agen boleh berpikir dan memanggil tool berturut-turut untuk menjaga efisiensi token.
                  </p>
                </div>

                {/* MCP List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono uppercase text-fg-2">Layanan MCP Tersedia</div>
                    <span className="text-[10px] text-fg-3">Firecrawl (Cloud) · Chrome DevTools (Lokal)</span>
                  </div>

                  <div className="p-3 rounded-xl border border-line bg-hover/40 text-xs space-y-1">
                    <div className="font-semibold text-fg flex items-center gap-1.5 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-accent" /> Kenapa Chrome DevTools / Playwright MCP perlu port lokal?
                    </div>
                    <p className="text-[11px] text-fg-3 leading-relaxed">
                      Layanan Cloud seperti <strong>Firecrawl</strong> langsung terhubung otomatis via internet. Sedangkan <strong>Chrome DevTools</strong> dan <strong>Playwright MCP</strong> memerlukan server MCP yang aktif di laptopmu (port 9222 & 8931). <em>Catatan:</em> Vox Omong sudah memiliki engine browser bawaan (native), jadi fitur browsing & visual inspect tetap berfungsi normal walau server MCP lokal tidak dinyalakan.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {mcpProviders.map((provider) => {
                      const isLocalTool = provider.id === "chrome-devtools" || provider.id === "playwright";
                      const isConnected = mcpChecks[provider.id]?.includes("Terhubung") || (provider.id === "firecrawl" && provider.configured);
                      const isConnectingThis = connectingProviderId === provider.id;

                      return (
                        <div key={provider.id} className="rounded-xl border border-line bg-raised p-3.5 transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-accent"
                                disabled={!provider.configured && !isConnected}
                                checked={(form.mcpEnabled || []).includes(provider.id)}
                                onChange={(e) =>
                                  setForm((curr) => ({
                                    ...curr,
                                    mcpEnabled: e.target.checked
                                      ? [...new Set([...(curr.mcpEnabled || []), provider.id])]
                                      : (curr.mcpEnabled || []).filter((id) => id !== provider.id),
                                  }))
                                }
                              />
                              <span className="text-fg">{provider.name}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                isConnected
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold"
                                  : isLocalTool
                                  ? "border-line text-fg-4"
                                  : "border-accent/30 bg-accent-wash text-accent"
                              }`}>
                                {isConnected ? "TERHUBUNG" : isLocalTool ? "LOKAL" : "CLOUD"}
                              </span>
                            </label>

                            <div className="flex items-center gap-1.5">
                              {/* If Chrome DevTools: Auto-Launch button */}
                              {provider.id === "chrome-devtools" && (
                                <button
                                  type="button"
                                  disabled={isStartingLocal}
                                  className="rounded-lg border border-line px-2 py-1 text-[11px] font-mono hover:bg-hover text-accent flex items-center gap-1 transition-colors disabled:opacity-50"
                                  onClick={async () => {
                                    setIsStartingLocal(true);
                                    setMcpChecks((curr) => ({ ...curr, [provider.id]: "Menyalakan Chrome..." }));
                                    try {
                                      const res = await fetch("/api/mcp", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "start_local", provider: provider.id }),
                                      });
                                      const d = await res.json();
                                      if (d.success) {
                                        setMcpChecks((curr) => ({ ...curr, [provider.id]: "Terhubung · port 9222 aktif" }));
                                      } else {
                                        setMcpChecks((curr) => ({ ...curr, [provider.id]: d.error || "Gagal menyalakan" }));
                                      }
                                    } catch {
                                      setMcpChecks((curr) => ({ ...curr, [provider.id]: "Gagal memulai Chrome" }));
                                    } finally {
                                      setIsStartingLocal(false);
                                    }
                                  }}
                                >
                                  <Play className="w-3 h-3" />
                                  <span>{isStartingLocal ? "Memulai..." : "Nyalakan Port 9222"}</span>
                                </button>
                              )}

                              {/* Connect or Edit Key Button for Cloud Tools */}
                              {!isLocalTool && provider.id !== "firecrawl" && (
                                <button
                                  type="button"
                                  className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-mono hover:bg-hover text-accent transition-colors"
                                  onClick={() => {
                                    setConnectingProviderId(isConnectingThis ? null : provider.id);
                                    setAuthInputToken("");
                                    setAuthInputUrl("");
                                    setAuthFeedback(null);
                                  }}
                                >
                                  {isConnectingThis ? "Tutup" : (provider.hasSavedToken || provider.configured ? "Ubah Kunci" : "🔑 Masuk / Hubungkan")}
                                </button>
                              )}

                              {/* Test Connection Button */}
                              <button
                                type="button"
                                disabled={provider.locked || mcpChecks[provider.id] === "Menguji…"}
                                className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-mono hover:bg-hover text-fg-2 disabled:opacity-40 transition-colors"
                                onClick={async () => {
                                  setMcpChecks((curr) => ({ ...curr, [provider.id]: "Menguji…" }));
                                  try {
                                    const response = await fetch("/api/mcp", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "test", provider: provider.id }),
                                    });
                                    const result = await response.json();
                                    setMcpChecks((curr) => ({
                                      ...curr,
                                      [provider.id]: result.connected ? `Terhubung · ${result.readableTools} alat` : result.error || "Gagal",
                                    }));
                                  } catch {
                                    setMcpChecks((curr) => ({ ...curr, [provider.id]: "Gagal menghubungi" }));
                                  }
                                }}
                              >
                                {mcpChecks[provider.id] || "Uji Koneksi"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-1 text-[11px] text-fg-3">
                            {provider.purpose} · {
                              isConnected
                                ? "Layanan aktif & siap menerima tugas"
                                : isLocalTool
                                ? (provider.id === "chrome-devtools" ? "Perlu server di port 9222" : "Perlu server di port 8931")
                                : (provider.configured ? "Siap diuji" : `Perlu ${provider.env}`)
                            }
                          </div>

                          {/* INLINE AUTH CONNECTION PANEL (Like ChatGPT / Claude login popover) */}
                          {isConnectingThis && (
                            <div className="mt-3 pt-3 border-t border-line/70 space-y-3 bg-hover/30 p-3 rounded-lg animate-in fade-in duration-150">
                              <div className="flex items-center justify-between text-xs font-semibold text-fg">
                                <span className="flex items-center gap-1.5">
                                  <Key className="w-3.5 h-3.5 text-accent" />
                                  Hubungkan {provider.name} (Tanpa Edit .env)
                                </span>
                                {provider.authLink && (
                                  <a
                                    href={provider.authLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-accent hover:underline flex items-center gap-1 font-mono"
                                  >
                                    <span>{provider.authLabel || "Buka Dashboard Token"}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <input
                                  type="password"
                                  placeholder={`Masukkan ${provider.env}...`}
                                  value={authInputToken}
                                  onChange={(e) => setAuthInputToken(e.target.value)}
                                  className="w-full bg-base border border-line-strong focus:border-accent rounded-lg px-3 py-1.5 text-xs font-mono text-fg outline-hidden"
                                />
                                {provider.id === "supabase" && (
                                  <input
                                    type="text"
                                    placeholder="Supabase Project URL opsional (https://xxx.supabase.co)..."
                                    value={authInputUrl}
                                    onChange={(e) => setAuthInputUrl(e.target.value)}
                                    className="w-full bg-base border border-line-strong focus:border-accent rounded-lg px-3 py-1.5 text-xs font-mono text-fg outline-hidden"
                                  />
                                )}
                              </div>

                              {authFeedback && (
                                <p className="text-[11px] text-accent font-medium">{authFeedback}</p>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                {provider.hasSavedToken ? (
                                  <button
                                    type="button"
                                    disabled={isSubmittingAuth}
                                    className="text-[11px] text-red-500 hover:underline flex items-center gap-1"
                                    onClick={async () => {
                                      setIsSubmittingAuth(true);
                                      try {
                                        await fetch("/api/mcp", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ action: "disconnect", provider: provider.id }),
                                        });
                                        setConnectingProviderId(null);
                                        setMcpChecks((curr) => ({ ...curr, [provider.id]: "Koneksi diputus" }));
                                        // Refresh provider status
                                        const res = await fetch("/api/mcp").then((r) => r.json());
                                        if (res.providers) setMcpProviders(res.providers);
                                      } finally {
                                        setIsSubmittingAuth(false);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus Kunci Tersimpan</span>
                                  </button>
                                ) : <div />}

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setConnectingProviderId(null)}
                                    className="px-2.5 py-1 text-xs rounded-lg border border-line hover:bg-hover text-fg-3"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubmittingAuth || !authInputToken.trim()}
                                    className="px-3 py-1 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hi text-white flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                                    onClick={async () => {
                                      setIsSubmittingAuth(true);
                                      setAuthFeedback("Memverifikasi token & menghubungkan...");
                                      try {
                                        const res = await fetch("/api/mcp", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            action: "connect",
                                            provider: provider.id,
                                            token: authInputToken,
                                            customUrl: authInputUrl || undefined,
                                          }),
                                        });
                                        const d = await res.json();
                                        if (d.success) {
                                          setConnectingProviderId(null);
                                          setMcpChecks((curr) => ({
                                            ...curr,
                                            [provider.id]: `Terhubung · ${d.toolCount || 0} alat`,
                                          }));
                                          // Otomatis centang provider ini di form settings
                                          setForm((curr) => ({
                                            ...curr,
                                            mcpEnabled: [...new Set([...(curr.mcpEnabled || []), provider.id])],
                                          }));
                                          // Refresh status list
                                          const rList = await fetch("/api/mcp").then((r) => r.json());
                                          if (rList.providers) setMcpProviders(rList.providers);
                                        } else {
                                          setAuthFeedback(d.error || "Gagal menghubungkan. Periksa kembali token.");
                                        }
                                      } catch (err) {
                                        setAuthFeedback((err as Error).message);
                                      } finally {
                                        setIsSubmittingAuth(false);
                                      }
                                    }}
                                  >
                                    {isSubmittingAuth ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    <span>Simpan & Sambungkan</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================= TAB 6: SECURITY & INTEGRATION */}
            {activeTab === "security" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-fg">Keamanan & Integrasi Workspace</h3>
                  <p className="text-xs text-fg-3">Kelola token GitHub, Vercel, dan sandbox proteksi terminal.</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-fg-2">GitHub Personal Access Token</label>
                    <input
                      type="password"
                      placeholder="ghp_..."
                      value={form.githubToken || ""}
                      onChange={(e) => setForm({ ...form, githubToken: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg font-mono outline-hidden"
                    />
                    <p className="text-[11px] text-fg-3">Digunakan saat kamu meminta agen untuk push project aktif ke repository GitHub.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-fg-2">Vercel Deployment Token</label>
                    <input
                      type="password"
                      placeholder="Token Vercel..."
                      value={form.vercelToken || ""}
                      onChange={(e) => setForm({ ...form, vercelToken: e.target.value })}
                      className="w-full bg-hover border border-line-strong focus:border-accent rounded-xl px-3 py-2 text-xs text-fg font-mono outline-hidden"
                    />
                    <p className="text-[11px] text-fg-3">Untuk auto-deploy website ke domain live Vercel secara mandiri.</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-line bg-raised space-y-2">
                  <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-accent" /> Sandbox Terminal & Direktori Lokal
                  </div>
                  <p className="text-[11px] text-fg-3 leading-relaxed">
                    Perintah terminal dibatasi dalam folder project <code>.data/user_projects</code>. Perintah destruktif seperti <code>rm -rf /</code> otomatis dicegat oleh sistem keamanan internal.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-line bg-raised/50">
          <button
            type="button"
            onClick={testVoice}
            disabled={isTesting}
            className="px-3.5 py-2 text-xs font-mono tracking-wide bg-hover hover:bg-line text-fg-2 rounded-xl border border-line transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : <Volume2 className="w-3.5 h-3.5 text-accent" />}
            <span>{isTesting ? "Memutar Audio..." : "Tes Suara"}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-fg-2 hover:bg-hover rounded-xl border border-line transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onSave(form);
                onClose();
              }}
              className="px-5 py-2 text-xs font-semibold bg-accent hover:bg-accent-hi text-white rounded-xl transition-all shadow-md shadow-accent/20 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
