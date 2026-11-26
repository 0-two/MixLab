// The ad "spot": a short generated jingle, so ads sound clearly different from the music.
// (Songs are real clips played through an <audio> element; see Player.tsx.)

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let volume = 0.25;

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

export function setJingleVolume(v: number) {
  volume = v * 0.3;
  if (master) master.gain.value = volume;
}

export function stopJingle() {
  if (timer) clearInterval(timer);
  timer = null;
}

function note(freq: number, start: number, length: number) {
  const { ctx, out } = audio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.4, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + length);
}

/** Loop a bright six-note jingle until stopJingle(). */
export function playJingle() {
  stopJingle();
  const { ctx } = audio();
  const melody = [0, 4, 7, 12, 7, 4];
  const beat = 60 / 150;
  let n = 0;
  let next = ctx.currentTime + 0.05;
  timer = setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      note(440 * 2 ** (melody[n++ % melody.length] / 12), next, 0.25);
      next += beat;
    }
  }, 50);
}
