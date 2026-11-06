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
}

export interface SpreadsheetData {
  title: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  bullets: string[];
  speakerNotes?: string;
}

export interface SlideDeckData {
  deckTitle: string;
  slides: SlideItem[];
}

export interface WebPreviewData {
  html: string;
  title?: string;
}

export interface ArtifactItem {
  id: string;
  type: "code_diff" | "pdf_document" | "invoice" | "spreadsheet" | "slides" | "web_preview" | "file_bundle";
  title: string;
  summary?: string;
  files?: ArtifactFile[];
  totalAdditions?: number;
  totalDeletions?: number;
  pdfTitle?: string;
  pdfPages?: number;
  pdfContent?: string;
  invoice?: InvoiceData;
  spreadsheet?: SpreadsheetData;
  slides?: SlideDeckData;
  webPreview?: WebPreviewData;
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
