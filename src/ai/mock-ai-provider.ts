import type { Classification } from "../core/models";
import type { AiProvider, CommentContext } from "./ai-provider";

const toxic = ["идиот", "туп", "ненавиж", "убей", "сдох", "ничтож", "клоун", "мусор", "бездар", "лох", "moron", "idiot", "stupid", "hate you", "kill yourself"];
const spam = ["http://", "https://", "telegram", "whatsapp", "заработок без", "crypto giveaway", "promo code"];

export class MockAiProvider implements AiProvider {
  readonly id = "mock";

  async classifyComment(comment: { text: string }, _context: CommentContext): Promise<Classification> {
    const value = comment.text.toLocaleLowerCase();
    if (spam.some((word) => value.includes(word))) return { kind: "spam", shield: true, confidence: 0.91, reasonCode: "spam_pattern" };
    if (toxic.some((word) => value.includes(word))) return { kind: "toxic", shield: true, confidence: 0.9, reasonCode: "hostile_language" };
    if (value.includes("?")) return { kind: "question", shield: false, confidence: 0.78, reasonCode: "question_mark" };
    if (["но ", "однако", "не соглас", "ошиб"].some((word) => value.includes(word))) return { kind: "criticism", shield: false, confidence: 0.72, reasonCode: "constructive_disagreement" };
    return { kind: "positive", shield: false, confidence: 0.7, reasonCode: "neutral_or_positive" };
  }

  async generateReply(comment: { text: string }, context: CommentContext): Promise<string> {
    const result = await this.classifyComment(comment, context);
    if (result.shield) return "Спасибо за обратную связь. Давайте сохраним обсуждение содержательным и уважительным.";
    if (result.kind === "question") return "Спасибо за вопрос! Я учту его и постараюсь раскрыть тему подробнее.";
    if (result.kind === "criticism") return "Спасибо за аргументированную обратную связь — это полезный взгляд на тему.";
    return "Спасибо за комментарий и поддержку!";
  }

  async summarizeHiddenComment(_comment: { text: string }, _context: CommentContext): Promise<string> {
    return "Автор выражает резкое несогласие и пытается перевести обсуждение с темы видео на личную оценку автора.";
  }

  async testConnection(): Promise<{ model: string }> { return { model: "Встроенный mock" }; }
}
