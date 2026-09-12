import type { ISODate } from "@/domain/types";
import { daysBetween, toIsoDate } from "@/lib/format";
import type { SeededRandom } from "./random";

const DAY_MS = 86_400_000;

/** Developments are dated within this many days before `asOf` (six years). */
export const EVENT_WINDOW_DAYS = 365 * 6;
/** Share of dates that fall in the recent window (the last eighteen months). */
const RECENT_WINDOW_DAYS = 548;
const RECENT_SHARE = 0.6;
/** Provenance timestamps: verification within 120 days, updates within 90 days. */
export const VERIFIED_WITHIN_DAYS = 120;
export const UPDATED_WITHIN_DAYS = 90;

export function addDays(date: ISODate, days: number): ISODate {
  return toIsoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

/**
 * Date arithmetic anchored on the dataset's reference day so every generated date,
 * timestamp and "days ago" figure is reproducible.
 */
export class Calendar {
  readonly windowStart: ISODate;

  constructor(readonly asOf: ISODate) {
    this.windowStart = addDays(asOf, -EVENT_WINDOW_DAYS);
  }

  /** A date within the six-year window, weighted toward the last eighteen months. */
  recentDate(rng: SeededRandom): ISODate {
    const daysAgo = rng.chance(RECENT_SHARE)
      ? rng.int(0, RECENT_WINDOW_DAYS)
      : rng.int(RECENT_WINDOW_DAYS + 1, EVENT_WINDOW_DAYS);
    return addDays(this.asOf, -daysAgo);
  }

  /** Like `recentDate` but never before `notBefore`. */
  recentDateAfter(rng: SeededRandom, notBefore: ISODate): ISODate {
    const candidate = this.recentDate(rng);
    if (candidate >= notBefore) return candidate;
    return this.dateBetween(rng, notBefore, this.asOf);
  }

  /** Uniform date in [from, to]; collapses to `from` when the range is empty. */
  dateBetween(rng: SeededRandom, from: ISODate, to: ISODate): ISODate {
    const span = daysBetween(from, to);
    if (span <= 0) return from;
    return addDays(from, rng.int(0, span));
  }

  daysAgo(rng: SeededRandom, maxDays: number, minDays = 0): ISODate {
    return addDays(this.asOf, -rng.int(minDays, maxDays));
  }

  /** Timestamp within the last `maxDays` days, with a time of day so rows are not all at midnight. */
  timestampWithinDays(rng: SeededRandom, maxDays: number, minDays = 0): Date {
    const day = this.daysAgo(rng, maxDays, minDays);
    return this.timestampOn(rng, day);
  }

  timestampOn(rng: SeededRandom, day: ISODate): Date {
    return new Date(
      Date.parse(`${day}T00:00:00Z`) + rng.int(6, 21) * 3_600_000 + rng.int(0, 59) * 60_000,
    );
  }

  isWithinWindow(date: ISODate): boolean {
    return date >= this.windowStart && date <= this.asOf;
  }
}
