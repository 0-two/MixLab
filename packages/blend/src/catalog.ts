import { GENRES, type Genre, type Track } from './types';

const HEADER = 'id,title,artist,genre,energy,valence,tempo,popularity';

/**
 * Parse the text of data/catalog.csv into tracks.
 * Pure (no file access) so the simulator and the browser player can both use it.
 * Throws with the line number if a row is malformed, so bad data fails loudly.
 */
export function parseCatalog(csv: string): Track[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== HEADER) {
    throw new Error(`catalog: expected header "${HEADER}", got "${lines[0]}"`);
  }

  const seenIds = new Set<string>();
  return lines.slice(1).map((line, i) => {
    const lineNo = i + 2;
    const cols = line.split(',');
    if (cols.length !== 8) throw new Error(`catalog line ${lineNo}: expected 8 columns, got ${cols.length}`);

    const [id, title, artist, genre, energy, valence, tempo, popularity] = cols;
    if (!id || !title || !artist) throw new Error(`catalog line ${lineNo}: empty id/title/artist`);
    if (seenIds.has(id)) throw new Error(`catalog line ${lineNo}: duplicate id ${id}`);
    seenIds.add(id);
    if (!GENRES.includes(genre as Genre)) throw new Error(`catalog line ${lineNo}: unknown genre "${genre}"`);

    return {
      id,
      title,
      artist,
      genre: genre as Genre,
      energy: num(energy, 0, 1, 'energy', lineNo),
      valence: num(valence, 0, 1, 'valence', lineNo),
      tempo: num(tempo, 30, 250, 'tempo', lineNo),
      popularity: num(popularity, 0, 100, 'popularity', lineNo),
    };
  });
}

function num(text: string, min: number, max: number, field: string, lineNo: number): number {
  const value = Number(text);
  if (text === '' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`catalog line ${lineNo}: ${field} "${text}" is not a number in [${min}, ${max}]`);
  }
  return value;
}
