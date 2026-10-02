import type { EventLogEntry } from "../core/models";

const forbidden = new Set(["text", "original", "comment", "reply", "apiKey", "token", "authorization"]);

export function safeConsole(level: "info" | "warn" | "error", event: string, details: Record<string, unknown> = {}): void {
  const safe = Object.fromEntries(Object.entries(details).filter(([key]) => !forbidden.has(key)));
  console[level]("[Lizard Sentinel]", event, safe);
}

export function logEntry(message: string, level: EventLogEntry["level"] = "info"): EventLogEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), level, message };
}

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/sk-[\w-]{8,}/gi, "[REDACTED]").slice(0, 240);
  return "Неизвестная ошибка";
}
