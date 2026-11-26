import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Rng } from '@mixlab/blend';
import type { Persona } from './listener.js';

/** Load and check a persona file like sim/personas/baseline.yaml. */
export function loadPersonas(path: string): Persona[] {
  const doc = parse(readFileSync(path, 'utf8')) as { personas?: unknown };
  if (!Array.isArray(doc?.personas) || doc.personas.length === 0) {
    throw new Error(`${path}: expected a "personas" list`);
  }
  const personas = doc.personas.map((p, i) => checkPersona(p, `${path} persona #${i + 1}`));
  const total = personas.reduce((s, p) => s + p.share, 0);
  if (Math.abs(total - 100) > 1e-9) throw new Error(`${path}: shares add up to ${total}, expected 100`);
  return personas;
}

function checkPersona(raw: unknown, where: string): Persona {
  const p = raw as Record<string, unknown>;
  const num = (key: string, min: number, max: number): number => {
    const v = p?.[key];
    if (typeof v !== 'number' || v < min || v > max) throw new Error(`${where}: ${key} must be a number in [${min}, ${max}]`);
    return v;
  };
  if (typeof p?.name !== 'string' || !p.name) throw new Error(`${where}: name is required`);
  return {
    name: p.name,
    share: num('share', 0, 100),
    willingness_to_pay: num('willingness_to_pay', 0, 1),
    ad_tolerance: num('ad_tolerance', 0, 1),
    patience: num('patience', 0, 100),
    base_save: num('base_save', 0, 1),
    base_skip: num('base_skip', 0, 1),
  };
}

/** Pick a persona with probability proportional to its share. */
export function pickPersona(personas: Persona[], rng: Rng): Persona {
  let roll = rng() * 100;
  for (const p of personas) {
    roll -= p.share;
    if (roll < 0) return p;
  }
  return personas[personas.length - 1];
}
