/**
 * Mesin orkestrasi VOX·AI Studio.
 *
 * Lapisan ini hasil bedah OpenBot 0.78.0 (lihat docs/openbot-breakdown.md): workflow multi-step,
 * routine terjadwal, thread paralel per agent, failover model, memory agent, UI block interaktif,
 * dan control plane automation. Semua diimplementasi ulang dari nol — tidak ada kode OpenBot
 * yang dipakai (lisensinya PolyForm Noncommercial).
 */

export * from "./types";
export { engineDir, newId } from "./store";
export { fillTemplate, fillString, referencedSteps } from "./template";
export { parseCron, nextCronRun, missedRuns, zonedParts, CronError } from "./cron";
export {
  WorkflowError,
  planWorkflow,
  stepDependencies,
  registerStepRunner,
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
  setWorkflowPaused,
  exportWorkflow,
  importWorkflow,
  runWorkflow,
  listRuns,
} from "./workflow";
export type { StepContext, StepRunner, RunOptions, WorkflowBundle } from "./workflow";
export {
  DEFAULT_TIMEZONE,
  RoutineError,
  listRoutines,
  getRoutine,
  saveRoutine,
  deleteRoutine,
  setRoutineEnabled,
  nextRunOf,
  dueRoutines,
  GRACE_MS,
  recordRoutineRun,
} from "./routines";
export type { DueRoutine } from "./routines";
export {
  ThreadError,
  setThreadExecutor,
  setConcurrency,
  concurrencyOf,
  listThreads,
  getThread,
  waitingCount,
  startThread,
  answerThread,
  stopThread,
  clearFinishedThreads,
} from "./threads";
export type { ThreadContext, ThreadExecutor } from "./threads";
export {
  FailoverError,
  listAccounts,
  addAccount,
  removeAccount,
  markLimited,
  accountUsable,
  pickAccount,
  isRetryable,
  withFailover,
} from "./failover";
export type { AttemptLog, FailoverResult } from "./failover";
export {
  MemoryError,
  MAX_ALWAYS,
  listMemories,
  saveMemory,
  deleteMemory,
  scoreMemory,
  searchMemories,
  memoryPrompt,
} from "./memory";
export {
  UiBlockError,
  normalizeBlock,
  extractBlock,
  validateAnswer,
  describeAnswer,
} from "./uiBlocks";
export { tickRoutines, setRoutinePromptRunner } from "./scheduler";
export type { TickResult } from "./scheduler";
export { bootEngine, runPrompt } from "./bootstrap";
export type { PromptRun } from "./bootstrap";
export { allowEngineRequest } from "./guard";
export {
  writeAutomationHandshake,
  clearAutomationHandshake,
  verifyAutomationToken,
  setAutomationAgents,
  handleAutomationCommand,
} from "./automation";
export type { AutomationCommand, AutomationResult } from "./automation";
