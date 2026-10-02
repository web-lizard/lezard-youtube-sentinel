# Lizard Sentinel

Firefox WebExtension для сбора, AI-анализа и безопасной обработки комментариев YouTube. Первая версия запускается в **DRY RUN**: она собирает комментарии, классифицирует их, готовит ответы и ведёт историю, но не нажимает Send.

## Возможности

- popup/dashboard со статусом YouTube, AI, очереди и статистикой;
- `YouTubeDomAdapter` для YouTube и YouTube Studio;
- заготовленный `YouTubeApiAdapter` для официального YouTube Data API;
- `MockAiProvider` и OpenAI-compatible provider (включая DeepSeek);
- последовательная очередь, retry, задержка между действиями и немедленная пауза;
- защита от повторной обработки по comment ID;
- Shield Mode: исходный вредоносный текст не попадает в историю и логи, UI показывает только безопасный AI-summary;
- mock dataset для демонстрации без YouTube и API-ключа.

## Установка и сборка

Требуются Node.js 20+, npm 10+ и Firefox 140+ (встроенное согласие на передачу данных AI-провайдеру).

```bash
npm install
npm run build
```

Распакованное расширение появится в `dist/`. ZIP-пакет:

```bash
npm run package
```

## Разработка

```bash
npm run dev
```

Команда следит за TypeScript entry points и пересобирает `dist/`. После изменений нажмите **Reload** у расширения в Firefox.

Проверки:

```bash
npm run check
```

## Загрузка в Firefox

1. Выполните `npm run build`.
2. Откройте `about:debugging#/runtime/this-firefox`.
3. Нажмите **Load Temporary Add-on…**.
4. Выберите `dist/manifest.json`.
5. Откройте видео YouTube с загруженными комментариями или раздел комментариев YouTube Studio.
6. Откройте popup расширения и нажмите **Сканировать сейчас**.

Для автономной демонстрации нажмите **Запустить demo на mock-данных** в popup. Токсичный mock-комментарий проходит цепочку Shield → безопасный пересказ → подготовленный ответ, при этом оригинал не сохраняется.

## Настройка AI

В настройках выберите:

- `Mock` — полностью локальный детерминированный режим;
- `OpenAI-compatible / DeepSeek` — base URL, модель, API key и temperature.

Промпты находятся в `src/prompts/` и намеренно являются временными. Их можно полностью заменить без изменений provider, очереди или UI. API key не включён в репозиторий и не выводится в лог.

## Реальные ответы

`Allow real replies` по умолчанию выключен. Пока он выключен, DOM-кнопка Send и API `comments.insert` не вызываются. Перед включением:

1. проверьте mock workflow;
2. проверьте dry-run на реальной странице;
3. просмотрите подготовленные ответы;
4. только затем включите опцию с отдельным подтверждением.

DOM YouTube меняется без контракта. При ошибке селектора расширение останавливает конкретное действие и пишет безопасную ошибку, а не пытается обходить защиту сайта.

## Структура

```text
src/
  adapters/     YouTubeAdapter и API-реализация
  ai/           AiProvider, mock и OpenAI-compatible клиент
  background/   координация, очередь, alarms, message passing
  content/      сбор DOM, veil, безопасный Reply workflow
  core/         модели, Collector, Processor, ReplyEngine и ShieldEngine
  mock/         тестовый набор комментариев
  options/      настройки
  popup/        dashboard
  prompts/      заменяемые TEMP/MOCK prompts
  storage/      browser.storage и дедупликация
docs/           архитектура и исследование YouTube
tests/          unit/DOM tests
```

Подробнее: [архитектура](docs/architecture.md) и [исследование YouTube](docs/youtube-research.md).
