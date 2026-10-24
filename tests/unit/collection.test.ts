import { describe, it, expect } from "vitest";
import {
  collectionKey,
  emptyCollection,
  readCollection,
  writeCollection,
  type DrawingRecord,
} from "../../src/collection/storage";
import { drawingScene } from "../../src/collection/drawingScene";
const drawing: DrawingRecord = {
  id: "one",
  groupId: "goat",
  createdAt: "2026-10-23T12:00:00Z",
  outcome: "self-confirmed",
  strokes: [
    [
      { x: 160, y: 200 },
      { x: 400, y: 220 },
    ],
  ],
};
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
}
describe("端末内の描画保存", () => {
  it("空の状態と線の往復保存", () => {
    const s = memory();
    expect(readCollection(s)).toEqual(emptyCollection());
    writeCollection(s, { version: 1, drawings: [drawing] });
    expect(readCollection(s).drawings[0]).toEqual(drawing);
  });
  it("同じ動物の別の絵を残せ、1枚だけ削除できる", () => {
    const s = memory();
    writeCollection(s, {
      version: 1,
      drawings: [drawing, { ...drawing, id: "two" }],
    });
    writeCollection(s, {
      version: 1,
      drawings: readCollection(s).drawings.filter((d) => d.id !== "one"),
    });
    expect(readCollection(s).drawings.map((d) => d.id)).toEqual(["two"]);
  });
  it("壊れたデータや未対応版を勝手に上書きしない", () => {
    for (const value of [
      "{",
      '{"version":2,"drawings":[]}',
      JSON.stringify({
        version: 1,
        drawings: [{ ...drawing, groupId: "unknown" }],
      }),
      JSON.stringify({
        version: 1,
        drawings: [
          {
            ...drawing,
            strokes: [
              [
                { x: 700, y: 10 },
                { x: 1, y: 2 },
              ],
            ],
          },
        ],
      }),
    ]) {
      const s = memory();
      s.setItem(collectionKey, value);
      expect(() => readCollection(s)).toThrow();
      expect(s.getItem(collectionKey)).toBe(value);
    }
  });
  it("全身版の足先も保存し、旧版には旧座標の図を適用する", () => {
    const s = memory();
    const whole: DrawingRecord = {
      ...drawing,
      id: "whole",
      groupId: "zebra",
      taskId: "zebra",
      sceneVersion: 2,
      strokes: [
        [
          { x: 170, y: 520 },
          { x: 220, y: 560 },
        ],
      ],
    };
    writeCollection(s, { version: 1, drawings: [drawing, whole] });
    const [old, current] = readCollection(s).drawings;
    expect(drawingScene(old).frameHeight || 400).toBe(400);
    expect(drawingScene(old).artworkOverride?.incomplete).toBe(
      "illustrations/simple/goat.svg",
    );
    expect(drawingScene(current).frameHeight).toBe(600);
    expect(current.strokes).toEqual(whole.strokes);
    s.setItem(
      collectionKey,
      JSON.stringify({
        version: 1,
        drawings: [{ ...whole, sceneVersion: undefined }],
      }),
    );
    expect(() => readCollection(s)).toThrow();
  });
  it("容量不足は呼び出し側に通知する", () => {
    expect(() =>
      writeCollection(
        {
          setItem() {
            throw new DOMException("quota", "QuotaExceededError");
          },
        },
        { version: 1, drawings: [drawing] },
      ),
    ).toThrow();
  });
  it("件数上限で既存の絵を消さない", () => {
    const s = memory();
    writeCollection(s, { version: 1, drawings: [drawing] });
    expect(() =>
      writeCollection(s, {
        version: 1,
        drawings: Array.from({ length: 101 }, (_, i) => ({
          ...drawing,
          id: String(i),
        })),
      }),
    ).toThrow();
    expect(readCollection(s).drawings).toHaveLength(1);
  });
});
