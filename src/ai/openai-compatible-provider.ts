import type { AiSettings, Classification } from "../core/models";
import { CLASSIFIER_PROMPT } from "../prompts/classifier";
import { REPLY_PROMPT } from "../prompts/reply";
import { SUMMARIZER_PROMPT } from "../prompts/summarizer";
import type { AiProvider, CommentContext } from "./ai-provider";

interface Completion { choices?: Array<{ message?: { content?: unknown } }>; model?: string; }

function endpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("AI base URL должен использовать HTTPS.");
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/v1") ? `${path}/chat/completions` : `${path}/chat/completions`;
  return url.toString();
}

function stripFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id = "openai-compatible";
  constructor(private readonly settings: AiSettings) {}

  private async chat(system: string, user: string, json = false): Promise<{ content: string; model: string }> {
    if (!this.settings.apiKey) throw new Error("API key не задан.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(endpoint(this.settings.baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.settings.apiKey}` },
        body: JSON.stringify({
          model: this.settings.model,
          temperature: this.settings.temperature,
          stream: false,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AI API вернул HTTP ${response.status}.`);
      const payload = await response.json() as Completion;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("AI API вернул пустой ответ.");
      return { content: content.trim(), model: payload.model ?? this.settings.model };
    } finally { clearTimeout(timeout); }
  }

  private user(comment: { text: string }, context: CommentContext): string {
    return JSON.stringify({ comment: comment.text, context });
  }

  async classifyComment(comment: { text: string }, context: CommentContext): Promise<Classification> {
    const result = await this.chat(CLASSIFIER_PROMPT, this.user(comment, context), true);
    const parsed = JSON.parse(stripFence(result.content)) as Partial<Classification>;
    const kinds = ["positive", "criticism", "question", "toxic", "spam"];
    if (!kinds.includes(parsed.kind ?? "") || typeof parsed.shield !== "boolean") throw new Error("Некорректный ответ классификатора.");
    return {
      kind: parsed.kind as Classification["kind"],
      shield: parsed.shield,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      reasonCode: String(parsed.reasonCode ?? "ai_decision").slice(0, 80),
    };
  }

  async generateReply(comment: { text: string }, context: CommentContext): Promise<string> {
    return (await this.chat(REPLY_PROMPT, this.user(comment, context))).content.slice(0, 500);
  }

  async summarizeHiddenComment(comment: { text: string }, context: CommentContext): Promise<string> {
    return (await this.chat(SUMMARIZER_PROMPT, this.user(comment, context))).content.slice(0, 300);
  }

  async testConnection(): Promise<{ model: string }> {
    const result = await this.chat("Reply with exactly OK.", "Connection test.");
    return { model: result.model };
  }
}
