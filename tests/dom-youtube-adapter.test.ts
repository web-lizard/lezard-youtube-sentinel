import { beforeEach, describe, expect, it } from "vitest";
import { YouTubeDomAdapter } from "../src/content/dom-youtube-adapter";

describe("YouTubeDomAdapter", () => {
  beforeEach(() => {
    history.replaceState({}, "", "https://www.youtube.com/watch?v=video123");
    document.body.innerHTML = `
      <h1>Test video</h1>
      <ytd-comment-thread-renderer data-comment-id="comment123">
        <a id="author-text" href="/@viewer">Viewer</a>
        <yt-formatted-string id="content-text">A useful comment?</yt-formatted-string>
        <button aria-label="Reply">Reply</button>
      </ytd-comment-thread-renderer>`;
  });

  it("normalizes a current YouTube comment custom element", async () => {
    const comments = await new YouTubeDomAdapter().collect();
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: "comment123", videoId: "video123", authorName: "Viewer", text: "A useful comment?" });
    expect(document.querySelector("#content-text")?.classList.contains("ls-comment-veiled")).toBe(true);
  });

  it("replaces a shielded original and drops it from visible DOM", async () => {
    const adapter = new YouTubeDomAdapter();
    await adapter.collect();
    adapter.applyVerdict("comment123", true, "Safe summary");
    expect(document.querySelector("#content-text")?.textContent).toBe("Обезврежено Lizard Sentinel");
    expect(document.body.textContent).not.toContain("A useful comment?");
  });
});
