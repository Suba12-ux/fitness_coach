import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { WorkflowPayload, WorkflowResponse } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { AccountDialog } from "../components/AccountDialog";
import { Composer } from "../components/Composer";
import { HistoryList } from "../components/HistoryList";
import { MobileNav, Sidebar, Topbar, type View } from "../components/Navigation";
import { ResultView } from "../components/ResultView";
import { RunProgress } from "../components/RunProgress";
import { Toasts } from "../components/Toasts";
import { useRunPolling } from "../hooks/useRunPolling";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useTheme } from "../hooks/useTheme";
import { useToasts } from "../hooks/useToasts";
import { copyText } from "../lib/download";
import type { FormExample } from "../lib/examples";
import { applyProfileToFields } from "../lib/profileForm";
import { hashFor, parseRoute, type Route } from "../lib/router";
import { isInFlight, isTerminal } from "../lib/status";
import {
  EMPTY_FORM,
  buildPayload,
  formFromUserData,
  isFormPristine,
  validateForm,
  type FormState,
} from "../lib/validation";
import { ProfilePage } from "./ProfilePage";
import { ProgramPage } from "./ProgramPage";
import { ProgramsPage } from "./ProgramsPage";
import { WorkoutPage } from "./WorkoutPage";
import { WorkoutsPage } from "./WorkoutsPage";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить запрос.";
}

function viewFromRoute(route: Route): View {
  switch (route.name) {
    case "generations":
      return "history";
    case "programs":
    case "program":
      return "programs";
    case "workouts":
    case "workout":
      return "workouts";
    case "profile":
      return "profile";
    default:
      return "compose";
  }
}

function updateHash(hash: string): void {
  const target = hash || `${window.location.pathname}${window.location.search}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", target);
  }
}

const initialRoute = parseRoute(window.location.hash);

export default function Workspace() {
  const { theme, setTheme } = useTheme();
  const { toasts, notify, dismiss } = useToasts();
  const system = useSystemStatus();
  const auth = useAuth();
  const email = auth.user?.email ?? "";

  const [route, setRoute] = useState<Route>(initialRoute);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [run, setRun] = useState<WorkflowResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingRun, setLoadingRun] = useState(
    initialRoute.name === "run",
  );
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const view = viewFromRoute(route);

  const errors = useMemo(
    () => (attempted ? validateForm(form) : {}),
    [attempted, form],
  );

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    updateHash(hashFor(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const loadRun = useCallback(
    async (runId: string) => {
      setLoadingRun(true);
      try {
        const loaded = await api.getWorkflow(runId);
        setRun(loaded);
        setRoute({ name: "run", id: loaded.run_id });
        setLaunchError(null);
        updateHash(hashFor({ name: "run", id: loaded.run_id }));
      } catch (error) {
        notify(errorMessage(error), "error");
        setRun(null);
        setRoute({ name: "compose", id: null });
        updateHash("");
      } finally {
        setLoadingRun(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    if (initialRoute.name === "run" && initialRoute.id) {
      void loadRun(initialRoute.id);
    }
    // Загружаем запуск из адреса один раз при первом открытии рабочей области.
  }, []);

  useEffect(() => {
    const sync = () => {
      const next = parseRoute(window.location.hash);
      setRoute(next);
      if (next.name === "run" && next.id) {
        void loadRun(next.id);
        return;
      }
      setRun(null);
      setLoadingRun(false);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [loadRun]);

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        setForm((current) =>
          isFormPristine(current)
            ? applyProfileToFields(current, profile)
            : current,
        );
      })
      .catch(() => {
        // Профиля нет или он недоступен — форма остаётся пустой.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const launch = useCallback(
    async (payload: WorkflowPayload) => {
      setBusy(true);
      setLaunchError(null);
      try {
        const created = await api.createWorkflow(payload);
        setRun(created);
        setAttempted(false);
        setRoute({ name: "run", id: created.run_id });
        updateHash(hashFor({ name: "run", id: created.run_id }));
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
    navigate({ name: "compose", id: null });
  }, [navigate]);

  const handleRefine = useCallback(() => {
    if (!run) {
      return;
    }
    setForm(formFromUserData(run.request, run.user_data));
    setRun(null);
    setAttempted(false);
    navigate({ name: "compose", id: null });
    notify("Данные из запуска перенесены в форму.", "info");
    window.setTimeout(() => {
      document.getElementById("request")?.focus();
    }, 120);
  }, [navigate, notify, run]);

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
    setRoute({ name: "run", id: loaded.run_id });
    updateHash(hashFor({ name: "run", id: loaded.run_id }));
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
      if (next === "history") {
        navigate({ name: "generations", id: null });
        return;
      }
      if (next === "programs") {
        navigate({ name: "programs", id: null });
        return;
      }
      if (next === "workouts") {
        navigate({ name: "workouts", id: null });
        return;
      }
      navigate({ name: "profile", id: null });
    },
    [handleNewPlan, navigate],
  );

  const openProgram = useCallback(
    (programId: string) => {
      navigate({ name: "program", id: programId });
    },
    [navigate],
  );

  const openWorkout = useCallback(
    (workoutId: string) => {
      navigate({ name: "workout", id: workoutId });
    },
    [navigate],
  );

  const createStandaloneWorkout = useCallback(async () => {
    const title = window.prompt(
      "Название самостоятельной тренировки",
      "Самостоятельная тренировка",
    );
    if (title === null) {
      return;
    }
    try {
      const created = await api.createWorkout({
        title: title.trim() || "Самостоятельная тренировка",
      });
      notify("Тренировка начата.", "info");
      openWorkout(created.id);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  }, [notify, openWorkout]);

  const openAccount = useCallback(() => setAccountOpen(true), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const handleLogout = useCallback(() => void auth.logout(), [auth]);

  const renderPage = () => {
    if (route.name === "generations") {
      return (
        <HistoryList
          onOpen={handleOpenRun}
          onCreate={handleNewPlan}
          notify={notify}
        />
      );
    }
    if (route.name === "programs") {
      return (
        <ProgramsPage
          notify={notify}
          onOpenProgram={openProgram}
          onCreatePlan={handleNewPlan}
        />
      );
    }
    if (route.name === "program" && route.id) {
      return (
        <ProgramPage
          programId={route.id}
          notify={notify}
          onBack={() => navigate({ name: "programs", id: null })}
          onOpenWorkout={openWorkout}
          onOpenRun={(runId) => void loadRun(runId)}
        />
      );
    }
    if (route.name === "workouts") {
      return (
        <WorkoutsPage
          notify={notify}
          onOpenWorkout={openWorkout}
          onCreateWorkout={() => void createStandaloneWorkout()}
        />
      );
    }
    if (route.name === "workout" && route.id) {
      return (
        <WorkoutPage
          workoutId={route.id}
          notify={notify}
          onBack={() => navigate({ name: "workouts", id: null })}
          onOpenProgram={openProgram}
        />
      );
    }
    if (route.name === "profile") {
      return <ProfilePage notify={notify} />;
    }

    if (loadingRun) {
      return (
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
      );
    }
    if (run) {
      return isTerminal(run.status) ? (
        <ResultView
          run={run}
          onNewPlan={handleNewPlan}
          onRefine={handleRefine}
          onRetry={handleRetry}
          onOpenProgram={openProgram}
          notify={notify}
        />
      ) : (
        <RunProgress
          run={run}
          onNewPlan={handleNewPlan}
          onCopyId={() => void handleCopyId()}
        />
      );
    }
    return (
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
    );
  };

  return (
    <div className="app">
      <Sidebar
        view={view}
        onSelectView={handleSelectView}
        theme={theme}
        onSetTheme={setTheme}
        system={system}
        userEmail={email}
        onOpenAccount={openAccount}
        onLogout={handleLogout}
      />

      <main className="main">
        <Topbar
          theme={theme}
          onSetTheme={setTheme}
          system={system}
          userEmail={email}
          onOpenAccount={openAccount}
        />
        <div className="page">{renderPage()}</div>
      </main>

      <MobileNav view={view} onSelectView={handleSelectView} />
      <AccountDialog open={accountOpen} onClose={closeAccount} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
