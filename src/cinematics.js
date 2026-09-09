import { hash, identity } from "./identity.js";

export const SOURCE_STARS = [
  [-2.9, 1.8],
  [2.55, 2.1],
  [-2.35, 2.7],
  [2.95, 1.2],
  [1.8, 2.65],
  [-2.8, -1.4],
];

export const EVENTS = [
  {
    name: "Supernova",
    subtitle:
      "You set off a star explosion. Its shock wave sends the particles flying.",
    color: "#e9aa6c",
    source: "https://svs.gsfc.nasa.gov/20413/",
    detail:
      "A star swells, erupts and sends an expanding shock front through the 6. Particles move only when the wave reaches them.",
  },
  {
    name: "Sixfall",
    subtitle:
      "You brought a comet shower. Glowing 6s sweep the particles aside.",
    color: "#96c9db",
    source: "https://esahubble.org/news/heic2606/",
    detail:
      "A fragmented comet becomes a procession of luminous 6s. Their trails carve separate channels through the numeral.",
  },
  {
    name: "Tidal disruption",
    subtitle:
      "Oh no, you woke a black hole. Its gravity pulls the particles into a spiral.",
    color: "#efa56c",
    source:
      "https://www.jpl.nasa.gov/images/pia25440-a-black-hole-destroys-a-star-illustration/",
    detail:
      "A dark centre opens inside an accretion disc. The 6 stretches into a long stream and spirals inward before returning.",
  },
  {
    name: "Kilonova",
    subtitle:
      "You brought two neutron stars together. They collide and send out waves of debris.",
    color: "#d8b8e7",
    source:
      "https://www.esa.int/ESA_Multimedia/Videos/2017/10/Neutron_star_merger/%28lang%29",
    detail:
      "Two bright stars orbit closer, merge and release expanding shells. The 6 ripples, disperses and gathers again.",
  },
  {
    name: "Pulsar",
    subtitle:
      "You spun up a neutron star. Its rotating beams push the particles as they pass.",
    color: "#86cdd0",
    source:
      "https://science.nasa.gov/photojournal/beacons-of-x-ray-light-animation/",
    detail:
      "Twin lighthouse beams sweep through space. Each pass lifts a narrow fan of particles out of the 6.",
  },
  {
    name: "Relativistic jet",
    subtitle:
      "You unleashed a black hole's jet. A narrow stream of matter sweeps particles along.",
    color: "#94b9ed",
    source: "https://svs.gsfc.nasa.gov/14203/",
    detail:
      "A compact source launches a narrow jet. It cuts through the 6, stretches a stream of particles downstream and leaves them to settle.",
  },
  {
    name: "Einstein ring",
    subtitle:
      "You bent the starlight. Gravity stretches the 6 into a glowing ring.",
    color: "#d7c498",
    source: "https://www.eso.org/public/videos/eso1522a/",
    detail:
      "A passing gravitational lens bends starlight into arcs. The particles follow a warped ring, then the distortion passes.",
  },
  {
    name: "Stellar winds",
    subtitle:
      "You stirred up two stars. Their winds send spirals of dust through the 6.",
    color: "#c3b1dd",
    source:
      "https://www.esa.int/ESA_Multimedia/Images/2022/10/Webb_finds_star_duo_forms_fingerprint_in_space",
    detail:
      "A binary star blows nested, turning dust shells. They comb through the 6 and roll its particles into a spiral.",
  },
  {
    name: "Butterfly nebula",
    subtitle:
      "You gave a dying star its wings. Expanding clouds carry the particles outward.",
    color: "#9fd4bf",
    source: "https://www.eso.org/public/news/eso1523/",
    detail:
      "Two lobes of starlight unfold from a stellar core. The 6 opens into wing-like streams, then closes back into its original shape.",
  },
];

export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCinematic(guest, ambientSeed, forcedType) {
  const nameSeed = guest
    ? hash(
        guest.name
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase("en")
          .replace(/\s+/g, " "),
      )
    : ambientSeed >>> 0;
  const seed = guest ? hash(`${nameSeed}:${guest.id}`) : nameSeed;
  const random = randomGenerator(seed);
  const type = forcedType ?? nameSeed % EVENTS.length;
  const definition = EVENTS[type];
  const side = random() > 0.5 ? 1 : -1;
  return {
    id: guest ? `guest:${guest.id}` : `ambient:${seed}`,
    guest: guest
      ? { ...guest, ...identity(guest), line: definition.subtitle }
      : null,
    type,
    seed,
    name: definition.name,
    color: definition.color,
    duration: 14200 + Math.round(random() * 500),
    source: SOURCE_STARS[Math.floor(random() * SOURCE_STARS.length)],
    angle: -0.75 + random() * 1.5,
    strength: 0.85 + random() * 0.4,
    spin: side * (0.8 + random() * 0.4),
    signature: random(),
  };
}

// One clock owns idle deadlines, pause, guest priority and complete entrances.
export function createDirector(random = Math.random) {
  let time = 0,
    nextIdle = 15000,
    serial = 0,
    lastType = -1,
    isPaused = false;
  const director = {
    current: null,
    elapsed: 0,
    queue: [],
    enqueue(guests) {
      director.queue.push(...guests);
      nextIdle = time + 15000;
      if (!isPaused && !director.current?.guest) beginGuest();
    },
    advance(milliseconds, paused = false) {
      isPaused = paused;
      if (paused) return;
      time += milliseconds;
      if (director.current) {
        director.elapsed += milliseconds;
        if (director.elapsed >= director.current.duration) {
          director.current = null;
          director.elapsed = 0;
        }
      }
      if (!director.current?.guest && director.queue.length) beginGuest();
      if (!director.current && time >= nextIdle) director.preview();
    },
    preview(type) {
      if (director.current?.guest || director.queue.length) return false;
      const seed = (Math.floor(random() * 4294967296) + ++serial) >>> 0;
      let selected = type ?? seed % EVENTS.length;
      if (type === undefined && selected === lastType)
        selected =
          (selected + 1 + (seed % (EVENTS.length - 1))) % EVENTS.length;
      director.current = makeCinematic(null, seed, selected);
      director.elapsed = 0;
      lastType = selected;
      nextIdle = time + 15000;
      return true;
    },
    reset() {
      director.current = null;
      director.elapsed = 0;
      director.queue = [];
      nextIdle = time + 15000;
    },
  };
  function beginGuest() {
    const guest = director.queue.shift();
    if (!guest) return;
    director.current = makeCinematic(guest);
    director.elapsed = 0;
    lastType = director.current.type;
    nextIdle = time + 15000;
  }
  return director;
}
