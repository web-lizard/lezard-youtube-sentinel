import type { Comment } from "../core/models";

const samples = [
  ["positive", "Очень полезное видео, спасибо за ясное объяснение!"],
  ["criticism", "Не согласен с выводом во второй части, потому что пример не учитывает стоимость поддержки."],
  ["question", "Покажете в следующем видео, как настроить это в Firefox?"],
  ["trolling", "Да-да, конечно, очередной гений всё придумал."],
  ["insult", "Автор тупой бездарь, удали канал и не позорься."],
  ["provocation", "Только идиот использует ИИ, докажи, что ты не клоун."],
  ["spam", "Заработок без вложений, переходи https://example.invalid прямо сейчас!"],
] as const;

export function mockComments(): Comment[] {
  const stamp = Date.now();
  return samples.map(([kind, text], index) => ({
    id: `mock-${stamp}-${kind}`, threadId: `mock-thread-${index}`, videoId: "mock-video",
    videoTitle: "Lizard Sentinel demo", authorName: `Demo ${index + 1}`, authorChannelId: `mock-author-${index}`,
    publishedAt: new Date(stamp - index * 60_000).toISOString(), text, parentCommentId: null,
    isReply: false, status: "new", source: "mock",
  }));
}
