# MixLab — agent brief

Hackathon project for **Toggle Wars** (WeMakeDevs × Flagsmith). Hacking: Nov 26 8 AM IST → submissions close **Nov 29 8 PM IST** (aim to submit by 4 PM).
Submitted to **Track 01 only**: build an app and run a real A/B test with Flagsmith Experimentation. Uses **Flagsmith Cloud** (managed warehouse already connected). Simulated traffic is allowed (confirmed by organisers). Repo is public; judges must be able to run it.

**Track 01 judging:** a clear hypothesis, versions behind a flag, a metric from real events, results you can explain.
**Overall scorecard:** use of Flagsmith, impact, creativity, demo video.
AI coding is allowed, but the author must understand and be able to explain everything. Keep code small and readable.

## What MixLab is
A free, ad-supported music player that A/B tests **how often to play ads**. More ads may push listeners to buy Premium, or push them out of the app. A Flagsmith multivariate flag carries a JSON ad config straight into the player. Simulated listeners react with real SDK events; Flagsmith Experimentation picks the winner. The deployed player is the demo of what each version feels like.

(Pivoted on Nov 26 from an earlier "how many new songs per playlist" test. Its 300-listener pilot is archived in `results/_archive-discovery-pilot/` and is not part of the submission's results.)

## Hypothesis
Playing an ad **every 3 songs** instead of every 6 increases the share of listeners who click **Go Premium** by ≥25%, but increases abandonment (leaving before hearing 10 of the 20 songs). Playing an ad **every 10 songs** lowers abandonment but also lowers Premium clicks.

## Architecture
```
apps/player        Next.js player: onboarding (pick 3–5 genres), playlist of 20, ads between songs, Go Premium button
packages/blend     playlist recommender + ad schedule (pure TS; no Flagsmith or framework imports)
sim/               listener simulator CLI (Node, real Flagsmith SDK)
scripts/smoke.ts   smoke test: 50 identities → resolve flag → send one event each
data/              catalog.csv (~2,000 synthetic tracks, `npm run catalog`)
results/           per-run notes + local summaries + screenshots
.env.example       per-environment Flagsmith keys
```
TypeScript everywhere, npm workspaces. Node 20+.

## Flagsmith contract (do not rename)
- Flag **`ad_config`** — multivariate, JSON string values:
  - `every_6` (**control**): `{"ad_every_n_songs":6,"ad_length_seconds":15}`
  - `every_3`: same, `"ad_every_n_songs":3`
  - `every_10`: same, `"ad_every_n_songs":10`
  - Only `ad_every_n_songs` differs, so results have one clear cause.
- Flag **`ad_config_aa`** — for the A/A test: two variations with the **identical** `every_6` JSON. Expect no winner.
- Metrics/events:
  - `premium_clicked` — **primary**, occurrence, higher is better (listener clicked Go Premium; no real payment is taken).
  - `session_abandoned` — **guardrail**, occurrence, lower is better (left before hearing 10 songs, half the playlist). Chosen over "before 5 songs" after dry runs showed that threshold cannot see ad fatigue: only every_3 plays an ad before song 5.
  - `ad_shown`, `track_saved`, `track_skipped` — debugging only.
- Fallback config if Flagsmith is unreachable or JSON fails to parse = `every_6`. The app must never break without Flagsmith.
- The old flags `blend_config` / `blend_config_aa` and metric `discovery_saved` belong to the archived pilot. The playlist itself uses a fixed blend (`PLAYLIST_BLEND` in packages/blend), not a flag.
- Experiments are scoped per environment, and a flag can have only one active experiment. One environment per run: **Smoke** (pipeline checks), **Baseline** (main runs), **AA**, **PersonaSwap** (budget-heavy mix), **Guardrail** (twin run with `session_abandoned` as primary), **Live** (the deployed demo player; not part of the results). Metrics and the warehouse connection are per environment.
- The experiment wizard allows exactly **one** metric per experiment (verified). Report the `session_abandoned` guardrail from the simulator's local counts, or replay the same seeded run in a twin environment with it as primary.
- Free plan = one project (**MixLab**, id 56629; recreated Nov 26 after the first project went missing).

## Flagsmith gotchas (must follow)
- Events must be enabled in the SDK (`enableEvents: true`), or no exposures/conversions are recorded.
- Every listener needs a **stable identifier**. Player: UUID generated once, stored in localStorage. Simulator: deterministic IDs per run (`sim-<runId>-<n>`). Never a new ID per request.
- Assign the version with the experiment call (browser: `getExperimentFlag` / React: `useExperiment`) — this records the exposure. Send conversions with `trackEvent` using the **same identifier**.
- Node SDK (verified in 9.5.0 source): `getExperimentFlag(flag, identifier)`, `trackEvent(name, { identifier })`, `flushEvents()`, `close(timeoutMs)`. Exposures are only recorded while the identity is enrolled in a **running** experiment.
- The SDK event buffer drops the oldest event when full (default 1,000). The simulator raises `maxBuffer` and flushes every 100 listeners.
- Flag values lock once an experiment starts. Never change them after launch.
- Docs: https://docs.flagsmith.com/experimentation · https://docs.flagsmith.com/experimentation/statistics

## Playlist + ads (packages/blend)
- Playlist recommender (unchanged from the pilot): taste centroid of picked genres, cosine similarity, familiar genres take turns, a few "new for you" tracks from neighbouring genres. Uses the fixed `PLAYLIST_BLEND` config. Pure, seeded, deterministic, tested.
- `parseAdConfig(value)` → `AdConfig` with `every_6` fallback.
- `buildSchedule(playlist, adConfig)` → the session as a list of `song` and `ad` items: an ad after every `ad_every_n_songs` songs, never after the last song. Same placement rule for every variation.

## Listener simulator (sim/)
- Personas from `sim/personas/*.yaml`: name, share %, `willingness_to_pay` (0–1), `ad_tolerance` (0–1), `patience`, `base_save`, `base_skip`.
  Default `baseline.yaml`: fans 20%, casual 50%, budget 30%. `budget-heavy.yaml` (budget 60%) for the persona-swap run.
- Each listener: stable ID → resolve `ad_config` → playlist + schedule → go through it item by item:
  - songs: save/skip from taste match; liked songs lower annoyance a little;
  - ads: add annoyance (more for low `ad_tolerance`); at each ad the listener may click Go Premium (more likely with higher `willingness_to_pay` and higher annoyance) → `premium_clicked` once;
  - annoyance > patience → leave; fewer than 10 songs heard → `session_abandoned`.
- CLI: `npm run sim -- --env baseline --listeners 1000 --personas sim/personas/baseline.yaml --seed 42 --run baseline-w1`; `--dry-run` assigns variations locally without Flagsmith.
- Rate-limited, retries, flushes before exit, prints a summary and writes `results/<run>/local-summary.json`.
- Never hard-code a winner: effects must come only from the listener model. Don't tune persona values to get a desired result.

## Player (apps/player)
- Onboarding: pick 3–5 genres → playlist of 20 → ads between songs per the assigned `ad_config`.
- Ad break: a short countdown card with a **Go Premium** button. Go Premium is also always visible in the header.
- Same events as the simulator. Small debug panel (toggle) showing visitor ID and assigned variation, for the demo video.
- Deploy on Vercel against the **Live** environment (client-side key).
- Built (Nov 26): `npm run player` (dev). SDK is `@flagsmith/flagsmith` ≥12.4 (the old `flagsmith` package has no experiment API): `init({ environmentID, identity, enableEvents: true })`, `getExperimentFlag('ad_config')` at playlist start (records exposure), `trackEvent(name)`, `flushEvents()`. Key in `apps/player/.env.local` as `NEXT_PUBLIC_FLAGSMITH_KEY` (client-side key = environment ID, public by design).
- Look: familiar streaming-app layout (sidebar, playlist page, bottom now-playing bar) under our own MixLab brand. Never copy Spotify/YouTube Music branding, logos or exact screens.
- Music: 48 real 30 s excerpts of **CC BY 4.0** tracks by Kevin MacLeod (incompetech.com), 4 per genre, listed in `data/music.json`, cut by `npm run music` (ffmpeg; the server is ~3 KB/s per connection, so the script range-requests only the excerpt) into `apps/player/public/music/` (committed, with `tracks.json`). The recommender still picks each slot's genre; `src/music.ts` gives every slot an unused real clip of that genre. A Music credits page lists every track (attribution is a license requirement). NCS music is NOT allowed (their terms forbid music players without a licence).
- Ads are a generated jingle (`src/sound.ts`) for `ad_length_seconds`, can't be skipped. `?debug` opens the debug panel, `?fast` makes songs/ads 3 s (testing only — never against Live).
- `session_abandoned`: the SDK has no sendBeacon, so a started session is marked in localStorage until song 10; on `pagehide` or "New playlist" the event is sent, and an unfinished marker is re-sent on the next visit (occurrence metric, so duplicates are harmless).
- `packages/blend` uses extensionless relative imports (Turbopack can't map `./x.js` → `.ts`). `ABANDON_BEFORE` lives in blend and is shared by sim and player.

## Traffic: simulated listeners only (decided Nov 26)
The author chose not to recruit real users. All results come from simulated listeners (allowed by the organisers). The player is deployed on Vercel against **Live** as a demo for judges; any stray Live visits are not reported as results. Say this plainly in the README and video.

## Build order (small, verifiable steps)
1. ✅ Flagsmith project, environments, warehouse. ✅ Smoke test (pipeline verified with 50 identities).
2. ✅ Catalog + playlist recommender + tests.
3. ✅ Ad config + schedule + tests. Listener model for ads + tests. Dry runs.
4. ✅ Flagsmith: `ad_config`, `ad_config_aa`, metrics; Baseline experiment (id 686) → waves of 300 and 1,000.
5. ✅ Player UI (real CC BY music) → deployed on Vercel against **Live** (demo only).
6. ✅ Wave of 3,000 (Baseline 686) → A/A (705) → persona swap (706) → guardrail twin (Guardrail 710). Recorded in `results/`. 7a. ✅ README with screenshots; fresh-clone test passes.
7. README + fresh-clone test → demo video. 8. Ship winner (end experiment, serve winning value to everyone).

## Demo video (~3 min)
Problem (ads vs Premium) → hypothesis slide → app with debug panel showing the assigned version → Flagsmith flag + experiment → simulator sending real events → results (win probability, lift, credible interval, guardrail, A/A) → decision + ship. Be plain that all traffic is simulated.

## README must include
What & why (GIF) · hypothesis · how the flag drives the ad schedule · setup (clone → `npm install` → `.env` → `npm run sim`) · Flagsmith dashboard steps with screenshots · how the listener model works · results per run with screenshots and plain-English explanation (win probability, lift, credible interval) · what we shipped and why · limitations (all listeners simulated; the listener model's assumptions drive the effect sizes) · "Built with Claude Code + Flagsmith MCP" · MIT license.

## Rules
- No secrets in the repo; everything via `.env`. Commit `.env.example` only.
- Every feature must work from a fresh clone following the README.
- Small commits with clear messages. Prefer boring code over clever code.
- Don't claim any real company tuned its ad load with Flagsmith. Safe framing: ad-supported streaming services publicly discuss the trade-off between ad load, retention and upgrades.
