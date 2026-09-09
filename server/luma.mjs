import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cleanName } from "../src/identity.js";

export function verifySignature(secret, header, raw, now = Date.now()) {
  if (!secret || typeof header !== "string") return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  if (!/^\d+$/.test(parts.t || "") || !/^[a-f0-9]{64}$/i.test(parts.v1 || ""))
    return false;
  if (Math.abs(now / 1000 - Number(parts.t)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.`)
    .update(raw)
    .digest();
  const actual = Buffer.from(parts.v1, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function checkInFromWebhook(
  payload,
  eventId,
  fullNames = false,
  now = Date.now(),
) {
  if (payload?.type !== "guest.updated") return null;
  const guest = payload.data;
  if (
    !guest ||
    guest.event?.id !== eventId ||
    typeof guest.id !== "string" ||
    !guest.id.trim()
  )
    return null;
  if (!["approved", "session"].includes(guest.approval_status)) return null;
  if (!Array.isArray(guest.event_tickets)) return null;
  const times = guest.event_tickets
    .map((ticket) =>
      typeof ticket?.checked_in_at === "string"
        ? Date.parse(ticket.checked_in_at)
        : NaN,
    )
    .filter((time) => Number.isFinite(time));
  if (!times.length) return null;
  const checkedIn = Math.min(...times);
  // Registration edits to old check-ins must not become new entrances.
  if (checkedIn < now - 15 * 60 * 1000 || checkedIn > now + 5 * 60 * 1000)
    return null;
  const name = fullNames
    ? guest.user_name
    : guest.user_first_name || guest.user_name?.trim().split(/\s+/)[0];
  return {
    id: createHash("sha256")
      .update(`${eventId}:${guest.id}`)
      .digest("hex")
      .slice(0, 24),
    name: cleanName(name),
    arrivedAt: new Date(checkedIn).toISOString(),
  };
}
