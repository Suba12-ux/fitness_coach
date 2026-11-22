import { describe, expect, it } from "vitest";

import {
  capitalizeFirst,
  formatDuration,
  parseApiDate,
  pluralize,
} from "./format";

describe("pluralize", () => {
  it("picks the correct Russian plural form", () => {
    const forms: [string, string, string] = [
      "тренировка",
      "тренировки",
      "тренировок",
    ];

    expect(pluralize(1, forms)).toBe("тренировка");
    expect(pluralize(3, forms)).toBe("тренировки");
    expect(pluralize(11, forms)).toBe("тренировок");
    expect(pluralize(21, forms)).toBe("тренировка");
  });
});

describe("formatDuration", () => {
  it("handles sub-second and minute durations", () => {
    expect(
      formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:00.200Z"),
    ).toBe("< 1 с");
    expect(
      formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:02:05Z"),
    ).toBe("2 мин 5 с");
    expect(formatDuration(null, "2026-01-01T00:02:05Z")).toBeNull();
  });
});

describe("capitalizeFirst", () => {
  it("capitalizes only the first letter", () => {
    expect(capitalizeFirst("общая физическая форма")).toBe(
      "Общая физическая форма",
    );
    expect(capitalizeFirst("Развитие силы")).toBe("Развитие силы");
    expect(capitalizeFirst("")).toBe("");
  });
});

describe("parseApiDate", () => {
  it("treats timestamps without an offset as UTC", () => {
    expect(parseApiDate("2026-01-01T12:00:00")?.toISOString()).toBe(
      "2026-01-01T12:00:00.000Z",
    );
    expect(parseApiDate("2026-01-01T12:00:00+03:00")?.toISOString()).toBe(
      "2026-01-01T09:00:00.000Z",
    );
    expect(parseApiDate("not-a-date")).toBeNull();
    expect(parseApiDate(null)).toBeNull();
  });
});

