# Исследование YouTube comments

Дата проверки: **2 октября 2026**.

## Метод и ограничения

Проверены публичная страница просмотра YouTube, редирект YouTube Studio и актуальная официальная документация YouTube Data API. Среда исследования не имела авторизованной Google-сессии: `studio.youtube.com` перенаправил на Google Sign-In. Автоматический web reader также не отдаёт hydrated DOM комментариев публичной watch page. Поэтому авторизованный Studio DOM нельзя честно считать подтверждённым; его selectors в первой версии являются изолированным best-effort adapter, а не контрактом.

Это ограничение важно: YouTube не публикует стабильный DOM API. Надёжной границей интеграции является публичный Data API.

## DOM-модель и динамика

YouTube — SPA на custom elements. В watch UI top-level thread обычно ограничен `ytd-comment-thread-renderer`; текст и автор находятся в семантически именованных descendants (`#content-text`, `#author-text`). YouTube Studio использует семейство `ytcp-*`, для комментариев встречаются boundaries `ytcp-comment-thread` / `ytcp-comment`. Классы оформления и глубина вложенности не должны считаться стабильными.

Практические выводы для adapter:

- искать comment boundary по custom-element tag, а не случайному CSS class;
- предпочитать `data-comment-id`, стабильный element ID или `lc` в permalink; если идентификатор не доступен — делать локальный детерминированный fallback hash;
- video ID брать из `?v=` на watch page; Studio route нужно обрабатывать отдельно;
- автора извлекать из channel link (`/channel/…` или `/@handle`), дату — из `time[datetime]`, когда она есть;
- lazy loading наблюдать через `MutationObserver`, а не polling/`while(true)`;
- Reply/editor/submit искать внутри конкретного thread по role, `aria-label` и тексту с несколькими локализациями;
- после submit нельзя считать клик доказательством успеха: production-версия должна дождаться появления reply или API response;
- при неизвестном DOM завершать действие ошибкой. Обход anti-bot защиты не предусмотрен.

Lizard Sentinel дополнительно ставит veil на текст вновь появившегося комментария до решения классификатора. Safe original затем раскрывается; shielded original заменяется безопасной меткой.

## Официальный YouTube Data API v3

Официальная модель лучше соответствует внутренней сущности приложения:

- `commentThreads.list` получает threads по `videoId`, `channelId` или `allThreadsRelatedToChannelId`;
- `part=snippet,replies` включает top-level comment и часть replies, но `commentThread` не гарантирует все ответы; полный список требует `comments.list`;
- ресурс содержит стабильные comment/thread/video IDs, `authorDisplayName`, `authorChannelId`, `publishedAt`, `textOriginal`, `canReply` и moderation data;
- `comments.insert` создаёт reply: обязательны `snippet.parentId` и `snippet.textOriginal`;
- запись требует OAuth 2.0 scope `https://www.googleapis.com/auth/youtube.force-ssl`;
- `comments.insert` стоит 50 quota units;
- moderation для владельца канала доступна через `comments.setModerationStatus`;
- `comments.markAsSpam` больше не поддерживается.

Официальные источники:

- [Comments implementation guide](https://developers.google.com/youtube/v3/guides/implementation/comments)
- [Comments: insert](https://developers.google.com/youtube/v3/docs/comments/insert)
- [YouTube Data API reference](https://developers.google.com/youtube/v3/docs)

Неизвестные private/internal endpoints YouTube намеренно не используются.

## Рекомендация

Рекомендуемый target — **hybrid с приоритетом официального API**:

1. На первом этапе DOM adapter даёт запускаемый продукт без блокировки на OAuth и служит наблюдателем текущей страницы.
2. Следующим этапом добавить OAuth 2.0 + PKCE и сделать Data API основным transport для collection/reply: IDs, pagination, ошибки и статус ответа там существенно надёжнее DOM.
3. DOM оставить для локального Shield UX, связи с открытой вкладкой и резервного режима.

До завершения OAuth текущая конфигурация по умолчанию — DOM + dry-run. API adapter уже отделён контрактом и не требует переписывания processor, queue, AI или UI.
