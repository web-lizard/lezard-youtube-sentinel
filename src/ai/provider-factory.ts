import type { AiSettings } from "../core/models";
import type { AiProvider } from "./ai-provider";
import { MockAiProvider } from "./mock-ai-provider";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider";

export function createAiProvider(settings: AiSettings): AiProvider {
  return settings.provider === "mock" ? new MockAiProvider() : new OpenAiCompatibleProvider(settings);
}
