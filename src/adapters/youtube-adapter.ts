import type { Comment } from "../core/models";

export interface ReplyResult { sent: boolean; dryRun: boolean; }
export interface YouTubeAdapter {
  readonly id: "youtube-dom" | "youtube-api";
  collect(): Promise<Comment[]>;
  reply(comment: Comment, text: string, allowRealReplies: boolean): Promise<ReplyResult>;
}
