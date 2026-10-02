import type { AppSettings, Comment } from "./models";
import type { ReplyTransport } from "./comment-processor";

export class ReplyEngine {
  constructor(private readonly transport: ReplyTransport) {}

  execute(comment: Comment, reply: string, settings: AppSettings): Promise<{ sent: boolean; dryRun: boolean }> {
    return this.transport.reply(comment, reply, settings.allowRealReplies);
  }
}
