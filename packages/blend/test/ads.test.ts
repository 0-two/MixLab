import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPlaylist, buildSchedule, createRng, EVERY_6, parseAdConfig, parseCatalog, PLAYLIST_BLEND,
} from '../src/index.js';

const catalog = parseCatalog(readFileSync('data/catalog.csv', 'utf8'));
const playlist = buildPlaylist(catalog, { genres: ['pop', 'rock', 'latin'] }, PLAYLIST_BLEND, createRng(1));
const adsAfter = (n: number) =>
  buildSchedule(playlist, { ...EVERY_6, ad_every_n_songs: n }).flatMap((i) => (i.kind === 'ad' ? [i.afterSong] : []));

describe('buildSchedule', () => {
  it('places an ad after every N songs, never after the last song', () => {
    expect(adsAfter(3)).toEqual([3, 6, 9, 12, 15, 18]);
    expect(adsAfter(6)).toEqual([6, 12, 18]);
    expect(adsAfter(10)).toEqual([10]);
    expect(adsAfter(20)).toEqual([]);
  });

  it('keeps every song, in order', () => {
    const songs = buildSchedule(playlist, EVERY_6).flatMap((i) => (i.kind === 'song' ? [i.track.id] : []));
    expect(songs).toEqual(playlist.map((t) => t.id));
  });

  it('numbers ads and carries the ad length', () => {
    const ads = buildSchedule(playlist, { ad_every_n_songs: 6, ad_length_seconds: 15 }).filter((i) => i.kind === 'ad');
    expect(ads).toEqual([
      { kind: 'ad', adNumber: 1, afterSong: 6, lengthSeconds: 15 },
      { kind: 'ad', adNumber: 2, afterSong: 12, lengthSeconds: 15 },
      { kind: 'ad', adNumber: 3, afterSong: 18, lengthSeconds: 15 },
    ]);
  });
});

describe('parseAdConfig', () => {
  it('parses the flag JSON', () => {
    expect(parseAdConfig('{"ad_every_n_songs":3,"ad_length_seconds":15}')).toEqual({
      config: { ad_every_n_songs: 3, ad_length_seconds: 15 }, usedFallback: false,
    });
  });

  it.each([
    ['broken JSON', '{"ad_every_n_songs":'],
    ['missing field', '{"ad_every_n_songs":3}'],
    ['zero', '{"ad_every_n_songs":0,"ad_length_seconds":15}'],
    ['not an integer', '{"ad_every_n_songs":2.5,"ad_length_seconds":15}'],
    ['flag unreachable', undefined],
    ['null', null],
  ])('falls back to every_6 on %s', (_label, value) => {
    expect(parseAdConfig(value)).toEqual({ config: EVERY_6, usedFallback: true });
  });
});
