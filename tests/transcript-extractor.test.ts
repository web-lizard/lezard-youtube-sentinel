import { beforeEach, describe, expect, it } from "vitest";
import { readTranscriptSegments } from "../src/content/transcript-extractor";

describe("readTranscriptSegments", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("extracts the classic YouTube transcript DOM", () => {
    document.body.innerHTML = `
      <ytd-transcript-segment-renderer>
        <div class="segment-timestamp">1:10:16</div>
        <yt-formatted-string class="segment-text">Полгода норм. Я редко делал.</yt-formatted-string>
      </ytd-transcript-segment-renderer>
      <ytd-transcript-segment-renderer>
        <div class="segment-timestamp">1:10:28</div>
        <yt-formatted-string class="segment-text">Я даже об этом и не подумал.</yt-formatted-string>
      </ytd-transcript-segment-renderer>`;

    expect(readTranscriptSegments()).toEqual([
      { timestamp: "1:10:16", text: "Полгода норм. Я редко делал." },
      { timestamp: "1:10:28", text: "Я даже об этом и не подумал." },
    ]);
  });

  it("supports the newer transcript view model and removes duplicates", () => {
    document.body.innerHTML = `
      <yt-transcript-segment-view-model><span class="segment-timestamp">0:04</span><span class="segment-text">Первая строка</span></yt-transcript-segment-view-model>
      <yt-transcript-segment-view-model><span class="segment-timestamp">0:04</span><span class="segment-text">Первая строка</span></yt-transcript-segment-view-model>`;

    expect(readTranscriptSegments()).toEqual([{ timestamp: "0:04", text: "Первая строка" }]);
  });
});
