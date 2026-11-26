'use client';
// MixLab player: pick genres → a 20-song playlist with ads between songs, every N songs,
// where N comes from the Flagsmith `ad_config` flag. Sends the same events as the simulator.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ABANDON_BEFORE, buildPlaylist, buildSchedule, createRng, GENRES, hashSeed, parseCatalog, PLAYLIST_BLEND,
  type Genre, type ScheduleItem, type Track,
} from '@mixlab/blend';
import { assignClips, loadLibrary, type MusicLibrary, type MusicTrack } from './music';
import { assignAdConfig, startFlagsmith, track as sendEvent, visitorId, type Assignment, type PlayerEvent } from './flagsmith';
import { playJingle, setJingleVolume, stopJingle } from './sound';

/** Fictional advertisers: the ads are props, not real brands. */
const ADS = [
  { brand: 'Brewly', line: 'Cold brew that keeps up with your playlist.' },
  { brand: 'Northwind', line: 'Running shoes for people who skip leg day.' },
  { brand: 'Pixel Pantry', line: 'Dinner kits, delivered before the drop.' },
];
/** A session that has started but not yet reached song ABANDON_BEFORE. See the startup effect. */
const OPEN_SESSION_KEY = 'mixlab.openSession';
/** ?fast: songs and ads last this many seconds, for testing only. */
const FAST_SECONDS = 3;

type View = 'home' | 'playlist' | 'liked' | 'credits';
type Phase = 'idle' | 'loading' | 'playing' | 'finished';

export default function Player() {
  const [catalog, setCatalog] = useState<Track[] | null>(null);
  const [library, setLibrary] = useState<MusicLibrary | null>(null);
  const [view, setView] = useState<View>('home');
  const [phase, setPhase] = useState<Phase>('idle');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [clips, setClips] = useState<Map<string, MusicTrack>>(new Map());
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [premium, setPremium] = useState(false);
  const [showThanks, setShowThanks] = useState(false);
  const [liked, setLiked] = useState<MusicTrack[]>([]);
  const [volume, setVolume] = useState(0.8);
  const [debug, setDebug] = useState(false);
  const [fast, setFast] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [visitor, setVisitor] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const adElapsed = useRef(0);
  const advancing = useRef(false);

  const track = useCallback((event: PlayerEvent, opts?: { flush?: boolean }) => {
    setLog((l) => [`${new Date().toLocaleTimeString()} ${event}`, ...l].slice(0, 8));
    return sendEvent(event, opts);
  }, []);

  // --- Startup: data, Flagsmith, and any session left unfinished last time ----------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setDebug(params.has('debug'));
    setFast(params.has('fast'));
    setVisitor(visitorId());
    audioRef.current = new Audio();
    fetch('/catalog.csv').then((r) => r.text()).then((csv) => setCatalog(parseCatalog(csv)));
    loadLibrary().then(setLibrary);
    startFlagsmith().then(() => {
      // The tab may have closed before the abandonment event got out (the SDK has no
      // sendBeacon). Send it now; the metric counts each visitor once, so duplicates are harmless.
      if (localStorage.getItem(OPEN_SESSION_KEY)) {
        localStorage.removeItem(OPEN_SESSION_KEY);
        void track('session_abandoned', { flush: true });
      }
    });
    const onLeave = () => {
      if (localStorage.getItem(OPEN_SESSION_KEY)) void track('session_abandoned', { flush: true });
    };
    addEventListener('pagehide', onLeave);
    return () => {
      removeEventListener('pagehide', onLeave);
      audioRef.current?.pause();
      stopJingle();
    };
  }, [track]);

  // --- Start or leave a session -------------------------------------------------------------------
  async function start() {
    if (!catalog || !library) return;
    leaveSession();
    setPhase('loading');
    setView('playlist');
    const a = await assignAdConfig(); // records the exposure
    const rng = createRng(hashSeed(`${visitorId()}:${Date.now()}`));
    const playlist = buildPlaylist(catalog, { genres }, PLAYLIST_BLEND, rng);
    const songs = assignClips(playlist, library, genres, rng);
    setClips(new Map(songs.map((s) => [s.slot.id, s.music])));
    setAssignment(a);
    setSchedule(buildSchedule(playlist, a.config));
    setIndex(0);
    setPremium(false);
    setPaused(false);
    localStorage.setItem(OPEN_SESSION_KEY, '1');
    setPhase('playing');
  }

  /** Stop the current session. Leaving before song 10 counts as abandonment. */
  function leaveSession() {
    audioRef.current?.pause();
    stopJingle();
    if (localStorage.getItem(OPEN_SESSION_KEY)) {
      localStorage.removeItem(OPEN_SESSION_KEY);
      void track('session_abandoned', { flush: true });
    }
  }

  const advance = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    setIndex((i) => {
      let next = i + 1;
      // Premium listeners don't hear ads.
      while (premium && schedule[next]?.kind === 'ad') next++;
      return next;
    });
  }, [premium, schedule]);

  // --- Entering an item: audio, events, abandonment bookkeeping ----------------------------------
  const item = phase === 'playing' ? schedule[index] : undefined;
  const songClip = item?.kind === 'song' ? clips.get(item.track.id) : undefined;
  const itemLength = !item ? 0 : fast ? FAST_SECONDS : item.kind === 'song' ? library?.clipSeconds ?? 30 : item.lengthSeconds;
  useEffect(() => {
    if (phase !== 'playing') return;
    const audio = audioRef.current!;
    advancing.current = false;
    adElapsed.current = 0;
    setElapsed(0);
    if (!item) {
      audio.pause();
      stopJingle();
      localStorage.removeItem(OPEN_SESSION_KEY);
      setPhase('finished');
      return;
    }
    if (item.kind === 'song') {
      // Reaching song 10 means this session can no longer count as abandoned.
      if (item.songNumber >= ABANDON_BEFORE) localStorage.removeItem(OPEN_SESSION_KEY);
      stopJingle();
      audio.src = songClip!.file;
      audio.currentTime = 0;
      void audio.play().catch(() => setPaused(true));
    } else {
      audio.pause();
      void track('ad_shown');
      playJingle();
    }
    setPaused(false);
  }, [phase, item, songClip, track]);

  // --- Clock: one ticker reads the current position and moves on when an item ends ---------------
  const tick = useRef(() => {});
  tick.current = () => {
    if (phase !== 'playing' || !item || paused) return;
    let t: number;
    if (item.kind === 'song') {
      const audio = audioRef.current!;
      t = audio.ended ? itemLength : audio.currentTime;
    } else {
      t = adElapsed.current += 0.25;
    }
    setElapsed(t);
    if (t >= itemLength) advance();
  };
  useEffect(() => {
    const id = setInterval(() => tick.current(), 250);
    return () => clearInterval(id);
  }, []);

  // --- Controls -----------------------------------------------------------------------------------
  function togglePause() {
    if (phase !== 'playing' || !item) return;
    const audio = audioRef.current!;
    if (paused) {
      if (item.kind === 'song') void audio.play();
      else playJingle();
    } else {
      audio.pause();
      stopJingle();
    }
    setPaused(!paused);
  }
  function goPremium() {
    if (premium || phase !== 'playing') return;
    setPremium(true);
    setShowThanks(true);
    setTimeout(() => setShowThanks(false), 6000);
    void track('premium_clicked', { flush: true });
    if (item?.kind === 'ad') advance();
  }
  function skip() {
    if (item?.kind !== 'song') return; // ads can't be skipped
    void track('track_skipped');
    advance();
  }
  function like(m: MusicTrack) {
    if (liked.some((x) => x.id === m.id)) return;
    setLiked([...liked, m]);
    void track('track_saved');
  }
  function changeVolume(v: number) {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setJingleVolume(v);
  }

  // --- View ---------------------------------------------------------------------------------------
  const isLiked = (m?: MusicTrack) => !!m && liked.some((x) => x.id === m.id);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">Mix<span>Lab</span></div>
        <nav>
          <button className={view === 'home' ? 'nav on' : 'nav'} onClick={() => setView('home')}>⌂ Home</button>
          <button className={view === 'playlist' ? 'nav on' : 'nav'} onClick={() => setView('playlist')} disabled={phase === 'idle'}>♫ Your Mix</button>
          <button className={view === 'liked' ? 'nav on' : 'nav'} onClick={() => setView('liked')}>♥ Liked Songs <small>{liked.length || ''}</small></button>
          <button className={view === 'credits' ? 'nav on' : 'nav'} onClick={() => setView('credits')}>ⓘ Music credits</button>
        </nav>
        {!premium && (
          <div className="promo">
            <b>Listen without ads</b>
            <span>Premium removes every ad break.</span>
            <button className="premium" onClick={goPremium} disabled={phase !== 'playing'}>Go Premium</button>
          </div>
        )}
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="muted small">
            <span className="mobile-only">
              <button className="link" onClick={() => setView('home')}>Home</button> ·{' '}
              <button className="link" onClick={() => setView('playlist')} disabled={phase === 'idle'}>Your Mix</button> ·{' '}
              <button className="link" onClick={() => setView('credits')}>Credits</button>
            </span>
            <span className="desktop-only">{premium ? 'Premium' : 'Free, ad-supported music'}</span>
          </span>
          {premium
            ? <span className="premium-badge">✦ Premium · no ads</span>
            : <button className="premium" onClick={goPremium} disabled={phase !== 'playing'}>Go Premium</button>}
        </header>

        {view === 'home' && (
          <Home genres={genres} setGenres={setGenres} ready={!!catalog && !!library} onStart={start} />
        )}
        {view === 'playlist' && (
          <PlaylistView phase={phase} genres={genres} schedule={schedule} clips={clips} index={index}
            premium={premium} isLiked={isLiked} onRestart={start} />
        )}
        {view === 'liked' && <Liked tracks={liked} />}
        {view === 'credits' && library && <Credits library={library} />}

        {item?.kind === 'ad' && (
          <div className="ad-overlay">
            <AdBreak item={item} left={Math.max(0, Math.ceil(itemLength - elapsed))} onPremium={goPremium} />
          </div>
        )}
      </main>

      <footer className="nowbar">
        <div className="nowbar-left">
          {item?.kind === 'song' && songClip ? (
            <>
              <div className="art small" style={{ background: art(songClip) }} />
              <div className="ellipsis">
                <div className="ellipsis">{songClip.title}</div>
                <div className="muted small ellipsis">{songClip.artist}</div>
              </div>
              <button className={isLiked(songClip) ? 'icon on' : 'icon'} onClick={() => like(songClip)} aria-label="Like">
                {isLiked(songClip) ? '♥' : '♡'}
              </button>
            </>
          ) : item?.kind === 'ad' ? (
            <div><div className="ad-label">Advertisement</div><div className="muted small">Your music continues shortly</div></div>
          ) : (
            <div className="muted small">{phase === 'finished' ? 'Playlist finished' : 'Pick some genres to start'}</div>
          )}
        </div>
        <div className="nowbar-center">
          <div className="transport">
            <button className="icon" disabled aria-label="Previous">⏮</button>
            <button className="play" onClick={togglePause} disabled={phase !== 'playing'} aria-label={paused ? 'Play' : 'Pause'}>
              {paused || phase !== 'playing' ? '▶' : '❚❚'}
            </button>
            <button className="icon" onClick={skip} disabled={item?.kind !== 'song'} aria-label="Skip">⏭</button>
          </div>
          <div className="scrub">
            <span>{clock(elapsed)}</span>
            <div className={item?.kind === 'ad' ? 'track ad' : 'track'}>
              <div style={{ width: `${itemLength ? Math.min(100, (100 * elapsed) / itemLength) : 0}%` }} />
            </div>
            <span>{clock(itemLength)}</span>
          </div>
        </div>
        <div className="nowbar-right">
          <span aria-hidden>🔈</span>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Volume" />
          <button className="debug-toggle" onClick={() => setDebug(!debug)}>debug</button>
        </div>
      </footer>

      {showThanks && (
        <p className="toast">Thanks! This is a demo, so no payment is taken. Ads are off for this session.</p>
      )}

      {debug && (
        <aside className="debug">
          <div><b>Visitor</b> {visitor}</div>
          <div><b>Variation</b> {assignment?.variant ?? '— (assigned when the playlist starts)'}</div>
          <div><b>In experiment</b> {assignment ? String(assignment.inExperiment) : '—'}</div>
          <div><b>ad_config</b> {assignment ? JSON.stringify(assignment.config) : '—'}</div>
          {assignment?.fallbackReason && <div className="warn"><b>Fallback</b> {assignment.fallbackReason}</div>}
          {fast && <div className="warn">Fast mode (?fast): {FAST_SECONDS}s songs and ads</div>}
          <div><b>Events sent</b></div>
          {log.length ? log.map((l, i) => <div key={i} className="mono">{l}</div>) : <div className="muted">none yet</div>}
        </aside>
      )}
    </div>
  );
}

function Home({ genres, setGenres, ready, onStart }: {
  genres: Genre[]; setGenres: (g: Genre[]) => void; ready: boolean; onStart: () => void;
}) {
  const toggle = (g: Genre) =>
    setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : genres.length < 5 ? [...genres, g] : genres);
  return (
    <section className="page">
      <h1>{greeting()}</h1>
      <p className="muted">Pick 3 to 5 genres and we&apos;ll make you a 20-song mix. Free, with ads.</p>
      <div className="genre-grid">
        {GENRES.map((g) => (
          <button key={g} className={genres.includes(g) ? 'genre on' : 'genre'} style={{ background: genreColor(g) }} onClick={() => toggle(g)}>
            <span>{g}</span>
            {genres.includes(g) && <i>✓</i>}
          </button>
        ))}
      </div>
      <button className="primary" disabled={!ready || genres.length < 3} onClick={onStart}>
        {genres.length < 3 ? `Pick ${3 - genres.length} more` : '▶  Play my mix'}
      </button>
    </section>
  );
}

function PlaylistView({ phase, genres, schedule, clips, index, premium, isLiked, onRestart }: {
  phase: Phase; genres: Genre[]; schedule: ScheduleItem[]; clips: Map<string, MusicTrack>; index: number;
  premium: boolean; isLiked: (m?: MusicTrack) => boolean; onRestart: () => void;
}) {
  if (phase === 'idle') return <section className="page muted">Start a mix from Home.</section>;
  if (phase === 'loading') return <section className="page muted">Building your mix…</section>;
  const songs = schedule.flatMap((it) => (it.kind === 'song' ? [clips.get(it.track.id)!] : []));
  return (
    <section>
      <div className="hero" style={{ background: `linear-gradient(180deg, ${genreColor(genres[0] ?? 'pop')} 0%, transparent 100%)` }}>
        <div className="mosaic">{songs.slice(0, 4).map((m) => <div key={m.id} style={{ background: art(m) }} />)}</div>
        <div>
          <div className="small">Playlist</div>
          <h1 className="hero-title">Your Mix</h1>
          <div className="muted small">{genres.join(' · ')} · 20 songs, about 10 min</div>
        </div>
      </div>
      <div className="page">
        {phase === 'finished' && (
          <div className="finished">That&apos;s the end of your mix. <button className="primary" onClick={onRestart}>Play a new mix</button></div>
        )}
        <div className="tracklist">
          <div className="row head"><span>#</span><span>Title</span><span>Genre</span><span>⏱</span></div>
          {schedule.map((it, i) => {
            if (it.kind === 'ad' && premium && i > index) return null;
            const state = phase === 'playing' && i === index ? 'now' : i < index || phase === 'finished' ? 'past' : '';
            if (it.kind === 'ad') {
              return (
                <div key={i} className={`row adrow ${state}`}>
                  <span>AD</span><span>Ad break</span><span /><span>0:{String(it.lengthSeconds).padStart(2, '0')}</span>
                </div>
              );
            }
            const m = clips.get(it.track.id)!;
            return (
              <div key={i} className={`row ${state}`}>
                <span>{state === 'now' ? <em className="eq"><i /><i /><i /></em> : it.songNumber}</span>
                <span className="title-cell">
                  <span className="art tiny" style={{ background: art(m) }} />
                  <span className="ellipsis">
                    <span className="ellipsis t">{m.title}{isLiked(m) && <b className="liked"> ♥</b>}</span>
                    <span className="muted small">{m.artist}{it.track.isDiscovery ? ' · New for you' : ''}</span>
                  </span>
                </span>
                <span className="muted small cap">{m.genre}</span>
                <span className="muted small">0:30</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AdBreak({ item, left, onPremium }: { item: Extract<ScheduleItem, { kind: 'ad' }>; left: number; onPremium: () => void }) {
  const ad = ADS[(item.adNumber - 1) % ADS.length];
  return (
    <div className="ad-card" role="dialog" aria-label="Advertisement">
      <div className="ad-label">Advertisement · {left}s</div>
      <h2>{ad.brand}</h2>
      <p>{ad.line}</p>
      <p className="muted small">(A made-up advertiser, for this demo.)</p>
      <button className="premium big" onClick={onPremium}>Go Premium: no ads</button>
    </div>
  );
}

function Liked({ tracks }: { tracks: MusicTrack[] }) {
  return (
    <section className="page">
      <h1>Liked Songs</h1>
      {tracks.length === 0 ? <p className="muted">Songs you like with ♡ show up here.</p> : (
        <div className="tracklist">
          {tracks.map((m, i) => (
            <div key={m.id} className="row">
              <span>{i + 1}</span>
              <span className="title-cell"><span className="art tiny" style={{ background: art(m) }} />
                <span className="ellipsis"><span className="t">{m.title}</span><span className="muted small">{m.artist}</span></span></span>
              <span className="muted small cap">{m.genre}</span><span />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Credits({ library }: { library: MusicLibrary }) {
  return (
    <section className="page credits">
      <h1>Music credits</h1>
      <p>
        All music by <b>Kevin MacLeod</b> (<a href="https://incompetech.com" target="_blank" rel="noreferrer">incompetech.com</a>),
        licensed under <a href={library.licenseUrl} target="_blank" rel="noreferrer">Creative Commons: By Attribution 4.0</a>.
      </p>
      <p className="muted">Changes: {library.changes} Ads are fictional and generated in the browser.</p>
      <ul>
        {library.tracks.map((m) => (
          <li key={m.id}>&ldquo;{m.title}&rdquo; Kevin MacLeod (incompetech.com) · <span className="cap">{m.genre}</span></li>
        ))}
      </ul>
    </section>
  );
}

// --- Small helpers ----------------------------------------------------------------------------------

function clock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const GENRE_HUE: Record<Genre, number> = {
  pop: 330, rock: 0, 'hip-hop': 30, electronic: 270, 'r&b': 300, indie: 160,
  folk: 45, jazz: 210, classical: 230, metal: 250, latin: 15, ambient: 185,
};

function genreColor(g: Genre): string {
  return `hsl(${GENRE_HUE[g]} 55% ${g === 'metal' ? 28 : 40}%)`;
}

/** Generated cover art: two hues from the track id. */
function art(m: MusicTrack): string {
  const h = hashSeed(m.id) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 70) % 360} 60% 30%))`;
}
