import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "./api/client";
import type { WorkflowPayload, WorkflowResponse } from "./api/types";
import { Composer } from "./components/Composer";
import { HistoryList } from "./components/HistoryList";
import { MobileNav, Sidebar, Topbar, type View } from "./components/Navigation";
import { ResultView } from "./components/ResultView";
import { RunProgress } from "./components/RunProgress";
import { Toasts } from "./components/Toasts";
import { useRunPolling } from "./hooks/useRunPolling";
import { useSystemStatus } from "./hooks/useSystemStatus";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { copyText } from "./lib/download";
import type { FormExample } from "./lib/examples";
import { isInFlight, isTerminal } from "./lib/status";
import {
  EMPTY_FORM,
  buildPayload,
  formFromUserData,
  validateForm,
  type FormState,
} from "./lib/validation";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить запрос.";
}

interface Route {
  view: View;
  runId: string | null;
}

function parseRoute(): Route {
  const hash = window.location.hash;
  if (hash.startsWith("#run/")) {
    return {
      view: "compose",
      runId: decodeURIComponent(hash.slice("#run/".length)),
    };
  }
  if (hash === "#history") {
    return { view: "history", runId: null };
  }
  return { view: "compose", runId: null };
}

function updateHash(hash: string): void {
  const target = hash || `${window.location.pathname}${window.location.search}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", target);
  }
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const { toasts, notify, dismiss } = useToasts();
  const system = useSystemStatus();

  const [view, setView] = useState<View>(() => parseRoute().view);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [run, setRun] = useState<WorkflowResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingRun, setLoadingRun] = useState(() =>
    Boolean(parseRoute().runId),
  );
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const errors = useMemo(
    () => (attempted ? validateForm(form) : {}),
    [attempted, form],
  );

  const loadRun = useCallback(
    async (runId: string) => {
      setLoadingRun(true);
      try {
        const loaded = await api.getWorkflow(runId);
        setRun(loaded);
        setView("compose");
        setLaunchError(null);
        updateHash(`#run/${loaded.run_id}`);
      } catch (error) {
        notify(errorMessage(error), "error");
        setRun(null);
        setView("compose");
        updateHash("");
      } finally {
        setLoadingRun(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    const route = parseRoute();
    if (route.view === "history") {
      setView("history");
    }
    if (route.runId) {
      void loadRun(route.runId);
    }

    const sync = () => {
      const next = parseRoute();
      setView(next.view);
      if (next.runId) {
        void loadRun(next.runId);
        return;
      }
      setRun(null);
      setLoadingRun(false);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [loadRun]);

  const selectView = useCallback(
    (next: View) => {
      setView(next);
      updateHash(
        next === "history" ? "#history" : run ? `#run/${run.run_id}` : "",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [run],
  );

  const launch = useCallback(
    async (payload: WorkflowPayload) => {
      setBusy(true);
      setLaunchError(null);
      try {
        const created = await api.createWorkflow(payload);
        setRun(created);
        setAttempted(false);
        updateHash(`#run/${created.run_id}`);
        notify("Запрос принят — агенты приступили к работе.", "info");
        system.refresh();
      } catch (error) {
        const message = errorMessage(error);
        setLaunchError(message);
        notify(message, "error");
        system.refresh();
      } finally {
        setBusy(false);
      }
    },
    [notify, system],
  );

  useRunPolling(run && isInFlight(run.status) ? run.run_id : null, (updated) => {
    setRun(updated);
    if (!isTerminal(updated.status)) {
      return;
    }
    if (updated.status === "completed") {
      notify("План готов.", "success");
    } else if (updated.status === "needs_info") {
      notify("Для плана не хватает данных.", "info");
    } else if (updated.status === "failed") {
      notify(updated.error ?? "Не удалось собрать план.", "error");
    }
    system.refresh();
  });

  const handleChange = useCallback((patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const handleSubmit = useCallback(() => {
    setAttempted(true);
    if (Object.keys(validateForm(form)).length > 0) {
      notify("Проверьте выделенные поля формы.", "error");
      return;
    }
    void launch(buildPayload(form));
  }, [form, launch, notify]);

  const handleExample = useCallback(
    (example: FormExample) => {
      setForm(example.form);
      setAttempted(false);
      notify(`Пример «${example.label}» подставлен в форму.`, "info");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [notify],
  );

  const handleNewPlan = useCallback(() => {
    setRun(null);
    setLaunchError(null);
    setAttempted(false);
    setView("compose");
    updateHash("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleRefine = useCallback(() => {
    if (!run) {
      return;
    }
    setForm(formFromUserData(run.request, run.user_data));
    setRun(null);
    setAttempted(false);
    setView("compose");
    updateHash("");
    notify("Данные из запуска перенесены в форму.", "info");
    window.setTimeout(() => {
      document.getElementById("request")?.focus();
    }, 120);
  }, [notify, run]);

  const handleRetry = useCallback(() => {
    if (!run) {
      return;
    }
    void launch({ request: run.request, user_data: run.user_data ?? {} });
  }, [launch, run]);

  const handleOpenRun = useCallback((loaded: WorkflowResponse) => {
    setRun(loaded);
    setLaunchError(null);
    setLoadingRun(false);
    setView("compose");
    updateHash(`#run/${loaded.run_id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCopyId = useCallback(async () => {
    if (!run) {
      return;
    }
    try {
      await copyText(run.run_id);
      notify("ID запуска скопирован.", "success");
    } catch {
      notify("Не удалось скопировать ID.", "error");
    }
  }, [notify, run]);

  const handleSelectView = useCallback(
    (next: View) => {
      if (next === "compose") {
        handleNewPlan();
        return;
      }
      selectView("history");
    },
    [handleNewPlan, selectView],
  );

  return (
    <div className="app">
      <Sidebar
        view={view}
        onSelectView={handleSelectView}
        theme={theme}
        onSetTheme={setTheme}
        system={system}
      />

      <main className="main">
        <Topbar theme={theme} onSetTheme={setTheme} system={system} />
        <div className="page">
          {view === "history" ? (
            <HistoryList
              onOpen={handleOpenRun}
              onCreate={handleNewPlan}
              notify={notify}
            />
          ) : loadingRun ? (
            <section className="run-shell">
              <div className="card progress-card">
                <span className="status status--info">
                  <span className="spinner" aria-hidden="true" />
                  Загрузка
                </span>
                <h1>Открываем запуск</h1>
                <p>
                  Получаем сохранённый результат из базы данных. Это займёт
                  мгновение.
                </p>
              </div>
            </section>
          ) : run ? (
            isTerminal(run.status) ? (
              <ResultView
                run={run}
                onNewPlan={handleNewPlan}
                onRefine={handleRefine}
                onRetry={handleRetry}
                notify={notify}
              />
            ) : (
              <RunProgress
                run={run}
                onNewPlan={handleNewPlan}
                onCopyId={() => void handleCopyId()}
              />
            )
          ) : (
            <Composer
              form={form}
              errors={errors}
              busy={busy}
              launchError={launchError}
              system={system}
              onChange={handleChange}
              onExample={handleExample}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </main>

      <MobileNav view={view} onSelectView={handleSelectView} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
