// The listener model: how one simulated person reacts to a listening session
// (songs with ads in between), item by item.
// Pure and seeded: the same schedule, persona and RNG always give the same session.
// Nothing here knows which variation the listener got. Any difference between
// variations comes only from how many ads are in the schedule.
import { ABANDON_BEFORE, type PlaylistTrack, type Rng, type ScheduleItem } from '@mixlab/blend';

export interface Persona {
  name: string;
  /** Percentage of listeners with this persona. */
  share: number;
  /** 0 = would never pay, 1 = very ready to pay for Premium. */
  willingness_to_pay: number;
  /** 0 = hates ads, 1 = barely notices them. */
  ad_tolerance: number;
  /** How much annoyance a listener takes before leaving. */
  patience: number;
  /** Chance to save a song that fits perfectly. */
  base_save: number;
  /** Chance to skip a song that doesn't fit at all. */
  base_skip: number;
}

export type SimEvent = 'premium_clicked' | 'session_abandoned' | 'ad_shown' | 'track_saved' | 'track_skipped';

export interface SessionResult {
  /** Songs the listener reached (played or skipped). */
  heard: number;
  adsSeen: number;
  /** Clicked Go Premium → `premium_clicked`. */
  premiumClicked: boolean;
  /** Left before hearing ABANDON_BEFORE songs → `session_abandoned`. */
  abandoned: boolean;
  endReason: 'finished' | 'annoyed' | 'dropoff';
  /** Events in the order they happened. */
  events: SimEvent[];
}

/** "Abandonment" means leaving before reaching song 10 (defined in @mixlab/blend, shared with the player). */
export { ABANDON_BEFORE };
/** Chance per song of leaving for reasons unrelated to the app (same for every variation). */
const DROPOFF = 0.03;
/** Annoyance added by one ad for a listener with ad_tolerance 0 (tolerance 1 → a third of it). */
const AD_ANNOYANCE = 1.2;
/** Chance of clicking Go Premium at an ad break, before scaling by willingness and annoyance. */
const UPGRADE_BASE = 0.12;
/** How songs change annoyance: liked songs calm you down, skipped ones irritate. */
const SONG = { save: -0.3, listen: -0.1, skip: 0.2 };

/** How much the listener likes a song, 0–1 (taste match, stretched from the ~0.5–0.9 similarity range). */
export function appeal(track: PlaylistTrack): number {
  return clamp01((track.similarity - 0.4) / 0.5);
}

/** Annoyance from one ad: high-tolerance listeners barely mind, low-tolerance listeners mind a lot. */
export function adAnnoyance(persona: Persona): number {
  return AD_ANNOYANCE * (1 - (2 / 3) * persona.ad_tolerance);
}

/**
 * Chance to click Go Premium at an ad break. Grows with willingness to pay and with
 * how annoyed the listener already is ("I'm tired of these ads").
 */
export function upgradeChance(persona: Persona, annoyance: number): number {
  return Math.min(0.9, UPGRADE_BASE * persona.willingness_to_pay * (1 + annoyance) * 2);
}

export function simulateSession(schedule: ScheduleItem[], persona: Persona, rng: Rng): SessionResult {
  const result: SessionResult = {
    heard: 0, adsSeen: 0, premiumClicked: false, abandoned: false, endReason: 'finished', events: [],
  };
  const totalSongs = schedule.filter((i) => i.kind === 'song').length;
  let annoyance = 0;

  for (const item of schedule) {
    if (item.kind === 'ad') {
      // A Premium listener doesn't hear ads.
      if (result.premiumClicked) continue;
      result.adsSeen++;
      result.events.push('ad_shown');
      annoyance += adAnnoyance(persona);

      if (rng() < upgradeChance(persona, annoyance)) {
        result.premiumClicked = true;
        result.events.push('premium_clicked');
        annoyance = 0; // no more ads
        continue;
      }
      if (annoyance > persona.patience) {
        result.endReason = 'annoyed';
        break;
      }
      continue;
    }

    // A song.
    result.heard++;
    const a = appeal(item.track);
    const pSave = persona.base_save * a;
    const pSkip = persona.base_skip * (1 - a) + 0.05;
    const roll = rng();
    if (roll < pSave) {
      result.events.push('track_saved');
      annoyance += SONG.save;
    } else if (roll < pSave + pSkip) {
      result.events.push('track_skipped');
      annoyance += SONG.skip;
    } else {
      annoyance += SONG.listen;
    }
    annoyance = Math.max(0, annoyance);

    const isLast = result.heard === totalSongs;
    if (!isLast && annoyance > persona.patience) {
      result.endReason = 'annoyed';
      break;
    }
    if (!isLast && rng() < DROPOFF) {
      result.endReason = 'dropoff';
      break;
    }
  }

  if (result.heard < ABANDON_BEFORE) {
    result.abandoned = true;
    result.events.push('session_abandoned');
  }
  return result;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
