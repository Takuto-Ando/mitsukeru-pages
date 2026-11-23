import { expect, test } from "vitest";
import { createRecentFrameResults } from "../../src/recognition/recentFrameResults";

test("モデル入力の全画素が一致した場合だけ識別結果を再利用する", () => {
  const cache = createRecentFrameResults<string>();
  cache.write(new Uint32Array([100, 200]), "red panda");
  expect(cache.read(new Uint32Array([100, 200]))).toBe("red panda");
  expect(cache.read(new Uint32Array([100, 201]))).toBeUndefined();
  expect(cache.read(new Uint32Array([100]))).toBeUndefined();
});

test("最近使った4枚分だけを保持する", () => {
  const cache = createRecentFrameResults<number>();
  for (let index = 1; index <= 4; index++)
    cache.write(new Uint32Array([index]), index);
  expect(cache.read(new Uint32Array([1]))).toBe(1);
  cache.write(new Uint32Array([5]), 5);
  expect(cache.read(new Uint32Array([1]))).toBe(1);
  expect(cache.read(new Uint32Array([2]))).toBeUndefined();
});
