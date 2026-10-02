import type { Comment } from "../core/models";
import type { ReplyResult, YouTubeAdapter } from "../adapters/youtube-adapter";

const ROOT_SELECTOR = "ytd-comment-thread-renderer, ytcp-comment-thread, ytcp-comment";
const TEXT_SELECTORS = ["#content-text", "yt-formatted-string#content-text", "[data-content-text]", ".comment-text"];
const tracked = new Map<string, { root: Element; textNode: HTMLElement; original: string }>();

function textElement(root: Element): HTMLElement | null {
  for (const selector of TEXT_SELECTORS) {
    const element = root.querySelector<HTMLElement>(selector);
    if ((element?.innerText ?? element?.textContent ?? "").trim()) return element;
  }
  return null;
}

function videoId(): string {
  const url = new URL(location.href);
  return url.searchParams.get("v") ?? url.pathname.match(/\/video\/([^/]+)/)?.[1] ?? "";
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  return (hash >>> 0).toString(36);
}

function commentId(root: Element, text: string, author: string): string {
  const direct = root.getAttribute("data-comment-id") || root.id;
  if (direct && !["comment", "content"].includes(direct)) return direct;
  const linked = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => new URL(anchor.href, location.href).searchParams.get("lc"))
    .find(Boolean);
  return linked ?? `dom-${stableHash(`${videoId()}|${author}|${text}`)}`;
}

function authorInfo(root: Element): { name: string; channelId: string } {
  const link = root.querySelector<HTMLAnchorElement>("#author-text, a[href*='/channel/'], a[href*='/@']");
  const href = link?.getAttribute("href") ?? "";
  return { name: link?.textContent?.trim() ?? "Неизвестный автор", channelId: href.match(/\/channel\/([^/?]+)/)?.[1] ?? href };
}

function veil(id: string, node: HTMLElement): void {
  if (node.dataset.lsVeiled === "true") return;
  node.dataset.lsVeiled = "true";
  node.dataset.lsCommentId = id;
  node.classList.add("ls-comment-veiled");
}

function normalize(root: Element): Comment | null {
  const node = textElement(root);
  if (!node) return null;
  const text = (node.innerText ?? node.textContent ?? "").trim();
  if (!text) return null;
  const author = authorInfo(root);
  const id = commentId(root, text, author.name);
  tracked.set(id, { root, textNode: node, original: text });
  veil(id, node);
  const published = root.querySelector<HTMLTimeElement>("time[datetime]")?.dateTime ?? "";
  return {
    id, threadId: root.getAttribute("data-thread-id") ?? id, videoId: videoId(),
    videoTitle: document.querySelector("h1")?.textContent?.trim() ?? document.title.replace(/\s*-\s*YouTube$/, ""),
    authorName: author.name, authorChannelId: author.channelId, publishedAt: published,
    text, parentCommentId: null, isReply: false, status: "new", source: "youtube-dom",
  };
}

function semanticButton(root: Element, patterns: RegExp[], exclude?: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>("button, [role='button'], ytcp-button, yt-button-shape"))
    .find((element) => element !== exclude && patterns.some((pattern) => pattern.test(`${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`))) ?? null;
}

function setEditable(element: HTMLElement, value: string): void {
  element.focus();
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
    setter?.call(element, value);
  } else {
    element.textContent = value;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export class YouTubeDomAdapter implements YouTubeAdapter {
  readonly id = "youtube-dom" as const;

  async collect(): Promise<Comment[]> {
    const unique = new Map<string, Comment>();
    document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
      const comment = normalize(root);
      if (comment) unique.set(comment.id, comment);
    });
    return [...unique.values()];
  }

  applyVerdict(id: string, shielded: boolean, summary?: string): void {
    const item = tracked.get(id);
    if (!item) return;
    if (shielded) {
      item.textNode.textContent = "Обезврежено Lizard Sentinel";
      item.textNode.classList.remove("ls-comment-veiled");
      item.textNode.classList.add("ls-comment-shielded");
      item.original = "";
      if (summary) item.textNode.title = "Безопасная суть доступна в панели Lizard Sentinel";
    } else {
      item.textNode.classList.remove("ls-comment-veiled");
      item.textNode.removeAttribute("data-ls-veiled");
    }
  }

  async reply(comment: Comment, text: string, allowRealReplies: boolean): Promise<ReplyResult> {
    if (!allowRealReplies) return { sent: false, dryRun: true };
    const item = tracked.get(comment.id);
    if (!item) throw new Error("Комментарий больше не найден на странице.");
    const replyButton = semanticButton(item.root, [/^reply$/i, /^ответить$/i, /ответ/i]);
    if (!replyButton) throw new Error("Кнопка Reply не найдена. Возможно, DOM YouTube изменился.");
    replyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 450));
    const editor = item.root.querySelector<HTMLElement>("[contenteditable='true'], textarea");
    if (!editor) throw new Error("Поле ответа не найдено.");
    setEditable(editor, text);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const submit = semanticButton(item.root, [/^reply$/i, /^ответить$/i, /^send$/i, /^отправить$/i], replyButton);
    if (!submit || submit.getAttribute("aria-disabled") === "true") throw new Error("Кнопка отправки ответа не готова.");
    submit.click();
    return { sent: true, dryRun: false };
  }
}

export function installCommentVeil(): MutationObserver {
  const scan = (): void => document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
    const node = textElement(root);
    if (!node || node.dataset.lsVeiled === "true" || node.classList.contains("ls-comment-shielded")) return;
    const text = (node.innerText ?? node.textContent ?? "").trim();
    if (!text) return;
    const author = authorInfo(root);
    const id = commentId(root, text, author.name);
    tracked.set(id, { root, textNode: node, original: text });
    veil(id, node);
  });
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}
