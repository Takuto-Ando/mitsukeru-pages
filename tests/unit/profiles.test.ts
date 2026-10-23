import { test, expect } from "vitest";
import { profiles, evaluateProfile } from "../../src/content/profiles";
for (const [id, p] of Object.entries(profiles))
  test(`${id}: 専用のお手本・問い・未検証の判定を正しく区別`, () => {
    expect(p.answer.length).toBeGreaterThan(20);
    expect(p.background.length).toBeGreaterThan(20);
    const r = evaluateProfile(
      [
        [
          { x: 100, y: 100 },
          { x: 300, y: 200 },
        ],
      ],
      p,
    );
    expect(r.status).toBe("uncertain");
    expect(r.passed).toBe(false);
    expect(r.debug?.automaticJudging).toBe("unvalidated");
    expect(evaluateProfile([], p).passed).toBe(false);
  });
test("お手本は動物ごとに異なる", () =>
  expect(new Set(Object.values(profiles).map((p) => p.answer)).size).toBe(15));
