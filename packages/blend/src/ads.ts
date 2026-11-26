import type { PlaylistTrack } from './playlist';

/** The JSON carried by the `ad_config` Flagsmith flag. */
export interface AdConfig {
  /** Play an ad after every N songs. */
  ad_every_n_songs: number;
  /** How long an ad lasts in the player (the simulator only counts ads). */
  ad_length_seconds: number;
}

/** Control variation, and the fallback when Flagsmith is unreachable or the JSON is bad. */
export const EVERY_6: AdConfig = { ad_every_n_songs: 6, ad_length_seconds: 15 };

/**
 * Turn a flag value (JSON string or object) into an AdConfig.
 * Anything missing or invalid falls back to EVERY_6, so the app never breaks.
 */
export function parseAdConfig(value: unknown): { config: AdConfig; usedFallback: boolean } {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return { config: EVERY_6, usedFallback: true };
    }
  }
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const n = r.ad_every_n_songs;
  const len = r.ad_length_seconds;
  if (
    typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 50 ||
    typeof len !== 'number' || !Number.isFinite(len) || len < 1 || len > 120
  ) {
    return { config: EVERY_6, usedFallback: true };
  }
  return { config: { ad_every_n_songs: n, ad_length_seconds: len }, usedFallback: false };
}

/**
 * The guardrail's definition, shared by the simulator and the player: a listener who
 * leaves before reaching song 10 (half the 20-song playlist) sends `session_abandoned`.
 */
export const ABANDON_BEFORE = 10;

export type ScheduleItem =
  | { kind: 'song'; track: PlaylistTrack; songNumber: number }
  | { kind: 'ad'; adNumber: number; afterSong: number; lengthSeconds: number };

/**
 * The listening session: songs with an ad after every `ad_every_n_songs` songs.
 * No ad after the last song (the session is over). Same rule for every variation.
 *   every 3 → ads after songs 3, 6, 9, 12, 15, 18 (6 ads in 20 songs)
 *   every 6 → after 6, 12, 18 (3 ads)
 *   every 10 → after 10 (1 ad)
 */
export function buildSchedule(playlist: PlaylistTrack[], config: AdConfig): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  let adNumber = 0;
  playlist.forEach((track, i) => {
    const songNumber = i + 1;
    items.push({ kind: 'song', track, songNumber });
    const isLast = songNumber === playlist.length;
    if (!isLast && songNumber % config.ad_every_n_songs === 0) {
      items.push({ kind: 'ad', adNumber: ++adNumber, afterSong: songNumber, lengthSeconds: config.ad_length_seconds });
    }
  });
  return items;
}
