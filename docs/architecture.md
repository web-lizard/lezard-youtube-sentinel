# Архитектура Lizard Sentinel

## Принципы

1. DOM YouTube, AI и UI не зависят друг от друга напрямую.
2. Background управляет состоянием, очередью и побочными эффектами.
3. Реальная отправка требует явного `allowRealReplies=true`; значение по умолчанию — `false`.
4. Исходный текст shielded-комментария существует только в краткоживущем объекте очереди. В `browser.storage`, event log, popup, toast и error он не записывается.
5. Все обработанные ID хранятся отдельно, поэтому повторное сканирование не создаёт второй ответ.

## Слои

### YouTubeAdapter

Контракт `collect()` + `reply()` реализован двумя транспортами:

- `YouTubeDomAdapter` работает в content script. Он читает semantic/custom elements, закрывает текст veil-слоем до решения классификатора и выполняет Reply workflow.
- `YouTubeApiAdapter` использует публичный YouTube Data API v3. Чтение поддержано по API key/OAuth, отправка — только по OAuth access token. Полный OAuth lifecycle оставлен следующему этапу.

Background выбирает транспорт по настройке и работает с общей моделью `Comment`.

### CommentCollector

DOM adapter нормализует комментарий в поля `id`, `threadId`, `videoId`, `videoTitle`, `authorName`, `authorChannelId`, `publishedAt`, `text`, `parentCommentId`, `isReply`, `status`, `source`. Отдельный `CommentCollector` удаляет дубликаты текущего сканирования и отбрасывает ID из истории. Динамически добавленные custom elements обнаруживает `MutationObserver`; бесконечного цикла в content script нет.

### CommentProcessor

Processor не знает о DOM и storage. Он вызывает `AiProvider`, применяет verdict через transport, готовит ответ и возвращает `ProcessedComment` без поля исходного текста.

Состояния доменной модели: `new → processing → safe | shielded → replied`, а также `ignored` и `failed`.

### AiProvider

Интерфейс:

```ts
classifyComment(comment, context)
generateReply(comment, context)
summarizeHiddenComment(comment, context)
testConnection()
```

Реализации: локальный keyword-based mock и OpenAI-compatible HTTP client. Конкретные prompts находятся в `src/prompts/`. Перед включением внешнего AI Firefox отдельно запрашивает optional permission `personalCommunications`; mock ничего наружу не передаёт.

### ReplyEngine

Reply transport сначала проверяет safety gate. В dry-run возвращает `{ sent: false, dryRun: true }`, не открывая editor и не вызывая API. DOM-режим ищет Reply/editor/submit по semantic roles, aria labels и границам comment custom element. API-режим вызывает официальный `comments.insert`.

### ShieldEngine

До классификации comment text закрыт CSS veil. Для safe-комментария veil снимается. Для shielded-комментария:

1. AI получает исходный текст в памяти;
2. параллельно готовятся нейтральный ответ и sanitized summary;
3. DOM original заменяется на `Обезврежено Lizard Sentinel`;
4. ссылка на original в tracked DOM record очищается;
5. в storage попадают metadata, summary, reply и status — без original;
6. popup показывает только summary.

### Storage

`browser.storage.local` содержит настройки, runtime state, агрегированную статистику, до 500 результатов, до 5000 обработанных ID и до 200 безопасных событий. API key можно оставить только в памяти, сняв `Хранить ключ локально`.

### UI

Popup отображает соединения, режим, действия, статистику, Shield-блок и event log. Options управляет AI, транспортом, интервалом, retry и safety gate. UI общается только с background через typed messages.

## Pipeline

```text
DOM/API collect
  → normalize + deduplicate
  → sequential queue
  → classify
  → generate reply (+ safe summary for Shield)
  → apply DOM verdict
  → dry-run or reply
  → persist sanitized result + processed ID
```

Между элементами очереди есть настраиваемая задержка. Ошибки повторяются ограниченное число раз; после лимита создаётся `failed` record без исходного текста. Пауза останавливает выдачу следующего элемента и очищает alarm.

## Границы первого этапа

- OAuth authorization code + PKCE для YouTube ещё не реализован; access token можно временно указать вручную для интеграционной разработки.
- API channel-wide collection требует channel ID; текущий UI API-режима ориентирован на открытое видео.
- DOM selectors являются best-effort fallback и требуют fixture/ручной проверки после изменений YouTube.
- Финальные classifier/reply/summarizer prompts должны быть предоставлены отдельно.
- Автоматический ответ должен использоваться с учётом правил YouTube, квот и человеческого контроля.
