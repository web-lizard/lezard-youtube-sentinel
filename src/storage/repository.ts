import {
  DEFAULT_SETTINGS, DEFAULT_STATE, EMPTY_STATS,
  type AppSettings, type DashboardData, type EventLogEntry, type ProcessedComment, type RuntimeState, type Stats,
} from "../core/models";

const KEYS = { settings: "settings", state: "runtimeState", stats: "stats", processed: "processedComments", ids: "processedIds", logs: "eventLog" } as const;
let volatileApiKey = "";
let volatileYoutubeToken = "";

async function read<T>(key: string, fallback: T): Promise<T> {
  const result = await browser.storage.local.get(key);
  return (result[key] as T | undefined) ?? structuredClone(fallback);
}

export class StorageRepository {
  async getSettings(): Promise<AppSettings> {
    const stored = await read<Partial<AppSettings>>(KEYS.settings, {});
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
    };
    if (!settings.ai.apiKey) settings.ai.apiKey = volatileApiKey;
    if (!settings.youtubeAccessToken) settings.youtubeAccessToken = volatileYoutubeToken;
    return settings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const normalized: AppSettings = {
      ...settings,
      ai: {
        ...settings.ai,
        baseUrl: settings.ai.baseUrl.trim().replace(/\/+$/, ""),
        model: settings.ai.model.trim(),
        apiKey: settings.ai.apiKey.trim(),
        temperature: Math.min(2, Math.max(0, Number(settings.ai.temperature) || 0)),
      },
      autoIntervalMinutes: Math.max(1, Math.round(settings.autoIntervalMinutes || 5)),
      maxRetries: Math.min(5, Math.max(0, Math.round(settings.maxRetries || 0))),
      actionDelayMs: Math.max(250, Math.round(settings.actionDelayMs || 1200)),
    };
    volatileApiKey = normalized.ai.apiKey;
    volatileYoutubeToken = normalized.youtubeAccessToken;
    await browser.storage.local.set({
      [KEYS.settings]: normalized.ai.rememberKey
        ? normalized
        : { ...normalized, ai: { ...normalized.ai, apiKey: "" }, youtubeAccessToken: "" },
    });
  }

  getState(): Promise<RuntimeState> { return read(KEYS.state, DEFAULT_STATE); }
  setState(state: RuntimeState): Promise<void> { return browser.storage.local.set({ [KEYS.state]: state }); }
  getStats(): Promise<Stats> { return read(KEYS.stats, EMPTY_STATS); }
  setStats(stats: Stats): Promise<void> { return browser.storage.local.set({ [KEYS.stats]: stats }); }
  getProcessed(): Promise<ProcessedComment[]> { return read(KEYS.processed, []); }
  getProcessedIds(): Promise<string[]> { return read(KEYS.ids, []); }

  async hasProcessed(id: string): Promise<boolean> { return (await this.getProcessedIds()).includes(id); }

  async saveProcessed(result: ProcessedComment): Promise<void> {
    const [items, ids] = await Promise.all([this.getProcessed(), this.getProcessedIds()]);
    const without = items.filter((item) => item.id !== result.id);
    // Processed records intentionally never include the original comment text.
    await browser.storage.local.set({
      [KEYS.processed]: [result, ...without].slice(0, 500),
      [KEYS.ids]: [result.id, ...ids.filter((id) => id !== result.id)].slice(0, 5000),
    });
  }

  async addLog(entry: EventLogEntry): Promise<void> {
    const logs = await read<EventLogEntry[]>(KEYS.logs, []);
    await browser.storage.local.set({ [KEYS.logs]: [entry, ...logs].slice(0, 200) });
  }

  async dashboard(aiConnected: boolean): Promise<DashboardData> {
    const [settings, state, stats, recent, logs] = await Promise.all([
      this.getSettings(), this.getState(), this.getStats(), this.getProcessed(), read<EventLogEntry[]>(KEYS.logs, []),
    ]);
    return { settings, state, stats, recent: recent.slice(0, 30), logs: logs.slice(0, 50), aiConnected };
  }
}
