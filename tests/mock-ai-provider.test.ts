import { describe, expect, it } from "vitest";
import { MockAiProvider } from "../src/ai/mock-ai-provider";

const context = { videoId: "v", videoTitle: "Demo", authorName: "Author" };

describe("MockAiProvider", () => {
  const provider = new MockAiProvider();

  it("shields hostile comments", async () => {
    const result = await provider.classifyComment({ text: "Автор тупой бездарь" }, context);
    expect(result.kind).toBe("toxic");
    expect(result.shield).toBe(true);
  });

  it("keeps constructive criticism visible", async () => {
    const result = await provider.classifyComment({ text: "Не согласен, потому что пример не учитывает цену" }, context);
    expect(result.kind).toBe("criticism");
    expect(result.shield).toBe(false);
  });

  it("identifies spam", async () => {
    const result = await provider.classifyComment({ text: "Заработок без вложений https://example.test" }, context);
    expect(result.kind).toBe("spam");
    expect(result.shield).toBe(true);
  });
});
