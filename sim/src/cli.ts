// Listener simulator.
//
//   npm run sim -- --env baseline --listeners 300 --personas sim/personas/baseline.yaml --seed 42 --run baseline-w1
//   npm run sim -- --dry-run --listeners 300        (no Flagsmith: variations assigned locally)
//
// Each simulated listener gets a stable ID, is assigned a variation of `ad_config` by Flagsmith
// (which records the exposure), gets a playlist with ads every N songs, goes through it item by
// item, and sends real `premium_clicked` / `session_abandoned` events with the same ID.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Flagsmith } from '@flagsmith/nodejs';
import {
  buildPlaylist, buildSchedule, createRng, EVERY_6, GENRES, hashSeed, parseAdConfig, parseCatalog,
  PLAYLIST_BLEND, type Genre, type Rng,
} from '@mixlab/blend';
import { simulateSession, type Persona, type SimEvent, type SessionResult } from './listener.js';
import { loadPersonas, pickPersona } from './personas.js';

const { values: args } = parseArgs({
  options: {
    listeners: { type: 'string', default: '300' },
    personas: { type: 'string', default: 'sim/personas/baseline.yaml' },
    flag: { type: 'string', default: 'ad_config' },
    seed: { type: 'string', default: '42' },
    run: { type: 'string' },
    env: { type: 'string' },
    concurrency: { type: 'string', default: '8' },
    'dry-run': { type: 'boolean', default: false },
    'debug-events': { type: 'boolean', default: false }, // also send ad_shown / track_saved / track_skipped
  },
});

const LISTENERS = Number(args.listeners);
const SEED = Number(args.seed);
const CONCURRENCY = Number(args.concurrency);
const RUN_ID = args.run ?? `run${Date.now().toString(36)}`;
const DRY_RUN = args['dry-run'];
/** Wait for events to be sent after this many listeners, so the SDK buffer never overflows. */
const FLUSH_EVERY = 100;

if (existsSync('.env')) process.loadEnvFile('.env');

// --- Flagsmith (or a local stand-in for --dry-run) -------------------------------------------

interface Assignment {
  variant: string;
  value: unknown;
  inExperiment: boolean;
}

interface FlagClient {
  assign(identifier: string): Promise<Assignment>;
  track(event: SimEvent, identifier: string): void;
  flush(): Promise<void>;
  close(): Promise<void>;
}

function realClient(): FlagClient {
  const keyVar = args.env ? `FLAGSMITH_KEY_${args.env.toUpperCase()}` : 'FLAGSMITH_ENVIRONMENT_KEY';
  const environmentKey = process.env[keyVar];
  if (!environmentKey) {
    console.error(`Missing ${keyVar} in .env (see .env.example), or use --dry-run.`);
    process.exit(1);
  }
  const flagsmith = new Flagsmith({
    environmentKey,
    enableEvents: true,
    eventProcessorConfig: { maxBuffer: 10_000 },
  });
  return {
    async assign(identifier) {
      // getExperimentFlag assigns the variation and records the exposure.
      const flag = await withRetry(() => flagsmith.getExperimentFlag(args.flag!, identifier));
      return {
        variant: ('variant' in flag && flag.variant) || 'control',
        value: flag.value,
        inExperiment: 'experiment' in flag && flag.experiment?.inExperiment === true,
      };
    },
    track: (event, identifier) => flagsmith.trackEvent(event, { identifier }),
    flush: () => flagsmith.flushEvents(),
    close: () => flagsmith.close(30_000),
  };
}

/** Same three configs as the flag, assigned by hashing the ID. For trying the model offline. */
function dryRunClient(): FlagClient {
  const variants: [string, number][] = [['control', 6], ['every_3', 3], ['every_10', 10]];
  return {
    async assign(identifier) {
      const [variant, ad_every_n_songs] = variants[hashSeed(identifier) % variants.length];
      return { variant, value: JSON.stringify({ ...EVERY_6, ad_every_n_songs }), inExperiment: true };
    },
    track: () => {},
    flush: async () => {},
    close: async () => {},
  };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

// --- One listener -----------------------------------------------------------------------------

interface ListenerRecord {
  id: string;
  persona: string;
  variant: string;
  inExperiment: boolean;
  usedFallback: boolean;
  session: SessionResult;
}

const catalog = parseCatalog(readFileSync('data/catalog.csv', 'utf8'));
const personas = loadPersonas(args.personas!);
const client = DRY_RUN ? dryRunClient() : realClient();

/** Pick 3–5 distinct genres for a listener's onboarding. */
function pickGenres(rng: Rng): Genre[] {
  const pool = [...GENRES];
  const count = 3 + Math.floor(rng() * 3);
  const picked: Genre[] = [];
  while (picked.length < count) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return picked;
}

async function simulateListener(n: number): Promise<ListenerRecord> {
  const id = `sim-${RUN_ID}-${n}`;
  // Each listener has its own RNG seeded from (seed, id): results don't depend on timing.
  const rng = createRng(hashSeed(`${SEED}:${id}`));
  const persona: Persona = pickPersona(personas, rng);
  const genres = pickGenres(rng);

  const assignment = await client.assign(id);
  const { config, usedFallback } = parseAdConfig(assignment.value);
  const playlist = buildPlaylist(catalog, { genres }, PLAYLIST_BLEND, rng);
  const session = simulateSession(buildSchedule(playlist, config), persona, rng);

  for (const event of session.events) {
    const isDebug = event !== 'premium_clicked' && event !== 'session_abandoned';
    if (!isDebug || args['debug-events']) client.track(event, id);
  }
  return { id, persona: persona.name, variant: assignment.variant, inExperiment: assignment.inExperiment, usedFallback, session };
}

// --- Run --------------------------------------------------------------------------------------

async function main() {
  console.log(`${DRY_RUN ? 'DRY RUN' : `env=${args.env ?? 'default'}`} run=${RUN_ID} flag=${args.flag} listeners=${LISTENERS} personas=${args.personas} seed=${SEED}`);
  const started = Date.now();
  const records: ListenerRecord[] = [];
  let failed = 0;

  for (let batchStart = 0; batchStart < LISTENERS; batchStart += FLUSH_EVERY) {
    const batchEnd = Math.min(batchStart + FLUSH_EVERY, LISTENERS);
    let next = batchStart;
    // A small pool of workers keeps at most CONCURRENCY requests in flight (rate limiting).
    const worker = async () => {
      while (next < batchEnd) {
        const n = next++;
        try {
          records.push(await simulateListener(n));
        } catch (err) {
          failed++;
          console.error(`listener ${n} failed: ${(err as Error).message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await client.flush();
    process.stdout.write(`\r${batchEnd}/${LISTENERS} listeners`);
  }
  await client.close();
  console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s, ${failed} failed)\n`);

  printSummary(records);
  saveSummary(records, failed);
}

function printSummary(records: ListenerRecord[]) {
  const variants = [...new Set(records.map((r) => r.variant))].sort();
  const pct = (n: number, d: number) => (d ? `${n} (${((100 * n) / d).toFixed(1)}%)` : '-');

  console.table(Object.fromEntries(variants.map((v) => {
    const rs = records.filter((r) => r.variant === v);
    return [v, {
      listeners: rs.length,
      premium_clicked: pct(rs.filter((r) => r.session.premiumClicked).length, rs.length),
      session_abandoned: pct(rs.filter((r) => r.session.abandoned).length, rs.length),
      'avg songs heard': +(rs.reduce((s, r) => s + r.session.heard, 0) / rs.length).toFixed(1),
      'avg ads seen': +(rs.reduce((s, r) => s + r.session.adsSeen, 0) / rs.length).toFixed(1),
    }];
  })));

  if (personas.length > 1) {
    console.log('premium_clicked / session_abandoned by persona:');
    console.table(Object.fromEntries(personas.map((p) => [p.name, Object.fromEntries(variants.map((v) => {
      const rs = records.filter((r) => r.variant === v && r.persona === p.name);
      const rate = (k: 'premiumClicked' | 'abandoned') => rs.length ? `${((100 * rs.filter((r) => r.session[k]).length) / rs.length).toFixed(0)}%` : '-';
      return [v, `${rate('premiumClicked')} / ${rate('abandoned')} (n=${rs.length})`];
    }))])));
  }

  const notEnrolled = records.filter((r) => !r.inExperiment).length;
  const fallbacks = records.filter((r) => r.usedFallback).length;
  if (notEnrolled) console.warn(`WARNING: ${notEnrolled} listeners were not enrolled in a running experiment (no exposure recorded).`);
  if (fallbacks) console.warn(`WARNING: ${fallbacks} listeners got an unparseable flag value and used the every_6 fallback.`);
}

function saveSummary(records: ListenerRecord[], failed: number) {
  if (DRY_RUN) return;
  const dir = `results/${RUN_ID}`;
  mkdirSync(dir, { recursive: true });
  const summary = {
    run: RUN_ID, env: args.env, flag: args.flag, personas: args.personas, seed: SEED,
    listeners: LISTENERS, failed, finishedAt: new Date().toISOString(),
    byVariant: Object.fromEntries([...new Set(records.map((r) => r.variant))].sort().map((v) => {
      const rs = records.filter((r) => r.variant === v);
      return [v, {
        listeners: rs.length,
        premium_clicked: rs.filter((r) => r.session.premiumClicked).length,
        session_abandoned: rs.filter((r) => r.session.abandoned).length,
      }];
    })),
  };
  writeFileSync(`${dir}/local-summary.json`, JSON.stringify(summary, null, 2) + '\n');
  console.log(`saved ${dir}/local-summary.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
