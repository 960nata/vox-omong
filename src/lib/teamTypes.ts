/** Shared browser/server contract. Secrets never belong in these persisted records. */
export type TeamKind = "developer" | "marketing" | "creative" | "founder" | "research" | "trading" | "career" | "executive" | "custom";
export type TeamAvatar = "initials" | "orbit" | "bolt" | "palette" | "code" | "megaphone" | "sparkle";
/** Same supported presets as SettingsModal.NEURAL_VOICES; safe to import on the server. */
export const TEAM_VOICE_IDS = [
  "id-ID-GadisNeural", "id-ID-ArdiNeural", "jv-ID-SitiNeural", "jv-ID-DimasNeural",
  "su-ID-TutiNeural", "su-ID-JajangNeural", "ms-MY-YasminNeural", "ms-MY-OsmanNeural",
  "en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural", "en-US-ChristopherNeural",
] as const;
export const TEAM_DEFAULT_VOICES: Record<TeamKind, readonly string[]> = {
  developer: ["id-ID-ArdiNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "su-ID-JajangNeural", "jv-ID-SitiNeural"],
  marketing: ["id-ID-GadisNeural", "jv-ID-SitiNeural", "jv-ID-DimasNeural", "su-ID-TutiNeural", "id-ID-ArdiNeural"],
  creative: ["ms-MY-YasminNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "jv-ID-SitiNeural", "su-ID-JajangNeural"],
  founder: ["id-ID-ArdiNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "jv-ID-SitiNeural"],
  research: ["id-ID-ArdiNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "jv-ID-SitiNeural"],
  trading: ["id-ID-ArdiNeural", "jv-ID-DimasNeural", "id-ID-GadisNeural", "su-ID-JajangNeural"],
  career: ["id-ID-GadisNeural", "id-ID-ArdiNeural", "jv-ID-SitiNeural", "jv-ID-DimasNeural"],
  executive: ["id-ID-ArdiNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "ms-MY-YasminNeural", "su-ID-TutiNeural"],
  custom: ["id-ID-ArdiNeural", "id-ID-GadisNeural", "jv-ID-DimasNeural", "su-ID-JajangNeural", "jv-ID-SitiNeural"],
};
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  agencyAgentId?: string;
  skillId?: string;
  status: "idle" | "working" | "done" | "failed";
  report?: string;
  model?: string;
  avatar?: TeamAvatar;
  voice?: string;
}
export interface TeamMessage {
  id: string;
  memberId: string;
  content: string;
  createdAt: string;
  taskId?: string;
  channel?: "group" | "direct";
  role?: "user" | "assistant";
  changedFiles?: string[];
}
export interface TeamTask {
  id: string;
  message: string;
  status: "running" | "completed" | "partial" | "failed";
  createdAt: string;
  updatedAt: string;
  result?: string;
  previewUrl?: string;
  error?: string;
  artifactPath?: string;
  verification?: "draft" | "code-generated" | "runtime-verified";
  mode?: "work" | "discuss";
  participantIds?: string[];
}
export interface Team {
  id: string;
  name: string;
  projectId: string;
  kind: TeamKind;
  createdAt: string;
  updatedAt: string;
  leaderId: string;
  members: TeamMember[];
  messages: TeamMessage[];
  tasks: TeamTask[];
}

export type SessionKind = "website" | "saas" | "launch" | "custom";
export type PipelineStage = "ideation" | "prd" | "board_vote" | "development" | "ready";

export interface BoardVote {
  memberId: string;
  memberName: string;
  division: string;
  decision: "approve" | "revise" | "pending";
  feedback?: string;
  votedAt?: string;
}

export interface TeamSession {
  id: string;
  title: string;
  description?: string;
  kind: SessionKind;
  pipelineStage: PipelineStage;
  prdDocument?: string;
  votes?: BoardVote[];
  recommendedDivisions?: TeamKind[];
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAnalysisResult {
  projectTitle: string;
  executiveSummary: string;
  recommendedDivisions: {
    kind: TeamKind;
    name: string;
    recommended: boolean;
    reason: string;
    initialFocus: string;
  }[];
  initialPrdSeed: {
    problemStatement: string;
    targetAudience: string;
    coreFeatures: string[];
    monetizationIdea: string;
  };
}
