import { describe, expect, it } from "vitest";

import { isInFlight, isTerminal, statusMeta } from "./status";

describe("statusMeta", () => {
  it("maps known statuses to Russian labels and tones", () => {
    expect(statusMeta("completed")).toMatchObject({
      label: "Готово",
      tone: "success",
    });
    expect(statusMeta("needs_info")).toMatchObject({
      label: "Нужны данные",
      tone: "warning",
    });
  });

  it("falls back to a neutral label for unknown statuses", () => {
    expect(statusMeta("paused")).toMatchObject({
      label: "paused",
      tone: "neutral",
    });
  });
});

describe("status predicates", () => {
  it("treats queued and running as in flight", () => {
    expect(isInFlight("queued")).toBe(true);
    expect(isInFlight("running")).toBe(true);
    expect(isInFlight("completed")).toBe(false);
  });

  it("treats final statuses as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("needs_info")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("running")).toBe(false);
  });
});
