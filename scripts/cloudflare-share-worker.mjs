const sharePath = "/__zooketch-share";
const githubOrigin = "https://takuto-ando.github.io";
const maximumSketchBytes = 12_000_000;
const fieldLimits = {
  id: 128,
  createdAt: 40,
  animalName: 128,
  taskName: 128,
  groupId: 128,
};

export async function relayShare(request, env) {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin && origin !== githubOrigin) {
    return new Response(null, { status: 403 });
  }
  const reply = (status) =>
    new Response(null, {
      status,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    });
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "POST") return reply(405);
  const endpoint = env.ZOOKETCH_SHARE_ENDPOINT;
  const token = env.ZOOKETCH_SHARE_TOKEN;
  if (
    !token ||
    !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(
      endpoint ?? "",
    )
  ) {
    return reply(503);
  }

  const body = request.body;
  if (
    !body ||
    Number(request.headers.get("Content-Length")) > maximumSketchBytes
  )
    return reply(body ? 413 : 400);
  const decoder = new TextDecoder();
  let raw = "";
  let size = 0;
  try {
    for await (const bytes of body) {
      size += bytes.byteLength;
      if (size > maximumSketchBytes) return reply(413);
      raw += decoder.decode(bytes, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return reply(400);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return reply(400);
  }
  if (
    !data ||
    typeof data.pngBase64 !== "string" ||
    !/^iVBOR[A-Za-z0-9+/=]+$/.test(data.pngBase64) ||
    !Object.entries(fieldLimits).every(
      ([key, limit]) =>
        typeof data[key] === "string" &&
        data[key].length > 0 &&
        data[key].length <= limit &&
        !/^\s*[=+@-]/.test(data[key]),
    ) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(data.id) ||
    !Number.isFinite(Date.parse(data.createdAt))
  ) {
    return reply(400);
  }

  const sketch = Object.fromEntries(
    Object.keys(fieldLimits).map((key) => [key, data[key]]),
  );
  sketch.pngBase64 = data.pngBase64;
  if (Array.isArray(data.strokes)) {
    // Copy only the coordinate data. Other client fields remain on the device.
    if (
      !data.strokes.every(
        (stroke) =>
          Array.isArray(stroke) &&
          stroke.every(
            (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
          ),
      )
    )
      return reply(400);
    sketch.strokes = data.strokes.map((stroke) =>
      stroke.map(({ x, y }) => ({ x, y })),
    );
  }
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...sketch, token }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = upstream.ok ? await upstream.json() : null;
    return reply(result?.ok === true ? 204 : 502);
  } catch {
    return reply(502);
  }
}
