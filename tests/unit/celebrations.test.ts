import { test, expect } from "vitest";
import {
  celebrationFor,
  DEFAULT_CELEBRATION,
  type CelebrationKind,
} from "../../src/content/celebrations";
import { celebrationOrigin } from "../../src/components/FeatureCelebration";
import { tasks } from "../../src/content/tasks";

const KINDS: CelebrationKind[] = [
  "sway",
  "curl",
  "blink",
  "slide",
  "wiggle",
  "bounce",
  "bob",
  "pulse",
];

test("全課題にアニメーションの割り当てがある（キリンの舌は専用）", () => {
  for (const task of tasks) {
    if (task.id === "giraffe") continue;
    const c = celebrationFor(task.id);
    expect(KINDS).toContain(c.kind);
    expect(c.caption.length).toBeGreaterThan(0);
  }
});

test("代表的な割り当て：ヤギは slide、カバは bob、フクロテナガザル系は curl", () => {
  expect(celebrationFor("goat").kind).toBe("slide");
  expect(celebrationFor("hippo").kind).toBe("bob");
  expect(celebrationFor("capuchin").kind).toBe("curl");
  expect(celebrationFor("gibbon").kind).toBe("sway");
  expect(celebrationFor("unknown-task")).toEqual(DEFAULT_CELEBRATION);
});

test("回転中心：sway は領域の下端、それ以外は中心", () => {
  const scene = {
    frameHeight: 400,
    regions: [{ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }],
  } as never;
  // 中心: x=150+150=300, y=100+100=200 / 下端: y=100+200=300
  expect(celebrationOrigin(scene, "pulse")).toEqual({ x: 300, y: 200 });
  expect(celebrationOrigin(scene, "sway")).toEqual({ x: 300, y: 300 });
  expect(celebrationOrigin(scene, "bounce")).toEqual({ x: 300, y: 300 });
});
