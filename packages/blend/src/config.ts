/** The JSON carried by the `blend_config` Flagsmith flag. */
export interface BlendConfig {
  /** Share of the playlist that is discovery (new-for-you) tracks, 0–1. */
  discovery_ratio: number;
  /** How much a discovery track must still sound like the listener's taste, 0–1. */
  novelty_weight: number;
  /** How strongly popular tracks are pushed down in the discovery pool, 0–1. */
  popularity_penalty: number;
  /** Never more than this many discovery tracks in a row. */
  max_unfamiliar_streak: number;
}

/** Control variation, and the fallback when Flagsmith is unreachable or the JSON is bad. */
export const FAMILIAR_HEAVY: BlendConfig = {
  discovery_ratio: 0.1,
  novelty_weight: 0.6,
  popularity_penalty: 0.2,
  max_unfamiliar_streak: 2,
};

/**
 * Turn a flag value (JSON string or object) into a BlendConfig.
 * Anything missing or invalid falls back to FAMILIAR_HEAVY, so the app never breaks.
 */
export function parseBlendConfig(value: unknown): { config: BlendConfig; usedFallback: boolean } {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return { config: FAMILIAR_HEAVY, usedFallback: true };
    }
  }
  if (typeof raw !== 'object' || raw === null) return { config: FAMILIAR_HEAVY, usedFallback: true };

  const r = raw as Record<string, unknown>;
  const inRange = (x: unknown, min: number, max: number): x is number =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

  if (
    !inRange(r.discovery_ratio, 0, 1) ||
    !inRange(r.novelty_weight, 0, 1) ||
    !inRange(r.popularity_penalty, 0, 1) ||
    !inRange(r.max_unfamiliar_streak, 1, 20) ||
    !Number.isInteger(r.max_unfamiliar_streak)
  ) {
    return { config: FAMILIAR_HEAVY, usedFallback: true };
  }

  return {
    config: {
      discovery_ratio: r.discovery_ratio,
      novelty_weight: r.novelty_weight,
      popularity_penalty: r.popularity_penalty,
      max_unfamiliar_streak: r.max_unfamiliar_streak,
    },
    usedFallback: false,
  };
}

/**
 * The fixed playlist blend used by the ad-frequency experiment. The playlist is the same
 * kind of mix for every listener and every variation; only the ad schedule changes.
 */
export const PLAYLIST_BLEND: BlendConfig = { ...FAMILIAR_HEAVY, discovery_ratio: 0.2 };
