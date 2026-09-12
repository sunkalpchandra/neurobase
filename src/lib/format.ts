import type { ISODate, ISOTimestamp } from "@/domain/types";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const integer = new Intl.NumberFormat("en-US");

/** "$12.5M" for tables. Null (undisclosed) renders as an en dash, never as zero. */
export function formatUsdCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return usdCompact.format(amount);
}

/** "$12,500,000" for detail views. */
export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "Undisclosed";
  return usdFull.format(amount);
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return integer.format(value);
}

function parseDateInput(value: ISODate | ISOTimestamp | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Date-only strings are parsed as UTC; append a time to keep the calendar day stable.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 Mar 2026". Dates are rendered in UTC so a stored calendar day never shifts. */
export function formatDate(value: ISODate | ISOTimestamp | Date | null | undefined): string {
  if (!value) return "—";
  const date = parseDateInput(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "Mar 2026" for timelines and compact metadata. */
export function formatMonthYear(value: ISODate | ISOTimestamp | Date | null | undefined): string {
  if (!value) return "—";
  const date = parseDateInput(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** ISO calendar date (YYYY-MM-DD) in UTC, for <time dateTime> attributes. */
export function toIsoDate(value: ISODate | ISOTimestamp | Date): ISODate {
  const date = parseDateInput(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** Days between two dates, ignoring time of day. Positive when `later` is after `earlier`. */
export function daysBetween(
  earlier: ISODate | ISOTimestamp | Date,
  later: ISODate | ISOTimestamp | Date,
): number {
  const a = parseDateInput(earlier);
  const b = parseDateInput(later);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${integer.format(count)} ${count === 1 ? singular : plural}`;
}

/** Lower-case, hyphen-separated slug from arbitrary text. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Truncates on a word boundary and appends an ellipsis character. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
