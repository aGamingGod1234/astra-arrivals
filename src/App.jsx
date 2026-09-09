import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowTopRightIcon,
  Cross1Icon,
  EnterFullScreenIcon,
  GearIcon,
  PauseIcon,
  PlayIcon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  PlusIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import Constellation from "./Constellation.jsx";
import { cleanName, DEMO_NAMES, identity } from "./identity.js";
import { createDirector, EVENTS } from "./cinematics.js";

function savedScreenKey() {
  try {
    return sessionStorage.getItem("astra-screen-key") || "";
  } catch {
    return "";
  }
}

function Star({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 1 24.5 15.5 39 20 24.5 24.5 20 39 15.5 24.5 1 20 15.5 15.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time>
      {time.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Singapore",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}{" "}
      SGT
    </time>
  );
}

function Map({ guests }) {
  const stars = guests.slice(0, 90).map((g) => ({ ...g, ...identity(g) }));
  return (
    <svg
      viewBox="0 0 260 135"
      role="img"
      aria-label={`${guests.length} guest stars in the room's constellation`}
      className="room-map"
    >
      {[25, 65, 105].map((y) => (
        <path key={y} d={`M0 ${y}H260`} stroke="currentColor" opacity=".08" />
      ))}
      {[30, 80, 130, 180, 230].map((x) => (
        <path key={x} d={`M${x} 0V135`} stroke="currentColor" opacity=".08" />
      ))}
      {stars.slice(0, 35).map((g, i) => {
        const prev = stars[i + 1];
        return (
          prev && (
            <path
              key={`p${g.id}`}
              d={`M${g.x * 2.6} ${g.y * 1.35}L${prev.x * 2.6} ${prev.y * 1.35}`}
              stroke="currentColor"
              opacity=".16"
              strokeWidth=".6"
            />
          )
        );
      })}
      {stars.map((g, i) => (
        <g key={g.id}>
          <circle
            cx={g.x * 2.6}
            cy={g.y * 1.35}
            r={i === 0 ? 3 : 1.6}
            fill="currentColor"
            opacity={i === 0 ? 1 : 0.6}
          />
          <title>{g.name}</title>
          {i === 0 && (
            <circle
              cx={g.x * 2.6}
              cy={g.y * 1.35}
              r="7"
              stroke="currentColor"
              opacity=".4"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export default function App() {
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [sound, setSound] = useState(false);
  const [panel, setPanel] = useState(false);
  const [tab, setTab] = useState("playback");
  const [hidden, setHidden] = useState(false);
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [cinematic, setCinematic] = useState(null);
  const active = cinematic?.guest;
  const director = useRef(null);
  if (!director.current) director.current = createDirector();
  const stageRef = useRef(null);
  const [queued, setQueued] = useState(0);
  const [mode, setMode] = useState(() => (savedScreenKey() ? "live" : "demo"));
  const [connection, setConnection] = useState("");
  const [token, setToken] = useState("");
  const [displayToken, setDisplayToken] = useState(savedScreenKey);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const seen = useRef(new Set()),
    demoIndex = useRef(0),
    nextSequence = useRef(0);
  const soundRef = useRef(false),
    heardId = useRef(null),
    audioRef = useRef(null),
    triggerRef = useRef(null),
    dialogRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  soundRef.current = sound;

  const chime = useCallback((seed) => {
    if (!soundRef.current || !audioRef.current) return;
    const ctx = audioRef.current;
    const base = [220, 246.94, 261.63, 293.66][seed % 4];
    [1, 1.5, 2].forEach((ratio, i) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = base * ratio;
      const at = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.035, at + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 2.1);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 2.2);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }, []);

  const receive = useCallback((arrivals, celebrate = true) => {
    const fresh = arrivals.filter((g) => !seen.current.has(g.id));
    if (!fresh.length) return;
    fresh.forEach((g) => seen.current.add(g.id));
    setGuests((prev) => [...fresh].reverse().concat(prev).slice(0, 200));
    if (celebrate) {
      director.current.enqueue(fresh);
      setQueued(director.current.queue.length);
    }
  }, []);

  const simulate = useCallback(
    (customName) => {
      if (modeRef.current !== "demo") return;
      const index = demoIndex.current++;
      const guest = {
        id: `demo-${crypto.randomUUID()}`,
        name: cleanName(customName || DEMO_NAMES[index % DEMO_NAMES.length]),
        arrivedAt: new Date().toISOString(),
      };
      receive([guest]);
      setTotal((t) => t + 1);
    },
    [receive],
  );

  useEffect(() => {
    if (!auto || paused || mode !== "demo") return;
    let timer;
    const tick = () => {
      simulate();
      timer = setTimeout(tick, 19000);
    };
    timer = setTimeout(tick, demoIndex.current === 0 ? 7000 : 19000);
    return () => clearTimeout(timer);
  }, [auto, paused, mode, simulate]);

  useEffect(() => {
    let frame,
      previous = performance.now(),
      shownId,
      shownQueue = -1;
    const tick = (now) => {
      director.current.advance(
        Math.max(0, now - previous),
        paused || document.hidden,
      );
      previous = now;
      const current = director.current.current;
      if (current?.id !== shownId) {
        shownId = current?.id;
        setCinematic(current);
        if (current?.guest && !paused && heardId.current !== current.id) {
          heardId.current = current.id;
          chime(current.seed);
        }
      }
      if (director.current.queue.length !== shownQueue) {
        shownQueue = director.current.queue.length;
        setQueued(shownQueue);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const visibility = () => {
      previous = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused, chime]);

  const preview = useCallback((type) => {
    if (director.current.preview(type)) setCinematic(director.current.current);
  }, []);

  useEffect(() => {
    if (mode !== "live") return;
    let stopped = false,
      timer,
      controller,
      initial = true;
    const poll = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const query = initial ? "initial=1" : `after=${nextSequence.current}`;
        const res = await fetch(`/api/arrivals?${query}`, {
          headers: { Authorization: `Bearer ${displayToken}` },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok)
          throw new Error(
            res.status === 401
              ? "Screen key rejected. Reconnect in settings."
              : "Connection interrupted. Retrying…",
          );
        const data = await res.json();
        if (!Array.isArray(data.arrivals))
          throw new Error(
            "This preview has no live server. Use the local event server.",
          );
        if (stopped) return;
        receive(data.arrivals, !initial);
        initial = false;
        nextSequence.current = data.sequence;
        setTotal(data.total);
        setConnection("Connected");
      } catch (e) {
        if (!stopped)
          setConnection(
            e.name === "AbortError"
              ? "Connection timed out. Retrying…"
              : e.message,
          );
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, 1800);
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [mode, displayToken, receive]);

  const toggleSound = useCallback(async () => {
    if (!soundRef.current) {
      try {
        audioRef.current ||= new (
          window.AudioContext || window.webkitAudioContext
        )();
        await audioRef.current.resume();
        setSound(true);
      } catch {
        setNotice("Sound is unavailable in this browser.");
      }
    } else setSound(false);
  }, []);
  useEffect(
    () => () => {
      audioRef.current?.close();
    },
    [],
  );

  const fullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice("Use your browser’s fullscreen command to fill the display.");
    }
  }, []);

  const reset = useCallback(() => {
    if (mode !== "demo") return;
    director.current.reset();
    seen.current.clear();
    demoIndex.current = 0;
    setGuests([]);
    setTotal(0);
    setCinematic(null);
    setQueued(0);
  }, [mode]);

  useEffect(() => {
    const key = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "Escape") {
        setPanel(false);
        setHidden(false);
        return;
      }
      if (panel) return;
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        simulate();
      }
      if (e.key.toLowerCase() === "f") fullscreen();
      if (e.key.toLowerCase() === "h") setHidden((v) => !v);
      if (e.key.toLowerCase() === "n") preview();
      if (e.key.toLowerCase() === "m") toggleSound();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [simulate, panel, fullscreen, toggleSound, preview]);

  useEffect(() => {
    if (!panel) return;
    const before = document.activeElement;
    dialogRef.current?.querySelector("button")?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const elements = [
        ...dialogRef.current.querySelectorAll("button,input,a,select"),
      ].filter((el) => !el.disabled);
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      before?.focus();
    };
  }, [panel]);

  const connect = async (e) => {
    e.preventDefault();
    setError("");
    setConnection("Connecting…");
    try {
      const res = await fetch("/api/arrivals?initial=1", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          res.status === 401
            ? "That screen key was not accepted."
            : "Live server unavailable. Start the event server first.",
        );
      const data = await res.json();
      if (!Array.isArray(data.arrivals))
        throw new Error(
          "Live mode runs on the event server. This hosted preview is demo only.",
        );
      director.current.reset();
      seen.current.clear();
      setGuests([]);
      setCinematic(null);
      setQueued(0);
      nextSequence.current = data.sequence;
      setTotal(data.total);
      receive(data.arrivals, false);
      try {
        sessionStorage.setItem("astra-screen-key", token);
      } catch {
        /* Private browsing may disable storage. */
      }
      setDisplayToken(token);
      setToken("");
      setMode("live");
      setAuto(false);
      setConnection("Connected");
      setPanel(false);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This hosted preview is demo only. Start the event server to connect Luma."
          : e.message,
      );
      setConnection("");
    }
  };

  return (
    <main
      className={`experience ${active ? "is-arriving" : ""} ${reduced ? "reduced" : ""} ${paused ? "motion-paused" : ""}`}
    >
      <Constellation
        director={director}
        stageRef={stageRef}
        reduced={reduced}
        paused={paused}
      />
      <header className="masthead flex items-center justify-between">
        <a
          className="wordmark flex items-center gap-3"
          href="/"
          aria-label="Astra arrivals home"
        >
          <Star />
          <span>
            GPT-6 <span className="wordmark-light">Astra</span>
          </span>
        </a>
        <div className="event-label">
          SINGAPORE <span>/</span> COMMUNITY GATHERING
        </div>
        <button
          className={`status ${mode === "live" && connection !== "Connected" ? "warning" : ""}`}
          onClick={() => {
            setTab("luma");
            setPanel(true);
          }}
        >
          <i />
          {mode === "demo"
            ? "Demo experience"
            : connection === "Connected"
              ? "Luma connected"
              : "Reconnecting"}
          <ChevronRightIcon />
        </button>
      </header>

      <section
        className="stage"
        ref={stageRef}
        aria-label="Astra arrival experience"
      >
        <div className="stage-heading">
          <div className="eyebrow">A NEW GENERATION. IN GOOD COMPANY.</div>
          <h1>
            Astra<span className="title-dot">.</span>
          </h1>
        </div>
        <div className="coordinate coordinate-left">
          01°17′ N<br />
          103°51′ E
        </div>
        <div className="coordinate coordinate-right">
          {cinematic ? String(cinematic.type + 1).padStart(2, "0") : "00"} / 09
          <br />
          {cinematic?.name.toUpperCase() || "ALL ROADS LEAD TO 6"}
        </div>
        <div className="hero-bottom">
          <div className={`idle-message ${active ? "is-away" : ""}`}>
            <span className="eyebrow">EVERY ARRIVAL CHANGES THE ROOM</span>
            <h2>
              A little more human.
              <br />A little more possibility.
            </h2>
          </div>
          {active && (
            <div key={active.id} className="arrival-message" aria-live="polite">
              <div className="arrival-label">
                <Star />
                <span>THIS MOMENT IS YOURS</span>
              </div>
              <h2
                className={
                  active.name.length > 22
                    ? "long-name"
                    : active.name.length > 12
                      ? "medium-name"
                      : ""
                }
              >
                {active.name}
                <span className="name-dot">.</span>
              </h2>
              <p className="event-explanation">
                <strong>{cinematic.name}.</strong> {active.line}
              </p>
            </div>
          )}
        </div>
        <div className="cinema-caption" aria-live="polite">
          <span className={cinematic ? "cinema-dot playing" : "cinema-dot"} />
          <span>
            {cinematic ? cinematic.name : "A quiet moment in the universe"}
          </span>
          <button
            disabled={!!active}
            onClick={() => {
              setTab("cinematics");
              setPanel(true);
            }}
          >
            Explore the events <ArrowTopRightIcon />
          </button>
        </div>
      </section>

      <aside className="arrivals-panel">
        <div className="panel-top">
          <span className="eyebrow">THE ROOM, SO FAR</span>
          <div className="count-line">
            <span className="guest-count">
              {String(total).padStart(2, "0")}
            </span>
            <Star />
          </div>
          <p>
            {total === 1
              ? "one bright mind, now in orbit"
              : "bright minds, now in orbit"}
          </p>
        </div>
        <div className="feed-heading">
          <span>JUST ARRIVED</span>
          <span>{mode === "demo" ? "SIMULATED" : "LIVE"}</span>
        </div>
        <ol className="guest-list" aria-label="Recent arrivals">
          {guests.slice(0, 6).map((g, i) => (
            <li key={g.id} style={{ "--guest-hue": identity(g).hue }}>
              <span className="guest-symbol">
                <Star />
              </span>
              <div className="guest-details">
                <span>{g.name}</span>
                <small>
                  {i === 0
                    ? "A new star in the room"
                    : "Part of the constellation"}
                </small>
              </div>
              <span className="guest-number">
                {String(Math.max(1, total - i)).padStart(2, "0")}
              </span>
            </li>
          ))}
        </ol>
        {!guests.length && (
          <div className="empty-feed">
            <Star />
            <p>
              The first star
              <br />
              could be you.
            </p>
            <button onClick={() => simulate()} disabled={mode === "live"}>
              {mode === "demo" ? "Try an arrival" : "Waiting for check-ins"}
              <ArrowTopRightIcon />
            </button>
          </div>
        )}
        <div className="map-block">
          <div className="feed-heading">
            <span>OUR CONSTELLATION</span>
            <span>{queued ? `${queued} IN QUEUE` : "GROWING TOGETHER"}</span>
          </div>
          <Map guests={guests} />
          <p>Different people. Shared gravity.</p>
        </div>
      </aside>

      <footer className="bottom-bar">
        <div className="footer-left">
          <Star />
          <span>MADE OF THE PEOPLE IN THIS ROOM</span>
        </div>
        <div className="footer-right">
          <span>
            {mode === "demo" ? "FICTIONAL DEMO GUESTS" : "CHECK-IN DISPLAY"}
          </span>
          <Clock />
        </div>
      </footer>
      <div
        className={`controls ${hidden ? "controls-hidden" : ""}`}
        aria-label="Display controls"
      >
        {mode === "demo" && (
          <button className="primary-control" onClick={() => simulate()}>
            <PlusIcon />
            Simulate arrival<kbd>SPACE</kbd>
          </button>
        )}
        <button
          className="icon-button"
          onClick={() => setPaused((v) => !v)}
          aria-label={
            paused ? "Resume motion and arrivals" : "Pause motion and arrivals"
          }
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          className="icon-button"
          onClick={toggleSound}
          aria-label={sound ? "Mute arrival sound" : "Enable arrival sound"}
          title={sound ? "Mute sound · M" : "Enable sound · M"}
        >
          {sound ? <SpeakerLoudIcon /> : <SpeakerOffIcon />}
        </button>
        <button
          className="icon-button"
          onClick={fullscreen}
          aria-label="Toggle fullscreen"
          title="Fullscreen · F"
        >
          <EnterFullScreenIcon />
        </button>
        <span className="control-divider" />
        <button
          ref={triggerRef}
          className="icon-button"
          onClick={() => setPanel(true)}
          aria-label="Open display settings"
          title="Display settings"
        >
          <GearIcon />
        </button>
      </div>
      {hidden && (
        <button className="reveal-controls" onClick={() => setHidden(false)}>
          Show controls <kbd>H</kbd>
        </button>
      )}
      {notice && (
        <button className="notice" onClick={() => setNotice("")}>
          {notice} <Cross1Icon />
        </button>
      )}

      {panel && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPanel(false);
          }}
        >
          <section
            className="settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            ref={dialogRef}
          >
            <div className="settings-heading">
              <div>
                <span className="eyebrow">BEHIND THE SCENES</span>
                <h2 id="settings-title">Make it your room.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setPanel(false)}
                aria-label="Close settings"
              >
                <Cross1Icon />
              </button>
            </div>
            <div className="settings-tabs">
              {["playback", "cinematics", "luma", "about"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                >
                  {t === "luma"
                    ? "Luma connection"
                    : t === "about"
                      ? "The idea"
                      : t === "cinematics"
                        ? "Cinematics"
                        : "Playback"}
                </button>
              ))}
            </div>
            {tab === "playback" && (
              <div className="settings-content">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (name.trim()) {
                      simulate(name);
                      setName("");
                      setPanel(false);
                    }
                  }}
                >
                  <label htmlFor="guest-name">Give yourself an entrance</label>
                  <div className="input-row">
                    <input
                      id="guest-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={70}
                      placeholder="Your name"
                      disabled={mode === "live"}
                    />
                    <button
                      className="action-button"
                      disabled={mode === "live" || !name.trim()}
                    >
                      Send <ArrowTopRightIcon />
                    </button>
                  </div>
                </form>
                <div className="setting-row">
                  <div>
                    <span>Automatic demo arrivals</span>
                    <small>A fictional guest every 19 seconds</small>
                  </div>
                  <button
                    className={`switch ${auto ? "on" : ""}`}
                    role="switch"
                    aria-checked={auto}
                    aria-label="Automatic demo arrivals"
                    disabled={mode === "live"}
                    onClick={() => setAuto((v) => !v)}
                  >
                    <span />
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <span>Gentle motion</span>
                    <small>Still forms, softer name transitions</small>
                  </div>
                  <button
                    className={`switch ${reduced ? "on" : ""}`}
                    role="switch"
                    aria-checked={reduced}
                    aria-label="Gentle motion"
                    onClick={() => setReduced((v) => !v)}
                  >
                    <span />
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <span>Projector mode</span>
                    <small>Hide controls. Press H to bring them back.</small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setHidden(true);
                      setPanel(false);
                    }}
                  >
                    Enter <ArrowTopRightIcon />
                  </button>
                </div>
                <div className="shortcut-row">
                  <span>
                    <kbd>F</kbd> Fullscreen
                  </span>
                  <span>
                    <kbd>N</kbd> Random event
                  </span>
                  <span>
                    <kbd>M</kbd> Sound
                  </span>
                </div>
                <button
                  className="text-button reset-button"
                  disabled={mode === "live"}
                  onClick={reset}
                >
                  Start a fresh demo
                </button>
              </div>
            )}
            {tab === "cinematics" && (
              <div className="settings-content cinema-library">
                <p>
                  Nine cosmic events. Every one comes home to 6. A random
                  cinematic plays every 15 seconds when the room is quiet.
                </p>
                <button
                  className="random-event"
                  disabled={!!active}
                  onClick={() => {
                    preview();
                    setPanel(false);
                  }}
                >
                  Surprise me <ArrowTopRightIcon />
                </button>
                {active && (
                  <p className="library-note">
                    {active.name}'s entrance is playing. Previews are available
                    when it finishes.
                  </p>
                )}
                {EVENTS.map((event, index) => (
                  <button
                    key={event.name}
                    className="cinema-choice"
                    disabled={!!active}
                    onClick={() => {
                      preview(index);
                      setPanel(false);
                    }}
                  >
                    <span className="cinema-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{event.name}</strong>
                      <small>{event.detail}</small>
                    </span>
                    <PlayIcon />
                  </button>
                ))}
                <a
                  className="source-link"
                  href="/research.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  The real space phenomena behind the cinematics{" "}
                  <ArrowTopRightIcon />
                </a>
              </div>
            )}
            {tab === "luma" && (
              <div className="settings-content">
                <p>
                  Each Luma check-in becomes an arrival here. The host scans
                  tickets as usual.
                </p>
                <div className="connection-note">
                  <strong>
                    {mode === "live" ? connection : "Demo mode is active"}
                  </strong>
                  <span>
                    {mode === "live"
                      ? "Arrivals come from the connected event server."
                      : "The hosted preview uses fictional guests. Live check-ins need the included event server and the organizer’s Luma webhook."}
                  </span>
                </div>
                <ol className="setup-list">
                  <li>
                    Run the event server with the Luma event ID, webhook secret
                    and a private screen key.
                  </li>
                  <li>
                    In Luma, open Calendar → Settings → Developer. Add the
                    server’s <code>/api/luma/webhook</code> URL and select Guest
                    Updated.
                  </li>
                  <li>
                    Open this display on that server and enter the screen key
                    below.
                  </li>
                </ol>
                <form onSubmit={connect}>
                  <label htmlFor="screen-key">Screen key</label>
                  <div className="input-row">
                    <input
                      id="screen-key"
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="From your event server"
                    />
                    <button className="action-button" disabled={!token.trim()}>
                      Connect <ArrowTopRightIcon />
                    </button>
                  </div>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </form>
                <a
                  className="source-link"
                  href="https://help.luma.com/p/webhooks"
                  target="_blank"
                  rel="noreferrer"
                >
                  Luma setup reference <ArrowTopRightIcon />
                </a>
                {mode === "live" && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setMode("demo");
                      setDisplayToken("");
                      try {
                        sessionStorage.removeItem("astra-screen-key");
                      } catch {}
                      director.current.reset();
                      seen.current.clear();
                      setGuests([]);
                      setTotal(0);
                      setCinematic(null);
                      setQueued(0);
                      setAuto(false);
                      nextSequence.current = 0;
                    }}
                  >
                    Disconnect and return to demo
                  </button>
                )}
              </div>
            )}
            {tab === "about" && (
              <div className="settings-content">
                <p className="about-intro">
                  A room is a constellation.
                  <br />
                  Every person changes its shape.
                </p>
                <p>
                  The 6 is always home. Nine space events act on its particles,
                  then let them reform. Your name chooses the event family. Your
                  guest signature gives it a direction, timing, scale and
                  movement of its own.
                </p>
                <p>
                  The welcome lines are curated. No model calls, no generated
                  biographies, no waiting for an API to write a joke.
                </p>
                <div className="about-links">
                  <a href="/concepts.html" target="_blank" rel="noreferrer">
                    Explore the visual studies <ArrowTopRightIcon />
                  </a>
                  <a
                    href="https://openai.com/index/gpt-6-astra/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenAI launch reference <ArrowTopRightIcon />
                  </a>
                </div>
                <small className="independent-note">
                  An independent community event concept. Not an official OpenAI
                  product. “Astra” is used as a stellar theme, without claiming
                  a particular namesake star.
                </small>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
