import type { AiProvider } from "../ai/ai-provider";
import type { AppSettings, Comment, ProcessedComment } from "./models";
import { ReplyEngine } from "./reply-engine";
import { ShieldEngine } from "./shield-engine";

export interface ReplyTransport {
  reply(comment: Comment, text: string, allowRealReplies: boolean): Promise<{ sent: boolean; dryRun: boolean }>;
  applyVerdict(commentId: string, shielded: boolean, summary?: string): Promise<void>;
}

export class CommentProcessor {
  private readonly replies: ReplyEngine;
  private readonly shield: ShieldEngine;

  constructor(private readonly ai: AiProvider, transport: ReplyTransport) {
    this.replies = new ReplyEngine(transport);
    this.shield = new ShieldEngine(ai, transport);
  }

  async process(comment: Comment, settings: AppSettings): Promise<ProcessedComment> {
    const context = { videoId: comment.videoId, videoTitle: comment.videoTitle, authorName: comment.authorName };
    const classification = await this.ai.classifyComment({ text: comment.text }, context);
    const [reply, summary] = await Promise.all([
      this.ai.generateReply({ text: comment.text }, context),
      this.shield.summarize(comment, context, classification.shield),
    ]);

    await this.shield.apply(comment.id, classification.shield, summary);
    const result = await this.replies.execute(comment, reply, settings);
    return {
      id: comment.id, threadId: comment.threadId, videoId: comment.videoId, videoTitle: comment.videoTitle,
      authorName: comment.authorName, publishedAt: comment.publishedAt, processedAt: new Date().toISOString(),
      status: result.sent ? "replied" : classification.shield ? "shielded" : "safe",
      kind: classification.kind, shielded: classification.shield, summary, reply,
      replySent: result.sent, source: comment.source,
    };
  }
}
