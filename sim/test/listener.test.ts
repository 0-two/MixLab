import { describe, expect, it } from 'vitest';
import { buildSchedule, createRng, EVERY_6, type PlaylistTrack } from '@mixlab/blend';
import { ABANDON_BEFORE, adAnnoyance, simulateSession, upgradeChance, type Persona } from '../src/listener.js';

const persona: Persona = {
  name: 'test', share: 100, willingness_to_pay: 0.3, ad_tolerance: 0.5, patience: 2.5, base_save: 0.25, base_skip: 0.4,
};
const playlist: PlaylistTrack[] = Array.from({ length: 20 }, (_, i) => ({
  id: `t${i}`, title: `T${i}`, artist: `A${i}`, genre: 'pop',
  energy: 0.5, valence: 0.5, tempo: 120, popularity: 50, isDiscovery: false, similarity: 0.8,
}));
const scheduleEvery = (n: number) => buildSchedule(playlist, { ...EVERY_6, ad_every_n_songs: n });
const run = (n: number, p: Persona, seed: number) => simulateSession(scheduleEvery(n), p, createRng(seed));

describe('simulateSession', () => {
  it('is deterministic for the same seed', () => {
    expect(run(3, persona, 1)).toEqual(run(3, persona, 1));
  });

  it('never clicks Premium when there are no ads or willingness to pay is 0', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(run(20, persona, seed).premiumClicked).toBe(false); // no ads in 20 songs
      expect(run(3, { ...persona, willingness_to_pay: 0 }, seed).premiumClicked).toBe(false);
    }
  });

  it('sends premium_clicked at most once and stops showing ads after it', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = run(3, { ...persona, willingness_to_pay: 1 }, seed);
      expect(s.events.filter((e) => e === 'premium_clicked').length).toBeLessThanOrEqual(1);
      const clickAt = s.events.indexOf('premium_clicked');
      if (clickAt >= 0) expect(s.events.slice(clickAt).includes('ad_shown')).toBe(false);
    }
  });

  it('sends session_abandoned exactly when fewer than ABANDON_BEFORE songs were heard', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = run(3, { ...persona, ad_tolerance: 0, patience: 0.8 }, seed);
      expect(s.abandoned).toBe(s.heard < ABANDON_BEFORE);
      expect(s.events.filter((e) => e === 'session_abandoned')).toHaveLength(s.abandoned ? 1 : 0);
    }
  });

  it('shows the scheduled number of ads to a listener who stays and never upgrades', () => {
    const stayer = { ...persona, willingness_to_pay: 0, patience: 99 };
    // Random dropoff can still end a session early, so check the maximum over many seeds.
    const maxAds = (n: number) => Math.max(...Array.from({ length: 100 }, (_, s) => run(n, stayer, s).adsSeen));
    expect(maxAds(3)).toBe(6);
    expect(maxAds(6)).toBe(3);
    expect(maxAds(10)).toBe(1);
  });
});

describe('ad annoyance and upgrade chance', () => {
  it('ads annoy low-tolerance listeners more', () => {
    expect(adAnnoyance({ ...persona, ad_tolerance: 0.1 })).toBeGreaterThan(adAnnoyance({ ...persona, ad_tolerance: 0.9 }));
  });

  it('upgrade chance grows with willingness to pay and with annoyance, capped below 1', () => {
    expect(upgradeChance({ ...persona, willingness_to_pay: 0.6 }, 1)).toBeGreaterThan(upgradeChance({ ...persona, willingness_to_pay: 0.1 }, 1));
    expect(upgradeChance(persona, 2)).toBeGreaterThan(upgradeChance(persona, 0.5));
    expect(upgradeChance({ ...persona, willingness_to_pay: 1 }, 100)).toBeLessThanOrEqual(0.9);
  });
});
