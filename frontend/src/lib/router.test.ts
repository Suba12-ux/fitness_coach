import { describe, expect, it } from "vitest";

import { hashFor, parseRoute } from "./router";

describe("parseRoute", () => {
  it("maps empty hash to compose", () => {
    expect(parseRoute("")).toEqual({ name: "compose", id: null });
    expect(parseRoute("#")).toEqual({ name: "compose", id: null });
  });

  it("parses legacy run and history hashes", () => {
    expect(parseRoute("#run/abc")).toEqual({ name: "run", id: "abc" });
    expect(parseRoute("#history")).toEqual({
      name: "generations",
      id: null,
    });
  });

  it("parses new sections", () => {
    expect(parseRoute("#programs")).toEqual({
      name: "programs",
      id: null,
    });
    expect(parseRoute("#programs/p1")).toEqual({
      name: "program",
      id: "p1",
    });
    expect(parseRoute("#workouts")).toEqual({
      name: "workouts",
      id: null,
    });
    expect(parseRoute("#workouts/w1")).toEqual({
      name: "workout",
      id: "w1",
    });
    expect(parseRoute("#profile")).toEqual({ name: "profile", id: null });
  });

  it("decodes identifiers", () => {
    expect(parseRoute("#programs/id%20with%20space")).toEqual({
      name: "program",
      id: "id with space",
    });
  });

  it("falls back for unknown or invalid hashes", () => {
    expect(parseRoute("#unknown")).toEqual({ name: "compose", id: null });
    expect(parseRoute("#run/")).toEqual({ name: "compose", id: null });
    expect(parseRoute("#programs/")).toEqual({
      name: "programs",
      id: null,
    });
  });
});

describe("hashFor", () => {
  it("builds hashes for all sections", () => {
    expect(hashFor({ name: "compose", id: null })).toBe("");
    expect(hashFor({ name: "run", id: "abc" })).toBe("#run/abc");
    expect(hashFor({ name: "generations", id: null })).toBe("#history");
    expect(hashFor({ name: "programs", id: null })).toBe("#programs");
    expect(hashFor({ name: "program", id: "p1" })).toBe("#programs/p1");
    expect(hashFor({ name: "workouts", id: null })).toBe("#workouts");
    expect(hashFor({ name: "workout", id: "w1" })).toBe("#workouts/w1");
    expect(hashFor({ name: "profile", id: null })).toBe("#profile");
  });

  it("round-trips identifiers with spaces", () => {
    const hash = hashFor({ name: "workout", id: "id with space" });
    expect(parseRoute(hash)).toEqual({
      name: "workout",
      id: "id with space",
    });
  });
});
