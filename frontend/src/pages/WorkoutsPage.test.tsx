// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    getWorkoutStats: vi.fn(),
    listPrograms: vi.fn(),
    listExerciseNames: vi.fn(),
    listWorkouts: vi.fn(),
    getExerciseProgress: vi.fn(),
  },
}));

import { api } from "../api/client";
import type { WorkoutStats } from "../api/types";
import { WorkoutsPage } from "./WorkoutsPage";

const getWorkoutStats = vi.mocked(api.getWorkoutStats);
const listPrograms = vi.mocked(api.listPrograms);
const listExerciseNames = vi.mocked(api.listExerciseNames);
const listWorkouts = vi.mocked(api.listWorkouts);

function stats(overrides: Partial<WorkoutStats> = {}): WorkoutStats {
  return {
    completed_total: 0,
    completed_last_7_days: 0,
    completed_last_30_days: 0,
    by_program: [],
    recent_dates: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <WorkoutsPage
      notify={vi.fn()}
      onOpenWorkout={vi.fn()}
      onCreateWorkout={vi.fn()}
    />,
  );
}

describe("WorkoutsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkoutStats.mockResolvedValue(stats());
    listPrograms.mockResolvedValue({ items: [], total: 0 });
    listExerciseNames.mockResolvedValue({ items: [] });
    listWorkouts.mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty history and statistics", async () => {
    renderPage();

    expect(await screen.findByText("Тренировок пока нет")).toBeTruthy();
    expect(screen.getByText("завершено всего")).toBeTruthy();
    expect(
      screen.getByText(/Завершите тренировку с упражнениями и весом/),
    ).toBeTruthy();
  });

  it("shows a load error with retry", async () => {
    listWorkouts.mockRejectedValue(new Error("backend down"));

    renderPage();

    expect(await screen.findByText("backend down")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Повторить/i }),
    ).toBeTruthy();
  });
});
