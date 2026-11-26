import type { BlendConfig } from './config';
import { buildTaste, similarity, soundSimilarity, type Listener } from './taste';
import type { Genre, Rng, Track } from './types';

export const PLAYLIST_SIZE = 20;

/** Small random nudge added to scores so two listeners with the same genres get different playlists. */
const JITTER = 0.03;

export interface PlaylistTrack extends Track {
  /** True if the track is from a genre the listener did not pick ("New for you"). */
  isDiscovery: boolean;
  /** Similarity to the listener's taste, 0–1 (genre + sound). */
  similarity: number;
}

/**
 * Build a playlist of 20 for one listener.
 *
 * - Familiar pool: tracks in the listener's genres, best taste match first,
 *   taking turns between the picked genres.
 * - Discovery pool: tracks from the 3 other genres that sound closest to the taste,
 *   taking turns between them, ranked by
 *     novelty_weight × (sounds like your taste) − popularity_penalty × (popularity),
 *   i.e. "new genres that still sound like you, nudged toward lesser-known tracks".
 * - round(20 × discovery_ratio) discovery tracks, spread evenly through the playlist,
 *   never more than max_unfamiliar_streak in a row.
 *
 * Pure and deterministic: the same inputs and RNG seed always give the same playlist.
 */
export function buildPlaylist(
  catalog: readonly Track[],
  listener: Listener,
  config: BlendConfig,
  rng: Rng,
): PlaylistTrack[] {
  const taste = buildTaste(catalog, listener);

  // Score every track into a per-genre list.
  const byGenre = new Map<string, Scored[]>();
  const genreSound = new Map<string, number>(); // avg sound similarity of each genre to the taste
  for (const track of catalog) {
    const sim = similarity(catalog, taste, track);
    const sound = soundSimilarity(catalog, taste, track);
    const score = taste.genres.has(track.genre)
      ? sim
      : config.novelty_weight * sound - config.popularity_penalty * (track.popularity / 100);
    if (!byGenre.has(track.genre)) byGenre.set(track.genre, []);
    byGenre.get(track.genre)!.push({ track, sim, score: score + rng() * JITTER });
    genreSound.set(track.genre, (genreSound.get(track.genre) ?? 0) + sound);
  }
  for (const list of byGenre.values()) list.sort(byScoreDesc);

  // Familiar: the listener's own genres, taking turns so each picked genre shows up.
  const familiar = new Rotation(listener.genres.map((g) => byGenre.get(g) ?? []));
  // Discovery: the ADJACENT_GENRES other genres that sound most like the taste, taking turns.
  const adjacent = [...byGenre.keys()]
    .filter((g) => !taste.genres.has(g as Genre))
    .sort((a, b) => genreSound.get(b)! / byGenre.get(b)!.length - genreSound.get(a)! / byGenre.get(a)!.length)
    .slice(0, ADJACENT_GENRES);
  const discovery = new Rotation(adjacent.map((g) => byGenre.get(g)!));

  const slots = discoverySlots(config.discovery_ratio, config.max_unfamiliar_streak, discovery.size);
  const playlist: PlaylistTrack[] = [];
  const usedArtists = new Map<string, number>();
  for (let i = 0; i < PLAYLIST_SIZE; i++) {
    const pool = slots.has(i) ? discovery : familiar;
    const pick = pool.take(usedArtists) ?? familiar.take(usedArtists)!;
    playlist.push({ ...pick.track, isDiscovery: !taste.genres.has(pick.track.genre), similarity: round3(pick.sim) });
  }
  return playlist;
}

/** Discovery tracks come from this many neighbouring genres. */
const ADJACENT_GENRES = 3;

/** Several ranked lists that we draw from in turn (list 1, list 2, list 3, list 1, ...). */
class Rotation {
  private next = 0;
  constructor(private readonly lists: Scored[][]) {}

  get size(): number {
    return this.lists.reduce((n, l) => n + l.length, 0);
  }

  /** Best remaining track from the next list in turn; skips lists that have nothing usable. */
  take(usedArtists: Map<string, number>): Scored | undefined {
    for (let tries = 0; tries < this.lists.length; tries++) {
      const list = this.lists[this.next];
      this.next = (this.next + 1) % this.lists.length;
      const pick = takeNext(list, usedArtists);
      if (pick) return pick;
    }
    return undefined;
  }
}

interface Scored {
  track: Track;
  sim: number;
  score: number;
}

const byScoreDesc = (a: Scored, b: Scored) => b.score - a.score || a.track.id.localeCompare(b.track.id);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** At most 2 tracks per artist, so one artist can't fill the playlist. */
const MAX_PER_ARTIST = 2;

/** Remove and return the best remaining track whose artist isn't used up yet. */
function takeNext(pool: Scored[], usedArtists: Map<string, number>): Scored | undefined {
  const index = pool.findIndex((s) => (usedArtists.get(s.track.artist) ?? 0) < MAX_PER_ARTIST);
  if (index === -1) return undefined;
  const [pick] = pool.splice(index, 1);
  usedArtists.set(pick.track.artist, (usedArtists.get(pick.track.artist) ?? 0) + 1);
  return pick;
}

/**
 * Which positions (0–19) hold discovery tracks. Spread evenly: for 2 tracks that's
 * positions 5 and 15, for 6 it's 1, 5, 8, 11, 15, 18. Even spacing keeps the rule the
 * same for every variation, so only the *amount* of discovery differs.
 */
export function discoverySlots(ratio: number, maxStreak: number, available = Infinity): Set<number> {
  // With a streak limit of s, at most s of every s+1 slots can be discovery.
  const feasible = Math.floor((PLAYLIST_SIZE * maxStreak) / (maxStreak + 1));
  const count = Math.min(Math.round(PLAYLIST_SIZE * ratio), feasible, available);
  const slots = new Set<number>();
  for (let i = 0; i < count; i++) slots.add(Math.floor(((i + 0.5) * PLAYLIST_SIZE) / count));
  return slots;
}
