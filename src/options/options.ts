import { DEFAULT_SETTINGS, type AppSettings } from "../core/models";
import { MSG, type ApiResponse, type DashboardResponse } from "../shared/messages";
import "../ui/theme.css";
import "./options.css";

const app = document.querySelector<HTMLElement>("#app")!;
let settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
let status = "";
let error = "";

function replaceMarkup(markup: string): void {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  app.replaceChildren(...parsed.body.childNodes);
}

function esc(value: string): string { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function checked(value: boolean): string { return value ? "checked" : ""; }

function render(): void {
  replaceMarkup(`<div class="shell">
    <header><div class="brand"><img src="icons/lizard.svg" alt=""><div><span>CONTROL CENTER</span><h1>Lizard Sentinel</h1><p>Настройка AI, транспорта и безопасной автоматизации.</p></div></div><div class="safety ${settings.allowRealReplies ? "safety--live" : ""}"><b>${settings.allowRealReplies ? "LIVE REPLIES" : "DRY RUN"}</b><small>${settings.allowRealReplies ? "Ответы могут быть опубликованы" : "YouTube не изменяется"}</small></div></header>
    <section class="card section"><div class="section__title"><div><span>01 · INTELLIGENCE</span><h2>AI Provider</h2></div><p>Промпты вынесены в <code>src/prompts</code> и заменяются независимо.</p></div>
      <div class="grid grid--3"><label class="field"><span>Provider</span><select id="provider"><option value="mock" ${settings.ai.provider === "mock" ? "selected" : ""}>Mock (локальный)</option><option value="openai-compatible" ${settings.ai.provider === "openai-compatible" ? "selected" : ""}>OpenAI-compatible / DeepSeek</option></select></label><label class="field field--wide"><span>Base URL</span><input id="baseUrl" value="${esc(settings.ai.baseUrl)}"></label><label class="field"><span>Model</span><input id="model" value="${esc(settings.ai.model)}"></label></div>
      <div class="grid grid--3"><label class="field field--wide"><span>API key</span><input id="apiKey" type="password" autocomplete="off" value="${esc(settings.ai.apiKey)}" placeholder="sk-…"></label><label class="field"><span>Temperature</span><input id="temperature" type="number" min="0" max="2" step="0.1" value="${settings.ai.temperature}"></label><label class="check remember"><input id="rememberKey" type="checkbox" ${checked(settings.ai.rememberKey)}>Хранить ключ локально</label></div>
      <div class="inline"><button class="button" id="test">Проверить соединение</button><span class="hint">Ключ никогда не попадает в логи.</span></div>
    </section>
    <section class="card section"><div class="section__title"><div><span>02 · TRANSPORT</span><h2>YouTube</h2></div><p>DOM работает сразу; API подготовлен для OAuth.</p></div>
      <div class="grid"><label class="field"><span>Transport</span><select id="transport"><option value="dom" ${settings.transport === "dom" ? "selected" : ""}>DOM adapter</option><option value="api" ${settings.transport === "api" ? "selected" : ""}>YouTube Data API</option></select></label><label class="field"><span>YouTube API key (чтение)</span><input id="youtubeApiKey" type="password" value="${esc(settings.youtubeApiKey)}"></label><label class="field"><span>OAuth access token (временный)</span><input id="youtubeAccessToken" type="password" value="${esc(settings.youtubeAccessToken)}"></label><div class="note">Рекомендуется hybrid: API после завершения OAuth, DOM как наблюдатель и резервный транспорт.</div></div>
    </section>
    <section class="card section"><div class="section__title"><div><span>03 · AUTOMATION</span><h2>Очередь и безопасность</h2></div><p>Пауза проверяется между каждым действием.</p></div>
      <div class="grid grid--3"><label class="field"><span>Интервал, мин</span><input id="interval" type="number" min="1" value="${settings.autoIntervalMinutes}"></label><label class="field"><span>Retry</span><input id="retries" type="number" min="0" max="5" value="${settings.maxRetries}"></label><label class="field"><span>Задержка действий, мс</span><input id="delay" type="number" min="250" value="${settings.actionDelayMs}"></label></div>
      <div class="danger-zone"><label class="check"><input id="allowRealReplies" type="checkbox" ${checked(settings.allowRealReplies)}><span><b>Allow real replies</b><small>Включайте только после проверки dry-run истории. Расширение нажмёт Send.</small></span></label></div>
    </section>
    <footer><div>${status ? `<span class="success">${esc(status)}</span>` : error ? `<span class="failure">${esc(error)}</span>` : `<span class="hint">Настройки сохраняются только по кнопке.</span>`}</div><button class="button button--primary" id="save">Сохранить настройки</button></footer>
  </div>`);
  bind();
}

function collect(): AppSettings {
  const value = (id: string) => (document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "").trim();
  return {
    ai: { provider: value("provider") as AppSettings["ai"]["provider"], baseUrl: value("baseUrl"), model: value("model"), apiKey: value("apiKey"), rememberKey: document.querySelector<HTMLInputElement>("#rememberKey")!.checked, temperature: Number(value("temperature")) },
    allowRealReplies: document.querySelector<HTMLInputElement>("#allowRealReplies")!.checked,
    autoIntervalMinutes: Number(value("interval")), maxRetries: Number(value("retries")), actionDelayMs: Number(value("delay")),
    transport: value("transport") as AppSettings["transport"], youtubeApiKey: value("youtubeApiKey"), youtubeAccessToken: value("youtubeAccessToken"),
  };
}

async function ensureHostPermission(next: AppSettings): Promise<boolean> {
  if (next.ai.provider === "mock") return true;
  const dataAllowed = await browser.permissions.request({ data_collection: ["personalCommunications"] });
  if (!dataAllowed) return false;
  const origin = new URL(next.ai.baseUrl).origin + "/*";
  if (origin === "https://api.deepseek.com/*") return true;
  return browser.permissions.request({ origins: [origin] });
}

async function save(): Promise<void> {
  try {
    const next = collect();
    if (!await ensureHostPermission(next)) throw new Error("Доступ к указанному AI host не разрешён.");
    const response = await browser.runtime.sendMessage<ApiResponse>({ type: MSG.SAVE_SETTINGS, settings: next });
    if (!response.ok) throw new Error(response.error);
    settings = next; status = "Настройки сохранены"; error = ""; render();
  } catch (caught) { status = ""; error = caught instanceof Error ? caught.message : "Ошибка сохранения"; render(); }
}

async function test(): Promise<void> {
  try {
    const next = collect();
    if (!await ensureHostPermission(next)) throw new Error("Доступ к AI host не разрешён.");
    const response = await browser.runtime.sendMessage<ApiResponse<{ model: string }>>({ type: MSG.TEST_AI, settings: next });
    if (!response.ok) throw new Error(response.error);
    status = `Соединение работает: ${response.data.model}`; error = "";
  } catch (caught) { status = ""; error = caught instanceof Error ? caught.message : "Ошибка проверки"; }
  render();
}

function bind(): void {
  document.querySelector("#save")?.addEventListener("click", () => void save());
  document.querySelector("#test")?.addEventListener("click", () => void test());
  document.querySelector("#allowRealReplies")?.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.checked && !confirm("Разрешить реальную публикацию ответов в YouTube? Сначала рекомендуется проверить dry-run.")) input.checked = false;
  });
}

async function load(): Promise<void> {
  const response = await browser.runtime.sendMessage<DashboardResponse>({ type: MSG.GET_DASHBOARD });
  if (response.ok) settings = response.data.settings; else error = response.error;
  render();
}
void load();
