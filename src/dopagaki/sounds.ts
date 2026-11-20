import { loadDopaSound } from "./dopa";

let output: { context: AudioContext; volume: GainNode } | undefined;
let soundGeneration = 0;

export function unlockDopaAudio() {
  if (!loadDopaSound()) return;
  try {
    if (!output) {
      const Audio =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return;
      const context = new Audio();
      const volume = context.createGain();
      volume.gain.value = 0.55;
      volume.connect(context.destination);
      output = { context, volume };
    }
    output.volume.gain.value = 0.55;
    if (output.context.state !== "running")
      return output.context.resume().catch(() => undefined);
  } catch {
    // Audio is optional on browsers that cannot start an AudioContext.
  }
}

export function silenceDopaAudio() {
  soundGeneration++;
  if (output) {
    output.volume.gain.value = 0;
    output.volume.disconnect();
    void output.context.close().catch(() => undefined);
    output = undefined;
  }
}

type Note = readonly [
  frequency: number,
  offset: number,
  duration: number,
  waveform?: OscillatorType,
];

function play(notes: readonly Note[]) {
  if (!loadDopaSound()) return;
  const resumed = unlockDopaAudio();
  const channel = output;
  const generation = soundGeneration;
  if (!channel) return;
  const { context, volume } = channel;
  const schedule = () => {
    if (generation !== soundGeneration || context.state !== "running") return;
    const start = context.currentTime + 0.015;
    try {
      for (const [
        frequency,
        offset,
        duration,
        waveform = "triangle",
      ] of notes) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const time = start + offset;
        oscillator.type = waveform;
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0.0001, time);
        envelope.gain.exponentialRampToValueAtTime(
          waveform === "square" ? 0.045 : 0.13,
          time + 0.012,
        );
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        oscillator.connect(envelope).connect(volume);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
        };
        oscillator.start(time);
        oscillator.stop(time + duration);
      }
    } catch {
      // A backgrounded tab may suspend audio during scheduling.
    }
  };
  if (resumed) void resumed.then(schedule).catch(() => undefined);
  else schedule();
}

export function dopaDing() {
  play([
    [1318.51, 0, 0.16],
    [1760, 0.08, 0.24],
  ]);
}

export function dopaShutter() {
  play([
    [659.25, 0, 0.09],
    [440, 0.045, 0.12],
  ]);
}

export function dopaComboSound(combo: number) {
  const pitch = 392 * 2 ** (Math.min(combo, 30) / 12);
  play([
    [pitch, 0, 0.12, "square"],
    [pitch * 1.5, 0.06, 0.17],
  ]);
}

export function dopaFanfare() {
  play([
    [523.25, 0, 0.21],
    [659.25, 0.09, 0.21],
    [783.99, 0.18, 0.23],
    [1046.5, 0.29, 0.48],
    [659.25, 0.29, 0.4],
    [1318.51, 0.39, 0.55],
    [1567.98, 0.47, 0.52],
  ]);
}

export function dopaJackpotSound() {
  const climb: Note[] = [
    523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51,
  ].map((note, index) => [note, index * 0.052, 0.13, "square"]);
  play([
    [98, 0, 0.35, "sine"],
    ...climb,
    [130.81, 0.46, 0.58, "sine"],
    [783.99, 0.46, 0.55],
    [1046.5, 0.46, 0.66],
    [1318.51, 0.5, 0.66],
    [1567.98, 0.62, 0.55],
    [2093, 0.75, 0.5],
  ]);
}
