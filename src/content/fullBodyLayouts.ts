// One 600×600 frame for drawing, answer and explanation. Only the giraffe tongue
// task uses an owner's design-reference head close-up; other tasks stay full-body.
export interface FullBodyLayout {
  x: number;
  y: number;
  scale: number;
  windows?: number[][];
  answerPath?: string;
}
export const fullBodyLayouts: Record<string, FullBodyLayout> = {
  mandrill: { x: 0, y: 0, scale: 1 },
  lemur: { x: 0, y: 0, scale: 1 },
  goat: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[160, 185, 120, 70]],
    answerPath: "M170 207Q220 198 270 207L270 231Q220 240 170 231Z",
  },
  sheep: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[160, 185, 120, 70]],
    answerPath: "M170 207Q220 198 270 207L270 231Q220 240 170 231Z",
  },
  gibbon: { x: 0, y: 75, scale: 1 },
  elephant: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[170, 45, 260, 130]],
    answerPath:
      "M198 163Q207 45 261 76Q288 85 301 124Q319 83 347 76Q409 45 402 163",
  },
  capuchin: { x: -10, y: 60, scale: 1.1 },
  macaque: { x: 0, y: 100, scale: 1 },
  badger: { x: -50, y: 120, scale: 0.85 },
  zebra: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[158, 500, 100, 72]],
    answerPath: "M178 510Q164 534 170 563L245 563Q242 534 223 510Z",
  },
  giraffe: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[315, 255, 245, 125]],
    answerPath:
      "M322 310C365 297 396 307 424 305C461 306 489 281 527 279C543 277 556 287 553 304C550 319 527 323 505 325C473 329 446 348 412 347C375 346 353 329 323 321Z",
  },
  "giraffe-hoof": {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[245, 510, 80, 65]],
    answerPath: "M255 518L250 565L280 565L286 540L292 565L320 565L311 518Z",
  },
  hippo: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [
      [99, 325, 40, 35],
      [154, 325, 40, 35],
    ],
    answerPath:
      "M109 342a9 7 0 1 0 18 0a9 7 0 1 0 -18 0M164 342a9 7 0 1 0 18 0a9 7 0 1 0 -18 0",
  },
  "hippo-body": {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[220, 215, 280, 105]],
    answerPath: "M225 305Q260 215 375 232Q465 230 495 307",
  },
  fennec: {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[155, 460, 90, 80]],
    answerPath:
      "M174 471Q156 501 165 532L235 532Q242 500 222 471M188 517V532M214 517V532",
  },
  "fennec-tail": {
    x: 0,
    y: 0,
    scale: 1,
    windows: [[350, 350, 210, 160]],
    answerPath: "M352 364Q459 401 547 469Q479 532 409 483Q366 452 338 416",
  },
  gorilla: { x: 45, y: 0, scale: 0.85, windows: [[155, 35, 290, 125]] },
  donkey: { x: 0, y: 100, scale: 1 },
  deer: { x: 0, y: 100, scale: 1 },
  meerkat: { x: 60, y: 10, scale: 0.8 },
};
