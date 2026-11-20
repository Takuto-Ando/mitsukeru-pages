export interface FeedbackAudio {
  unlock(): void;
  success(): void;
  shutter(): void;
  silence(): void;
  dispose(): void;
}

type Cue = {
  notes: readonly number[];
  spacing: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
};

const standardSuccess: Cue = {
  notes: [523.25, 659.25, 783.99],
  spacing: 0.105,
  duration: 0.4,
  volume: 0.1,
  wave: "sine",
};
const dopaSuccess: Cue = {
  notes: [587.33, 739.99, 880, 1174.66],
  spacing: 0.075,
  duration: 0.29,
  volume: 0.066,
  wave: "triangle",
};
const shutterCue: Cue = {
  notes: [659.25, 440],
  spacing: 0.054,
  duration: 0.09,
  volume: 0.054,
  wave: "triangle",
};

export function createFeedbackAudio(
  isEnabled: () => boolean,
  style: "standard" | "dopa" = "standard",
): FeedbackAudio {
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

  function play(cue: Cue) {
    const output = context;
    if (!isEnabled() || !output) return;
    function playNotes() {
      if (
        !output ||
        output !== context ||
        !isEnabled() ||
        output.state !== "running"
      )
        return;
      try {
        const start = output.currentTime;
        cue.notes.forEach((frequency, index) => {
          const oscillator = output.createOscillator();
          const gain = output.createGain();
          oscillator.type = cue.wave;
          oscillator.frequency.value = frequency;
          const time = start + index * cue.spacing;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(cue.volume, time + 0.018);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            time + cue.duration - 0.02,
          );
          oscillator.connect(gain);
          gain.connect(output.destination);
          active.add(oscillator);
          oscillator.onended = () => {
            active.delete(oscillator);
            oscillator.disconnect();
            gain.disconnect();
          };
          oscillator.start(time);
          oscillator.stop(time + cue.duration);
        });
      } catch {
        return;
      }
    }
    if (output.state === "suspended") {
      void output
        .resume()
        .then(playNotes)
        .catch(() => undefined);
    } else {
      playNotes();
    }
  }

  const feedback: FeedbackAudio = {
    unlock,
    success() {
      play(style === "dopa" ? dopaSuccess : standardSuccess);
    },
    shutter() {
      if (style === "dopa") play(shutterCue);
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
      const output = context;
      context = undefined;
      feedback.silence();
      if (output && output.state !== "closed")
        void output.close().catch(() => undefined);
    },
  };
  return feedback;
}
