// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => {
  class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }
  return {
    ApiError,
    api: {
      getProfile: vi.fn(),
      putProfile: vi.fn(),
    },
  };
});

import { ApiError, api } from "../api/client";
import type { Profile } from "../api/types";
import { ProfilePage } from "./ProfilePage";

const getProfile = vi.mocked(api.getProfile);
const putProfile = vi.mocked(api.putProfile);

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    goal: "выносливость",
    age: 30,
    weight_kg: 75,
    height_cm: 178,
    experience_level: "beginner",
    days_per_week: 4,
    minutes_per_session: 50,
    limitations: ["колено"],
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves a profile from the empty state", async () => {
    getProfile.mockRejectedValue(new ApiError("not found", 404));
    putProfile.mockResolvedValue(profile({ goal: "сила", age: null }));
    const notify = vi.fn();

    render(<ProfilePage notify={notify} />);

    expect(
      await screen.findByText(/Профиль ещё не сохранён/),
    ).toBeTruthy();

    await userEvent.type(
      screen.getByLabelText(/Цель тренировок/i),
      "сила",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Сохранить профиль/i }),
    );

    await waitFor(() => expect(putProfile).toHaveBeenCalledTimes(1));
    const payload = putProfile.mock.calls[0][0];
    expect(payload.goal).toBe("сила");
    expect(payload.age).toBeNull();
    expect(payload.limitations).toEqual([]);
    expect(notify).toHaveBeenCalledWith("Профиль сохранён.", "success");
  });

  it("loads and updates an existing profile", async () => {
    getProfile.mockResolvedValue(profile());
    putProfile.mockResolvedValue(profile({ goal: "сила" }));

    render(<ProfilePage notify={vi.fn()} />);

    const goal = await screen.findByDisplayValue("выносливость");
    expect(
      (screen.getByLabelText(/Возраст/i) as HTMLInputElement).value,
    ).toBe("30");

    await userEvent.clear(goal);
    await userEvent.type(goal, "сила");
    await userEvent.click(
      screen.getByRole("button", { name: /Сохранить профиль/i }),
    );

    await waitFor(() => expect(putProfile).toHaveBeenCalledTimes(1));
    expect(putProfile.mock.calls[0][0]).toMatchObject({
      goal: "сила",
      age: 30,
      days_per_week: 4,
      limitations: ["колено"],
    });
  });

  it("shows a validation error for invalid numbers", async () => {
    getProfile.mockRejectedValue(new ApiError("not found", 404));
    const notify = vi.fn();

    render(<ProfilePage notify={notify} />);

    await screen.findByText(/Профиль ещё не сохранён/);
    await userEvent.type(screen.getByLabelText(/Возраст/i), "5");
    await userEvent.click(
      screen.getByRole("button", { name: /Сохранить профиль/i }),
    );

    expect(await screen.findByText(/Возраст — от 10 до 100/)).toBeTruthy();
    expect(putProfile).not.toHaveBeenCalled();
  });

  it("shows a load error with retry", async () => {
    getProfile.mockRejectedValue(new Error("backend down"));

    render(<ProfilePage notify={vi.fn()} />);

    expect(
      await screen.findByText("Не удалось загрузить профиль"),
    ).toBeTruthy();
    expect(screen.getByText("backend down")).toBeTruthy();
  });
});
