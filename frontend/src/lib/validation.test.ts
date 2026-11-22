import { describe, expect, it } from "vitest";

import {
  EMPTY_FORM,
  buildPayload,
  formFromUserData,
  validateForm,
} from "./validation";

describe("validateForm", () => {
  it("reports missing required fields and out-of-range values", () => {
    const errors = validateForm({
      ...EMPTY_FORM,
      age: "abc",
      days: 7,
      minutes: 5,
    });

    expect(errors.request).toBeTruthy();
    expect(errors.goal).toBeTruthy();
    expect(errors.age).toBeTruthy();
    expect(errors.days).toBeTruthy();
    expect(errors.minutes).toBeTruthy();
  });

  it("accepts a complete profile and ignores empty optional metrics", () => {
    const errors = validateForm({
      ...EMPTY_FORM,
      request: "Недельный план тренировок",
      goal: "развитие силы",
    });

    expect(errors).toEqual({});
  });

  it("rejects metrics outside the supported ranges", () => {
    const errors = validateForm({
      ...EMPTY_FORM,
      request: "Недельный план тренировок",
      goal: "развитие силы",
      weight: "10",
      height: "260",
    });

    expect(errors.weight).toBeTruthy();
    expect(errors.height).toBeTruthy();
  });
});

describe("buildPayload", () => {
  it("trims values, omits empty optional fields and deduplicates limitations", () => {
    const payload = buildPayload({
      ...EMPTY_FORM,
      request: "  План на неделю  ",
      goal: "  сила  ",
      limitations: [" колено ", " ", "колено"],
    });

    expect(payload).toEqual({
      request: "План на неделю",
      user_data: {
        goal: "сила",
        experience_level: "beginner",
        days_per_week: 3,
        minutes_per_session: 45,
        limitations: ["колено"],
      },
    });
  });

  it("converts optional metrics to numbers", () => {
    const payload = buildPayload({
      ...EMPTY_FORM,
      request: "План",
      goal: "форма",
      age: "30",
      weight: "75",
      height: "178",
    });

    expect(payload.user_data).toMatchObject({
      age: 30,
      weight_kg: 75,
      height_cm: 178,
    });
  });
});

describe("formFromUserData", () => {
  it("restores the form from a saved run", () => {
    const form = formFromUserData("Запрос", {
      goal: "сила",
      age: 30,
      days_per_week: 4,
      minutes_per_session: 60,
      experience_level: "advanced",
      limitations: ["колено", 42],
    });

    expect(form).toMatchObject({
      request: "Запрос",
      goal: "сила",
      age: "30",
      days: 4,
      minutes: 60,
      experience: "advanced",
      limitations: ["колено"],
    });
  });
});
