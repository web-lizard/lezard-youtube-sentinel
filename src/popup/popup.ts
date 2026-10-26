import type { DashboardData } from "../core/models";
import { MSG, type ApiResponse, type DashboardResponse, type TranscriptResponse } from "../shared/messages";
import "../ui/theme.css";
import "./popup.css";

const app = document.querySelector<HTMLElement>("#app")!;
let data: DashboardData | null = null;
let error = "";
let transcriptStatus = "";
let timer = 0;

function replaceMarkup(markup: string): void {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  app.replaceChildren(...parsed.body.childNodes);
}

function escapeHtml(value: string): string {
  const div = document.createElement("div"); div.textContent = value; return div.innerHTML;
}

function today(value: string): boolean {
  const date = new Date(value); const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function time(value: string): string {
  return new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

const modeLabel = (mode: DashboardData["state"]["mode"]): string => ({ stopped: "Остановлен", scanning: "Сканирование", auto: "Авто-режим", paused: "На паузе" })[mode];

function render(): void {
  if (!data) { replaceMarkup(`<div class="loading">Загрузка Sentinel…</div>`); return; }
  const shielded = data.recent.filter((item) => item.shielded && today(item.processedAt));
  const busy = data.state.mode === "scanning" || data.state.mode === "auto";
  replaceMarkup(`
    <section class="popup">
      <header class="brand"><img src="icons/lizard.svg" alt=""><div><h1>Lizard Sentinel</h1><p>Comment defense console</p></div><span class="dry">${data.settings.allowRealReplies ? "LIVE" : "DRY RUN"}</span></header>
      <div class="card connections">
        <div><span class="status-dot ${data.state.youtubeConnected ? "status-dot--ok" : ""}"></span><p><b>YouTube</b><small>${data.state.youtubeConnected ? "Connected" : "Откройте страницу комментариев"}</small></p></div>
        <div><span class="status-dot ${data.aiConnected ? "status-dot--ok" : ""}"></span><p><b>AI · ${escapeHtml(data.settings.ai.provider === "mock" ? "Mock" : data.settings.ai.model)}</b><small>${data.aiConnected ? "Connected" : "Not connected"}</small></p></div>
        <div><span class="status-dot ${busy ? "status-dot--busy" : ""}"></span><p><b>Статус</b><small>${modeLabel(data.state.mode)}${data.state.queueSize ? ` · в очереди ${data.state.queueSize}` : ""}</small></p></div>
      </div>
      <section class="card transcript">
        <div><b>Расшифровка видео</b><small>Берётся из вашей открытой сессии YouTube</small></div>
        <div class="transcript__actions">
          <button class="button button--primary" data-action="copy-transcript">Скопировать текст</button>
          <button class="button" data-action="save-transcript">Скачать .txt</button>
        </div>
        ${transcriptStatus ? `<p>${escapeHtml(transcriptStatus)}</p>` : ""}
      </section>
      <div class="actions">
        <button class="button button--primary" data-action="scan" ${busy ? "disabled" : ""}>Сканировать сейчас</button>
        <button class="button" data-action="auto" ${data.state.mode === "auto" ? "disabled" : ""}>Запустить автоответы</button>
        <button class="button button--danger" data-action="pause" ${!busy ? "disabled" : ""}>Пауза</button>
        <button class="button" data-action="options">Настройки</button>
      </div>
      <div class="metrics">
        ${[["Найдено",data.stats.found],["Обработано",data.stats.processed],["Отвечено",data.stats.replied],["Обезврежено",data.stats.shielded],["Ошибки",data.stats.errors]].map(([label,value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}
      </div>
      <section class="shield card">
        <div class="shield__head"><span class="shield__icon">◆</span><div><b>Обезврежено сегодня: ${shielded.length}</b><small>Оригиналы скрыты и не сохраняются</small></div></div>
        <details ${shielded.length ? "" : "disabled"}><summary>Показать суть претензий</summary><div class="summaries">${shielded.length ? shielded.map((item) => `<article><span>${escapeHtml(item.videoTitle || "YouTube")}</span><p>${escapeHtml(item.summary ?? "Безопасный пересказ недоступен")}</p></article>`).join("") : "<p class='empty'>Пока здесь тихо.</p>"}</div></details>
      </section>
      <details class="activity"><summary>Журнал событий</summary><div class="log">${data.logs.slice(0, 12).map((item) => `<p class="log--${item.level}"><time>${time(item.at)}</time>${escapeHtml(item.message)}</p>`).join("") || "<p class='empty'>Событий пока нет.</p>"}</div></details>
      <button class="demo" data-action="mock">Запустить demo на mock-данных</button>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
    </section>`);
}

async function load(): Promise<void> {
  const response = await browser.runtime.sendMessage<DashboardResponse>({ type: MSG.GET_DASHBOARD });
  if (response.ok) { data = response.data; error = ""; } else error = response.error;
  render();
}

async function command(type: string): Promise<void> {
  error = "";
  const response = await browser.runtime.sendMessage<ApiResponse>({ type });
  if (!response.ok) error = response.error;
  await new Promise((resolve) => setTimeout(resolve, 180));
  await load();
}

async function getTranscript(): Promise<Extract<TranscriptResponse, { ok: true }>["data"]> {
  const response = await browser.runtime.sendMessage<TranscriptResponse>({ type: MSG.GET_TRANSCRIPT });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function safeFilename(title: string): string {
  const cleaned = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${cleaned || "youtube-transcript"}.txt`;
}

async function transcriptCommand(download: boolean): Promise<void> {
  error = "";
  transcriptStatus = "Получаю расшифровку…";
  render();
  try {
    const transcript = await getTranscript();
    if (download) {
      const blob = new Blob([transcript.text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeFilename(transcript.title);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      transcriptStatus = `Скачано: ${transcript.segmentCount} фрагментов.`;
    } else {
      await copyText(transcript.text);
      transcriptStatus = `Скопировано: ${transcript.segmentCount} фрагментов.`;
    }
  } catch (reason) {
    transcriptStatus = "";
    error = reason instanceof Error ? reason.message : String(reason);
  }
  render();
}

app.addEventListener("click", (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "options") void browser.runtime.openOptionsPage();
  else if (action === "copy-transcript") void transcriptCommand(false);
  else if (action === "save-transcript") void transcriptCommand(true);
  else if (action === "scan") void command(MSG.SCAN_NOW);
  else if (action === "auto") void command(MSG.START_AUTO);
  else if (action === "pause") void command(MSG.PAUSE);
  else if (action === "mock") void command(MSG.RUN_MOCK);
});

void load();
timer = window.setInterval(() => void load(), 1200);
window.addEventListener("unload", () => clearInterval(timer));
