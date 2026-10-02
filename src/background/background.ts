import { YouTubeApiAdapter } from "../adapters/youtube-api-adapter";
import { createAiProvider } from "../ai/provider-factory";
import { CommentProcessor, type ReplyTransport } from "../core/comment-processor";
import { CommentCollector } from "../core/comment-collector";
import type { AppSettings, Comment, ProcessedComment, RuntimeState, Stats } from "../core/models";
import { mockComments } from "../mock/comments";
import { MSG, type BackgroundMessage, type CollectResponse, type ReplyResponse } from "../shared/messages";
import { logEntry, safeConsole, safeError } from "../shared/logger";
import { StorageRepository } from "../storage/repository";

const storage = new StorageRepository();
const AUTO_ALARM = "lizard-sentinel-auto-scan";
let queueRunning = false;
let pauseRequested = false;

async function patchState(patch: Partial<RuntimeState>): Promise<RuntimeState> {
  const state = { ...(await storage.getState()), ...patch };
  await storage.setState(state);
  return state;
}

async function patchStats(patch: Partial<Stats>): Promise<void> {
  await storage.setStats({ ...(await storage.getStats()), ...patch });
}

async function addLog(message: string, level: "info" | "warn" | "error" = "info"): Promise<void> {
  await storage.addLog(logEntry(message, level));
  safeConsole(level, message);
}

async function activeYoutubeTab(): Promise<{ id: number; url: string } | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs.find((item) => item.id && item.url && /https:\/\/(www\.)?youtube\.com|https:\/\/studio\.youtube\.com/.test(item.url));
  return tab?.id && tab.url ? { id: tab.id, url: tab.url } : null;
}

function domTransport(tabId: number): ReplyTransport {
  return {
    async applyVerdict(commentId, shielded, summary) {
      await browser.tabs.sendMessage(tabId, { type: MSG.APPLY_VERDICT, commentId, shielded, summary });
    },
    async reply(comment, reply, allowRealReplies) {
      const response = await browser.tabs.sendMessage<ReplyResponse>(tabId, {
        type: MSG.REPLY, commentId: comment.id, reply, allowRealReplies,
      });
      if (!response.ok) throw new Error(response.error);
      return response.data;
    },
  };
}

function apiTransport(adapter: YouTubeApiAdapter): ReplyTransport {
  return {
    async applyVerdict() { /* API transport has no page DOM to reveal. */ },
    reply: (comment, text, allowed) => adapter.reply(comment, text, allowed),
  };
}

async function collectFromTab(settings: AppSettings): Promise<{ comments: Comment[]; transport: ReplyTransport }> {
  const tab = await activeYoutubeTab();
  if (!tab) throw new Error("Откройте YouTube или YouTube Studio в активной вкладке.");
  if (settings.transport === "api") {
    const url = new URL(tab.url);
    const adapter = new YouTubeApiAdapter({
      apiKey: settings.youtubeApiKey, accessToken: settings.youtubeAccessToken,
      videoId: url.searchParams.get("v") ?? undefined,
    });
    return { comments: await adapter.collect(), transport: apiTransport(adapter) };
  }
  const response = await browser.tabs.sendMessage<CollectResponse>(tab.id, { type: MSG.COLLECT });
  if (!response.ok) throw new Error(response.error);
  return { comments: response.data.comments, transport: domTransport(tab.id) };
}

async function withRetry<T>(task: () => Promise<T>, retries: number): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try { return await task(); } catch (error) {
      last = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw last;
}

async function processQueue(comments: Comment[], transport: ReplyTransport, requestedMode: RuntimeState["mode"]): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  pauseRequested = false;
  try {
    const settings = await storage.getSettings();
    const fresh = await new CommentCollector(storage).onlyNew(comments);
    const currentStats = await storage.getStats();
    await patchStats({ found: currentStats.found + fresh.length });
    await patchState({ mode: requestedMode, queueSize: fresh.length, youtubeConnected: true, lastScanAt: new Date().toISOString() });
    await addLog(`Найдено новых комментариев: ${fresh.length}`);
    const ai = createAiProvider(settings.ai);
    const processor = new CommentProcessor(ai, transport);

    for (let index = 0; index < fresh.length; index += 1) {
      if (pauseRequested) {
        await addLog("Обработка поставлена на паузу", "warn");
        break;
      }
      const comment = fresh[index]!;
      await patchState({ activeCommentId: comment.id, queueSize: fresh.length - index });
      try {
        const result = await withRetry(() => processor.process(comment, settings), settings.maxRetries);
        await storage.saveProcessed(result);
        const stats = await storage.getStats();
        await patchStats({
          processed: stats.processed + 1,
          replied: stats.replied + (result.replySent ? 1 : 0),
          shielded: stats.shielded + (result.shielded ? 1 : 0),
        });
        await addLog(`Комментарий ${comment.id} → ${result.shielded ? "SHIELDED" : result.kind.toUpperCase()}`);
        if (result.shielded) await addLog("Shield-summary сформирован");
        await addLog(result.replySent ? "Ответ отправлен" : "DRY RUN — ответ подготовлен, но не отправлен");
      } catch (error) {
        const message = safeError(error);
        const failed: ProcessedComment = {
          id: comment.id, threadId: comment.threadId, videoId: comment.videoId, videoTitle: comment.videoTitle,
          authorName: comment.authorName, publishedAt: comment.publishedAt, processedAt: new Date().toISOString(),
          status: "failed", kind: "criticism", shielded: false, replySent: false, source: comment.source, error: message,
        };
        await storage.saveProcessed(failed);
        const stats = await storage.getStats();
        await patchStats({ errors: stats.errors + 1 });
        await addLog(`Ошибка обработки ${comment.id}: ${message}`, "error");
      } finally {
        // Drop the only queue reference that contains original comment text.
        comment.text = "";
      }
      if (index < fresh.length - 1) await new Promise((resolve) => setTimeout(resolve, settings.actionDelayMs));
    }
  } finally {
    queueRunning = false;
    const state = await storage.getState();
    await patchState({ mode: state.mode === "auto" && !pauseRequested ? "auto" : pauseRequested ? "paused" : "stopped", queueSize: 0, activeCommentId: "" });
  }
}

async function scan(mode: RuntimeState["mode"] = "scanning"): Promise<void> {
  if (queueRunning) return;
  try {
    const settings = await storage.getSettings();
    const collected = await collectFromTab(settings);
    await processQueue(collected.comments, collected.transport, mode);
  } catch (error) {
    await patchState({ mode: "stopped", youtubeConnected: false, queueSize: 0, activeCommentId: "" });
    await addLog(safeError(error), "error");
    throw error;
  }
}

async function runMock(): Promise<void> {
  const transport: ReplyTransport = {
    async applyVerdict() {},
    async reply(_comment, _text, allowed) { return { sent: false, dryRun: !allowed }; },
  };
  await processQueue(mockComments(), transport, "scanning");
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_ALARM) return;
  void storage.getState().then((state) => state.mode === "auto" ? scan("auto") : undefined).catch(() => undefined);
});

browser.runtime.onMessage.addListener(async (raw: unknown) => {
  const message = raw as BackgroundMessage;
  try {
    if (message.type === MSG.GET_DASHBOARD) {
      const settings = await storage.getSettings();
      return { ok: true, data: await storage.dashboard(settings.ai.provider === "mock" || Boolean(settings.ai.apiKey)) };
    }
    if (message.type === MSG.SCAN_NOW) { void scan(); return { ok: true, data: undefined }; }
    if (message.type === MSG.RUN_MOCK) { void runMock(); return { ok: true, data: undefined }; }
    if (message.type === MSG.START_AUTO) {
      const settings = await storage.getSettings();
      pauseRequested = false;
      await patchState({ mode: "auto" });
      await browser.alarms.create(AUTO_ALARM, { periodInMinutes: settings.autoIntervalMinutes });
      void scan("auto");
      return { ok: true, data: undefined };
    }
    if (message.type === MSG.PAUSE) {
      pauseRequested = true;
      await browser.alarms.clear(AUTO_ALARM);
      await patchState({ mode: "paused" });
      return { ok: true, data: undefined };
    }
    if (message.type === MSG.SAVE_SETTINGS) {
      await storage.saveSettings(message.settings);
      return { ok: true, data: undefined };
    }
    if (message.type === MSG.TEST_AI) {
      const result = await createAiProvider(message.settings.ai).testConnection();
      return { ok: true, data: result };
    }
  } catch (error) {
    return { ok: false, error: safeError(error) };
  }
  return undefined;
});

void storage.getState().then(async (state) => {
  if (state.mode === "scanning") await patchState({ mode: "stopped", queueSize: 0, activeCommentId: "" });
  if (state.mode === "auto") {
    const settings = await storage.getSettings();
    await browser.alarms.create(AUTO_ALARM, { periodInMinutes: settings.autoIntervalMinutes });
  }
});
