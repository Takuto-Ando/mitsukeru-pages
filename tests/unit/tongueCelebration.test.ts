import { test, expect } from "vitest";
import { tonguePartyLayout } from "../../src/components/TongueCelebration";
import { taskById } from "../../src/content/tasks";

test("キリンの舌のお祝い: 木は右上に立ち、口元から届く葉だけを食べる", () => {
  const { mouth, treeBase, bites, durationMs } = tonguePartyLayout;
  expect(durationMs).toBe(5000);
  // Top-right sky of the 600x600 frame.
  expect(treeBase.x).toBeGreaterThan(450);
  expect(treeBase.y).toBeLessThan(300);
  // The mouth anchor sits on the left edge of the giraffe tongue window.
  const giraffe = taskById.giraffe;
  const window = giraffe.scene.regions[0];
  const left = window.x * 600,
    top = window.y * 600,
    right = left + window.width * 600,
    bottom = top + window.height * 600;
  expect(mouth.x).toBeGreaterThanOrEqual(left - 10);
  expect(mouth.x).toBeLessThanOrEqual(left + 20);
  expect(mouth.y).toBeGreaterThanOrEqual(top);
  expect(mouth.y).toBeLessThanOrEqual(bottom);
  // Three bites, in time order, leaves hanging right of the window
  // (within a cartoon stretch of the drawn tongue) and below the canopy.
  expect(bites).toHaveLength(3);
  for (let i = 1; i < bites.length; i++)
    expect(bites[i].at).toBeGreaterThan(bites[i - 1].at);
  for (const bite of bites) {
    expect(bite.at).toBeGreaterThan(0.15);
    expect(bite.at).toBeLessThan(0.6);
    expect(bite.leaf.x).toBeGreaterThan(right);
    expect(bite.leaf.x).toBeLessThan(right + 90);
    expect(bite.leaf.y).toBeGreaterThan(top);
    expect(bite.leaf.y).toBeLessThan(bottom + 30);
    expect(bite.leaf.x).toBeLessThan(treeBase.x);
  }
});
