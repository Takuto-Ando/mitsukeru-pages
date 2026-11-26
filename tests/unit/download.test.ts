import { afterEach, expect, test, vi } from "vitest";
import { withDownloadDeadline } from "../../src/recognition/download";

afterEach(() => vi.useRealTimers());

test("保存処理が中断に応答しない場合も期限を過ぎたら失敗を返す", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const result = withDownloadDeadline(1_000, (abortSignal) => {
    signal = abortSignal;
    return new Promise(() => undefined);
  });
  const outcome = vi.fn();
  void result.then(
    () => outcome("success"),
    () => outcome("timeout"),
  );

  await vi.advanceTimersByTimeAsync(1_000);
  expect(signal?.aborted).toBe(true);
  expect(outcome).toHaveBeenCalledWith("timeout");
});
