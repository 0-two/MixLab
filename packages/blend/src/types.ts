export const GENRES = [
  'pop', 'rock', 'hip-hop', 'electronic', 'r&b', 'indie',
  'folk', 'jazz', 'classical', 'metal', 'latin', 'ambient',
] as const;

export type Genre = (typeof GENRES)[number];

/** One row of data/catalog.csv. */
export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  /** 0–1, how intense/loud the track feels. */
  energy: number;
  /** 0–1, how positive/happy the track feels. */
  valence: number;
  /** Beats per minute (raw; the recommender normalises it). */
  tempo: number;
  /** 0–100, how well known the track is. */
  popularity: number;
}

/** A random number generator returning floats in [0, 1). */
export type Rng = () => number;
