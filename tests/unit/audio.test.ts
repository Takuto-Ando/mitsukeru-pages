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
it("ドパガキ版の撮影音とお祝い音は設定をオンにしたときだけ鳴る", () => {
  const pitches: number[] = [];
  let enabled = false;
  class Audio {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
    createOscillator() {
      const frequency = { value: 0 };
      return {
        frequency,
        connect() {},
        start() {
          pitches.push(frequency.value);
        },
        stop() {},
      };
    }
  }
  vi.stubGlobal("window", { AudioContext: Audio });
  const audio = createFeedbackAudio(() => enabled, "dopa");
  audio.unlock();
  audio.shutter();
  audio.success();
  expect(pitches).toHaveLength(0);
  enabled = true;
  audio.unlock();
  audio.shutter();
  audio.success();
  expect(pitches).toEqual([659.25, 440, 587.33, 739.99, 880, 1174.66]);
  enabled = false;
  audio.shutter();
  audio.success();
  expect(pitches).toHaveLength(6);
});
