# Astra / Arrivals

A working event display for a GPT-6 Astra community gathering. The 6 is the permanent home shape. Nine cinematic space events disturb its particles, reveal a guest name and then return the particles to the numeral. A full starfield and slow nebular background surround the scene.

The [public hosted display](https://astra-arrivals-singapore.agaminggod12345.chatgpt.site) opens without signing in and is a **demo with fictional guests**. Each visitor gets their own demo session. The included Node server connects the same display to Luma. A real organizer account and event were not available during development, so live integration was verified with signed fixtures based on Luma's published schema.

## Try the display

Requires Node 22.12+ or Node 24. Tested here with Node 24.

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:4316`. The display starts with no fictional arrivals. An ambient cinematic plays after 15 seconds, then every 15 seconds while the room is quiet. Ambient events never add names or increase the count. Optional automatic demo guests can be enabled in settings. Use settings to enter your own name, turn off automatic arrivals or reset the demo.

| Control                   | Action                                              |
| ------------------------- | --------------------------------------------------- |
| Space or Simulate arrival | Add a fictional guest                               |
| F                         | Toggle fullscreen                                   |
| H                         | Hide or reveal projector controls                   |
| N                         | Preview a random cinematic when no guest is playing |
| M                         | Enable or mute the arrival chime                    |
| Pause button              | Pause motion and the arrival queue                  |

Sound starts only after you enable it. Gentle motion respects the browser's reduced-motion preference and can also be selected in settings. On mobile, the arrival list follows the sculpture. Desktop and projector layouts keep it on the right.

## Connect the event

Luma webhooks require the organizer's Luma Plus calendar. This integration does not need a Luma API key and never checks anybody in itself. The host continues scanning tickets in Luma.

1. Copy `.env.example` to `.env` and enter the event ID and a random screen key of at least 24 characters. Generate a key using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. Build with `npm run build`. The Node server serves this build, so rebuild after changing the display.
3. Run one Node server on a host with persistent storage, or run it on the event laptop behind an HTTPS tunnel. Set `HOST=0.0.0.0` only when your hosting provider needs it. Default access is local to the laptop.
4. The server needs a public HTTPS address for Luma to reach it. In Luma, open **Calendar → Settings → Developer → Webhooks → Create**, enter `https://YOUR-SERVER/api/luma/webhook`, and select **Guest Updated**. Copy the resulting `whsec_...` secret into `.env` as `LUMA_WEBHOOK_SECRET`.
5. Run `npm start`. Open `http://127.0.0.1:4317` on the event laptop, or the HTTPS server address on a separate display. In settings, choose **Luma connection**, enter the screen key and connect.
6. Before opening the doors, scan one real test guest in Luma. Verify that the name appears once, and check Luma's webhook delivery log. This real-account rehearsal is still needed.

If using an existing Cloudflare Tunnel installation, `cloudflared tunnel --url http://127.0.0.1:4317` can provide the HTTPS address. A temporary tunnel URL can change after a restart, requiring the Luma webhook URL to be updated. A stable URL is preferable for the event. No tunnel was created during development.

The public Sites demo is static and cannot receive webhooks. Use the included Node event server for live mode. The display page needs no login; live attendee data requires the host's screen key. Never place a Luma secret in a frontend environment variable or in a URL.

## What the receiver does

- Verifies Luma's HMAC-SHA256 signature against the raw body, with a five-minute timestamp tolerance.
- Selects only `guest.updated` for the configured `data.event.id` and an approved guest with a real `data.event_tickets[].checked_in_at` timestamp.
- Ignores old check-ins beyond 15 minutes so later registration edits do not create entrances. Start the receiver before arrivals begin. Historical attendee backfill is not included.
- Welcomes each guest once per event, even if their ticket is scanned again, a registration field changes or Luma retries delivery. Multiple checked-in tickets on one guest registration still produce one entrance.
- Saves only a hashed guest identifier, display name, check-in time and sequence. No emails, profile photos, ticket QR codes or full webhook payloads are saved or sent to the screen.
- Defaults to first names. Set `DISPLAY_FULL_NAMES=true` if the organizer wants full names displayed.
- Polls for arrivals every 1.8 seconds using a screen key in the Authorization header. The screen reconnects automatically after a temporary outage.
- Keeps the live mode and screen key in session storage so reloading the same tab reconnects without replaying historical entrances. Closing the browser session can require entering the key again.
- Queues busy arrivals without shortening their cinematics. Each guest receives one complete sequence of 14.2 to 14.7 seconds. Arrivals interrupt ambient sequences, but never interrupt another guest. Names appear in the arrival list immediately.
- Arrivals received while paused wait in the queue until playback resumes.

## Hosting and data

The live backend is for **one Node process per event**. It uses an atomic JSON file, not a multi-server database. Keep the `data` directory on a persistent volume, and keep it private. It stores up to 10,000 guests. Initial screens load the latest 200 arrivals; the sculpture map shows up to 90 guest stars and the main feed shows six names.

Use a different `DATA_FILE` for a different event. A mismatched event ID causes startup to fail instead of mixing guest lists. No attendee data is in source control. There is no public reset endpoint.

Demo mode runs from locally bundled scripts and fonts and needs no OpenAI API calls. The particle sculpture is procedural Three.js graphics, not an AI-generated image. On weaker devices it reduces render resolution and particle count; without WebGL it shows a static 6.

## Motion and explanations

Each entrance names the event beneath the guest name and explains what it does in plain language. Particles have persistent velocity, receive forces at their current positions and slow through damping. The effect renderer uses the same wave fronts, beam angles, meteor positions and simulation clock as the force calculation. A restoring spring starts only after the effects have disappeared. The simulation runs at 120 steps per cinematic second, independently of display frame rate.

## Verification

`npm test` checks raw-body signatures, expiry, event filtering, real check-in timestamps, duplicate deliveries, authentication, privacy and persistence through a server restart. The cinematic director tests cover the 15-second idle deadline, complete queued entrances, guest priority, pause, repeatable name-based event selection and different signatures for same-name guests. Physics tests cover contact timing, continued drift, both kilonova shells, delayed restoration and frame-rate independence. Browser checks cover all nine events, custom names, queued arrivals, mobile layout, settings and reduced motion. The original Luma checks cover live-mode recovery.

## References

- [OpenAI's GPT-6 Astra announcement](https://openai.com/index/gpt-6-astra/). Its article was accessible; direct browser inspection of the interactive hero was blocked. The concept uses Lucas's description of the numeral and its interaction, without claiming an exact recreation.
- [Luma webhook setup and signature verification](https://help.luma.com/p/webhooks).
- [Luma Guest Updated schema](https://docs.luma.com/reference/webhook_guest_updated), including the nested `EventTicketLegacy.checked_in_at` field.
- [Visual studies A, B and C](public/concepts.html).

This is an independent community concept, not an official OpenAI event identity. The stellar theme does not claim Astra is named after a specific star.

## Cinematic library

- **Supernova**. A star swells, erupts and sends an expanding shock front through the 6. Particles move only when the wave reaches them.
- **Sixfall**. A fragmented comet becomes a procession of luminous 6s. Their trails carve separate channels through the numeral.
- **Tidal disruption**. A dark centre opens inside an accretion disc. The 6 stretches into a long stream and spirals inward before returning.
- **Kilonova**. Two bright stars orbit closer, merge and release expanding shells. The 6 ripples, disperses and gathers again.
- **Pulsar**. Twin lighthouse beams sweep through space. Each pass lifts a narrow fan of particles out of the 6.
- **Relativistic jet**. A compact source launches a narrow jet. It cuts through the 6, stretches a stream of particles downstream and leaves them to settle.
- **Einstein ring**. A passing gravitational lens bends starlight into arcs. The particles follow a warped ring, then the distortion passes.
- **Stellar winds**. A binary star blows nested, turning dust shells. They comb through the 6 and roll its particles into a spiral.
- **Butterfly nebula**. Two lobes of starlight unfold from a stellar core. The 6 opens into wing-like streams, then closes back into its original shape.

Open **Explore the events** or **Settings → Cinematics** to preview any sequence. A name determines the event family, while a seeded guest signature varies direction, source star, duration, intensity and spin. These are artistic adaptations; [research notes](public/research.html) link each one to NASA, ESA or ESO.
