import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));

test("the production entry point serves the build and survives malformed requests", {
  timeout: 30000,
}, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "astra-production-"));
  const secret = "whsec_production_test_only";
  const screenKey = "production-test-screen-key-only";
  const child = spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "server/index.mjs"],
    {
      cwd: project,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "0",
        LUMA_EVENT_ID: "evt-production-test",
        LUMA_WEBHOOK_SECRET: secret,
        SCREEN_KEY: screenKey,
        DISPLAY_FULL_NAMES: "false",
        DATA_FILE: join(directory, "guests.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = once(child, "close");
  t.after(async () => {
    child.kill();
    await closed;
    rmSync(directory, { recursive: true, force: true });
  });
  let output = "";
  child.stderr.on("data", (data) => {
    output += data;
  });
  const base = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`Server exited (${code}): ${output}`)),
    );
    child.stdout.on("data", (data) => {
      output += data;
      const address = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (address) resolve(address[0]);
    });
  });
  const page = await fetch(base);
  assert.equal(page.status, 200, "Build the display before running this test");
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  const html = await page.text();
  assert.match(html, /Astra \/ Arrivals/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
    .map((match) => match[1]);
  assert.ok(
    assets.some((asset) => /\/three-.*\.js$/.test(asset)),
    "Three.js remains in a separate bundle",
  );
  assert.ok(assets.some((asset) => asset.endsWith(".css")));
  for (const asset of assets) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get("cache-control"), /immutable/);
    assert.match(
      response.headers.get("content-type"),
      asset.endsWith(".css") ? /text\/css/ : /text\/javascript/,
    );
    const body = await response.text();
    assert.ok(body.length > 0);
    if (asset.endsWith(".css")) {
      const fonts = body.matchAll(/url\(["']?(\/assets\/[^\s)"']+\.woff2)["']?\)/g);
      for (const [, font] of fonts) {
        const response = await fetch(`${base}${font}`);
        assert.equal(response.status, 200, font);
        assert.match(response.headers.get("content-type"), /font\/woff2/);
        await response.arrayBuffer();
      }
    }
  }
  for (const path of ["/concepts.html", "/research.html", "/star.svg"]) {
    const response = await fetch(`${base}${path}`, { method: "HEAD" });
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), "");
  }
  const malformed = await new Promise((resolve, reject) => {
    const req = request(`${base}/`, { path: "//[" }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(malformed, 400);
  assert.deepEqual(await (await fetch(`${base}/api/status`)).json(), {
    liveConfigured: true,
  });
  assert.equal((await fetch(`${base}/api/arrivals`)).status, 401);
  const body = JSON.stringify({
    type: "guest.updated",
    data: {
      id: "guest-production-test",
      event: { id: "evt-production-test" },
      approval_status: "approved",
      user_first_name: "Fixture",
      user_email: "private@example.invalid",
      event_tickets: [{ checked_in_at: new Date().toISOString() }],
    },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const post = () =>
    fetch(`${base}/api/luma/webhook`, {
      method: "POST",
      headers: { "Webhook-Signature": `t=${timestamp},v1=${signature}` },
      body,
    });
  assert.deepEqual(await (await post()).json(), { accepted: true });
  assert.deepEqual(await (await post()).json(), { accepted: false });
  const response = await fetch(`${base}/api/arrivals?initial=1`, {
    headers: { Authorization: `Bearer ${screenKey}` },
  });
  const arrivals = await response.json();
  assert.equal(arrivals.total, 1);
  assert.equal(arrivals.arrivals[0].name, "Fixture");
  assert.equal(JSON.stringify(arrivals).includes("private@example.invalid"), false);
});
