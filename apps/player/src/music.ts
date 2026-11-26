// Real audio for the player: 48 thirty-second excerpts of CC BY 4.0 tracks by Kevin MacLeod
// (incompetech.com), 4 per genre, cut by scripts/fetch-music.ts from data/music.json.
//
// The recommender (packages/blend, same as the simulator) still decides the playlist: which
// genre each of the 20 slots gets, and which slots are "new for you". Each slot then plays a
// real clip of that genre, never repeating one within a session.
import type { Genre, PlaylistTrack, Rng } from '@mixlab/blend';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: Genre;
  bpm: number | null;
  /** URL of the clip, e.g. /music/galway.mp3 */
  file: string;
}

export interface MusicLibrary {
  license: string;
  licenseUrl: string;
  changes: string;
  clipSeconds: number;
  tracks: MusicTrack[];
}

/** A playlist slot with the real clip that plays in it. */
export interface Song {
  slot: PlaylistTrack;
  music: MusicTrack;
}

export async function loadLibrary(): Promise<MusicLibrary> {
  const res = await fetch('/music/tracks.json');
  return res.json();
}

/** Pick a real clip for every slot: same genre if one is left, else another picked genre, else anything unused. */
export function assignClips(playlist: PlaylistTrack[], library: MusicLibrary, picked: Genre[], rng: Rng): Song[] {
  const unused = shuffle(library.tracks, rng);
  const take = (ok: (t: MusicTrack) => boolean) => {
    const i = unused.findIndex(ok);
    return i >= 0 ? unused.splice(i, 1)[0] : undefined;
  };
  return playlist.map((slot) => ({
    slot,
    music:
      take((t) => t.genre === slot.genre) ??
      take((t) => picked.includes(t.genre)) ??
      take(() => true) ??
      library.tracks[0],
  }));
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
