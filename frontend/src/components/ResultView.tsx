import { useState } from "react";

import type { ToastTone } from "../hooks/useToasts";
import type {
  SafetyIssueData,
  SafetySeverity,
  UserProfileData,
  WorkflowResponse,
} from "../api/types";
import { copyText, downloadFile, runFileStem } from "../lib/download";
import {
  capitalizeFirst,
  experienceLabel,
  fieldLabel,
  formatDateTime,
  formatDuration,
  pluralize,
  shortId,
} from "../lib/format";
import { buildPlanMarkdown } from "../lib/markdown";
import { formatPlanned } from "../lib/training";
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCopy,
  IconDownload,
  IconInfo,
  IconRefresh,
  IconShield,
} from "./Icons";
import { SaveProgramDialog } from "./SaveProgramDialog";
import { StatusBadge } from "./StatusBadge";

interface ResultViewProps {
  run: WorkflowResponse;
  onNewPlan: () => void;
  onRefine: () => void;
  onRetry: () => void;
  onOpenProgram?: (programId: string) => void;
  notify: (message: string, tone?: ToastTone) => void;
}

function ageText(age?: number | null): string {
  if (age == null) {
    return "—";
  }
  return `${age} ${pluralize(age, ["год", "года", "лет"])}`;
}

function issuesOf(run: WorkflowResponse): SafetyIssueData[] {
  const final = run.final_answer;
  return final?.safety?.issues ?? final?.safety_issues ?? [];
}

function IssueIcon({ severity }: { severity: SafetySeverity }) {
  if (severity === "info") {
    return <IconInfo />;
  }
  return <IconAlert />;
}

function ProfilePanel({ profile }: { profile?: UserProfileData }) {
  if (!profile) {
    return (
      <section className="card">
        <h3>Профиль</h3>
        <p className="muted" style={{ marginTop: 10 }}>
          В ответе нет сохранённого профиля. Полный ответ доступен в JSON.
        </p>
      </section>
    );
  }

  const limitations = profile.limitations ?? [];

  return (
    <section className="card">
      <h3>Профиль</h3>
      <dl className="profile-rows">
        <div className="profile-row">
          <dt>Цель</dt>
          <dd>{profile.goal || "—"}</dd>
        </div>
        <div className="profile-row">
          <dt>Уровень</dt>
          <dd>{experienceLabel(profile.experience_level)}</dd>
        </div>
        <div className="profile-row">
          <dt>Возраст</dt>
          <dd>{ageText(profile.age)}</dd>
        </div>
        <div className="profile-row">
          <dt>Вес</dt>
          <dd>{profile.weight_kg != null ? `${profile.weight_kg} кг` : "—"}</dd>
        </div>
        <div className="profile-row">
          <dt>Рост</dt>
          <dd>{profile.height_cm != null ? `${profile.height_cm} см` : "—"}</dd>
        </div>
        <div className="profile-row">
          <dt>Дней в неделю</dt>
          <dd>{profile.days_per_week ?? "—"}</dd>
        </div>
        <div className="profile-row">
          <dt>Минут на занятие</dt>
          <dd>
            {profile.minutes_per_session != null
              ? `${profile.minutes_per_session} мин`
              : "—"}
          </dd>
        </div>
      </dl>
      {limitations.length ? (
        <div className="tag-cloud">
          {limitations.map((item) => (
            <span key={item} className="pill">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ResultView({
  run,
  onNewPlan,
  onRefine,
  onRetry,
  onOpenProgram,
  notify,
}: ResultViewProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const final = run.final_answer ?? {};
  const plan = final.plan;
  const profile = final.profile;
  const issues = issuesOf(run);
  const warnings = final.warnings ?? [];
  const missing = run.missing_data?.length
    ? run.missing_data
    : (final.missing_data ?? []);
  const duration = formatDuration(run.started_at ?? run.created_at, run.finished_at);
  const stem = runFileStem(run.run_id);

  const copyRunId = async () => {
    try {
      await copyText(run.run_id);
      notify("ID запуска скопирован.", "success");
    } catch {
      notify("Не удалось скопировать ID.", "error");
    }
  };

  const copyJson = async () => {
    try {
      await copyText(JSON.stringify(run, null, 2));
      notify("JSON ответа скопирован.", "success");
    } catch {
      notify("Не удалось скопировать JSON.", "error");
    }
  };

  const downloadJson = () => {
    downloadFile(
      `${stem}.json`,
      JSON.stringify(run, null, 2),
      "application/json;charset=utf-8",
    );
    notify("JSON-файл скачан.", "success");
  };

  const downloadMarkdown = () => {
    downloadFile(
      `${stem}.md`,
      buildPlanMarkdown(run),
      "text/markdown;charset=utf-8",
    );
    notify("Markdown-файл скачан.", "success");
  };

  const topLine = (
    <div className="run-topline">
      <button type="button" className="btn btn--ghost" onClick={onNewPlan}>
        <IconArrowLeft />
        Новый план
      </button>
      <span className="run-id">
        <span className="mono">#{shortId(run.run_id)}</span>
        <button type="button" onClick={copyRunId}>
          <IconCopy />
          Копировать ID
        </button>
      </span>
    </div>
  );

  if (run.status === "needs_info") {
    return (
      <section className="result">
        {topLine}
        <div className="card notice-card notice-card--warning">
          <span className="notice-card__icon">
            <IconInfo />
          </span>
          <StatusBadge status={run.status} />
          <h1>Не хватает данных для плана</h1>
          <p>
            {final.message ??
              "Профиль заполнен не полностью: агент не выдумывает данные, а просит их добавить."}
          </p>
          {missing.length ? (
            <div className="missing-list">
              {missing.map((field) => (
                <span key={field} className="pill">
                  {fieldLabel(field)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="notice-actions">
            <button type="button" className="btn btn--primary" onClick={onRefine}>
              Дополнить профиль
              <IconArrowRight />
            </button>
            <button type="button" className="btn btn--secondary" onClick={onNewPlan}>
              Новый план
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (run.status === "failed" || run.status === "cancelled") {
    const failed = run.status === "failed";
    return (
      <section className="result">
        {topLine}
        <div
          className={`card notice-card ${
            failed ? "notice-card--danger" : "notice-card--info"
          }`}
        >
          <span className="notice-card__icon">
            <IconAlert />
          </span>
          <StatusBadge status={run.status} />
          <h1>
            {failed ? "Не удалось собрать план" : "Запуск был отменён"}
          </h1>
          <p>
            {final.message ??
              (failed
                ? "Worker вернул ошибку. Проверьте логи backend и worker, затем повторите запуск."
                : "Запуск не был завершён. Можно отправить запрос заново.")}
          </p>
          {(run.error || final.error) && (
            <div className="error-text">{run.error ?? final.error}</div>
          )}
          <div className="notice-actions">
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              <IconRefresh />
              Повторить запуск
            </button>
            <button type="button" className="btn btn--secondary" onClick={onRefine}>
              Изменить запрос
            </button>
            <button type="button" className="btn btn--ghost" onClick={onNewPlan}>
              Новый план
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="result">
        {topLine}
        <div className="card notice-card notice-card--info">
          <span className="notice-card__icon">
            <IconInfo />
          </span>
          <StatusBadge status={run.status} />
          <h1>В ответе нет тренировочного плана</h1>
          <p>
            Запуск завершился без плана. Проверьте сырой ответ и попробуйте
            повторить запрос.
          </p>
          <div className="notice-actions">
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              <IconRefresh />
              Повторить запуск
            </button>
            <button type="button" className="btn btn--secondary" onClick={onNewPlan}>
              Новый план
            </button>
          </div>
        </div>
      </section>
    );
  }

  const sessions = plan.sessions ?? [];
  const assumptions = plan.assumptions ?? [];
  const limitations = plan.limitations ?? [];
  const goal = capitalizeFirst(
    plan.goal || profile?.goal || "Тренировочный план",
  );

  return (
    <section className="result">
      {topLine}

      <div className="result-head">
        <div className="result-head__main">
          <StatusBadge status={run.status} />
          <h1>{goal}</h1>
          <p className="result-head__request">{run.request}</p>
          <div className="result-meta">
            <span>
              <IconCalendar />
              {formatDateTime(run.finished_at ?? run.created_at)}
            </span>
            {duration ? (
              <span>
                <IconClock />
                {duration}
              </span>
            ) : null}
            <span className="mono">#{shortId(run.run_id)}</span>
          </div>
        </div>

        <div className="result-actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={copyJson}
            title="Скопировать JSON ответа"
          >
            <IconCopy />
            Копировать JSON
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={downloadJson}
            title="Скачать JSON"
          >
            <IconDownload />
            JSON
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={downloadMarkdown}
            title="Скачать Markdown"
          >
            <IconDownload />
            Markdown
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setSaveOpen(true)}
          >
            Сохранить как программу
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onNewPlan}
          >
            Новый план
          </button>
        </div>
      </div>

      <div className="result-grid">
        <div className="result-col">
          <section className="card plan-card">
            <div className="card__head">
              <div>
                <h2>Недельный план</h2>
                <p>Черновик, который можно адаптировать под себя.</p>
              </div>
              <span className="pill">
                {sessions.length}{" "}
                {pluralize(sessions.length, [
                  "тренировка",
                  "тренировки",
                  "тренировок",
                ])}
              </span>
            </div>

            {sessions.length ? (
              <div className="session-grid">
                {sessions.map((session, index) => (
                  <article key={`${session.day}-${session.activity}`} className="session">
                    <span className="session__index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="session__day">{session.day}</span>
                    <h3>{session.activity}</h3>
                    <span className="session__duration">
                      <IconClock />
                      {session.duration_min} мин
                    </span>
                    {session.exercises?.length ? (
                      <ul className="bullet-list session__exercises">
                        {session.exercises.map((exercise, exerciseIndex) => (
                          <li key={`${exercise.name}-${exerciseIndex}`}>
                            {exercise.name} —{" "}
                            {formatPlanned({
                              sets: exercise.sets,
                              reps: exercise.reps,
                              weight_kg: exercise.weight_kg,
                              duration_min: exercise.duration_min,
                            })}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-note">
                <IconInfo />
                В плане нет тренировок.
              </div>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2>Проверка безопасности</h2>
                <p>Программные правила поверх ответа агентов.</p>
              </div>
              {issues.length ? (
                <span className="pill">{issues.length}</span>
              ) : null}
            </div>

            {issues.length ? (
              <div className="issue-list">
                {issues.map((issue, index) => (
                  <div
                    key={`${issue.severity}-${index}`}
                    className={`issue issue--${issue.severity}`}
                  >
                    <IssueIcon severity={issue.severity} />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-note">
                <IconCheck />
                Проверка не выявила замечаний.
              </div>
            )}
          </section>

          <div className="two-col">
            <section className="card">
              <h3>Предположения</h3>
              {assumptions.length ? (
                <ul className="bullet-list" style={{ marginTop: 12 }}>
                  {assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                  Не зафиксированы.
                </p>
              )}
            </section>

            <section className="card">
              <h3>Ограничения</h3>
              {limitations.length ? (
                <ul className="bullet-list" style={{ marginTop: 12 }}>
                  {limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                  Не указаны.
                </p>
              )}
            </section>
          </div>

          {warnings.length ? (
            <section className="card">
              <h3>Предупреждения агентов</h3>
              <ul className="bullet-list warning-list" style={{ marginTop: 12 }}>
                {warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="result-col result-col--side">
          <ProfilePanel profile={profile} />

          <section className="card disclaimer-card">
            <span className="tip-card__head tip-card__head--muted">
              <IconShield />
              Безопасность
            </span>
            <p>
              План — учебный черновик. Перед началом тренировок
              проконсультируйтесь со специалистом, особенно при ограничениях по
              здоровью.
            </p>
          </section>

          <details className="raw-card card">
            <summary>
              Сырой JSON ответа
              <IconChevronDown />
            </summary>
            <pre>{JSON.stringify(run, null, 2)}</pre>
          </details>
        </aside>
      </div>

      <SaveProgramDialog
        open={saveOpen}
        runId={run.run_id}
        defaultName={plan.goal || "Тренировочная программа"}
        onClose={() => setSaveOpen(false)}
        onSaved={(programId) => {
          setSaveOpen(false);
          onOpenProgram?.(programId);
        }}
        notify={notify}
      />
    </section>
  );
}
