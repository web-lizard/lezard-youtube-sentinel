import { describe, expect, it } from "vitest";
import { CommentCollector } from "../src/core/comment-collector";
import type { Comment } from "../src/core/models";

function comment(id: string): Comment {
  return { id, threadId: id, videoId: "v", videoTitle: "", authorName: "", authorChannelId: "", publishedAt: "", text: id, parentCommentId: null, isReply: false, status: "new", source: "mock" };
}

describe("CommentCollector", () => {
  it("deduplicates a scan and skips processed IDs", async () => {
    const collector = new CommentCollector({ hasProcessed: async (id) => id === "old" });
    const result = await collector.onlyNew([comment("new"), comment("new"), comment("old")]);
    expect(result.map((item) => item.id)).toEqual(["new"]);
  });
});
