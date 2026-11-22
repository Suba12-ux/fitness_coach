// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    listPrograms: vi.fn(),
    archiveProgram: vi.fn(),
    patchProgram: vi.fn(),
  },
}));

import { api } from "../api/client";
import type { ProgramSummary } from "../api/types";
import { ProgramsPage } from "./ProgramsPage";

const listPrograms = vi.mocked(api.listPrograms);
const archiveProgram = vi.mocked(api.archiveProgram);

function program(overrides: Partial<ProgramSummary> = {}): ProgramSummary {
  return {
    id: "p1",
    name: "Силовая программа",
    description: null,
    goal: "сила",
    status: "active",
    source_run_id: "run-1",
    planned_workouts_count: 3,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

describe("ProgramsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty state", async () => {
    listPrograms.mockResolvedValue({ items: [], total: 0 });

    render(
      <ProgramsPage
        notify={vi.fn()}
        onOpenProgram={vi.fn()}
        onCreatePlan={vi.fn()}
      />,
    );

    expect(await screen.findByText("Нет активной программы")).toBeTruthy();
  });

  it("opens a program from the list", async () => {
    listPrograms.mockResolvedValue({ items: [program()], total: 1 });
    const onOpenProgram = vi.fn();

    render(
      <ProgramsPage
        notify={vi.fn()}
        onOpenProgram={onOpenProgram}
        onCreatePlan={vi.fn()}
      />,
    );

    expect(await screen.findByText("Силовая программа")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Открыть/i }));

    expect(onOpenProgram).toHaveBeenCalledWith("p1");
  });

  it("archives a program after confirmation", async () => {
    listPrograms
      .mockResolvedValueOnce({ items: [program()], total: 1 })
      .mockResolvedValue({ items: [], total: 0 });
    archiveProgram.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const notify = vi.fn();

    render(
      <ProgramsPage
        notify={notify}
        onOpenProgram={vi.fn()}
        onCreatePlan={vi.fn()}
      />,
    );

    await screen.findByText("Силовая программа");
    await userEvent.click(
      screen.getByRole("button", { name: "В архив" }),
    );

    await waitFor(() => expect(archiveProgram).toHaveBeenCalledWith("p1"));
    expect(confirm).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "Программа перемещена в архив.",
      "success",
    );
  });

  it("shows a load error with retry", async () => {
    listPrograms.mockRejectedValue(new Error("backend down"));

    render(
      <ProgramsPage
        notify={vi.fn()}
        onOpenProgram={vi.fn()}
        onCreatePlan={vi.fn()}
      />,
    );

    expect(await screen.findByText("backend down")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Повторить/i }),
    ).toBeTruthy();
  });
});
