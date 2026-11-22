import type { Theme } from "../hooks/useTheme";
import type { SystemStatus } from "../hooks/useSystemStatus";
import { IconHistory, IconMoon, IconSparkles, IconSun } from "./Icons";

export type View = "compose" | "history";

interface NavigationProps {
  view: View;
  onSelectView: (view: View) => void;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  system: SystemStatus;
}

const SYSTEM_COPY = {
  loading: { label: "Проверяем систему", tone: "unknown", statusTone: "neutral" },
  ok: { label: "Система готова", tone: "ok", statusTone: "success" },
  degraded: { label: "Работаем с ограничениями", tone: "warning", statusTone: "warning" },
  offline: { label: "API недоступен", tone: "danger", statusTone: "danger" },
} as const;

const CHECK_ROWS = [
  { key: "database", label: "База данных" },
  { key: "redis", label: "Очередь задач" },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden="true">
        S
      </span>
      <span>
        <span className="brand__name">Sensei</span>
        <span className="brand__tag">AI fitness coach</span>
      </span>
    </div>
  );
}

function SystemCard({ system }: { system: SystemStatus }) {
  const copy = SYSTEM_COPY[system.state];

  return (
    <div className="system-card">
      <div className="system-card__head">
        <span className={`system-card__dot system-card__dot--${copy.tone}`} />
        {copy.label}
      </div>
      <div className="system-card__rows">
        {CHECK_ROWS.map((row) => {
          const value = system.checks[row.key];
          let text = "—";
          let modifier = "";
          if (system.state === "loading") {
            text = "проверка…";
          } else if (system.state === "offline") {
            text = "недоступно";
            modifier = "error";
          } else {
            const ok = value === "ok";
            text = ok ? "в норме" : "ошибка";
            modifier = ok ? "ok" : "error";
          }

          return (
            <div key={row.key} className="system-card__row">
              <span>{row.label}</span>
              <span
                className={`system-card__value${
                  modifier ? ` system-card__value--${modifier}` : ""
                }`}
                title={value}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onSetTheme,
}: Pick<NavigationProps, "theme" | "onSetTheme">) {
  return (
    <div className="theme-toggle" role="group" aria-label="Тема интерфейса">
      <button
        type="button"
        className={theme === "dark" ? "is-active" : ""}
        aria-pressed={theme === "dark"}
        onClick={() => onSetTheme("dark")}
      >
        <IconMoon />
        Тёмная
      </button>
      <button
        type="button"
        className={theme === "light" ? "is-active" : ""}
        aria-pressed={theme === "light"}
        onClick={() => onSetTheme("light")}
      >
        <IconSun />
        Светлая
      </button>
    </div>
  );
}

function HealthPill({ system }: { system: SystemStatus }) {
  const copy = SYSTEM_COPY[system.state];
  return (
    <span className={`status status--${copy.statusTone} topbar__status`}>
      <span className="status__dot" />
      {copy.label}
    </span>
  );
}

export function Sidebar({
  view,
  onSelectView,
  theme,
  onSetTheme,
  system,
}: NavigationProps) {
  return (
    <aside className="sidebar">
      <Brand />

      <nav className="nav" aria-label="Основная навигация">
        <span className="nav__label">Рабочая область</span>
        <button
          type="button"
          className={`nav__item${view === "compose" ? " is-active" : ""}`}
          onClick={() => onSelectView("compose")}
        >
          <IconSparkles />
          Новый план
        </button>
        <button
          type="button"
          className={`nav__item${view === "history" ? " is-active" : ""}`}
          onClick={() => onSelectView("history")}
        >
          <IconHistory />
          История
        </button>
      </nav>

      <div className="sidebar__bottom">
        <SystemCard system={system} />
        <ThemeToggle theme={theme} onSetTheme={onSetTheme} />
        <p className="sidebar__note">
          Учебный прототип мультиагентной системы. Не медицинская рекомендация.
        </p>
      </div>
    </aside>
  );
}

export function Topbar({
  theme,
  onSetTheme,
  system,
}: Pick<NavigationProps, "theme" | "onSetTheme" | "system">) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar__actions">
        <HealthPill system={system} />
        <button
          type="button"
          className="topbar__theme"
          onClick={() => onSetTheme(theme === "dark" ? "light" : "dark")}
          aria-label={
            theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
          }
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  );
}

export function MobileNav({ view, onSelectView }: Pick<NavigationProps, "view" | "onSelectView">) {
  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      <button
        type="button"
        className={`mobile-nav__item${view === "compose" ? " is-active" : ""}`}
        onClick={() => onSelectView("compose")}
      >
        <IconSparkles />
        Новый план
      </button>
      <button
        type="button"
        className={`mobile-nav__item${view === "history" ? " is-active" : ""}`}
        onClick={() => onSelectView("history")}
      >
        <IconHistory />
        История
      </button>
    </nav>
  );
}
