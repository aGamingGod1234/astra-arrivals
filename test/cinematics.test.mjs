import test from "node:test";
import assert from "node:assert/strict";
import { createDirector, makeCinematic, EVENTS } from "../src/cinematics.js";

const guest = (id, name = id) => ({
  id,
  name,
  arrivedAt: new Date().toISOString(),
});

test("arrivals received while paused wait for resume, including during an ambient event", () => {
  for (const ambient of [false, true]) {
    const d = createDirector();
    if (ambient) d.advance(15000);
    const held = d.current;
    d.advance(0, true);
    d.enqueue([guest("waiting")]);
    assert.equal(d.current, held);
    assert.equal(d.queue.length, 1);
    d.advance(1000, true);
    assert.equal(d.current, held);
    d.advance(1, false);
    assert.equal(d.current.guest.id, "waiting");
    assert.equal(d.elapsed, 0);
  }
});

test("a quiet room starts at 15 seconds, repeats without immediate duplicate types, and returns to rest", () => {
  const d = createDirector(() => 0.4);
  d.advance(14999);
  assert.equal(d.current, null);
  d.advance(1);
  const first = d.current;
  assert.ok(first);
  assert.equal(first.guest, null);
  d.advance(first.duration);
  assert.equal(d.current, null);
  d.advance(15000 - first.duration);
  assert.ok(d.current);
  assert.notEqual(d.current.type, first.type);
});

test("a guest preempts ambient motion; queued guests each get their full cinematic exactly once", () => {
  const d = createDirector();
  d.advance(15000);
  assert.ok(d.current);
  d.enqueue([guest("one"), guest("two"), guest("three")]);
  assert.equal(d.current.guest.id, "one");
  assert.equal(d.elapsed, 0);
  assert.equal(d.queue.length, 2);
  for (const id of ["one", "two", "three"]) {
    assert.equal(d.current.guest.id, id);
    const duration = d.current.duration;
    d.advance(duration - 1);
    assert.equal(d.current.guest.id, id);
    d.advance(1);
  }
  assert.equal(d.current, null);
  assert.equal(d.queue.length, 0);
});

test("pause freezes the entire deadline and cinematic, and preview cannot interrupt a guest", () => {
  const d = createDirector();
  d.advance(10000);
  d.advance(60000, true);
  assert.equal(d.current, null);
  d.advance(5000);
  assert.ok(d.current);
  d.enqueue([guest("one")]);
  const playing = d.current;
  d.advance(60000, true);
  assert.equal(d.elapsed, 0);
  assert.equal(d.current, playing);
  assert.equal(d.preview(1), false);
  assert.equal(d.current, playing);
  d.reset();
  assert.equal(d.current, null);
  assert.equal(d.queue.length, 0);
});

test("name determines event family; a stable guest gets a stable signature and namesakes vary", () => {
  const a = makeCinematic(guest("person-a", "Mei Lin"));
  const b = makeCinematic(guest("person-a", "  MEI   LIN  "));
  assert.equal(a.type, b.type);
  assert.equal(a.seed, b.seed);
  assert.deepEqual(
    makeCinematic(guest("person-a", "Mei Lin")).source,
    a.source,
  );
  const other = makeCinematic(guest("person-b", "Mei Lin"));
  assert.equal(a.type, other.type);
  assert.notEqual(a.signature, other.signature);
  const types = new Set(
    Array.from(
      { length: 120 },
      (_, i) => makeCinematic(guest(String(i), `Visitor ${i}`)).type,
    ),
  );
  assert.equal(types.size, EVENTS.length);
});
