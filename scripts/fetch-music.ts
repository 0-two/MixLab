// Cut 30-second clips of the CC BY 4.0 tracks listed in data/music.json (Kevin MacLeod,
// incompetech.com) into apps/player/public/music/, plus a tracks.json the player loads.
// The clips are committed, so you only need this to re-create them. Requires ffmpeg on PATH.
//
//   npm run music
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

interface Source { id: string; title: string; artist: string; genre: string; bpm: number | null; length: string; source: string }
const manifest = JSON.parse(readFileSync('data/music.json', 'utf8')) as {
  license: string; licenseUrl: string; changes: string; tracks: Source[];
};

const OUT = 'apps/player/public/music';
const TMP = `${tmpdir()}/mixlab-music`;
const CLIP_SECONDS = 30;
const FADE = 1.5;

const seconds = (hms: string) => hms.split(':').map(Number).reduce((s, n) => s * 60 + n, 0);

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-400)))));
  });
}

async function clip(t: Source) {
  // Start a fifth of the way in (past most intros), but never so late the clip runs off the end.
  const duration = seconds(t.length);
  const start = Math.max(0, Math.min(duration * 0.2, duration - CLIP_SECONDS - 1));
  // The server is slow per connection, so fetch only the bytes around the excerpt
  // (MP3 frames resync on their own), then cut it exactly with ffmpeg.
  const head = await fetch(t.source, { method: 'HEAD' });
  const size = Number(head.headers.get('content-length'));
  const bytesPerSecond = size / duration;
  const from = Math.floor(start * bytesPerSecond);
  const to = Math.min(size - 1, Math.ceil((start + CLIP_SECONDS + 3) * bytesPerSecond));
  const res = await fetch(t.source, { headers: { Range: `bytes=${from}-${to}` } });
  if (res.status !== 206) throw new Error(`${t.title}: expected 206, got ${res.status}`);
  mkdirSync(TMP, { recursive: true });
  const part = `${TMP}/${t.id}.part.mp3`;
  writeFileSync(part, Buffer.from(await res.arrayBuffer()));
  await ffmpeg([
    '-y', '-loglevel', 'error', '-i', part, '-ss', '0.5', '-t', String(CLIP_SECONDS),
    '-af', `afade=t=in:d=${FADE},afade=t=out:st=${CLIP_SECONDS - FADE}:d=${FADE}`,
    '-ac', '1', '-b:a', '96k', `${OUT}/${t.id}.mp3`,
  ]);
  rmSync(part);
  return { start };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const queue = [...manifest.tracks];
  const starts = new Map<string, number>();
  const index = `${OUT}/tracks.json`;
  const previous = new Map<string, number>(existsSync(index)
    ? (JSON.parse(readFileSync(index, 'utf8')).tracks as { id: string; excerptStart: number }[]).map((t) => [t.id, t.excerptStart])
    : []);
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      const out = `${OUT}/${t.id}.mp3`;
      // Skip clips that already exist (re-runs only fetch what is missing).
      if (existsSync(out) && statSync(out).size > 100_000 && previous.has(t.id)) {
        starts.set(t.id, previous.get(t.id)!);
        continue;
      }
      try {
        const { start } = await clip(t);
        starts.set(t.id, start);
        console.log(`ok   ${t.genre.padEnd(10)} ${t.title}`);
      } catch (err) {
        console.error(`FAIL ${t.title}: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));

  writeFileSync(`${OUT}/tracks.json`, JSON.stringify({
    license: manifest.license, licenseUrl: manifest.licenseUrl, changes: manifest.changes,
    clipSeconds: CLIP_SECONDS,
    // Only clips that exist; run again to fetch any that failed.
    tracks: manifest.tracks.filter((t) => starts.has(t.id)).map(({ id, title, artist, genre, bpm }) => ({
      id, title, artist, genre, bpm, file: `/music/${id}.mp3`, excerptStart: starts.get(id),
    })),
  }, null, 2) + '\n');
  console.log(`\n${starts.size}/${manifest.tracks.length} clips in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
