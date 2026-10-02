export const COMMENT_STATUSES = [
  "new", "processing", "safe", "shielded", "replied", "ignored", "failed",
] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export type CommentKind = "positive" | "criticism" | "question" | "toxic" | "spam";

export interface Comment {
  id: string;
  threadId: string;
  videoId: string;
  videoTitle: string;
  authorName: string;
  authorChannelId: string;
  publishedAt: string;
  text: string;
  parentCommentId: string | null;
  isReply: boolean;
  status: CommentStatus;
  source: "youtube-dom" | "youtube-api" | "mock";
}

export interface Classification {
  kind: CommentKind;
  shield: boolean;
  confidence: number;
  reasonCode: string;
}

export interface ProcessedComment {
  id: string;
  threadId: string;
  videoId: string;
  videoTitle: string;
  authorName: string;
  publishedAt: string;
  processedAt: string;
  status: CommentStatus;
  kind: CommentKind;
  shielded: boolean;
  summary?: string;
  reply?: string;
  replySent: boolean;
  source: Comment["source"];
  error?: string;
}

export interface Stats {
  found: number;
  processed: number;
  replied: number;
  shielded: number;
  errors: number;
}

export type RunMode = "stopped" | "scanning" | "auto" | "paused";
export interface RuntimeState {
  mode: RunMode;
  queueSize: number;
  activeCommentId: string;
  youtubeConnected: boolean;
  lastScanAt: string;
}

export interface AiSettings {
  provider: "mock" | "openai-compatible";
  baseUrl: string;
  model: string;
  apiKey: string;
  rememberKey: boolean;
  temperature: number;
}

export interface AppSettings {
  ai: AiSettings;
  allowRealReplies: boolean;
  autoIntervalMinutes: number;
  maxRetries: number;
  actionDelayMs: number;
  transport: "dom" | "api";
  youtubeApiKey: string;
  youtubeAccessToken: string;
}

export interface EventLogEntry {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface DashboardData {
  settings: AppSettings;
  state: RuntimeState;
  stats: Stats;
  recent: ProcessedComment[];
  logs: EventLogEntry[];
  aiConnected: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: "mock",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKey: "",
    rememberKey: true,
    temperature: 0.2,
  },
  allowRealReplies: false,
  autoIntervalMinutes: 5,
  maxRetries: 2,
  actionDelayMs: 1200,
  transport: "dom",
  youtubeApiKey: "",
  youtubeAccessToken: "",
};

export const EMPTY_STATS: Stats = { found: 0, processed: 0, replied: 0, shielded: 0, errors: 0 };
export const DEFAULT_STATE: RuntimeState = {
  mode: "stopped", queueSize: 0, activeCommentId: "", youtubeConnected: false, lastScanAt: "",
};
