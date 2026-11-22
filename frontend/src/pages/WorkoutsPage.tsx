import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type {
  ExerciseNameStat,
  ExerciseProgressPoint,
  ProgramSummary,
  WorkoutStats,
  WorkoutStatus,
  WorkoutSummary,
} from "../api/types";
import type { ToastTone } from "../hooks/useToasts";
import { formatDate, formatDateTime, pluralize } from "../lib/format";
import {
  IconArrowUpRight,
  IconInbox,
  IconPlus,
  IconRefresh,
} from "../components/Icons";

interface WorkoutsPageProps {
  notify: (message: string, tone?: ToastTone) => void;
  onOpenWorkout: (workoutId: string) => void;
  onCreateWorkout: () => void;
}

const PAGE_SIZE = 20;

const STATUS_FILTERS: Array<{ value: WorkoutStatus | ""; label: string }> = [
  { value: "", label: "Все" },
  { value: "in_progress", label: "В процессе" },
  { value: "completed", label: "Завершённые" },
  { value: "cancelled", label: "Отменённые" },
  { value: "skipped", label: "Пропущенные" },
];

const STATUS_LABELS: Record<string, string> = {
  in_progress: "В процессе",
  completed: "Завершена",
  cancelled: "Отменена",
  skipped: "Пропущена",
};

const STATUS_TONES: Record<string, string> = {
  in_progress: "info",
  completed: "success",
  cancelled: "danger",
  skipped: "neutral",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить тренировки.";
}

export function WorkoutsPage({
  notify,
  onOpenWorkout,
  onCreateWorkout,
}: WorkoutsPageProps) {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [exerciseNames, setExerciseNames] = useState<ExerciseNameStat[]>([]);
  const [items, setItems] = useState<WorkoutSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<WorkoutStatus | "">("");
  const [programId, setProgramId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [progress, setProgress] = useState<ExerciseProgressPoint[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const programNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const program of programs) {
      map.set(program.id, program.name);
    }
    return map;
  }, [programs]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getWorkoutStats(),
      api.listPrograms({ limit: 100, offset: 0 }),
      api.listExerciseNames(),
    ])
      .then(([statsData, programData, namesData]) => {
        if (cancelled) {
          return;
        }
        setStats(statsData);
        setPrograms(programData.items);
        setExerciseNames(namesData.items);
        setSelectedExercise((current) =>
          current || namesData.items[0]?.name || "",
        );
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          notify(errorMessage(loadError), "error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [notify, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listWorkouts({
        status: status || undefined,
        program_id: programId || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError(errorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, programId, dateFrom, dateTo, reloadKey]);

  useEffect(() => {
    if (!selectedExercise) {
      setProgress([]);
      return;
    }
    let cancelled = false;
    setProgressLoading(true);

    api
      .getExerciseProgress(selectedExercise, 30)
      .then((data) => {
        if (!cancelled) {
          setProgress(data);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          notify(errorMessage(loadError), "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProgressLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedExercise, notify, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api.listWorkouts({
        status: status || undefined,
        program_id: programId || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item) => !known.has(item.id))];
      });
      setTotal(data.total);
    } catch (loadError) {
      notify(errorMessage(loadError), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="workouts">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            Фактические занятия
          </span>
          <h1>Тренировки</h1>
          <p>
            История выполнения, базовая статистика и динамика упражнений.
            Приложение не делает медицинских выводов.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={reload}
            disabled={loading}
          >
            <IconRefresh className={loading ? "is-spinning" : undefined} />
            Обновить
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onCreateWorkout}
          >
            <IconPlus />
            Самостоятельная тренировка
          </button>
        </div>
      </header>

      <div className="workout-stats">
        <div className="stat-card">
          <span className="stat-card__value">
            {stats?.completed_total ?? 0}
          </span>
          <span className="stat-card__label">завершено всего</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">
            {stats?.completed_last_7_days ?? 0}
          </span>
          <span className="stat-card__label">за 7 дней</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">
            {stats?.completed_last_30_days ?? 0}
          </span>
          <span className="stat-card__label">за 30 дней</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">
            {stats?.by_program.length ?? 0}
          </span>
          <span className="stat-card__label">программ с занятиями</span>
        </div>
      </div>

      {stats && stats.by_program.length ? (
        <section className="card">
          <div className="card__head">
            <div>
              <h2>По программам</h2>
              <p>Только завершённые тренировки.</p>
            </div>
          </div>
          <ul className="by-program-list">
            {stats.by_program.map((entry) => (
              <li key={entry.program_id}>
                <span>{entry.name}</span>
                <span className="mono">
                  {entry.completed_count}{" "}
                  {pluralize(entry.completed_count, [
                    "тренировка",
                    "тренировки",
                    "тренировок",
                  ])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="history-filters" role="group" aria-label="Фильтр тренировок">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value || "all"}
            type="button"
            className={`chip${status === option.value ? " chip--active" : ""}`}
            aria-pressed={status === option.value}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="filters-row">
        <div className="field">
          <label className="field__label" htmlFor="workouts-program">
            Программа
          </label>
          <select
            id="workouts-program"
            className="select"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
          >
            <option value="">Все программы</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="workouts-from">
            С даты
          </label>
          <input
            id="workouts-from"
            type="date"
            className="input"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="workouts-to">
            По дату
          </label>
          <input
            id="workouts-to"
            type="date"
            className="input"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </div>

      <div className="card history-card">
        {loading ? (
          <div aria-busy="true" aria-label="Загрузка тренировок">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="history-skeleton">
                <span className="skeleton" style={{ width: 92, height: 28 }} />
                <span className="history-skeleton__text">
                  <span
                    className="skeleton"
                    style={{ width: "54%", height: 14 }}
                  />
                  <span
                    className="skeleton"
                    style={{ width: "28%", height: 10 }}
                  />
                </span>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="history-error">
            <div className="error-text" role="alert">
              {error}
            </div>
            <div className="notice-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={reload}
              >
                <IconRefresh />
                Повторить
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty__icon">
              <IconInbox />
            </span>
            <h3>Тренировок пока нет</h3>
            <p>
              Начните занятие по программе или запишите самостоятельную
              тренировку.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onCreateWorkout}
            >
              <IconPlus />
              Создать тренировку
            </button>
          </div>
        ) : (
          <div className="history-list">
            {items.map((workout) => (
              <button
                key={workout.id}
                type="button"
                className="history-row"
                onClick={() => onOpenWorkout(workout.id)}
              >
                <span
                  className={`status status--${
                    STATUS_TONES[workout.status] ?? "neutral"
                  }`}
                >
                  <span className="status__dot" />
                  {STATUS_LABELS[workout.status] ?? workout.status}
                </span>
                <span className="history-row__request">
                  <strong>{workout.title}</strong>
                  <span className="mono">
                    {workout.program_id
                      ? programNames.get(workout.program_id) ??
                        "Программа"
                      : "Самостоятельная"}
                  </span>
                </span>
                <span className="history-row__date">
                  {formatDateTime(workout.started_at ?? workout.created_at)}
                </span>
                <span className="history-row__arrow">
                  <IconArrowUpRight />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && items.length > 0 && items.length < total ? (
        <div className="history-more">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? <span className="spinner" /> : <IconRefresh />}
            Показать ещё
          </button>
        </div>
      ) : null}

      <section className="card progress-card">
        <div className="card__head">
          <div>
            <h2>Динамика упражнения</h2>
            <p>Только подходы с указанным весом, без оценки здоровья.</p>
          </div>
        </div>

        {exerciseNames.length ? (
          <>
            <div className="field" style={{ maxWidth: 360 }}>
              <label className="field__label" htmlFor="progress-exercise">
                Упражнение
              </label>
              <select
                id="progress-exercise"
                className="select"
                value={selectedExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
              >
                {exerciseNames.map((exercise) => (
                  <option key={exercise.name} value={exercise.name}>
                    {exercise.name} ({exercise.completed_sessions})
                  </option>
                ))}
              </select>
            </div>

            {progressLoading ? (
              <div className="empty-note">
                <span className="spinner" />
                Загружаем динамику…
              </div>
            ) : progress.length ? (
              <div className="progress-table" role="table">
                <div className="progress-table__row progress-table__row--head" role="row">
                  <span role="columnheader">Дата</span>
                  <span role="columnheader">Макс. вес</span>
                  <span role="columnheader">Повторения</span>
                  <span role="columnheader">Объём, кг</span>
                </div>
                {progress.map((point) => (
                  <div
                    className="progress-table__row"
                    role="row"
                    key={`${point.date}-${point.top_weight_kg}`}
                  >
                    <span>{formatDate(point.date)}</span>
                    <span className="mono">{point.top_weight_kg} кг</span>
                    <span className="mono">{point.total_reps}</span>
                    <span className="mono">{point.total_volume_kg}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-note">
                Нет завершённых подходов с весом для этого упражнения.
              </div>
            )}
          </>
        ) : (
          <div className="empty-note">
            Завершите тренировку с упражнениями и весом — здесь появится
            динамика.
          </div>
        )}
      </section>
    </section>
  );
}
