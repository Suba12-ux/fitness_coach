import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import type { ProgramDetail, PlannedWorkout } from "../api/types";
import type { ToastTone } from "../hooks/useToasts";
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  pluralize,
} from "../lib/format";
import { formatPlanned } from "../lib/training";
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconClock,
  IconInfo,
  IconRefresh,
} from "../components/Icons";

interface ProgramPageProps {
  programId: string;
  notify: (message: string, tone?: ToastTone) => void;
  onBack: () => void;
  onOpenWorkout: (workoutId: string) => void;
  onOpenRun?: (runId: string) => void;
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить программу.";
}

function WorkoutCard({
  workout,
  busy,
  onStart,
  onContinue,
}: {
  workout: PlannedWorkout;
  busy: boolean;
  onStart: () => void;
  onContinue: () => void;
}) {
  const completed = workout.completed_sessions_count > 0;
  const inProgress = Boolean(workout.in_progress_session_id);

  return (
    <article className="plan-workout">
      <div className="plan-workout__head">
        <span className="plan-workout__index">
          {String(workout.position).padStart(2, "0")}
        </span>
        <div className="plan-workout__title">
          <h3>{workout.title}</h3>
          <div className="plan-workout__meta">
            {workout.day ? <span>{workout.day}</span> : null}
            {workout.duration_min ? (
              <span>
                <IconClock />
                {workout.duration_min} мин
              </span>
            ) : null}
            {workout.scheduled_date ? (
              <span>План: {formatDateOnly(workout.scheduled_date)}</span>
            ) : null}
          </div>
        </div>
        <div className="plan-workout__actions">
          {inProgress ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onContinue}
            >
              <IconArrowRight />
              Продолжить
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={onStart}
              disabled={busy}
            >
              {busy ? <span className="spinner" /> : <IconArrowRight />}
              {completed ? "Начать заново" : "Начать"}
            </button>
          )}
        </div>
      </div>

      {workout.exercises.length ? (
        <ul className="plan-workout__exercises">
          {workout.exercises.map((exercise) => (
            <li key={exercise.position}>
              <span>{exercise.name}</span>
              <span className="mono">{formatPlanned(exercise.planned)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-note">
          <IconInfo />
          Упражнения не указаны — состав можно вести самостоятельно.
        </div>
      )}

      <div className="plan-workout__status">
        {completed ? (
          <span className="status status--success">
            <span className="status__dot" />
            Выполнено {workout.completed_sessions_count}{" "}
            {pluralize(workout.completed_sessions_count, [
              "раз",
              "раза",
              "раз",
            ])}
            {workout.last_completed_at
              ? ` · ${formatDateTime(workout.last_completed_at)}`
              : ""}
          </span>
        ) : (
          <span className="status status--neutral">
            <span className="status__dot" />
            Ещё не выполнялась
          </span>
        )}
      </div>
    </article>
  );
}

export function ProgramPage({
  programId,
  notify,
  onBack,
  onOpenWorkout,
  onOpenRun,
}: ProgramPageProps) {
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyWorkout, setBusyWorkout] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getProgram(programId)
      .then((data) => {
        if (!cancelled) {
          setProgram(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setProgram(null);
          setError(loadErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [programId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const startWorkout = async (workout: PlannedWorkout) => {
    setBusyWorkout(workout.id);
    try {
      const created = await api.createWorkout({
        planned_workout_id: workout.id,
      });
      onOpenWorkout(created.id);
    } catch (startError) {
      notify(loadErrorMessage(startError), "error");
    } finally {
      setBusyWorkout(null);
    }
  };

  const changeStatus = async () => {
    if (!program) {
      return;
    }
    const activating = program.status !== "active";
    if (
      activating &&
      !window.confirm(
        "Сделать программу активной? Текущая активная программа будет перемещена в архив.",
      )
    ) {
      return;
    }
    setChangingStatus(true);
    try {
      const updated = await api.patchProgram(program.id, {
        status: activating ? "active" : "archived",
      });
      setProgram(updated);
      notify(
        activating ? "Программа активна." : "Программа в архиве.",
        "success",
      );
    } catch (statusError) {
      notify(loadErrorMessage(statusError), "error");
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) {
    return (
      <section className="program-detail">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          К программам
        </button>
        <div className="card" aria-busy="true" aria-label="Загрузка программы">
          <span className="skeleton" style={{ width: "40%", height: 20 }} />
          <span
            className="skeleton"
            style={{ width: "70%", height: 12, marginTop: 16 }}
          />
          <span
            className="skeleton"
            style={{ width: "55%", height: 12, marginTop: 10 }}
          />
        </div>
      </section>
    );
  }

  if (error || !program) {
    return (
      <section className="program-detail">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          К программам
        </button>
        <div className="card notice-card notice-card--danger">
          <h2>Не удалось открыть программу</h2>
          <p>{error ?? "Программа не найдена."}</p>
          <div className="notice-actions">
            <button type="button" className="btn btn--primary" onClick={reload}>
              <IconRefresh />
              Повторить
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="program-detail">
      <div className="run-topline">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          К программам
        </button>
        {program.source_run_id && onOpenRun ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onOpenRun(program.source_run_id as string)}
          >
            Исходный запуск
            <IconArrowUpRight />
          </button>
        ) : null}
      </div>

      <div className="result-head">
        <div className="result-head__main">
          <span
            className={`status status--${
              program.status === "active" ? "success" : "neutral"
            }`}
          >
            <span className="status__dot" />
            {program.status === "active"
              ? "Активная программа"
              : "В архиве"}
          </span>
          <h1>{program.name}</h1>
          {program.goal ? <p className="result-head__request">{program.goal}</p> : null}
          {program.description ? <p>{program.description}</p> : null}
          <div className="result-meta">
            <span>Создана {formatDate(program.created_at)}</span>
            <span>
              {program.workouts.length}{" "}
              {pluralize(program.workouts.length, [
                "тренировка",
                "тренировки",
                "тренировок",
              ])}
            </span>
            <span className="mono">
              {program.status === "active" ? "Активна" : "В архиве"}
            </span>
          </div>
        </div>
        <div className="result-actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void changeStatus()}
            disabled={changingStatus}
          >
            {changingStatus ? <span className="spinner" /> : null}
            {program.status === "active" ? "В архив" : "Сделать активной"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={reload}
          >
            <IconRefresh />
            Обновить
          </button>
        </div>
      </div>

      {program.assumptions.length || program.limitations.length ? (
        <div className="two-col">
          {program.assumptions.length ? (
            <section className="card">
              <h3>Предположения</h3>
              <ul className="bullet-list" style={{ marginTop: 12 }}>
                {program.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {program.limitations.length ? (
            <section className="card">
              <h3>Ограничения</h3>
              <ul className="bullet-list" style={{ marginTop: 12 }}>
                {program.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {program.workouts.length ? (
        <div className="plan-workouts">
          {program.workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              busy={busyWorkout === workout.id}
              onStart={() => void startWorkout(workout)}
              onContinue={() => {
                if (workout.in_progress_session_id) {
                  onOpenWorkout(workout.in_progress_session_id);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="card notice-card notice-card--info">
          <h2>В программе нет тренировок</h2>
          <p>Сохраните другой план или создайте самостоятельную тренировку.</p>
        </div>
      )}
    </section>
  );
}
