export interface FeedbackAudio {
  unlock(): void;
  success(): void;
  silence(): void;
  dispose(): void;
}
export function createFeedbackAudio(isEnabled: () => boolean): FeedbackAudio {
  let context: AudioContext | undefined;
  const active = new Set<OscillatorNode>();
  function unlock() {
    if (!isEnabled()) return;
    try {
      const Audio =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      if (context.state === "suspended")
        void context.resume().catch(() => undefined);
    } catch {
      return;
    }
  }
  const feedback: FeedbackAudio = {
    unlock,
    success() {
      if (!isEnabled() || !context) return;
      if (context.state === "suspended") {
        void context
          .resume()
          .then(() => {
            if (isEnabled()) feedback.success();
          })
          .catch(() => undefined);
        return;
      }
      if (context.state !== "running") return;
      try {
        const start = context.currentTime;
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          const oscillator = context!.createOscillator(),
            gain = context!.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = frequency;
          const time = start + index * 0.105;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.1, time + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
          oscillator.connect(gain);
          gain.connect(context!.destination);
          active.add(oscillator);
          oscillator.onended = () => {
            active.delete(oscillator);
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(time);
          oscillator.stop(time + 0.4);
        });
      } catch {
        return;
      }
    },
    silence() {
      for (const oscillator of active) {
        try {
          oscillator.stop();
          oscillator.disconnect();
        } catch {
          continue;
        }
      }
      active.clear();
    },
    dispose() {
      if (context && context.state !== "closed")
        void context.close().catch(() => undefined);
    },
  };
  return feedback;
}
