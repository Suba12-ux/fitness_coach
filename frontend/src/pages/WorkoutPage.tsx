import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { ExerciseResult, WorkoutDetail } from "../api/types";
import type { ToastTone } from "../hooks/useToasts";
import {
  clearWorkoutDraft,
  readWorkoutDraft,
  writeWorkoutDraft,
} from "../hooks/useWorkoutDraft";
import { formatDate, formatDateTime, formatDuration } from "../lib/format";
import {
  EMPTY_SET_DRAFT,
  columnsFor,
  createSetDrafts,
  draftToPayload,
  formatPlanned,
  plannedSetCount,
  setsToDrafts,
  totalVolume,
  validateSetDraft,
  type SetDraft,
} from "../lib/training";
import {
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconClose,
  IconDumbbell,
  IconInfo,
  IconPlus,
  IconRefresh,
} from "../components/Icons";

interface WorkoutPageProps {
  workoutId: string;
  notify: (message: string, tone?: ToastTone) => void;
  onBack: () => void;
  onOpenProgram?: (programId: string) => void;
}

interface ExerciseDraft {
  key: string;
  name: string;
  comment: string;
  planned: Record<string, unknown> | null;
  sets: SetDraft[];
}

interface StoredDraft {
  exercises: ExerciseDraft[];
  comment: string;
  perceivedExertion: string;
}

const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  in_progress: { label: "В процессе", tone: "info" },
  completed: { label: "Завершена", tone: "success" },
  skipped: { label: "Пропущена", tone: "neutral" },
  cancelled: { label: "Отменена", tone: "danger" },
};

function draftsFromWorkout(workout: WorkoutDetail): ExerciseDraft[] {
  return workout.exercises.map((exercise) => ({
    key: exercise.id,
    name: exercise.name,
    comment: exercise.comment ?? "",
    planned: exercise.planned ?? null,
    sets: exercise.sets.length
      ? setsToDrafts(exercise.sets)
      : createSetDrafts(plannedSetCount(exercise.planned)),
  }));
}

function newExerciseDraft(): ExerciseDraft {
  return {
    key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    comment: "",
    planned: null,
    sets: createSetDrafts(3),
  };
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить тренировку.";
}

function formatActualSet(set: ExerciseResult["sets"][number]): string {
  if (set.skipped) {
    return "пропущен";
  }
  const parts: string[] = [];
  if (set.reps != null) {
    parts.push(`${set.reps} повт.`);
  }
  if (set.weight_kg != null) {
    parts.push(`${set.weight_kg} кг`);
  }
  if (set.duration_sec != null) {
    parts.push(`${set.duration_sec} с`);
  }
  if (set.distance_m != null) {
    parts.push(`${set.distance_m} м`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function WorkoutPage({
  workoutId,
  notify,
  onBack,
  onOpenProgram,
}: WorkoutPageProps) {
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [comment, setComment] = useState("");
  const [exertion, setExertion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getWorkout(workoutId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setWorkout(detail);
        setComment(detail.comment ?? "");
        setExertion(
          detail.perceived_exertion != null
            ? String(detail.perceived_exertion)
            : "",
        );

        if (detail.status === "in_progress") {
          const stored = readWorkoutDraft<StoredDraft>(workoutId);
          if (stored && Array.isArray(stored.exercises)) {
            setExercises(stored.exercises);
            setComment(stored.comment ?? detail.comment ?? "");
            setExertion(stored.perceivedExertion ?? "");
            setRestored(true);
          } else {
            setExercises(draftsFromWorkout(detail));
            setRestored(false);
          }
        } else {
          setExercises(draftsFromWorkout(detail));
          setRestored(false);
        }
        setDirty(false);
        setAttempted(false);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setWorkout(null);
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
  }, [workoutId, reloadKey]);

  useEffect(() => {
    if (!workout || workout.status !== "in_progress") {
      return;
    }
    writeWorkoutDraft<StoredDraft>(workout.id, {
      exercises,
      comment,
      perceivedExertion: exertion,
    });
  }, [workout, exercises, comment, exertion]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const exerciseErrors = useMemo(
    () =>
      exercises.map((exercise) => ({
        name: exercise.name.trim()
          ? null
          : "Укажите название упражнения.",
        sets: exercise.sets.map(validateSetDraft),
      })),
    [exercises],
  );

  const hasErrors = exerciseErrors.some(
    (entry) => entry.name || entry.sets.some(Boolean),
  );
  const hasFilledSet = exercises.some((exercise) =>
    exercise.sets.some(
      (set) =>
        set.skipped ||
        set.reps.trim() !== "" ||
        set.duration.trim() !== "" ||
        set.distance.trim() !== "",
    ),
  );

  const markDirty = () => setDirty(true);

  const updateExercise = (
    index: number,
    patch: Partial<ExerciseDraft>,
  ) => {
    setExercises((current) =>
      current.map((exercise, position) =>
        position === index ? { ...exercise, ...patch } : exercise,
      ),
    );
    markDirty();
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<SetDraft>,
  ) => {
    setExercises((current) =>
      current.map((exercise, position) => {
        if (position !== exerciseIndex) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.map((set, index) =>
            index === setIndex ? { ...set, ...patch } : set,
          ),
        };
      }),
    );
    markDirty();
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((current) =>
      current.map((exercise, position) =>
        position === exerciseIndex
          ? { ...exercise, sets: [...exercise.sets, { ...EMPTY_SET_DRAFT }] }
          : exercise,
      ),
    );
    markDirty();
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, position) =>
        position === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.filter((_, index) => index !== setIndex),
            }
          : exercise,
      ),
    );
    markDirty();
  };

  const removeExercise = (exerciseIndex: number) => {
    setExercises((current) =>
      current.filter((_, position) => position !== exerciseIndex),
    );
    markDirty();
  };

  const resetDraft = () => {
    if (!workout) {
      return;
    }
    clearWorkoutDraft(workout.id);
    setExercises(draftsFromWorkout(workout));
    setComment(workout.comment ?? "");
    setExertion(
      workout.perceived_exertion != null
        ? String(workout.perceived_exertion)
        : "",
    );
    setRestored(false);
    setDirty(false);
    setAttempted(false);
    notify("Черновик сброшен.", "info");
  };

  const persist = async (
    finish: boolean,
  ): Promise<WorkoutDetail | null> => {
    if (!workout) {
      return null;
    }
    setAttempted(true);
    if (hasErrors) {
      notify("Проверьте упражнения и подходы.", "error");
      return null;
    }
    if (finish && !hasFilledSet) {
      notify("Добавьте хотя бы один выполненный подход.", "error");
      return null;
    }

    setSaving(true);
    try {
      if (workout.status === "in_progress") {
        await api.saveWorkoutExercises(workout.id, {
          exercises: exercises.map((exercise) => ({
            name: exercise.name.trim(),
            comment: exercise.comment.trim() || null,
            sets: exercise.sets.map(draftToPayload),
          })),
        });
      }

      const updated = await api.patchWorkout(workout.id, {
        comment: comment.trim() || null,
        perceived_exertion: exertion ? Number(exertion) : null,
        ...(finish ? { status: "completed" as const } : {}),
      });

      setWorkout(updated);
      setExercises(draftsFromWorkout(updated));
      setDirty(false);
      setAttempted(false);

      if (finish) {
        clearWorkoutDraft(workout.id);
        setRestored(false);
        notify("Тренировка завершена.", "success");
      } else {
        writeWorkoutDraft<StoredDraft>(workout.id, {
          exercises: draftsFromWorkout(updated),
          comment: updated.comment ?? "",
          perceivedExertion:
            updated.perceived_exertion != null
              ? String(updated.perceived_exertion)
              : "",
        });
        notify("Результаты сохранены.", "success");
      }
      return updated;
    } catch (saveError) {
      notify(loadErrorMessage(saveError), "error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const cancelWorkout = async () => {
    if (!workout) {
      return;
    }
    if (
      !window.confirm(
        "Отменить тренировку? Введённые результаты не будут учитываться как выполненные.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patchWorkout(workout.id, {
        status: "cancelled",
      });
      setWorkout(updated);
      setExercises(draftsFromWorkout(updated));
      clearWorkoutDraft(workout.id);
      setRestored(false);
      setDirty(false);
      notify("Тренировка отменена.", "info");
    } catch (cancelError) {
      notify(loadErrorMessage(cancelError), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="workout-page">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          Назад
        </button>
        <div className="card" aria-busy="true" aria-label="Загрузка тренировки">
          <span className="skeleton" style={{ width: "45%", height: 20 }} />
          <span
            className="skeleton"
            style={{ width: "70%", height: 12, marginTop: 16 }}
          />
        </div>
      </section>
    );
  }

  if (error || !workout) {
    return (
      <section className="workout-page">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          Назад
        </button>
        <div className="card notice-card notice-card--danger">
          <h2>Не удалось открыть тренировку</h2>
          <p>{error ?? "Тренировка не найдена."}</p>
          <div className="notice-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <IconRefresh />
              Повторить
            </button>
          </div>
        </div>
      </section>
    );
  }

  const meta = STATUS_META[workout.status] ?? {
    label: workout.status,
    tone: "neutral",
  };
  const editable = workout.status === "in_progress";
  const elapsed = formatDuration(workout.started_at, workout.finished_at);
  const volume = totalVolume(
    workout.exercises.map((exercise) => ({
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weight_kg: set.weight_kg,
        skipped: set.skipped,
      })),
    })),
  );
  const actualSets = workout.exercises.reduce(
    (sum, exercise) =>
      sum + exercise.sets.filter((set) => !set.skipped).length,
    0,
  );

  return (
    <section className="workout-page">
      <div className="run-topline">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <IconArrowLeft />
          Назад
        </button>
        {workout.program_id && onOpenProgram ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onOpenProgram(workout.program_id as string)}
          >
            <IconDumbbell />
            К программе
          </button>
        ) : null}
      </div>

      <div className="result-head">
        <div className="result-head__main">
          <span className={`status status--${meta.tone}`}>
            <span className="status__dot" />
            {meta.label}
          </span>
          <h1>{workout.title}</h1>
          <div className="result-meta">
            <span>
              <IconClock />
              {formatDateTime(workout.started_at)}
            </span>
            {elapsed ? <span>Длительность: {elapsed}</span> : null}
            {workout.finished_at ? (
              <span>Завершена {formatDate(workout.finished_at)}</span>
            ) : null}
          </div>
        </div>
        {!editable ? (
          <div className="result-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <IconRefresh />
              Обновить
            </button>
          </div>
        ) : null}
      </div>

      {restored && editable ? (
        <div className="notice-inline notice-inline--info" role="status">
          <IconInfo />
          <div>
            <strong>Восстановлен черновик.</strong> Введённые ранее значения не
            отправлены на сервер.
            <div className="notice-actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={resetDraft}
                disabled={saving}
              >
                Сбросить черновик
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editable ? (
        <>
          {exercises.length === 0 ? (
            <div className="card notice-card notice-card--info">
              <h2>В тренировке нет упражнений</h2>
              <p>Добавьте упражнение, чтобы внести фактические результаты.</p>
            </div>
          ) : null}

          <div className="workout-exercises">
            {exercises.map((exercise, exerciseIndex) => {
              const columns = columnsFor(exercise.planned, exercise.sets);
              const nameError = exerciseErrors[exerciseIndex]?.name;
              return (
                <article className="card workout-exercise" key={exercise.key}>
                  <div className="workout-exercise__head">
                    <div className="field workout-exercise__name">
                      <label
                        className="field__label"
                        htmlFor={`exercise-${exercise.key}`}
                      >
                        Упражнение
                      </label>
                      <input
                        id={`exercise-${exercise.key}`}
                        className="input"
                        value={exercise.name}
                        placeholder="Название упражнения"
                        disabled={saving}
                        onChange={(event) =>
                          updateExercise(exerciseIndex, {
                            name: event.target.value,
                          })
                        }
                        aria-invalid={Boolean(nameError)}
                      />
                      {nameError && attempted ? (
                        <span className="field__error" role="alert">
                          {nameError}
                        </span>
                      ) : null}
                    </div>
                    <div className="workout-exercise__plan">
                      <span className="field__label">План</span>
                      <span className="mono">
                        {formatPlanned(exercise.planned)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      onClick={() => removeExercise(exerciseIndex)}
                      disabled={saving}
                      aria-label={`Удалить упражнение «${exercise.name || "без названия"}»`}
                      title="Удалить упражнение"
                    >
                      <IconClose />
                    </button>
                  </div>

                  <div className="set-rows">
                    <div className="set-row set-row--head" aria-hidden="true">
                      <span>№</span>
                      {columns.reps ? <span>Повторения</span> : null}
                      {columns.weight ? <span>Вес, кг</span> : null}
                      {columns.duration ? <span>Длительность, с</span> : null}
                      {columns.distance ? <span>Дистанция, м</span> : null}
                      <span>Пропуск</span>
                      <span />
                    </div>

                    {exercise.sets.map((set, setIndex) => {
                      const setError = exerciseErrors[exerciseIndex]?.sets[
                        setIndex
                      ];
                      return (
                        <div key={setIndex} className="set-row">
                          <span className="set-row__index">
                            {setIndex + 1}
                          </span>
                          {columns.reps ? (
                            <input
                              className="input input--sm"
                              inputMode="numeric"
                              placeholder="10"
                              aria-label={`Повторения, подход ${setIndex + 1}`}
                              value={set.reps}
                              disabled={saving || set.skipped}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  reps: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(setError)}
                            />
                          ) : null}
                          {columns.weight ? (
                            <input
                              className="input input--sm"
                              inputMode="decimal"
                              placeholder="40"
                              aria-label={`Вес, подход ${setIndex + 1}`}
                              value={set.weight}
                              disabled={saving || set.skipped}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  weight: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(setError)}
                            />
                          ) : null}
                          {columns.duration ? (
                            <input
                              className="input input--sm"
                              inputMode="numeric"
                              placeholder="60"
                              aria-label={`Длительность, подход ${setIndex + 1}`}
                              value={set.duration}
                              disabled={saving || set.skipped}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  duration: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(setError)}
                            />
                          ) : null}
                          {columns.distance ? (
                            <input
                              className="input input--sm"
                              inputMode="decimal"
                              placeholder="1000"
                              aria-label={`Дистанция, подход ${setIndex + 1}`}
                              value={set.distance}
                              disabled={saving || set.skipped}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  distance: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(setError)}
                            />
                          ) : null}
                          <label className="set-row__skip">
                            <input
                              type="checkbox"
                              checked={set.skipped}
                              disabled={saving}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, {
                                  skipped: event.target.checked,
                                })
                              }
                            />
                            <span className="sr-only">Пропустить подход</span>
                          </label>
                          <button
                            type="button"
                            className="btn btn--ghost btn--icon"
                            onClick={() => removeSet(exerciseIndex, setIndex)}
                            disabled={saving || exercise.sets.length <= 1}
                            aria-label={`Удалить подход ${setIndex + 1}`}
                          >
                            <IconClose />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {attempted &&
                  exerciseErrors[exerciseIndex]?.sets.some(Boolean) ? (
                    <div className="error-text" role="alert">
                      {exerciseErrors[exerciseIndex].sets.find(Boolean)}
                    </div>
                  ) : null}

                  <div className="workout-exercise__foot">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => addSet(exerciseIndex)}
                      disabled={saving}
                    >
                      <IconPlus />
                      Добавить подход
                    </button>
                    <div className="field workout-exercise__comment">
                      <label
                        className="field__label"
                        htmlFor={`comment-${exercise.key}`}
                      >
                        Комментарий{" "}
                        <span className="field__optional">необязательно</span>
                      </label>
                      <input
                        id={`comment-${exercise.key}`}
                        className="input"
                        value={exercise.comment}
                        maxLength={2000}
                        disabled={saving}
                        placeholder="Например: легко, добавить вес"
                        onChange={(event) =>
                          updateExercise(exerciseIndex, {
                            comment: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="workout-add">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setExercises((current) => [...current, newExerciseDraft()]);
                markDirty();
              }}
              disabled={saving}
            >
              <IconPlus />
              Добавить упражнение
            </button>
          </div>

          <div className="card workout-summary">
            <div className="card__head">
              <div>
                <h2>Итоги тренировки</h2>
                <p>Комментарий и субъективная нагрузка.</p>
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="workout-exertion">
                  Нагрузка (1–10){" "}
                  <span className="field__optional">необязательно</span>
                </label>
                <select
                  id="workout-exertion"
                  className="select"
                  value={exertion}
                  disabled={saving}
                  onChange={(event) => {
                    setExertion(event.target.value);
                    markDirty();
                  }}
                >
                  <option value="">Не указано</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="field field--wide">
                <label className="field__label" htmlFor="workout-comment">
                  Комментарий{" "}
                  <span className="field__optional">необязательно</span>
                </label>
                <textarea
                  id="workout-comment"
                  className="textarea"
                  value={comment}
                  maxLength={2000}
                  disabled={saving}
                  rows={3}
                  onChange={(event) => {
                    setComment(event.target.value);
                    markDirty();
                  }}
                />
              </div>
            </div>

            <div className="form-actions">
              <span className="form-note">
                {dirty
                  ? "Есть несохранённые изменения."
                  : "Все изменения сохранены."}
              </span>
              <div className="workout-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void cancelWorkout()}
                  disabled={saving}
                >
                  Отменить
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void persist(false)}
                  disabled={saving}
                >
                  {saving ? <span className="spinner" /> : null}
                  Сохранить
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void persist(true)}
                  disabled={saving}
                >
                  {saving ? <span className="spinner" /> : <IconCheck />}
                  Завершить тренировку
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="workout-stats">
            <div className="stat-card">
              <span className="stat-card__value">
                {workout.exercises.length}
              </span>
              <span className="stat-card__label">упражнений</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{actualSets}</span>
              <span className="stat-card__label">подходов</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{volume}</span>
              <span className="stat-card__label">кг объёма</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">
                {workout.perceived_exertion ?? "—"}
              </span>
              <span className="stat-card__label">нагрузка</span>
            </div>
          </div>

          {workout.comment ? (
            <section className="card">
              <h3>Комментарий</h3>
              <p>{workout.comment}</p>
            </section>
          ) : null}

          <div className="workout-exercises">
            {workout.exercises.map((exercise) => (
              <article className="card workout-exercise" key={exercise.id}>
                <div className="workout-exercise__head">
                  <div>
                    <h3>{exercise.name}</h3>
                    <span className="muted">
                      План: {formatPlanned(exercise.planned)}
                    </span>
                  </div>
                </div>
                {exercise.sets.length ? (
                  <ul className="actual-sets">
                    {exercise.sets.map((set) => (
                      <li key={set.id}>
                        <span className="actual-sets__index">
                          {set.position}
                        </span>
                        <span>{formatActualSet(set)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-note">
                    <IconInfo />
                    Подходы не внесены.
                  </div>
                )}
                {exercise.comment ? (
                  <p className="muted">{exercise.comment}</p>
                ) : null}
              </article>
            ))}
          </div>

          {workout.exercises.length === 0 ? (
            <div className="card empty-note">
              <IconAlert />
              В тренировке нет сохранённых упражнений.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
