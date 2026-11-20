// Widths, heights and gaps are in the drawing scene's 600px coordinates.
// Each rule represents an observable cue and allows open or shaky strokes.
type Span = { width: number; height: number };

type FeatureCue =
  | ({ kind: "bend"; minTurn: number; eachRegion?: boolean } & Span)
  | ({ kind: "middle"; edge: "top" | "bottom"; depth: number } & Span)
  | {
      kind: "marks";
      count: number;
      axis: "x" | "y";
      separation: number;
      direction?: "up" | "across";
      size: number;
      eachRegion?: boolean;
    };

export const featureCues: Partial<Record<string, FeatureCue>> = {
  // Rounded shoulders with a dip in the upper edge.
  elephant: { kind: "middle", edge: "top", width: 115, height: 25, depth: 7 },
  // The split rises from the lower edge of the two-toed hoof.
  "giraffe-hoof": {
    kind: "middle",
    edge: "bottom",
    width: 36,
    height: 20,
    depth: 7,
  },
  "hippo-body": { kind: "bend", width: 102, height: 19, minTurn: 0.65 },
  "fennec-tail": { kind: "bend", width: 55, height: 21, minTurn: 0.78 },
  "giraffe-lashes": {
    kind: "marks",
    count: 2,
    axis: "x",
    separation: 8,
    direction: "up",
    size: 8,
  },
  "zebra-lashes": {
    kind: "marks",
    count: 2,
    axis: "x",
    separation: 8,
    direction: "up",
    size: 8,
  },
  "gibbon-face": { kind: "bend", width: 45, height: 36, minTurn: 1.85 },
  bear: { kind: "middle", edge: "top", width: 95, height: 14, depth: 8 },
  "hippo-tail": { kind: "bend", width: 19, height: 24, minTurn: 0.7 },
  "meerkat-claws": {
    kind: "marks",
    count: 2,
    axis: "x",
    separation: 6,
    direction: "up",
    size: 10,
    eachRegion: true,
  },
  tapir: { kind: "bend", width: 85, height: 18, minTurn: 2.5 },
  hyrax: { kind: "bend", width: 28, height: 70, minTurn: 0.8 },
  "giraffe-horns": {
    kind: "marks",
    count: 2,
    axis: "x",
    separation: 28,
    direction: "up",
    size: 19,
  },
  "hippo-skin": { kind: "marks", count: 2, axis: "x", separation: 26, size: 0 },
  "bush-dog": { kind: "bend", width: 35, height: 17, minTurn: 2.5 },
  "macaque-face": {
    kind: "bend",
    width: 14,
    height: 54,
    minTurn: 1.4,
    eachRegion: true,
  },
  "gorilla-back": { kind: "bend", width: 92, height: 60, minTurn: 1.5 },
  "lemur-tail": {
    kind: "marks",
    count: 3,
    axis: "y",
    separation: 17,
    direction: "across",
    size: 11,
  },
  deer: { kind: "marks", count: 3, axis: "x", separation: 21, size: 0 },
};
