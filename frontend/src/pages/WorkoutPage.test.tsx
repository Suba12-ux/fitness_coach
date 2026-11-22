// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    getWorkout: vi.fn(),
    saveWorkoutExercises: vi.fn(),
    patchWorkout: vi.fn(),
  },
}));

import { api } from "../api/client";
import type { WorkoutDetail, WorkoutSet } from "../api/types";
import { WorkoutPage } from "./WorkoutPage";

const getWorkout = vi.mocked(api.getWorkout);
const saveWorkoutExercises = vi.mocked(api.saveWorkoutExercises);
const patchWorkout = vi.mocked(api.patchWorkout);

function workout(overrides: Partial<WorkoutDetail> = {}): WorkoutDetail {
  return {
    id: "w1",
    title: "Силовая тренировка",
    status: "in_progress",
    program_id: "p1",
    planned_workout_id: "pw1",
    started_at: "2026-11-22T10:00:00Z",
    finished_at: null,
    created_at: "2026-11-22T10:00:00Z",
    perceived_exertion: null,
    comment: null,
    exercises: [
      {
        id: "e1",
        name: "Приседания",
        position: 1,
        planned: { sets: 1, reps: 10, weight_kg: 40 },
        comment: null,
        sets: [],
      },
    ],
    ...overrides,
  };
}

const savedSet: WorkoutSet = {
  id: "s1",
  position: 1,
  reps: 12,
  weight_kg: 40,
  duration_sec: null,
  distance_m: null,
  skipped: false,
};

describe("WorkoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("saves actual results", async () => {
    getWorkout.mockResolvedValue(workout());
    const saved = workout({
      exercises: [
        {
          id: "e1",
          name: "Приседания",
          position: 1,
          planned: { sets: 1, reps: 10, weight_kg: 40 },
          comment: null,
          sets: [savedSet],
        },
      ],
    });
    saveWorkoutExercises.mockResolvedValue(saved);
    patchWorkout.mockResolvedValue(saved);
    const notify = vi.fn();

    render(
      <WorkoutPage
        workoutId="w1"
        notify={notify}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue("Приседания")).toBeTruthy();
    await userEvent.type(
      screen.getByLabelText("Повторения, подход 1"),
      "12",
    );
    await userEvent.type(screen.getByLabelText("Вес, подход 1"), "40");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить" }),
    );

    await waitFor(() =>
      expect(saveWorkoutExercises).toHaveBeenCalledTimes(1),
    );
    const payload = saveWorkoutExercises.mock.calls[0][1];
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({
      name: "Приседания",
      sets: [{ reps: 12, weight_kg: 40 }],
    });
    expect(notify).toHaveBeenCalledWith("Результаты сохранены.", "success");
  });

  it("finishes a workout and shows a summary", async () => {
    getWorkout.mockResolvedValue(workout());
    const saved = workout({
      exercises: [
        {
          id: "e1",
          name: "Приседания",
          position: 1,
          planned: { sets: 1, reps: 10, weight_kg: 40 },
          comment: null,
          sets: [savedSet],
        },
      ],
    });
    saveWorkoutExercises.mockResolvedValue(saved);
    patchWorkout.mockResolvedValue({
      ...saved,
      status: "completed",
      finished_at: "2026-11-22T11:00:00Z",
    });
    const notify = vi.fn();

    render(
      <WorkoutPage
        workoutId="w1"
        notify={notify}
        onBack={vi.fn()}
      />,
    );

    await screen.findByDisplayValue("Приседания");
    await userEvent.type(
      screen.getByLabelText("Повторения, подход 1"),
      "12",
    );
    await userEvent.type(screen.getByLabelText("Вес, подход 1"), "40");
    await userEvent.click(
      screen.getByRole("button", { name: /Завершить тренировку/i }),
    );

    await waitFor(() =>
      expect(patchWorkout).toHaveBeenCalledWith("w1", {
        comment: null,
        perceived_exertion: null,
        status: "completed",
      }),
    );
    expect(notify).toHaveBeenCalledWith(
      "Тренировка завершена.",
      "success",
    );
    expect(await screen.findByText("Завершена")).toBeTruthy();
    expect(screen.getByText("12 повт. · 40 кг")).toBeTruthy();
  });

  it("restores an unsaved draft", async () => {
    getWorkout.mockResolvedValue(workout());
    window.sessionStorage.setItem(
      "sensei:workout-draft:w1",
      JSON.stringify({
        exercises: [
          {
            key: "e1",
            name: "Приседания",
            comment: "легко",
            planned: { sets: 1, reps: 10, weight_kg: 40 },
            sets: [
              {
                reps: "15",
                weight: "35",
                duration: "",
                distance: "",
                skipped: false,
              },
            ],
          },
        ],
        comment: "",
        perceivedExertion: "",
      }),
    );

    render(
      <WorkoutPage
        workoutId="w1"
        notify={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Восстановлен черновик/),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Повторения, подход 1") as HTMLInputElement)
        .value,
    ).toBe("15");
  });

  it("blocks saving a set without a result", async () => {
    getWorkout.mockResolvedValue(workout());
    const notify = vi.fn();

    render(
      <WorkoutPage
        workoutId="w1"
        notify={notify}
        onBack={vi.fn()}
      />,
    );

    await screen.findByDisplayValue("Приседания");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить" }),
    );

    expect(
      await screen.findByText(
        /Укажите повторения, длительность или дистанцию/,
      ),
    ).toBeTruthy();
    expect(saveWorkoutExercises).not.toHaveBeenCalled();
  });
});
