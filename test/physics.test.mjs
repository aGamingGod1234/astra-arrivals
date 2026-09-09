import test from "node:test";
import assert from "node:assert/strict";
import {
  createParticlePhysics,
  createEventField,
  EVENT_SECONDS,
  RETURN_AT,
} from "../src/particlePhysics.js";
import { makeCinematic, EVENTS } from "../src/cinematics.js";

const event = (type) => ({
  ...makeCinematic(null, 42, type),
  source: [-2.9, 1.8],
  strength: 1,
});
const particle = () =>
  createParticlePhysics(new Float32Array([1, 0, 0]), new Float32Array([0.4]));
test("shock fronts reach a particle before it accelerates, then it keeps drifting with damping", () => {
  const c = event(0),
    p = particle();
  p.begin(c);
  const arrival = 1.45 + Math.hypot(3.9, -1.8) / 1.75;
  p.advance(arrival - 0.35);
  assert.equal(p.positions[0], 1);
  assert.equal(p.velocities[0], 0);
  p.advance(arrival - 0.04);
  assert.ok(
    p.velocities[0] > 0,
    "The luminous leading edge already exerts pressure",
  );
  p.advance(arrival + 0.08);
  assert.ok(p.velocities[0] > 0.01);
  p.advance(5);
  const x = p.positions[0],
    velocity = p.velocities[0];
  p.advance(6);
  assert.ok(p.positions[0] > x + 0.01);
  assert.ok(p.velocities[0] > 0 && p.velocities[0] < velocity);
});
test("kilonova has no pre-collision displacement, and both visible shells exert a force", () => {
  const p = particle();
  p.begin(event(3));
  p.advance(3);
  assert.deepEqual(Array.from(p.positions), [1, 0, 0]);
  const field = createEventField(event(3)),
    out = [0, 0, 0];
  for (const age of [3.51, 3.67]) {
    field.update(age);
    field.force(1, 0, 0, 0.4, out);
    assert.ok(out[0] > 0.05);
  }
});
test("all effects are gone before the restoring spring engages, and every event settles home", () => {
  const home = new Float32Array([1, 0, 0, -1, 1, 0, 0, -2, 0]);
  for (let type = 0; type < EVENTS.length; type++) {
    const field = createEventField(event(type));
    field.update(RETURN_AT);
    assert.equal(field.state.envelope, 0);
    const p = createParticlePhysics(home, new Float32Array([0.1, 0.4, 0.7]));
    p.begin(event(type));
    p.advance(EVENT_SECONDS);
    for (let i = 0; i < home.length; i++) {
      assert.ok(Number.isFinite(p.positions[i]));
      assert.ok(
        Math.abs(p.positions[i] - home[i]) < 0.012,
        `${EVENTS[type].name} settles`,
      );
      assert.ok(Math.abs(p.velocities[i]) < 0.05);
    }
  }
});
test("simulation is stable across frame rates and does not advance when the cinematic clock is paused", () => {
  const a = particle(),
    b = particle();
  a.begin(event(0));
  b.begin(event(0));
  for (let i = 1; i <= 360; i++) a.advance(i / 60);
  for (let i = 1; i <= 144; i++) b.advance(i / 24);
  assert.ok(Math.abs(a.positions[0] - b.positions[0]) < 0.015);
  const held = Array.from(a.positions);
  a.advance(6);
  assert.deepEqual(Array.from(a.positions), held);
});
