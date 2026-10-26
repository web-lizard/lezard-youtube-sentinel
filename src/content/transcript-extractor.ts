export type TranscriptSegment = {
  timestamp: string;
  text: string;
};

export type TranscriptData = {
  title: string;
  videoId: string;
  url: string;
  segments: TranscriptSegment[];
  text: string;
};

const SEGMENT_SELECTORS = [
  "ytd-transcript-segment-renderer",
  "yt-transcript-segment-view-model",
  "ytd-transcript-segment-list-renderer [role='button']",
];

const TIMESTAMP_SELECTORS = [
  ".segment-timestamp",
  "[class*='segment-timestamp']",
  "[class*='timestamp']",
];

const TEXT_SELECTORS = [
  ".segment-text",
  "yt-formatted-string.segment-text",
  "[class*='segment-text']",
  "[class*='cue']",
];

const TRANSCRIPT_BUTTON_PATTERN = /(?:show|open|view)\s+(?:the\s+)?transcript|(?:показать|открыть)\s+расшифровку|расшифровка видео/i;
const TIMESTAMP_PATTERN = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;

function normalized(value: string | null | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
}

function firstText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const value = normalized(root.querySelector<HTMLElement>(selector)?.innerText ?? root.querySelector(selector)?.textContent);
    if (value) return value;
  }
  return "";
}

function parseSegment(root: Element): TranscriptSegment | null {
  let timestamp = firstText(root, TIMESTAMP_SELECTORS);
  let text = firstText(root, TEXT_SELECTORS);

  if (!timestamp || !text) {
    const lines = (root as HTMLElement).innerText?.split(/\r?\n/).map(normalized).filter(Boolean) ?? [];
    const timestampIndex = lines.findIndex((line) => TIMESTAMP_PATTERN.test(line));
    if (!timestamp && timestampIndex >= 0) timestamp = lines[timestampIndex] ?? "";
    if (!text && timestampIndex >= 0) text = lines.filter((_, index) => index !== timestampIndex).join(" ");
  }

  timestamp = normalized(timestamp).replace(/^\[|\]$/g, "");
  text = normalized(text);
  if (!TIMESTAMP_PATTERN.test(timestamp) || !text || text === timestamp) return null;
  return { timestamp, text };
}

export function readTranscriptSegments(root: ParentNode = document): TranscriptSegment[] {
  const nodes = new Set<Element>();
  for (const selector of SEGMENT_SELECTORS) root.querySelectorAll(selector).forEach((node) => nodes.add(node));

  const segments: TranscriptSegment[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const segment = parseSegment(node);
    if (!segment) continue;
    const key = `${segment.timestamp}\u0000${segment.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push(segment);
  }
  return segments;
}

function findTranscriptButton(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], ytd-button-renderer, yt-button-shape"))
    .find((element) => TRANSCRIPT_BUTTON_PATTERN.test(`${element.getAttribute("aria-label") ?? ""} ${element.innerText ?? element.textContent ?? ""}`)) ?? null;
}

function currentVideoId(): string {
  return new URL(location.href).searchParams.get("v") ?? "";
}

function currentTitle(): string {
  const title = document.querySelector<HTMLElement>("ytd-watch-metadata h1 yt-formatted-string, h1.ytd-watch-metadata, h1")?.innerText;
  return normalized(title) || document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim() || currentVideoId();
}

function formatTranscript(title: string, url: string, segments: TranscriptSegment[]): string {
  return [`${title}`, url, "", ...segments.map((segment) => `[${segment.timestamp}] ${segment.text}`)].join("\n");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectTranscript(): Promise<TranscriptData> {
  if (!/\/watch(?:\?|$)/.test(location.pathname + location.search)) {
    throw new Error("Откройте страницу нужного видео YouTube.");
  }

  let segments = readTranscriptSegments();
  if (!segments.length) {
    const button = findTranscriptButton();
    if (button) {
      button.click();
      for (let attempt = 0; attempt < 30 && !segments.length; attempt += 1) {
        await delay(200);
        segments = readTranscriptSegments();
      }
    }
  }

  if (!segments.length) {
    throw new Error("Расшифровка не загружена. Откройте панель «Расшифровка видео» на YouTube и повторите.");
  }

  const title = currentTitle();
  const url = `https://www.youtube.com/watch?v=${currentVideoId()}`;
  return { title, videoId: currentVideoId(), url, segments, text: formatTranscript(title, url, segments) };
}
