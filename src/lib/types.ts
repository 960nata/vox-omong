export interface ArtifactFile {
  name: string;
  path: string;
  type: "ts" | "tsx" | "js" | "jsx" | "py" | "json" | "css" | "pdf" | "doc" | "other";
  additions: number;
  deletions: number;
  content?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  companyName: string;
  companyAddress: string;
  clientName: string;
  clientAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  style?: "klasik" | "modern" | "bold";
  accent?: string;
}

export interface SpreadsheetData {
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

export type SlideLayout = "cover" | "bullets" | "stat" | "quote" | "split" | "closing" | "image" | "steps";

/** Foto (Unsplash) untuk sebuah slide. Atribusi wajib ditampilkan sesuai pedoman Unsplash. */
export interface SlideImage {
  url: string; // lebar 1400, untuk latar penuh
  small: string; // lebar 800, untuk panel samping
  alt: string;
  author: string;
  authorUrl: string;
  color?: string;
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  bullets: string[];
  speakerNotes?: string;
  layout?: SlideLayout;
  kicker?: string;
  subtitle?: string;
  stat?: { value: string; label: string };
  quote?: { text: string; author?: string };
  columns?: { leftTitle: string; left: string[]; rightTitle: string; right: string[] };
  /** kata kunci pencarian foto (Inggris, 2-4 kata) yang ditulis AI */
  imageQuery?: string;
  image?: SlideImage;
}

export interface SlideDeckData {
  deckTitle: string;
  slides: SlideItem[];
  theme?: string;
}

export interface WebPreviewData {
  html: string;
  title?: string;
}

export interface SwarmComponentItem {
  id: string;
  name: string;
  role: string;
  status: "completed" | "in_progress" | "pending";
  description: string;
  linesOfCode: number;
}

export interface SwarmPipelineData {
  projectName: string;
  targetPage: string;
  totalComponents: number;
  completedComponents: number;
  components: SwarmComponentItem[];
  previewUrl: string;
}

export interface WebsiteData {
  html: string;
  projectId: string;
  previewUrl: string;
  mode: "create" | "edit" | "undo";
  model?: string;
  lines: number;
  previousLines?: number;
  durationMs?: number;
  score?: number;
  warnings?: string[];
  meeting?: { role: string; agent: string; model: string; note: string; durationMs: number }[];
}

export interface ArtifactItem {
  id: string;
  type: "code_diff" | "pdf_document" | "invoice" | "spreadsheet" | "slides" | "web_preview" | "file_bundle" | "swarm_build" | "website" | "video";
  title: string;
  summary?: string;
  files?: ArtifactFile[];
  totalAdditions?: number;
  totalDeletions?: number;
  pdfTitle?: string;
  pdfPages?: number;
  pdfContent?: string;
  docTheme?: string;
  letter?: LetterData;
  invoice?: InvoiceData;
  spreadsheet?: SpreadsheetData;
  slides?: SlideDeckData;
  webPreview?: WebPreviewData;
  swarmPipeline?: SwarmPipelineData;
  website?: WebsiteData;
  video?: { id: string; url: string; htmlUrl: string; seconds: number; scenes: number; recorded: boolean; note?: string };
  downloadUrl?: string;
  status: "completed" | "in_progress" | "review";
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  audioDuration?: number;
  artifact?: ArtifactItem;
  /** Beberapa hasil sekaligus (orkestrator). */
  artifacts?: ArtifactItem[];
  imageUri?: string;
  imageAnalysis?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface VoiceSettings {
  apiKey: string;
  language: "id-ID" | "en-US";
  ttsProvider: "neural" | "browser";
  neuralVoice: string;
  voiceURI: string;
  pitch: number;
  rate: number;
  autoSpeak: boolean;
  systemPrompt: string;
  jarvisMode?: boolean;
  silenceTimeoutMs?: number;
  githubToken?: string;
  githubRepoUrl?: string;
  vercelToken?: string;
}

/** Surat resmi berkop (surat dinas, undangan, keterangan, lamaran, dll.). Kosong = tidak digambar. */
export interface LetterData {
  kind: "resmi" | "undangan" | "keterangan" | "lamaran" | "lainnya";
  kop?: { name: string; unit?: string; address?: string; contact?: string };
  nomor?: string;
  lampiran?: string;
  perihal: string;
  tempat: string;
  tanggal: string;
  kepada: string[];
  pembuka?: string;
  isi: string[];
  rincian?: { label: string; value: string }[];
  penutup?: string;
  salamPenutup?: string;
  jabatan?: string;
  nama: string;
  nip?: string;
  tembusan?: string[];
}
