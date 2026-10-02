import type { Comment } from "./models";

export interface ProcessedLookup {
  hasProcessed(id: string): Promise<boolean>;
}

export class CommentCollector {
  constructor(private readonly processed: ProcessedLookup) {}

  async onlyNew(comments: Comment[]): Promise<Comment[]> {
    const unique = new Map(comments.map((comment) => [comment.id, comment]));
    const fresh: Comment[] = [];
    for (const comment of unique.values()) {
      if (!await this.processed.hasProcessed(comment.id)) fresh.push(comment);
    }
    return fresh;
  }
}
