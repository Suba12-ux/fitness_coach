import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import type { WorkflowListItem, WorkflowResponse } from "../api/types";
import type { ToastTone } from "../hooks/useToasts";
import {
  formatDateTime,
  pluralize,
  shortId,
} from "../lib/format";
import {
  IconArrowUpRight,
  IconInbox,
  IconPlus,
  IconRefresh,
} from "./Icons";
import { StatusBadge } from "./StatusBadge";

interface HistoryListProps {
  onOpen: (run: WorkflowResponse) => void;
  onCreate: () => void;
  notify: (message: string, tone?: ToastTone) => void;
}

const PAGE_SIZE = 20;

const FILTERS = [
  { value: "", label: "Все" },
  { value: "completed", label: "Готовые" },
  { value: "running", label: "В работе" },
  { value: "queued", label: "В очереди" },
  { value: "needs_info", label: "Нужны данные" },
  { value: "failed", label: "Ошибки" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить историю запусков.";
}

export function HistoryList({ onOpen, onCreate, notify }: HistoryListProps) {
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<WorkflowListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .listWorkflows({ limit: PAGE_SIZE, offset: 0, status: filter || undefined })
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
      const data = await api.listWorkflows({
        limit: PAGE_SIZE,
        offset: items.length,
        status: filter || undefined,
      });
      setItems((current) => {
        const known = new Set(current.map((item) => item.run_id));
        return [...current, ...data.items.filter((item) => !known.has(item.run_id))];
      });
      setTotal(data.total);
    } catch (loadError) {
      notify(errorMessage(loadError), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const openRun = async (runId: string) => {
    setOpeningId(runId);
    try {
      const run = await api.getWorkflow(runId);
      onOpen(run);
    } catch (loadError) {
      notify(errorMessage(loadError), "error");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section className="history">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            Архив запусков
          </span>
          <h1>История</h1>
          <p>
            Все запуски, сохранённые в базе. Откройте любой, чтобы посмотреть
            план и отчёт безопасности.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={reload}
          disabled={loading}
        >
          <IconRefresh className={loading ? "is-spinning" : undefined} />
          Обновить
        </button>
      </header>

      <div className="history-filters" role="group" aria-label="Фильтр по статусу">
        {FILTERS.map((option) => (
          <button
            key={option.value || "all"}
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
          <div aria-busy="true" aria-label="Загрузка истории">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="history-skeleton">
                <span className="skeleton" style={{ width: 88, height: 28 }} />
                <span className="history-skeleton__text">
                  <span className="skeleton" style={{ width: "58%", height: 14 }} />
                  <span className="skeleton" style={{ width: "32%", height: 10 }} />
                </span>
                <span className="skeleton" style={{ width: 78, height: 12 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="history-error">
            <div className="error-text" role="alert">
              {error}
            </div>
            <div className="notice-actions">
              <button type="button" className="btn btn--primary" onClick={reload}>
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
            <h3>Здесь пока пусто</h3>
            <p>
              {filter
                ? "Для выбранного статуса запусков нет. Попробуйте другой фильтр."
                : "Создайте первый план — запуск появится в истории автоматически."}
            </p>
            <button type="button" className="btn btn--primary" onClick={onCreate}>
              <IconPlus />
              Создать план
            </button>
          </div>
        ) : (
          <div className="history-list">
            {items.map((item) => (
              <button
                key={item.run_id}
                type="button"
                className="history-row"
                onClick={() => void openRun(item.run_id)}
                disabled={openingId === item.run_id}
              >
                <StatusBadge status={item.status} />
                <span className="history-row__request">
                  <strong>{item.request || "Без описания"}</strong>
                  <span className="mono">
                    #{shortId(item.run_id)}
                    {item.error ? " · ошибка" : ""}
                  </span>
                </span>
                <span className="history-row__date">
                  {formatDateTime(item.created_at)}
                </span>
                <span className="history-row__arrow">
                  {openingId === item.run_id ? (
                    <span className="spinner" />
                  ) : (
                    <IconArrowUpRight />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && items.length > 0 ? (
        <div className="history-more">
          {items.length < total ? (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? <span className="spinner" /> : <IconRefresh />}
              Показать ещё
            </button>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              Показаны все {total}{" "}
              {pluralize(total, ["запуск", "запуска", "запусков"])}
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
