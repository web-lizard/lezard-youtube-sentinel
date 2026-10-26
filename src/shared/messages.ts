import type { AppSettings, Comment, DashboardData } from "../core/models";

export const MSG = {
  GET_DASHBOARD: "LS_GET_DASHBOARD",
  SCAN_NOW: "LS_SCAN_NOW",
  START_AUTO: "LS_START_AUTO",
  PAUSE: "LS_PAUSE",
  RUN_MOCK: "LS_RUN_MOCK",
  SAVE_SETTINGS: "LS_SAVE_SETTINGS",
  TEST_AI: "LS_TEST_AI",
  COLLECT: "LS_COLLECT",
  REPLY: "LS_REPLY",
  APPLY_VERDICT: "LS_APPLY_VERDICT",
  GET_TRANSCRIPT: "LS_GET_TRANSCRIPT",
  PING: "LS_PING",
} as const;

export type BackgroundMessage =
  | { type: typeof MSG.GET_DASHBOARD }
  | { type: typeof MSG.SCAN_NOW }
  | { type: typeof MSG.START_AUTO }
  | { type: typeof MSG.PAUSE }
  | { type: typeof MSG.RUN_MOCK }
  | { type: typeof MSG.GET_TRANSCRIPT }
  | { type: typeof MSG.SAVE_SETTINGS; settings: AppSettings }
  | { type: typeof MSG.TEST_AI; settings: AppSettings };

export type ContentMessage =
  | { type: typeof MSG.COLLECT }
  | { type: typeof MSG.REPLY; commentId: string; reply: string; allowRealReplies: boolean }
  | { type: typeof MSG.APPLY_VERDICT; commentId: string; shielded: boolean; summary?: string }
  | { type: typeof MSG.GET_TRANSCRIPT }
  | { type: typeof MSG.PING };

export type ApiResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DashboardResponse = ApiResponse<DashboardData>;
export type CollectResponse = ApiResponse<{ comments: Comment[]; page: string }>;
export type ReplyResponse = ApiResponse<{ sent: boolean; dryRun: boolean }>;
export type TranscriptResponse = ApiResponse<{ title: string; videoId: string; url: string; segmentCount: number; text: string }>;
