import type { AiProvider, CommentContext } from "../ai/ai-provider";
import type { Comment } from "./models";
import type { ReplyTransport } from "./comment-processor";

export class ShieldEngine {
  constructor(private readonly ai: AiProvider, private readonly transport: ReplyTransport) {}

  summarize(comment: Comment, context: CommentContext, shielded: boolean): Promise<string | undefined> {
    return shielded
      ? this.ai.summarizeHiddenComment({ text: comment.text }, context)
      : Promise.resolve(undefined);
  }

  apply(commentId: string, shielded: boolean, summary?: string): Promise<void> {
    return this.transport.applyVerdict(commentId, shielded, summary);
  }
}
