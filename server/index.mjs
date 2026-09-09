import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySignature, checkInFromWebhook } from "./luma.mjs";
import { createStore } from "./store.mjs";

export function createEventServer({
  secret,
  eventId,
  screenKey,
  dataFile,
  publicDir,
  now = Date.now,
}) {
  const store = createStore(dataFile, eventId);
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".png": "image/png",
  };
  const send = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    );
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/status")
      return send(res, 200, {
        liveConfigured: Boolean(secret && eventId && screenKey),
      });
    if (url.pathname === "/api/arrivals" && req.method === "GET") {
      const auth = req.headers.authorization || "";
      const expected = Buffer.from(`Bearer ${screenKey}`),
        actual = Buffer.from(auth);
      if (
        !screenKey ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        return send(res, 401, { error: "Unauthorized" });
      const after = Number(url.searchParams.get("after") || 0);
      if (!Number.isSafeInteger(after) || after < 0)
        return send(res, 400, { error: "Invalid cursor" });
      return send(
        res,
        200,
        store.read(after, url.searchParams.get("initial") === "1"),
      );
    }
    if (url.pathname === "/api/luma/webhook" && req.method === "POST") {
      if (!secret || !eventId)
        return send(res, 503, { error: "Luma is not configured" });
      const chunks = [];
      let size = 0;
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 256 * 1024) {
            send(res, 413, { error: "Payload too large" });
            return;
          }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);
        if (
          !verifySignature(secret, req.headers["webhook-signature"], raw, now())
        )
          return send(res, 401, { error: "Invalid signature" });
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          return send(res, 400, { error: "Invalid JSON" });
        }
        const guest = checkInFromWebhook(
          payload,
          eventId,
          process.env.DISPLAY_FULL_NAMES === "true",
          now(),
        );
        if (!guest)
          return send(res, 200, {
            accepted: false,
            reason: "No new check-in for this event",
          });
        return send(res, 200, { accepted: store.add(guest) });
      } catch {
        return send(res, 500, {
          error: "Could not save check-in. Retry delivery.",
        });
      }
    }
    if (url.pathname.startsWith("/api/"))
      return send(res, 404, { error: "Not found" });
    if (!["GET", "HEAD"].includes(req.method))
      return send(res, 405, { error: "Method not allowed" });
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, { error: "Invalid path" });
    }
    const root = resolve(publicDir),
      file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(root + sep))
      return send(res, 403, { error: "Forbidden" });
    try {
      const bytes = readFileSync(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      send(res, 404, {
        error: "Not found. Run npm run build before starting the event server.",
      });
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const project = fileURLToPath(new URL("../", import.meta.url));
  const config = {
    secret: process.env.LUMA_WEBHOOK_SECRET,
    eventId: process.env.LUMA_EVENT_ID,
    screenKey: process.env.SCREEN_KEY,
    dataFile: resolve(project, process.env.DATA_FILE || "data/arrivals.json"),
    publicDir: resolve(project, "dist"),
  };
  if (
    !config.secret ||
    !config.eventId ||
    !config.screenKey ||
    config.screenKey.length < 24
  ) {
    console.error(
      "Set LUMA_WEBHOOK_SECRET, LUMA_EVENT_ID and SCREEN_KEY (at least 24 characters) in .env. See README.md.",
    );
    process.exitCode = 1;
  } else {
    const server = createEventServer(config);
    const port = Number(process.env.PORT || 4317);
    server.requestTimeout = 10000;
    server.headersTimeout = 10000;
    server.listen(port, process.env.HOST || "127.0.0.1", () =>
      console.log(
        `Astra event display: http://127.0.0.1:${port}. Waiting for signed Luma check-ins.`,
      ),
    );
  }
}
