import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPlaylist, createRng, discoverySlots, FAMILIAR_HEAVY, parseBlendConfig, parseCatalog,
  PLAYLIST_SIZE, type BlendConfig, type Listener, type PlaylistTrack,
} from '../src/index.js';

const catalog = parseCatalog(readFileSync('data/catalog.csv', 'utf8'));
const listener: Listener = { genres: ['rock', 'indie', 'folk'] };
const withRatio = (discovery_ratio: number): BlendConfig => ({ ...FAMILIAR_HEAVY, discovery_ratio });

const VARIANTS = { familiar_heavy: 0.1, balanced: 0.3, discovery_heavy: 0.5 };

function longestDiscoveryStreak(playlist: PlaylistTrack[]): number {
  let longest = 0, run = 0;
  for (const t of playlist) {
    run = t.isDiscovery ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe('buildPlaylist', () => {
  it.each(Object.entries(VARIANTS))('%s has round(20 × ratio) discovery tracks', (_name, ratio) => {
    const playlist = buildPlaylist(catalog, listener, withRatio(ratio), createRng(1));
    expect(playlist).toHaveLength(PLAYLIST_SIZE);
    expect(playlist.filter((t) => t.isDiscovery)).toHaveLength(Math.round(PLAYLIST_SIZE * ratio));
  });

  it('tags discovery tracks as exactly those outside the listener genres', () => {
    for (const t of buildPlaylist(catalog, listener, withRatio(0.5), createRng(2))) {
      expect(t.isDiscovery).toBe(!listener.genres.includes(t.genre));
    }
  });

  it('never exceeds max_unfamiliar_streak, even at high ratios', () => {
    for (const ratio of [0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      for (const max_unfamiliar_streak of [1, 2, 3]) {
        const config = { ...withRatio(ratio), max_unfamiliar_streak };
        const playlist = buildPlaylist(catalog, listener, config, createRng(3));
        expect(longestDiscoveryStreak(playlist)).toBeLessThanOrEqual(max_unfamiliar_streak);
      }
    }
  });

  it('is deterministic for the same seed and varies with a different seed', () => {
    const ids = (seed: number) => buildPlaylist(catalog, listener, withRatio(0.3), createRng(seed)).map((t) => t.id);
    expect(ids(42)).toEqual(ids(42));
    expect(ids(42)).not.toEqual(ids(43));
  });

  it('has no duplicate tracks and at most 2 tracks per artist', () => {
    const playlist = buildPlaylist(catalog, listener, withRatio(0.5), createRng(4));
    expect(new Set(playlist.map((t) => t.id)).size).toBe(PLAYLIST_SIZE);
    const perArtist = new Map<string, number>();
    for (const t of playlist) perArtist.set(t.artist, (perArtist.get(t.artist) ?? 0) + 1);
    expect(Math.max(...perArtist.values())).toBeLessThanOrEqual(2);
  });

  it('ranks familiar tracks closer to the taste than discovery tracks on average', () => {
    const playlist = buildPlaylist(catalog, listener, withRatio(0.5), createRng(5));
    const avg = (xs: PlaylistTrack[]) => xs.reduce((s, t) => s + t.similarity, 0) / xs.length;
    expect(avg(playlist.filter((t) => !t.isDiscovery))).toBeGreaterThan(avg(playlist.filter((t) => t.isDiscovery)));
  });

  it('includes every picked genre and draws discovery from a few neighbouring genres', () => {
    const playlist = buildPlaylist(catalog, listener, withRatio(0.5), createRng(7));
    const familiarGenres = new Set(playlist.filter((t) => !t.isDiscovery).map((t) => t.genre));
    const discoveryGenres = new Set(playlist.filter((t) => t.isDiscovery).map((t) => t.genre));
    expect(familiarGenres).toEqual(new Set(listener.genres));
    expect(discoveryGenres.size).toBeGreaterThan(1);
    expect(discoveryGenres.size).toBeLessThanOrEqual(3);
  });

  it('fills a discovery slot with a familiar track if every genre was picked', () => {
    const everything: Listener = { genres: [...new Set(catalog.map((t) => t.genre))] };
    const playlist = buildPlaylist(catalog, everything, withRatio(0.5), createRng(6));
    expect(playlist).toHaveLength(PLAYLIST_SIZE);
    expect(playlist.every((t) => !t.isDiscovery)).toBe(true);
  });
});

describe('discoverySlots', () => {
  it('spreads slots evenly so the first discovery track comes early', () => {
    expect([...discoverySlots(0.1, 2)]).toEqual([5, 15]);
    expect([...discoverySlots(0.3, 2)]).toEqual([1, 5, 8, 11, 15, 18]);
    expect(discoverySlots(0.5, 2).size).toBe(10);
  });
});

describe('parseBlendConfig', () => {
  it('parses the flag JSON', () => {
    const json = '{"discovery_ratio":0.30,"novelty_weight":0.6,"popularity_penalty":0.2,"max_unfamiliar_streak":2}';
    expect(parseBlendConfig(json)).toEqual({ config: withRatio(0.3), usedFallback: false });
  });

  it.each([
    ['broken JSON', '{"discovery_ratio":'],
    ['missing field', '{"discovery_ratio":0.3}'],
    ['out of range', '{"discovery_ratio":3,"novelty_weight":0.6,"popularity_penalty":0.2,"max_unfamiliar_streak":2}'],
    ['flag unreachable', undefined],
    ['null', null],
  ])('falls back to familiar_heavy on %s', (_label, value) => {
    expect(parseBlendConfig(value)).toEqual({ config: FAMILIAR_HEAVY, usedFallback: true });
  });
});
