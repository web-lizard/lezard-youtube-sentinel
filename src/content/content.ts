import { MSG, type ContentMessage } from "../shared/messages";
import { YouTubeDomAdapter, installCommentVeil } from "./dom-youtube-adapter";
import { collectTranscript } from "./transcript-extractor";
import "./content.css";

const adapter = new YouTubeDomAdapter();
let observer: MutationObserver | null = null;
const cached = new Map<string, Awaited<ReturnType<YouTubeDomAdapter["collect"]>>[number]>();

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

void browser.runtime.sendMessage<{ ok: boolean; data?: { state?: { mode?: string } } }>({ type: MSG.GET_DASHBOARD })
  .then((response) => {
    if (response.ok && response.data?.state?.mode === "auto") {
      ensureVeil();
      return browser.runtime.sendMessage({ type: MSG.SCAN_NOW });
    }
    return undefined;
  })
  .catch(() => undefined);
