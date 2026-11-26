// Smoke test: 50 identities resolve `ad_config` and send one event each.
// Run with: npm run smoke   (reads FLAGSMITH_ENVIRONMENT_KEY from .env)
//
// Note: getExperimentFlag only records an exposure when the identity is enrolled
// in a *running* experiment on the flag. Run this against a test environment
// with an experiment started, so the real experiments stay clean.
import { Flagsmith } from '@flagsmith/nodejs';

const FLAG = process.env.SMOKE_FLAG ?? 'ad_config';
const EVENT = process.env.SMOKE_EVENT ?? 'premium_clicked';
const COUNT = 50;

const environmentKey = process.env.FLAGSMITH_ENVIRONMENT_KEY;
if (!environmentKey) {
  console.error('Missing FLAGSMITH_ENVIRONMENT_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const flagsmith = new Flagsmith({ environmentKey, enableEvents: true });
const runId = Date.now().toString(36);
const perVariant: Record<string, number> = {};
let enrolled = 0;

for (let n = 0; n < COUNT; n++) {
  const identifier = `sim-smoke-${runId}-${n}`;
  const flag = await flagsmith.getExperimentFlag(FLAG, identifier);
  const variant = ('variant' in flag && flag.variant) || 'control';
  const inExperiment = 'experiment' in flag && flag.experiment?.inExperiment === true;
  perVariant[variant] = (perVariant[variant] ?? 0) + 1;
  if (inExperiment) enrolled++;

  flagsmith.trackEvent(EVENT, { identifier });
  if (n === 0) console.log(`first identity ${identifier}: value=${flag.value} variant=${variant} inExperiment=${inExperiment}`);
}

await flagsmith.flushEvents();
await flagsmith.close(10_000);

console.log(`\nrun ${runId}: ${COUNT} identities, ${enrolled} enrolled in an experiment`);
console.table(perVariant);
console.log(`sent ${COUNT} "${EVENT}" events. Check exposures + events in the Flagsmith dashboard.`);
