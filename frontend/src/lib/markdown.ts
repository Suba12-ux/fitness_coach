import type { SafetyIssueData, WorkflowResponse } from "../api/types";
import {
  experienceLabel,
  fieldLabel,
  formatDateTime,
  formatDuration,
} from "./format";

function addList(lines: string[], title: string, items?: string[]): void {
  const values = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (!values.length) {
    return;
  }
  lines.push(`## ${title}`, "", ...values.map((item) => `- ${item}`), "");
}

export function buildPlanMarkdown(run: WorkflowResponse): string {
  const final = run.final_answer ?? {};
  const profile = final.profile ?? {};
  const plan = final.plan;
  const issues: SafetyIssueData[] =
    final.safety?.issues ?? final.safety_issues ?? [];

  const lines: string[] = ["# План тренировок — Sensei", ""];

  lines.push(`**Запрос:** ${run.request}`, "");
  lines.push(
    `- Статус: ${run.status}`,
    `- Запуск: ${run.run_id}`,
    `- Создан: ${formatDateTime(run.created_at)}`,
  );

  const duration = formatDuration(run.started_at, run.finished_at);
  if (duration) {
    lines.push(`- Время выполнения: ${duration}`);
  }
  lines.push("");

  if (run.error) {
    lines.push(`> Ошибка: ${run.error}`, "");
  }

  const profileRows: string[] = [];
  if (profile.goal) {
    profileRows.push(`- Цель: ${profile.goal}`);
  }
  if (profile.experience_level) {
    profileRows.push(
      `- Уровень подготовки: ${experienceLabel(profile.experience_level)}`,
    );
  }
  if (profile.age != null) {
    profileRows.push(`- Возраст: ${profile.age}`);
  }
  if (profile.weight_kg != null) {
    profileRows.push(`- Вес: ${profile.weight_kg} кг`);
  }
  if (profile.height_cm != null) {
    profileRows.push(`- Рост: ${profile.height_cm} см`);
  }
  if (profile.days_per_week != null) {
    profileRows.push(`- Тренировок в неделю: ${profile.days_per_week}`);
  }
  if (profile.minutes_per_session != null) {
    profileRows.push(
      `- Длительность занятия: ${profile.minutes_per_session} мин`,
    );
  }
  if (profile.limitations?.length) {
    profileRows.push(`- Ограничения: ${profile.limitations.join(", ")}`);
  }

  if (profileRows.length) {
    lines.push("## Профиль", "", ...profileRows, "");
  }

  if (plan) {
    lines.push("## Недельный план", "");
    if (plan.goal) {
      lines.push(`Цель: **${plan.goal}**`, "");
    }
    lines.push("| День | Активность | Длительность |", "| --- | --- | --- |");
    for (const session of plan.sessions ?? []) {
      lines.push(
        `| ${session.day} | ${session.activity} | ${session.duration_min} мин |`,
      );
    }
    lines.push("");
  }

  if (issues.length) {
    lines.push("## Проверка безопасности", "");
    for (const issue of issues) {
      const mark = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      lines.push(`- ${mark} ${issue.message}`);
    }
    lines.push("");
  } else if (run.status === "completed") {
    lines.push("## Проверка безопасности", "", "Замечаний нет.", "");
  }

  addList(lines, "Предположения", plan?.assumptions);
  addList(lines, "Ограничения", plan?.limitations);
  addList(lines, "Предупреждения", final.warnings);
  addList(
    lines,
    "Недостающие данные",
    (run.missing_data?.length ? run.missing_data : final.missing_data)?.map(
      fieldLabel,
    ),
  );

  lines.push(
    "---",
    "",
    "*Сформировано мультиагентной системой Sensei. Учебный прототип: не является медицинской рекомендацией.*",
    "",
  );

  return lines.join("\n");
}
