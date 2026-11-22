import { describe, expect, it } from "vitest";

import {
  columnsFor,
  createSetDrafts,
  draftToPayload,
  formatPlanned,
  plannedSetCount,
  setsToDrafts,
  totalVolume,
  validateSetDraft,
} from "./training";

describe("formatPlanned", () => {
  it("formats sets, reps, weight and duration", () => {
    expect(formatPlanned({ sets: 3, reps: 10 })).toBe("3×10");
    expect(formatPlanned({ sets: 3, reps: 10, weight_kg: 40 })).toBe(
      "3×10 · 40 кг",
    );
    expect(formatPlanned({ duration_min: 20 })).toBe("20 мин");
    expect(formatPlanned({ sets: 6, duration_min: 1 })).toBe(
      "6 подх. · 1 мин",
    );
  });

  it("handles empty plans", () => {
    expect(formatPlanned(null)).toBe("—");
    expect(formatPlanned({})).toBe("—");
  });
});

describe("plannedSetCount", () => {
  it("uses planned sets when valid", () => {
    expect(plannedSetCount({ sets: 4 })).toBe(4);
    expect(plannedSetCount({ sets: 0 })).toBe(3);
    expect(plannedSetCount({ sets: 99 })).toBe(3);
    expect(plannedSetCount(null)).toBe(3);
  });
});

describe("validateSetDraft", () => {
  it("allows skipped sets", () => {
    expect(
      validateSetDraft({
        reps: "",
        weight: "",
        duration: "",
        distance: "",
        skipped: true,
      }),
    ).toBeNull();
  });

  it("requires a result for non-skipped sets", () => {
    expect(
      validateSetDraft({
        reps: "",
        weight: "40",
        duration: "",
        distance: "",
        skipped: false,
      }),
    ).toContain("повторения");
  });

  it("accepts reps, duration or distance", () => {
    const base = {
      reps: "",
      weight: "",
      duration: "",
      distance: "",
      skipped: false,
    };
    expect(validateSetDraft({ ...base, reps: "12" })).toBeNull();
    expect(validateSetDraft({ ...base, duration: "60" })).toBeNull();
    expect(validateSetDraft({ ...base, distance: "1500" })).toBeNull();
  });

  it("rejects invalid numbers", () => {
    const base = {
      reps: "",
      weight: "",
      duration: "",
      distance: "",
      skipped: false,
    };
    expect(validateSetDraft({ ...base, reps: "abc" })).toContain(
      "числовые",
    );
    expect(validateSetDraft({ ...base, reps: "-2" })).toContain(
      "Повторения",
    );
    expect(validateSetDraft({ ...base, reps: "5", weight: "-1" })).toContain(
      "Вес",
    );
    expect(validateSetDraft({ ...base, duration: "0" })).toContain(
      "Длительность",
    );
  });
});

describe("conversion helpers", () => {
  it("converts saved sets to drafts and back", () => {
    const drafts = setsToDrafts([
      {
        id: "1",
        position: 1,
        reps: 10,
        weight_kg: 40,
        duration_sec: null,
        distance_m: null,
        skipped: false,
      },
      {
        id: "2",
        position: 2,
        reps: null,
        weight_kg: null,
        duration_sec: null,
        distance_m: null,
        skipped: true,
      },
    ]);

    expect(drafts[0]).toEqual({
      reps: "10",
      weight: "40",
      duration: "",
      distance: "",
      skipped: false,
    });
    expect(drafts[1].skipped).toBe(true);
    expect(draftToPayload(drafts[0])).toEqual({
      reps: 10,
      weight_kg: 40,
      duration_sec: null,
      distance_m: null,
    });
    expect(draftToPayload(drafts[1])).toEqual({ skipped: true });
  });

  it("creates at least one draft", () => {
    expect(createSetDrafts(0)).toHaveLength(1);
    expect(createSetDrafts(4)).toHaveLength(4);
  });
});

describe("columnsFor", () => {
  it("shows reps and weight by default", () => {
    expect(columnsFor(null, [])).toEqual({
      reps: true,
      weight: true,
      duration: false,
      distance: false,
    });
  });

  it("shows duration for cardio plans", () => {
    const columns = columnsFor({ duration_min: 20 }, []);
    expect(columns.duration).toBe(true);
    expect(columns.reps).toBe(false);
    expect(columns.weight).toBe(false);
  });

  it("allows weight for rep-based exercises", () => {
    expect(columnsFor({ sets: 3, reps: 10 }, []).weight).toBe(true);
  });
});

describe("totalVolume", () => {
  it("sums reps times weight, ignoring skipped sets", () => {
    expect(
      totalVolume([
        {
          sets: [
            { reps: 10, weight_kg: 40 },
            { reps: 8, weight_kg: 45 },
            { skipped: true },
          ],
        },
      ]),
    ).toBe(760);
  });
});
