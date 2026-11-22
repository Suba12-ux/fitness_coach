import { describe, expect, it } from "vitest";

import type { WorkflowResponse } from "../api/types";
import { buildPlanMarkdown } from "./markdown";

function completedRun(): WorkflowResponse {
  return {
    run_id: "12345678-abcd",
    status: "completed",
    request: "Недельный план",
    created_at: "2026-01-10T09:00:00Z",
    started_at: "2026-01-10T09:00:02Z",
    finished_at: "2026-01-10T09:00:12Z",
    final_answer: {
      profile: {
        goal: "развитие силы",
        experience_level: "beginner",
        days_per_week: 3,
        minutes_per_session: 45,
      },
      plan: {
        goal: "развитие силы",
        sessions: [
          {
            day: "Понедельник",
            activity: "Силовая тренировка",
            duration_min: 45,
          },
        ],
        assumptions: ["Возраст не указан."],
        limitations: [],
      },
      safety: {
        issues: [
          { severity: "warning", message: "Нужна постепенность." },
        ],
      },
      warnings: ["Проконсультируйтесь со специалистом."],
    },
  };
}

describe("buildPlanMarkdown", () => {
  it("renders profile, sessions, safety issues and warnings", () => {
    const markdown = buildPlanMarkdown(completedRun());

    expect(markdown).toContain("# План тренировок — Sensei");
    expect(markdown).toContain("| Понедельник | Силовая тренировка | 45 мин |");
    expect(markdown).toContain("⚠️ Нужна постепенность.");
    expect(markdown).toContain("- Проконсультируйтесь со специалистом.");
    expect(markdown).toContain("- Возраст не указан.");
  });

  it("notes the absence of safety issues for a completed run", () => {
    const run = completedRun();
    const final = run.final_answer ?? {};
    run.final_answer = {
      ...final,
      safety: { issues: [] },
      warnings: [],
    };

    expect(buildPlanMarkdown(run)).toContain("Замечаний нет.");
  });
});
