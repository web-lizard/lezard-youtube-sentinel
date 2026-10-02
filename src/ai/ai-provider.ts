import type { Classification, Comment } from "../core/models";

export interface CommentContext {
  videoId: string;
  videoTitle: string;
  authorName: string;
}

export interface AiProvider {
  readonly id: string;
  classifyComment(comment: Pick<Comment, "text">, context: CommentContext): Promise<Classification>;
  generateReply(comment: Pick<Comment, "text">, context: CommentContext): Promise<string>;
  summarizeHiddenComment(comment: Pick<Comment, "text">, context: CommentContext): Promise<string>;
  testConnection(): Promise<{ model: string }>;
}
