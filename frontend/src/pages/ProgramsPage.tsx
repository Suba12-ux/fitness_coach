import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import type { ProgramStatus, ProgramSummary } from "../api/types";
import type { ToastTone } from "../hooks/useToasts";
import { formatDate, pluralize } from "../lib/format";
import { IconArrowUpRight, IconInbox, IconPlus, IconRefresh } from "../components/Icons";

interface ProgramsPageProps {
  notify: (message: string, tone?: ToastTone) => void;
  onOpenProgram: (programId: string) => void;
  onCreatePlan: () => void;
}

const PAGE_SIZE = 20;

const FILTERS: Array<{ value: ProgramStatus; label: string }> = [
  { value: "active", label: "Активные" },
  { value: "archived", label: "Архив" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить программы.";
}

export function ProgramsPage({
  notify,
  onOpenProgram,
  onCreatePlan,
}: ProgramsPageProps) {
  const [filter, setFilter] = useState<ProgramStatus>("active");
  const [items, setItems] = useState<ProgramSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listPrograms({ status: filter, limit: PAGE_SIZE, offset: 0 })
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
  }, [filter, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api.listPrograms({
        status: filter,
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

  const changeStatus = async (program: ProgramSummary) => {
    const activating = program.status !== "active";
    if (
      !activating &&
      !window.confirm(
        `Архивировать программу «${program.name}»? История тренировок сохранится.`,
      )
    ) {
      return;
    }
    if (
      activating &&
      !window.confirm(
        `Сделать программу «${program.name}» активной? Текущая активная программа будет перемещена в архив.`,
      )
    ) {
      return;
    }

    setBusyId(program.id);
    try {
      if (activating) {
        await api.patchProgram(program.id, { status: "active" });
        notify("Программа снова активна.", "success");
      } else {
        await api.archiveProgram(program.id);
        notify("Программа перемещена в архив.", "success");
      }
      reload();
    } catch (actionError) {
      notify(errorMessage(actionError), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="programs">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            Сохранённые планы
          </span>
          <h1>Мои программы</h1>
          <p>
            Активная программа определяет запланированные тренировки. Старые
            программы можно вернуть из архива.
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
            onClick={onCreatePlan}
          >
            <IconPlus />
            Новый план
          </button>
        </div>
      </header>

      <div
        className="history-filters"
        role="group"
        aria-label="Фильтр программ"
      >
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip${filter === option.value ? " chip--active" : ""}`}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="card history-card">
        {loading ? (
          <div aria-busy="true" aria-label="Загрузка программ">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="history-skeleton">
                <span className="skeleton" style={{ width: 96, height: 28 }} />
                <span className="history-skeleton__text">
                  <span
                    className="skeleton"
                    style={{ width: "52%", height: 14 }}
                  />
                  <span
                    className="skeleton"
                    style={{ width: "30%", height: 10 }}
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
            <h3>
              {filter === "active"
                ? "Нет активной программы"
                : "Архив пуст"}
            </h3>
            <p>
              {filter === "active"
                ? "Создайте план и сохраните его как программу — тогда появятся запланированные тренировки."
                : "Архивированные программы появятся здесь."}
            </p>
            {filter === "active" ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onCreatePlan}
              >
                <IconPlus />
                Создать план
              </button>
            ) : null}
          </div>
        ) : (
          <div className="program-list">
            {items.map((program) => (
              <article key={program.id} className="program-row">
                <div className="program-row__main">
                  <span
                    className={`status status--${
                      program.status === "active" ? "success" : "neutral"
                    }`}
                  >
                    <span className="status__dot" />
                    {program.status === "active" ? "Активна" : "В архиве"}
                  </span>
                  <h3>{program.name}</h3>
                  <p className="program-row__goal">
                    {program.goal || program.description || "Без цели"}
                  </p>
                  <div className="program-row__meta">
                    <span>
                      {program.planned_workouts_count}{" "}
                      {pluralize(program.planned_workouts_count, [
                        "запланированная тренировка",
                        "запланированные тренировки",
                        "запланированных тренировок",
                      ])}
                    </span>
                    <span>Создана {formatDate(program.created_at)}</span>
                  </div>
                </div>
                <div className="program-row__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onOpenProgram(program.id)}
                  >
                    Открыть
                    <IconArrowUpRight />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => void changeStatus(program)}
                    disabled={busyId === program.id}
                  >
                    {busyId === program.id ? (
                      <span className="spinner" />
                    ) : null}
                    {program.status === "active"
                      ? "В архив"
                      : "Сделать активной"}
                  </button>
                </div>
              </article>
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
    </section>
  );
}
