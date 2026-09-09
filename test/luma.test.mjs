import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEventServer } from "../server/index.mjs";
import { checkInFromWebhook, verifySignature } from "../server/luma.mjs";

const now = Date.now(),
  secret = "whsec_test_fixture_only",
  eventId = "evt-test-fixture";
function fixture(id = "guest-one", change = {}) {
  return {
    type: "guest.updated",
    data: {
      id,
      event: { id: eventId },
      user_name: "Mei Lin Tan",
      user_first_name: "Mei Lin",
      user_email: "never-display@example.invalid",
      approval_status: "approved",
      event_tickets: [
        { id: "ticket-one", checked_in_at: new Date(now).toISOString() },
      ],
      ...change,
    },
  };
}
function signature(raw, at = now) {
  const timestamp = Math.floor(at / 1000);
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
}

test("accepts only authentic, recent raw-body signatures", () => {
  const raw = JSON.stringify(fixture());
  assert.equal(
    verifySignature(secret, signature(raw), Buffer.from(raw), now),
    true,
  );
  assert.equal(
    verifySignature(secret, signature(raw), Buffer.from(raw + " "), now),
    false,
  );
  assert.equal(
    verifySignature(
      secret,
      signature(raw, now - 360000),
      Buffer.from(raw),
      now,
    ),
    false,
  );
  assert.equal(
    verifySignature(secret, "t=bad,v1=x", Buffer.from(raw), now),
    false,
  );
  assert.equal(
    verifySignature("", signature(raw), Buffer.from(raw), now),
    false,
  );
});

test("reads documented ticket timestamps, filters RSVP edits, wrong events and old check-ins", () => {
  const guest = checkInFromWebhook(fixture(), eventId, false, now);
  assert.equal(guest.name, "Mei Lin");
  assert.equal(guest.id.length, 24);
  assert.equal("user_email" in guest, false);
  assert.equal(
    checkInFromWebhook(
      fixture("x", { event_tickets: [{ checked_in_at: null }] }),
      eventId,
      false,
      now,
    ),
    null,
  );
  assert.equal(
    checkInFromWebhook(
      fixture("x", { event: { id: "evt-somewhere-else" } }),
      eventId,
      false,
      now,
    ),
    null,
  );
  assert.equal(
    checkInFromWebhook(
      fixture("x", {
        event_tickets: [
          { checked_in_at: new Date(now - 3600000).toISOString() },
        ],
      }),
      eventId,
      false,
      now,
    ),
    null,
  );
  assert.equal(
    checkInFromWebhook(
      { ...fixture(), type: "guest.registered" },
      eventId,
      false,
      now,
    ),
    null,
  );
  assert.equal(
    checkInFromWebhook(
      fixture("x", { approval_status: "declined" }),
      eventId,
      false,
      now,
    ),
    null,
  );
});

test("signed check-ins reach the display once, stay private and survive a server restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "astra-arrivals-"));
  const config = {
    secret,
    eventId,
    screenKey: "fixture-screen-key-long-enough",
    dataFile: join(directory, "guests.json"),
    publicDir: join(directory, "public"),
    now: () => now,
  };
  let server;
  const start = async () => {
    server = createEventServer(config);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const stop = () => new Promise((resolve) => server.close(resolve));
  try {
    let base = await start();
    const post = async (body, auth = signature(body)) =>
      fetch(`${base}/api/luma/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Webhook-Signature": auth,
        },
        body,
      });
    const get = (after) =>
      fetch(`${base}/api/arrivals?after=${after}`, {
        headers: { Authorization: `Bearer ${config.screenKey}` },
      });
    const raw = JSON.stringify(fixture());
    assert.equal((await fetch(`${base}/api/arrivals`)).status, 401);
    assert.equal((await post(raw, "t=0,v1=fake")).status, 401);
    assert.deepEqual(await (await post(raw)).json(), { accepted: true });
    assert.deepEqual(await (await post(raw)).json(), { accepted: false });
    assert.deepEqual(
      await (
        await post(
          JSON.stringify(fixture("guest-one", { user_first_name: "Changed" })),
        )
      ).json(),
      { accepted: false },
    );
    let result = await (await get(0)).json();
    assert.equal(result.total, 1);
    assert.equal(result.arrivals[0].name, "Mei Lin");
    assert.equal(JSON.stringify(result).includes("never-display"), false);
    assert.equal((await (await get(1)).json()).arrivals.length, 0);
    const second = JSON.stringify(
      fixture("guest-two", { user_first_name: "<script>alert(1)</script>" }),
    );
    await post(second);
    result = await (await get(1)).json();
    assert.equal(result.arrivals.length, 1);
    assert.equal(result.sequence, 2);
    await stop();
    base = await start();
    result = await (await get(0)).json();
    assert.equal(result.total, 2);
    assert.deepEqual(await (await post(raw)).json(), { accepted: false });
    const invalid = "{invalid";
    assert.equal((await post(invalid)).status, 400);
    assert.equal((await get(-1)).status, 400);
  } finally {
    if (server?.listening) await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
