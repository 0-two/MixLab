import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENRES, parseCatalog } from '../src/index.js';

const HEADER = 'id,title,artist,genre,energy,valence,tempo,popularity';

describe('parseCatalog', () => {
  it('parses a valid row into numbers', () => {
    const [track] = parseCatalog(`${HEADER}\nt0001,Run Tonight,Silver Rivers,pop,0.7,0.65,120,42\n`);
    expect(track).toEqual({
      id: 't0001', title: 'Run Tonight', artist: 'Silver Rivers', genre: 'pop',
      energy: 0.7, valence: 0.65, tempo: 120, popularity: 42,
    });
  });

  it('rejects bad rows with the line number', () => {
    expect(() => parseCatalog(`${HEADER}\nt1,A,B,polka,0.5,0.5,100,10`)).toThrow(/line 2: unknown genre/);
    expect(() => parseCatalog(`${HEADER}\nt1,A,B,pop,1.5,0.5,100,10`)).toThrow(/line 2: energy/);
    expect(() => parseCatalog(`${HEADER}\nt1,A,B,pop,0.5,0.5,100`)).toThrow(/line 2: expected 8 columns/);
    expect(() => parseCatalog(`${HEADER}\nt1,A,B,pop,0.5,0.5,100,10\nt1,C,D,pop,0.5,0.5,100,10`)).toThrow(/duplicate id/);
    expect(() => parseCatalog('wrong,header\n')).toThrow(/expected header/);
  });

  it('loads the committed data/catalog.csv', () => {
    const tracks = parseCatalog(readFileSync('data/catalog.csv', 'utf8'));
    expect(tracks.length).toBeGreaterThan(1500);
    expect(new Set(tracks.map((t) => t.genre)).size).toBe(GENRES.length);
  });
});
