// Keep the watchdog active through the body read, including older Safari
// versions without AbortSignal.timeout.
export async function withDownloadDeadline<T>(
  milliseconds: number,
  download: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await download(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
