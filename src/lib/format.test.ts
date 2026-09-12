import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatDate,
  formatInteger,
  formatMonthYear,
  formatUsd,
  formatUsdCompact,
  pluralize,
  slugify,
  toIsoDate,
  truncate,
} from "./format";

describe("money formatting", () => {
  it("never renders undisclosed amounts as zero", () => {
    expect(formatUsdCompact(null)).toBe("—");
    expect(formatUsd(null)).toBe("Undisclosed");
    expect(formatUsd(undefined)).toBe("Undisclosed");
  });

  it("formats compact and full amounts", () => {
    expect(formatUsdCompact(12_500_000)).toBe("$12.5M");
    expect(formatUsd(12_500_000)).toBe("$12,500,000");
    expect(formatInteger(1234)).toBe("1,234");
    expect(formatInteger(null)).toBe("—");
  });
});

describe("date formatting", () => {
  it("renders calendar dates in UTC without shifting the day", () => {
    expect(formatDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatDate("2026-03-12T23:30:00Z")).toBe("12 Mar 2026");
    expect(formatMonthYear("2024-11-01")).toBe("Nov 2024");
    expect(toIsoDate("2026-03-12T23:30:00Z")).toBe("2026-03-12");
  });

  it("renders a dash for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });

  it("computes whole days between dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-01-31", "2026-01-01")).toBe(-30);
  });
});

describe("text helpers", () => {
  it("slugifies unicode and punctuation", () => {
    expect(slugify("Kestrel Neural, Inc.")).toBe("kestrel-neural-inc");
    expect(slugify("Émilie Zoë")).toBe("emilie-zoe");
  });

  it("truncates on a word boundary with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("implanted interfaces for speech restoration", 20)).toBe(
      "implanted interfaces…",
    );
  });

  it("pluralises with formatted counts", () => {
    expect(pluralize(1, "source")).toBe("1 source");
    expect(pluralize(1200, "source")).toBe("1,200 sources");
  });
});
