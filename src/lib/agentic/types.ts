import type { ArtifactItem } from "../types";

export interface ToolParameterSchema {
  type: string;
  description: string;
  enum?: string[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
}

export interface ToolExecutionContext {
  projectId: string;
  conversationId?: string;
  apiKey?: string;
  onLog?: (message: string) => void;
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  artifact?: ArtifactItem;
  error?: string;
}

export interface ReActStep {
  stepNumber: number;
  thought: string;
  action: string;
  args: Record<string, unknown>;
  observation?: string;
  success?: boolean;
  timestamp: string;
}

export interface ReActResult {
  success: boolean;
  finalAnswer: string;
  steps: ReActStep[];
  artifacts: ArtifactItem[];
  totalTokensApprox?: number;
}

export interface SubGoal {
  id: string;
  title: string;
  description: string;
  suggestedTool: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  status?: "pending" | "running" | "completed" | "failed";
}

export interface AutonomousPlan {
  isAutonomousGoal: boolean;
  goalSummary: string;
  complexity: "simple" | "multi_step" | "complex";
  steps: SubGoal[];
}

export interface VisualCriticIssue {
  type: "console_error" | "layout_overflow" | "contrast_warning" | "broken_asset" | "aesthetic";
  severity: "high" | "medium" | "low";
  description: string;
  suggestedFix?: string;
}

export interface VisualCriticResult {
  passed: boolean;
  issues: VisualCriticIssue[];
  fixedIssues: string[];
  screenshotBase64?: string;
  critiqueSummary: string;
  iterationsRun: number;
}

export interface SemanticMemoryItem {
  id: string;
  topic: string;
  content: string;
  embedding?: number[];
  category: "episodic" | "solution" | "user_preference" | "general";
  createdAt: string;
  accessCount: number;
}

export interface UserPreferenceProfile {
  themePreference?: "dark" | "light" | "system";
  designStyle?: string;
  techStackPreference?: string[];
  languageStyle?: "formal" | "casual" | "english" | "indonesian";
  customNotes: string[];
  updatedAt: string;
}

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface BackgroundTaskRecord {
  id: string;
  task: string;
  mode: "react" | "plan" | "critic";
  status: TaskStatus;
  progressPercent: number;
  currentStepMessage: string;
  logs: string[];
  result?: {
    reply: string;
    artifacts: ArtifactItem[];
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}
