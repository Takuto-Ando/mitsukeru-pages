import { afterEach, expect, it, vi } from "vitest";
import { createFeedbackAudio } from "../../src/audio";
afterEach(() => vi.unstubAllGlobals());
it("消音時はAudioContextを作らず音を鳴らさない", () => {
  const constructor = vi.fn();
  vi.stubGlobal("window", { AudioContext: constructor });
  const audio = createFeedbackAudio(() => false);
  audio.unlock();
  audio.success();
  audio.silence();
  audio.dispose();
  expect(constructor).not.toHaveBeenCalled();
});
it("Web Audio非対応でも観察を妨げない", () => {
  vi.stubGlobal("window", {});
  const audio = createFeedbackAudio(() => true);
  expect(() => {
    audio.unlock();
    audio.success();
    audio.silence();
    audio.dispose();
  }).not.toThrow();
});
it("再生許可がなくても例外を外へ漏らさない", () => {
  vi.stubGlobal("window", {
    AudioContext: class {
      constructor() {
        throw new Error("not available");
      }
    },
  });
  const audio = createFeedbackAudio(() => true);
  expect(() => {
    audio.unlock();
    audio.success();
  }).not.toThrow();
});
