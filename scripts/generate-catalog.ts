// Generates data/catalog.csv: ~2,000 synthetic tracks with made-up titles and artists.
// Synthetic on purpose: no licensing issues in a public repo, and the same seed
// always gives the same catalog, so every run and every judge sees identical data.
//
// Run with: npm run catalog
import { writeFileSync } from 'node:fs';
import { createRng, GENRES, type Genre, type Rng } from '@mixlab/blend';

const SEED = 2026;
const ARTISTS_PER_GENRE = 18;
const TRACKS_PER_ARTIST = [6, 12] as const; // min, max → ~2,000 tracks total

// Typical sound of each genre: mean energy/valence (0–1) and a BPM range.
const PROFILE: Record<Genre, { energy: number; valence: number; bpm: [number, number] }> = {
  pop:        { energy: 0.70, valence: 0.70, bpm: [95, 130] },
  rock:       { energy: 0.80, valence: 0.50, bpm: [100, 150] },
  'hip-hop':  { energy: 0.65, valence: 0.55, bpm: [80, 105] },
  electronic: { energy: 0.85, valence: 0.55, bpm: [118, 140] },
  'r&b':      { energy: 0.50, valence: 0.60, bpm: [70, 100] },
  indie:      { energy: 0.55, valence: 0.45, bpm: [90, 135] },
  folk:       { energy: 0.35, valence: 0.50, bpm: [80, 120] },
  jazz:       { energy: 0.40, valence: 0.55, bpm: [70, 160] },
  classical:  { energy: 0.20, valence: 0.35, bpm: [60, 120] },
  metal:      { energy: 0.95, valence: 0.25, bpm: [120, 180] },
  latin:      { energy: 0.75, valence: 0.80, bpm: [90, 115] },
  ambient:    { energy: 0.15, valence: 0.40, bpm: [60, 90] },
};

const ADJECTIVES = ['Silver', 'Midnight', 'Golden', 'Paper', 'Electric', 'Quiet', 'Neon', 'Velvet',
  'Broken', 'Hollow', 'Crimson', 'Lucky', 'Distant', 'Wild', 'Static', 'Gentle', 'Frozen', 'Burning',
  'Lonely', 'Sunday', 'Northern', 'Faded', 'Restless', 'Glass'];
const NOUNS = ['Rivers', 'Echoes', 'Lanterns', 'Horizon', 'Satellites', 'Garden', 'Signals', 'Harbor',
  'Mirrors', 'Comets', 'Highway', 'Orchard', 'Tides', 'Embers', 'Skyline', 'Shadows', 'Meadow',
  'Engines', 'Letters', 'Islands', 'Thunder', 'Feathers', 'Circuits', 'Daydreams'];
const TITLE_WORDS = ['Run', 'Stay', 'Fall', 'Glow', 'Drift', 'Breathe', 'Wait', 'Rise', 'Shine',
  'Wander', 'Hold On', 'Let Go', 'Come Home', 'Slow Down', 'Wake Up', 'Dance', 'Remember', 'Burn'];
const TITLE_ENDINGS = ['Tonight', 'Again', 'With Me', 'in the Rain', 'Forever', 'Alone', 'Away',
  'in Blue', 'for You', 'at Dawn', 'Like Fire', 'Together', 'Back', 'Slowly'];

const rng = createRng(SEED);
const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Roughly normal noise (sum of uniforms), mean 0, sd ≈ `sd`. */
const noise = (r: Rng, sd: number) => (r() + r() + r() - 1.5) * 2 * sd;
const round = (x: number, digits: number) => Number(x.toFixed(digits));

const usedArtists = new Set<string>();
const usedTitles = new Set<string>();
const rows: string[] = ['id,title,artist,genre,energy,valence,tempo,popularity'];
let n = 0;

for (const genre of GENRES) {
  const p = PROFILE[genre];
  for (let a = 0; a < ARTISTS_PER_GENRE; a++) {
    let artist: string;
    do artist = `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`;
    while (usedArtists.has(artist));
    usedArtists.add(artist);

    // Popularity is skewed: most artists are small, a few are big (power law).
    const artistFame = Math.pow(rng(), 2.5) * 85;
    // Each artist has a personal sound near the genre average.
    const artistEnergy = p.energy + noise(rng, 0.08);
    const artistValence = p.valence + noise(rng, 0.1);

    const trackCount = TRACKS_PER_ARTIST[0] + Math.floor(rng() * (TRACKS_PER_ARTIST[1] - TRACKS_PER_ARTIST[0] + 1));
    for (let t = 0; t < trackCount; t++) {
      let title: string;
      do title = rng() < 0.5 ? pick(rng, TITLE_WORDS) + ' ' + pick(rng, TITLE_ENDINGS) : `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`;
      while (usedTitles.has(`${artist}|${title}`));
      usedTitles.add(`${artist}|${title}`);

      const energy = round(clamp01(artistEnergy + noise(rng, 0.08)), 3);
      const valence = round(clamp01(artistValence + noise(rng, 0.1)), 3);
      const tempo = Math.round(p.bpm[0] + rng() * (p.bpm[1] - p.bpm[0]));
      const popularity = Math.round(Math.min(100, Math.max(1, artistFame + noise(rng, 8) + 5)));

      n++;
      rows.push([`t${String(n).padStart(4, '0')}`, title, artist, genre, energy, valence, tempo, popularity].join(','));
    }
  }
}

writeFileSync('data/catalog.csv', rows.join('\n') + '\n');
console.log(`wrote data/catalog.csv: ${n} tracks, ${usedArtists.size} artists, ${GENRES.length} genres`);
