// One full-animal frame for drawing, answer and explanation. No enlarged insets.
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
    windows: [[320, 165, 105, 95]],
    answerPath:
      "M330 178Q405 172 410 216Q415 244 379 246L372 225Q397 227 390 208Q380 193 330 198Z",
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
