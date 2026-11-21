import { loadEnv, type Plugin } from "vite";

export function localShareRelay(): Plugin {
  return {
    name: "zooketch-local-test-share",
    apply: "serve",
    config(_config, { mode, isPreview }) {
      const env = loadEnv(mode, process.cwd(), "ZOOKETCH_TEST_SHARE_");
      const endpoint = env.ZOOKETCH_TEST_SHARE_ENDPOINT ?? "";
      const token = env.ZOOKETCH_TEST_SHARE_TOKEN ?? "";
      const enabled = !isPreview && isAppsScriptEndpoint(endpoint) && !!token;
      return {
        define: {
          "import.meta.env.VITE_LOCAL_SHARE_CONSENT": JSON.stringify(
            enabled ? "1" : "0",
          ),
        },
      };
    },
    configureServer(server) {
      const env = loadEnv(
        server.config.mode,
        server.config.root,
        "ZOOKETCH_TEST_SHARE_",
      );
      const endpoint = env.ZOOKETCH_TEST_SHARE_ENDPOINT ?? "";
      const token = env.ZOOKETCH_TEST_SHARE_TOKEN ?? "";
      if (!isAppsScriptEndpoint(endpoint) || !token) return;
      const path = server.config.base + "__zooketch-test-share";
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== path) return next();
        const origin = req.headers.origin;
        if (
          req.method !== "POST" ||
          !origin ||
          ![
            `http://${req.headers.host}`,
            `https://${req.headers.host}`,
          ].includes(origin)
        ) {
          res.writeHead(403).end();
          return;
        }
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const buffer = Buffer.from(chunk);
            size += buffer.length;
            if (size > 12_000_000) {
              res.writeHead(413).end();
              return;
            }
            chunks.push(buffer);
          }
          const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const fields = [
            "id",
            "createdAt",
            "animalName",
            "taskName",
            "groupId",
            "pngBase64",
          ] as const;
          if (
            !fields.every(
              (key) => typeof data[key] === "string" && data[key].length > 0,
            ) ||
            !/^iVBOR[A-Za-z0-9+/=]+$/.test(data.pngBase64)
          ) {
            res.writeHead(400).end();
            return;
          }
          const body = Object.fromEntries(
            fields.map((key) => [key, data[key]]),
          );
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              ...body,
              strokes: Array.isArray(data.strokes) ? data.strokes : undefined,
              token,
            }),
            signal: AbortSignal.timeout(15_000),
          });
          const result = await response.json();
          // The client only learns whether the receiver accepted the sketch.
          res.writeHead(response.ok && result.ok === true ? 204 : 502).end();
        } catch {
          res.writeHead(502).end();
        }
      });
    },
  };
}

function isAppsScriptEndpoint(endpoint: string) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(
    endpoint,
  );
}
