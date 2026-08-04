/**
 * SkateHive "Nirvana" levels — a Hive Power (HP) based progression used by the
 * profile-setup CTA toasts to nudge users toward the next level.
 *
 * Round-milestone thresholds, five named levels. Below the first milestone the
 * user is "level 0" (unnamed) and is working toward level 1 (Grom).
 *
 * Names are brand terms and are intentionally NOT translated.
 */

export interface LevelDef {
  level: number;
  minHp: number;
  name: string;
}

/** Single source of truth for the curve + names. */
export const HIVE_LEVELS: readonly LevelDef[] = [
  { level: 1, minHp: 100, name: "Grom" },
  { level: 2, minHp: 500, name: "Local" },
  { level: 3, minHp: 1000, name: "Ripper" },
  { level: 4, minHp: 1500, name: "Shredder" },
  { level: 5, minHp: 2000, name: "Nirvana" },
] as const;

/** The top level definition (Nirvana). */
const TOP_LEVEL = HIVE_LEVELS[HIVE_LEVELS.length - 1];
/** HP needed to reach the top level. */
export const MAX_LEVEL_HP = TOP_LEVEL.minHp;

export interface HiveLevel {
  /** Current level number, 0–5. 0 means below the first milestone. */
  level: number;
  /** Current level name, or null at level 0. */
  name: string | null;
  /** Next level number to aim for, or null once maxed. */
  nextLevel: number | null;
  /** Next level name, or null once maxed. */
  nextName: string | null;
  /** Whole HP remaining to the next milestone, or null once maxed. */
  hpToNext: number | null;
  /** True once the user is at or above the top milestone. */
  isMax: boolean;
}

/**
 * Resolve a user's level from their Hive Power.
 *
 * A negative or NaN HP is treated as 0.
 */
export function getHiveLevel(hp: number): HiveLevel {
  const power = Number.isFinite(hp) && hp > 0 ? hp : 0;

  // Highest milestone whose threshold the user has reached.
  let current: LevelDef | null = null;
  for (const def of HIVE_LEVELS) {
    if (power >= def.minHp) current = def;
    else break;
  }

  const level = current?.level ?? 0;
  const isMax = level >= TOP_LEVEL.level;

  if (isMax) {
    return {
      level,
      name: current?.name ?? null,
      nextLevel: null,
      nextName: null,
      hpToNext: null,
      isMax: true,
    };
  }

  // The next milestone is the first one the user has NOT yet reached.
  const next = HIVE_LEVELS.find((d) => power < d.minHp) ?? null;

  return {
    level,
    name: current?.name ?? null,
    nextLevel: next?.level ?? null,
    nextName: next?.name ?? null,
    hpToNext: next ? Math.max(1, Math.ceil(next.minHp - power)) : null,
    isMax: false,
  };
}
