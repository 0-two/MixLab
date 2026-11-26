// Everything the player needs from Flagsmith, in one place.
// The app must keep working without Flagsmith: any failure falls back to the every_6 control.
import flagsmith from '@flagsmith/flagsmith';
import { EVERY_6, parseAdConfig, type AdConfig } from '@mixlab/blend';

export const AD_FLAG = 'ad_config';
export type PlayerEvent = 'premium_clicked' | 'session_abandoned' | 'ad_shown' | 'track_saved' | 'track_skipped';

export interface Assignment {
  variant: string;
  config: AdConfig;
  /** True when the visitor is enrolled in a running experiment (an exposure was recorded). */
  inExperiment: boolean;
  /** Why we used the every_6 fallback, if we did. */
  fallbackReason?: string;
}

const KEY = process.env.NEXT_PUBLIC_FLAGSMITH_KEY;
const VISITOR_KEY = 'mixlab.visitorId';
const INIT_TIMEOUT_MS = 4000;

/** A stable ID per browser: generated once, kept in localStorage. */
export function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

let ready: Promise<boolean> | null = null;

/** Start Flagsmith once (identified, events on). Resolves false if it is missing or too slow. */
export function startFlagsmith(): Promise<boolean> {
  if (ready) return ready;
  if (!KEY) return (ready = Promise.resolve(false));
  const init = flagsmith
    .init({ environmentID: KEY, identity: visitorId(), enableEvents: true })
    .then(() => true)
    .catch(() => false);
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), INIT_TIMEOUT_MS));
  return (ready = Promise.race([init, timeout]));
}

/** Assign an ad_config variation. getExperimentFlag also records the exposure. */
export async function assignAdConfig(): Promise<Assignment> {
  const fallback = (reason: string): Assignment => ({ variant: 'fallback (every_6)', config: EVERY_6, inExperiment: false, fallbackReason: reason });
  if (!KEY) return fallback('no NEXT_PUBLIC_FLAGSMITH_KEY set');
  if (!(await startFlagsmith())) return fallback('Flagsmith unreachable');
  const flag = flagsmith.getExperimentFlag(AD_FLAG);
  if (!flag) return fallback(`flag ${AD_FLAG} not found`);
  const { config, usedFallback } = parseAdConfig(flag.value);
  return {
    variant: flag.variant ?? 'control',
    config,
    inExperiment: flag.experiment?.inExperiment === true,
    fallbackReason: usedFallback ? 'flag value was not valid JSON' : undefined,
  };
}

/** Send an event for the current visitor. Silently does nothing without Flagsmith. */
export async function track(event: PlayerEvent, { flush = false } = {}): Promise<void> {
  if (!(await startFlagsmith())) return;
  flagsmith.trackEvent(event);
  if (flush) await flagsmith.flushEvents().catch(() => {});
}
