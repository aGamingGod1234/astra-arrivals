export const EVENT_SECONDS = 14.4;
export const RETURN_AT = 9;
export const EFFECT_END = 8.4;
export const smooth = (a, b, t) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const windowed = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));
const pressure = (radius, r, width) => {
  const distance = (r - radius) / width;
  return Math.abs(distance) <= 3 ? Math.exp(-distance * distance) : 0;
};

// These exact positions and envelopes drive both the visible effects and their forces.
export function createEventField(cinematic) {
  const c = cinematic,
    dx = Math.cos(c.angle - 0.55),
    dy = Math.sin(c.angle - 0.55);
  const state = {
    age: 0,
    envelope: 0,
    front1: 0,
    front2: 0,
    ignition: 0,
    orbit: 0,
    angle: 0,
    lensX: 0,
    lensY: 0,
    heads: new Float32Array(6),
    meteorOpacity: new Float32Array(6),
  };
  const offsets = Array.from(
    { length: 6 },
    (_, i) => (i - 2.5) * 0.7 + (c.signature - 0.5) * 0.4,
  );
  let beamX = 1,
    beamY = 0,
    wingX = Math.cos(c.angle),
    wingY = Math.sin(c.angle);
  const field = {
    state,
    dx,
    dy,
    offsets,
    update(t) {
      state.age = t;
      state.envelope = windowed(t, 0.3, 1.1, 7.2, EFFECT_END);
      state.front1 =
        c.type === 3
          ? Math.max(0, t - 3.1) * 2.5
          : Math.max(0, t - 1.45) * 1.75;
      state.front2 = state.front1 * (c.type === 3 ? 0.72 : 0.94);
      state.ignition =
        c.type === 3
          ? windowed(t, 2.8, 3.2, 3.3, 4.8)
          : windowed(t, 0, 0.9, 1.5, 3.1);
      state.orbit = 2 * (1 - smooth(0, 3.1, t));
      state.angle =
        c.type === 3
          ? t * (2 + t * 0.6) * c.spin + c.angle
          : c.angle + (t - 1) * c.spin * 1.35;
      beamX = Math.cos(state.angle);
      beamY = Math.sin(state.angle);
      state.lensX = Math.sin(t * 0.22 + c.angle) * 0.5;
      state.lensY = Math.cos(t * 0.21) * 0.25;
      for (let i = 0; i < 6; i++) {
        const life = t - (0.6 + i * 0.62);
        state.heads[i] = -6 + life * 4.4;
        state.meteorOpacity[i] = windowed(life, 0, 0.2, 2.5, 3);
      }
    },
    force(x, y, z, seed, out) {
      let ax = 0,
        ay = 0,
        az = 0;
      const s = state,
        t = s.age,
        on = s.envelope;
      if (on > 0) {
        if (c.type === 0 || c.type === 3) {
          const vx = x - (c.type === 0 ? c.source[0] : 0),
            vy = y - (c.type === 0 ? c.source[1] : 0),
            r = Math.hypot(vx, vy) + 1e-6;
          const released = c.type === 0 ? t >= 1.45 : t >= 3.1;
          // Pressure follows the visible ring's full thickness, including its leading edge.
          const f = released
            ? (pressure(
                s.front1,
                r,
                c.type === 0 ? 0.045 + s.front1 * 0.012 : 0.055,
              ) *
                4 +
                pressure(s.front2, r, c.type === 0 ? 0.16 : 0.13) * 1.5) *
              on *
              (0.65 + seed * 0.7)
            : 0;
          ax = (vx / r) * f;
          ay = (vy / r) * f;
          az = (seed - 0.5) * f * 0.22;
        } else if (c.type === 1) {
          const along = x * dx + y * dy,
            across = -x * dy + y * dx;
          for (let i = 0; i < 6; i++) {
            const behind = s.heads[i] - along,
              side = across - offsets[i];
            if (behind >= 0 && behind < 2) {
              const f =
                Math.exp(-side * side * 70 - behind * 2.8) *
                s.meteorOpacity[i] *
                25;
              ax += (dx * 0.65 - dy * Math.sign(side)) * f;
              ay += (dy * 0.65 + dx * Math.sign(side)) * f;
              az += (seed - 0.5) * f * 0.3;
            }
          }
        } else if (c.type === 2) {
          const vx = c.source[0] - x,
            vy = c.source[1] - y,
            r2 = vx * vx + vy * vy + 0.24;
          const pull = (on * 3.1) / Math.sqrt(r2),
            turn = (on * c.spin * 1.5) / r2;
          ax = vx * pull - vy * turn;
          ay = vy * pull + vx * turn;
          az = -z * on;
        } else if (c.type === 4) {
          const vx = x - c.source[0],
            vy = y - c.source[1],
            r = Math.hypot(vx, vy) + 1e-6;
          const along = vx * beamX + vy * beamY,
            across = -vx * beamY + vy * beamX;
          const width = 0.03 + Math.abs(along) * 0.11;
          const f =
            Math.exp(-((across / width) ** 2) - Math.abs(along) * 0.28) *
            on *
            7;
          ax = (vx / r) * f;
          ay = (vy / r) * f;
          az = (seed - 0.5) * f * 0.3;
        } else if (c.type === 5) {
          const along = x * dx + y * dy + 4.8,
            across = -x * dy + y * dx;
          const reached =
            smooth(1.3 + along / 3.5, 1.6 + along / 3.5, t) *
            (along >= 0 ? 1 : 0);
          const width = 0.025 + Math.max(0, along) * 0.022;
          const f =
            (Math.exp(-((across / width) ** 2)) +
              Math.exp(-((across / 0.27) ** 2)) * 0.175) *
            reached *
            on *
            6;
          ax = dx * f;
          ay = dy * f;
          az = (seed - 0.5) * f * 0.15;
        } else if (c.type === 6) {
          const vx = x - s.lensX,
            vy = y - s.lensY,
            r = Math.hypot(vx, vy) + 1e-6;
          const pull = (2.05 - r) * 3 * on,
            turn = on * c.spin * 0.18;
          ax = (vx / r) * pull - vy * turn;
          ay = (vy / r) * pull + vx * turn;
          az = -z * on;
        } else if (c.type === 7) {
          const r = Math.hypot(x, y) + 1e-6,
            a = Math.atan2(y, x);
          const shell = Math.sin(r * 9 - a * 2 - t * 2.4 * c.spin);
          const f =
            Math.pow(Math.max(0, shell), 14) *
            Math.exp(-r * 0.33) *
            smooth(0.1, 0.5, r) *
            on *
            4.5;
          ax = (x / r - (y / r) * c.spin) * f;
          ay = (y / r + (x / r) * c.spin) * f;
          az = (seed - 0.5) * f * 0.15;
        } else {
          const vx = wingX * x - wingY * y,
            vy = wingY * x + wingX * y;
          const wing = Math.abs(vx) / (0.35 + on * 2.9),
            span = 0.15 + Math.sin(Math.min(1, wing) * Math.PI) * 1.7;
          const inside =
            Math.exp(-((vy / span) ** 2) * 2) *
            (1 - smooth(0.85, 1.1, wing)) *
            smooth(0, 0.2, wing);
          const f = inside * on * 2.3,
            fx = Math.sign(vx) * f,
            fy = vy * f * 0.18;
          ax = wingX * fx + wingY * fy;
          ay = -wingY * fx + wingX * fy;
          az = (seed - 0.5) * f * 0.15;
        }
      }
      out[0] = ax * c.strength;
      out[1] = ay * c.strength;
      out[2] = az * c.strength;
    },
  };
  return field;
}

// Semi-implicit integration retains momentum between impacts. A damped spring
// only brings the particles home after the visible event has fully disappeared.
export function createParticlePhysics(homePositions, seeds) {
  const home = new Float32Array(homePositions),
    positions = new Float32Array(home),
    velocities = new Float32Array(home.length),
    force = [0, 0, 0];
  let field = null,
    time = 0,
    count = seeds.length;
  return {
    positions,
    velocities,
    get field() {
      return field;
    },
    get age() {
      return time;
    },
    begin(c) {
      positions.set(home);
      velocities.fill(0);
      field = createEventField(c);
      time = 0;
    },
    reset() {
      positions.set(home);
      velocities.fill(0);
      field = null;
      time = 0;
    },
    setCount(n) {
      count = Math.min(n, seeds.length);
    },
    advance(target) {
      if (!field || target <= time) return;
      const dt = 1 / 120,
        steps = Math.floor((target - time + 1e-8) * 120);
      for (let step = 0; step < steps; step++) {
        time += dt;
        field.update(time);
        const returning = smooth(RETURN_AT, RETURN_AT + 0.7, time),
          spring = returning * 16;
        const drag = 0.32 + returning * 7.68;
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          field.force(
            positions[j],
            positions[j + 1],
            positions[j + 2],
            seeds[i],
            force,
          );
          for (let axis = 0; axis < 3; axis++) {
            const k = j + axis;
            velocities[k] +=
              (force[axis] +
                (home[k] - positions[k]) * spring -
                velocities[k] * drag) *
              dt;
            positions[k] += velocities[k] * dt;
          }
        }
      }
      field.update(time);
    },
  };
}
