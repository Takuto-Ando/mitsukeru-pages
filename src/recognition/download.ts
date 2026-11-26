// Keep the watchdog active through the body read, including older Safari
// versions without AbortSignal.timeout.
export async function withDownloadDeadline<T>(
  milliseconds: number,
  download: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new DOMException("Model download timed out", "TimeoutError"));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([download(controller.signal), expired]);
  } finally {
    clearTimeout(timeout);
  }
}

// Forward the network chunks without retaining an extra copy of the model.
// Fetch supplies decoded bytes, so the synthetic response has no wire encoding.
export function trackDownloadedBytes(
  response: Response,
  onBytes: (downloaded: number) => void,
) {
  if (!response.body || typeof TransformStream === "undefined") return response;
  let downloaded = 0;
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        downloaded += chunk.byteLength;
        onBytes(downloaded);
        controller.enqueue(chunk);
      },
    }),
  );
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
