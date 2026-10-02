import { describe, expect, it, vi } from "vitest";
import { MockAiProvider } from "../src/ai/mock-ai-provider";
import { CommentProcessor } from "../src/core/comment-processor";
import { DEFAULT_SETTINGS, type Comment } from "../src/core/models";

const toxic: Comment = {
  id: "toxic-1", threadId: "thread-1", videoId: "video-1", videoTitle: "Demo",
  authorName: "Viewer", authorChannelId: "channel", publishedAt: "2026-10-02T10:00:00Z",
  text: "Ты тупой бездарь", parentCommentId: null, isReply: false, status: "new", source: "mock",
};

describe("CommentProcessor", () => {
  it("creates only a sanitized persistent result in dry-run", async () => {
    const transport = {
      applyVerdict: vi.fn(async () => undefined),
      reply: vi.fn(async () => ({ sent: false, dryRun: true })),
    };
    const result = await new CommentProcessor(new MockAiProvider(), transport).process(toxic, DEFAULT_SETTINGS);
    expect(result.shielded).toBe(true);
    expect(result.status).toBe("shielded");
    expect(result.summary).toContain("резкое несогласие");
    expect(result).not.toHaveProperty("text");
    expect(JSON.stringify(result)).not.toContain(toxic.text);
    expect(transport.reply).toHaveBeenCalledWith(toxic, expect.any(String), false);
  });
});
