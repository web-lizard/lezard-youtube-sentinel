import type { Comment } from "../core/models";
import type { ReplyResult, YouTubeAdapter } from "./youtube-adapter";

interface ApiConfig { apiKey: string; accessToken: string; channelId?: string; videoId?: string; }
export class YouTubeApiAdapter implements YouTubeAdapter {
  readonly id = "youtube-api" as const;
  constructor(private readonly config: ApiConfig) {}

  async collect(): Promise<Comment[]> {
    const query = new URLSearchParams({ part: "snippet,replies", maxResults: "100", order: "time" });
    if (this.config.videoId) query.set("videoId", this.config.videoId);
    else if (this.config.channelId) query.set("allThreadsRelatedToChannelId", this.config.channelId);
    else throw new Error("Для YouTube API нужен videoId или channelId.");
    if (this.config.apiKey) query.set("key", this.config.apiKey);
    const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${query}`, {
      headers: this.config.accessToken ? { Authorization: `Bearer ${this.config.accessToken}` } : {},
    });
    if (!response.ok) throw new Error(`YouTube API вернул HTTP ${response.status}.`);
    const payload = await response.json() as { items?: Array<Record<string, unknown>> };
    return (payload.items ?? []).flatMap((item) => this.normalizeThread(item));
  }

  private normalizeThread(item: Record<string, unknown>): Comment[] {
    const snippet = item.snippet as Record<string, unknown> | undefined;
    const top = snippet?.topLevelComment as Record<string, unknown> | undefined;
    const value = top?.snippet as Record<string, unknown> | undefined;
    if (!top?.id || !value?.textOriginal) return [];
    return [{
      id: String(top.id), threadId: String(item.id ?? top.id), videoId: String(snippet?.videoId ?? ""),
      videoTitle: "", authorName: String(value.authorDisplayName ?? ""),
      authorChannelId: String((value.authorChannelId as { value?: string } | undefined)?.value ?? ""),
      publishedAt: String(value.publishedAt ?? ""), text: String(value.textOriginal), parentCommentId: null,
      isReply: false, status: "new", source: "youtube-api",
    }];
  }

  async reply(comment: Comment, text: string, allowRealReplies: boolean): Promise<ReplyResult> {
    if (!allowRealReplies) return { sent: false, dryRun: true };
    if (!this.config.accessToken) throw new Error("Для ответа через API нужен OAuth access token.");
    const response = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
      method: "POST", headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ snippet: { parentId: comment.parentCommentId ?? comment.id, textOriginal: text } }),
    });
    if (!response.ok) throw new Error(`YouTube API reply вернул HTTP ${response.status}.`);
    return { sent: true, dryRun: false };
  }
}
