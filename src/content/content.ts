import { MSG, type ContentMessage } from "../shared/messages";
import { YouTubeDomAdapter, installCommentVeil } from "./dom-youtube-adapter";
import { collectTranscript } from "./transcript-extractor";
import "./content.css";

const adapter = new YouTubeDomAdapter();
let observer: MutationObserver | null = null;
const cached = new Map<string, Awaited<ReturnType<YouTubeDomAdapter["collect"]>>[number]>();
const isYoutubePage = /(^|\.)youtube\.com$/i.test(location.hostname);

function ensureVeil(): void {
  observer ??= installCommentVeil();
}

browser.runtime.onMessage.addListener(async (raw: unknown) => {
  const message = raw as ContentMessage;
  if (message.type === MSG.PING) return { ok: true, data: { page: location.href } };
  if (message.type === MSG.COLLECT) {
    ensureVeil();
    const comments = await adapter.collect();
    comments.forEach((comment) => cached.set(comment.id, comment));
    return { ok: true, data: { comments, page: location.href } };
  }
  if (message.type === MSG.GET_TRANSCRIPT) {
    const transcript = await collectTranscript();
    return {
      ok: true,
      data: {
        title: transcript.title,
        videoId: transcript.videoId,
        url: transcript.url,
        segmentCount: transcript.segments.length,
        segments: transcript.segments,
        text: transcript.text,
      },
    };
  }
  if (message.type === MSG.APPLY_VERDICT) {
    adapter.applyVerdict(message.commentId, message.shielded, message.summary);
    return { ok: true, data: undefined };
  }
  if (message.type === MSG.REPLY) {
    const comment = cached.get(message.commentId);
    if (!comment) return { ok: false, error: "Комментарий не найден." };
    return { ok: true, data: await adapter.reply(comment, message.reply, message.allowRealReplies) };
  }
  return undefined;
});

if (!isYoutubePage && location.hostname === "cv038824.tw1.ru" && location.pathname.startsWith("/youtube-transcript/")) {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const request = event.data as { source?: string; type?: string; requestId?: string; videoUrl?: string };
    if (request.source !== "LIZARD_TRANSCRIPT_PAGE" || request.type !== "REQUEST_TRANSCRIPT" || !request.requestId || !request.videoUrl) return;
    void browser.runtime.sendMessage({ type: MSG.GET_TRANSCRIPT_FOR_URL, videoUrl: request.videoUrl })
      .then((response) => window.postMessage({
        source: "LIZARD_TRANSCRIPT_EXTENSION",
        type: "TRANSCRIPT_RESPONSE",
        requestId: request.requestId,
        response,
      }, location.origin))
      .catch((reason) => window.postMessage({
        source: "LIZARD_TRANSCRIPT_EXTENSION",
        type: "TRANSCRIPT_RESPONSE",
        requestId: request.requestId,
        response: { ok: false, error: reason instanceof Error ? reason.message : String(reason) },
      }, location.origin));
  });
}

if (isYoutubePage) void browser.runtime.sendMessage<{ ok: boolean; data?: { state?: { mode?: string } } }>({ type: MSG.GET_DASHBOARD })
  .then((response) => {
    if (response.ok && response.data?.state?.mode === "auto") {
      ensureVeil();
      return browser.runtime.sendMessage({ type: MSG.SCAN_NOW });
    }
    return undefined;
  })
  .catch(() => undefined);
