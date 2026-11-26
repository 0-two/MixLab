import { GENRES, type Genre, type Track } from './types';

/** What we know about a listener: the 3–5 genres picked at onboarding. */
export interface Listener {
  genres: Genre[];
}

/** How much genre counts next to the sound features (energy, valence, tempo). */
const GENRE_WEIGHT = 0.5;

interface CatalogStats {
  mean: [number, number, number]; // energy, valence, normalised tempo
  tempoMin: number;
  tempoMax: number;
}

// Stats are computed once per catalog array and reused.
const statsCache = new WeakMap<readonly Track[], CatalogStats>();

function catalogStats(catalog: readonly Track[]): CatalogStats {
  const cached = statsCache.get(catalog);
  if (cached) return cached;

  let tempoMin = Infinity;
  let tempoMax = -Infinity;
  for (const t of catalog) {
    tempoMin = Math.min(tempoMin, t.tempo);
    tempoMax = Math.max(tempoMax, t.tempo);
  }
  const mean: [number, number, number] = [0, 0, 0];
  for (const t of catalog) {
    mean[0] += t.energy / catalog.length;
    mean[1] += t.valence / catalog.length;
    mean[2] += (t.tempo - tempoMin) / (tempoMax - tempoMin) / catalog.length;
  }
  const stats = { mean, tempoMin, tempoMax };
  statsCache.set(catalog, stats);
  return stats;
}

/**
 * Sound features (energy, valence, min-max tempo), centred on the catalog average.
 * Centring matters: all raw features are positive, so without it every pair of
 * tracks would look similar under cosine similarity.
 */
function soundVector(track: Track, stats: CatalogStats): number[] {
  const tempo = (track.tempo - stats.tempoMin) / (stats.tempoMax - stats.tempoMin);
  return [track.energy - stats.mean[0], track.valence - stats.mean[1], tempo - stats.mean[2]];
}

/** Sound features plus a weighted one-hot genre. */
function fullVector(track: Track, stats: CatalogStats): number[] {
  const genre = GENRES.map((g) => (g === track.genre ? GENRE_WEIGHT : 0));
  return [...soundVector(track, stats), ...genre];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

function centroid(vectors: number[][]): number[] {
  const out = new Array(vectors[0].length).fill(0);
  for (const v of vectors) v.forEach((x, i) => (out[i] += x / vectors.length));
  return out;
}

/** The listener's taste: centroid of every track in their chosen genres. */
export interface Taste {
  full: number[];
  sound: number[];
  genres: ReadonlySet<Genre>;
}

export function buildTaste(catalog: readonly Track[], listener: Listener): Taste {
  if (listener.genres.length === 0) throw new Error('listener must pick at least one genre');
  const stats = catalogStats(catalog);
  const genres = new Set(listener.genres);
  const seeds = catalog.filter((t) => genres.has(t.genre));
  if (seeds.length === 0) throw new Error(`no tracks in genres ${listener.genres.join(', ')}`);
  return {
    full: centroid(seeds.map((t) => fullVector(t, stats))),
    sound: centroid(seeds.map((t) => soundVector(t, stats))),
    genres,
  };
}

/** Similarity of a track to the listener's taste (genre + sound), mapped to 0–1. */
export function similarity(catalog: readonly Track[], taste: Taste, track: Track): number {
  return (cosine(fullVector(track, catalogStats(catalog)), taste.full) + 1) / 2;
}

/** Similarity on sound only (ignores genre), mapped to 0–1. Used to rank discovery tracks. */
export function soundSimilarity(catalog: readonly Track[], taste: Taste, track: Track): number {
  return (cosine(soundVector(track, catalogStats(catalog)), taste.sound) + 1) / 2;
}
