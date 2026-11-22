import { useElapsed } from "../hooks/useElapsed";
import type { WorkflowResponse } from "../api/types";
import { experienceLabel, formatClock, shortId } from "../lib/format";
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconShield,
} from "./Icons";
import { StatusBadge } from "./StatusBadge";

interface RunProgressProps {
  run: WorkflowResponse;
  onNewPlan: () => void;
  onCopyId: () => void;
}

const STAGES = [
  {
    title: "Supervisor",
    description: "Строит план задач и проверяет зависимости.",
  },
  {
    title: "ProfileAgent",
    description: "Нормализует профиль и ищет недостающие поля.",
  },
  {
    title: "Training + Safety",
    description: "Собирают план и проверяют нагрузку параллельно.",
  },
  {
    title: "Сборка результата",
    description: "Валидирует ответы агентов и объединяет их.",
  },
];

function readMeta(
  userData: Record<string, unknown> | undefined,
): Array<{ label: string; value: string }> {
  if (!userData) {
    return [];
  }

  const rows: Array<{ label: string; value: string }> = [];
  if (typeof userData.goal === "string" && userData.goal) {
    rows.push({ label: "Цель", value: userData.goal });
  }
  if (typeof userData.experience_level === "string") {
    rows.push({
      label: "Уровень",
      value: experienceLabel(userData.experience_level),
    });
  }
  if (typeof userData.days_per_week === "number") {
    rows.push({
      label: "Дней в неделю",
      value: String(userData.days_per_week),
    });
  }
  if (typeof userData.minutes_per_session === "number") {
    rows.push({
      label: "Минут на занятие",
      value: String(userData.minutes_per_session),
    });
  }
  return rows;
}

export function RunProgress({ run, onNewPlan, onCopyId }: RunProgressProps) {
  const elapsed = useElapsed(run.created_at);
  const stageIndex =
    run.status === "queued" ? 0 : elapsed < 3 ? 1 : elapsed < 12 ? 2 : 3;
  const meta = readMeta(run.user_data);
  const slowQueue = run.status === "queued" && elapsed > 15;
  const slowRun = run.status === "running" && elapsed > 45;

  return (
    <section className="run-shell">
      <div className="run-topline">
        <button type="button" className="btn btn--ghost" onClick={onNewPlan}>
          <IconArrowLeft />
          Новый план
        </button>
        <span className="run-id">
          <span className="mono">#{shortId(run.run_id)}</span>
          <button type="button" onClick={onCopyId}>
            <IconCopy />
            Копировать ID
          </button>
        </span>
      </div>

      <div className="card progress-card">
        <div className="progress-card__top">
          <StatusBadge status={run.status} busy />
          <span className="progress-elapsed">{formatClock(elapsed)}</span>
        </div>

        <h1>Готовим ваш план</h1>
        <p>
          Supervisor уже распределил задачи между агентами. Обычно это занимает
          несколько секунд — страницу можно не обновлять.
        </p>
        <span className="sr-only" aria-live="polite">
          Статус запуска: {run.status}
        </span>

        <ol className="stage-list">
          {STAGES.map((stage, index) => {
            const state =
              index < stageIndex
                ? "is-done"
                : index === stageIndex
                  ? "is-active"
                  : "";
            return (
              <li key={stage.title} className={`stage ${state}`}>
                <span className="stage__marker">
                  {index < stageIndex ? (
                    <IconCheck />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <div className="stage__body">
                  <div className="stage__title">
                    {stage.title}
                    {index === stageIndex ? (
                      <span className="stage__state">сейчас</span>
                    ) : null}
                  </div>
                  <div className="stage__desc">{stage.description}</div>
                </div>
              </li>
            );
          })}
        </ol>

        {slowQueue || slowRun ? (
          <div className="notice-inline notice-inline--warning" role="status">
            <IconShield />
            <div>
              {slowQueue
                ? "Задача в очереди дольше обычного. Проверьте, что Worker запущен и подключён к Redis."
                : "Агенты работают дольше обычного: LLM-провайдер может отвечать медленно. Запуск продолжается."}
            </div>
          </div>
        ) : null}
      </div>

      <div className="run-preview">
        <div className="card">
          <div className="card__head">
            <div>
              <h2>Ваш запрос</h2>
              <p>Проверьте детали, пока агенты работают.</p>
            </div>
          </div>
          <p className="run-request">{run.request}</p>
          {meta.length ? (
            <>
              <div className="divider" />
              <div className="meta-grid">
                {meta.map((row) => (
                  <div key={row.label}>
                    <span className="meta__label">{row.label}</span>
                    <span className="meta__value">{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
