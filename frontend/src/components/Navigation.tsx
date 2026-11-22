import type { Theme } from "../hooks/useTheme";
import type { SystemStatus } from "../hooks/useSystemStatus";
import {
  IconDumbbell,
  IconHistory,
  IconLayers,
  IconLogOut,
  IconMoon,
  IconSparkles,
  IconSun,
  IconUser,
} from "./Icons";

export type View =
  | "compose"
  | "programs"
  | "workouts"
  | "history"
  | "profile";

const NAV_ITEMS: Array<{
  view: View;
  label: string;
  shortLabel: string;
  icon: typeof IconSparkles;
}> = [
  {
    view: "compose",
    label: "Новый план",
    shortLabel: "План",
    icon: IconSparkles,
  },
  {
    view: "programs",
    label: "Программы",
    shortLabel: "Программы",
    icon: IconLayers,
  },
  {
    view: "workouts",
    label: "Тренировки",
    shortLabel: "Тренировки",
    icon: IconDumbbell,
  },
  {
    view: "history",
    label: "История планов",
    shortLabel: "История",
    icon: IconHistory,
  },
  {
    view: "profile",
    label: "Профиль",
    shortLabel: "Профиль",
    icon: IconUser,
  },
];

interface NavigationProps {
  view: View;
  onSelectView: (view: View) => void;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  system: SystemStatus;
  userEmail: string;
  onOpenAccount: () => void;
  onLogout: () => void;
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

export function Brand() {
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
    <span
      className={`status status--${copy.statusTone} topbar__status`}
      aria-label={copy.label}
      title={copy.label}
    >
      <span className="status__dot" />
      <span className="topbar__status-text">{copy.label}</span>
    </span>
  );
}

function emailInitial(email: string): string {
  return email ? email.charAt(0).toUpperCase() : "?";
}

function AccountCard({
  email,
  onOpen,
  onLogout,
}: {
  email: string;
  onOpen: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="account-card">
      <button
        type="button"
        className="account-card__main"
        onClick={onOpen}
        title={email}
      >
        <span className="account-card__avatar" aria-hidden="true">
          {emailInitial(email)}
        </span>
        <span className="account-card__info">
          <span className="account-card__email">{email}</span>
          <span className="account-card__hint">Аккаунт и сессии</span>
        </span>
      </button>
      <button
        type="button"
        className="account-card__logout"
        onClick={onLogout}
        aria-label="Выйти из аккаунта"
        title="Выйти"
      >
        <IconLogOut />
      </button>
    </div>
  );
}

export function Sidebar({
  view,
  onSelectView,
  theme,
  onSetTheme,
  system,
  userEmail,
  onOpenAccount,
  onLogout,
}: NavigationProps) {
  return (
    <aside className="sidebar">
      <Brand />

      <nav className="nav" aria-label="Основная навигация">
        <span className="nav__label">Рабочая область</span>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              type="button"
              className={`nav__item${view === item.view ? " is-active" : ""}`}
              onClick={() => onSelectView(item.view)}
            >
              <Icon />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__bottom">
        <AccountCard
          email={userEmail}
          onOpen={onOpenAccount}
          onLogout={onLogout}
        />
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
  userEmail,
  onOpenAccount,
}: Pick<
  NavigationProps,
  "theme" | "onSetTheme" | "system" | "userEmail" | "onOpenAccount"
>) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar__actions">
        <button
          type="button"
          className="topbar__account"
          onClick={onOpenAccount}
          aria-label="Настройки аккаунта"
          title={userEmail}
        >
          <span className="account-card__avatar account-card__avatar--sm">
            {emailInitial(userEmail)}
          </span>
          <span className="topbar__account-email">{userEmail}</span>
        </button>
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
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.view}
            type="button"
            className={`mobile-nav__item${
              view === item.view ? " is-active" : ""
            }`}
            aria-label={item.label}
            aria-current={view === item.view ? "page" : undefined}
            onClick={() => onSelectView(item.view)}
          >
            <Icon />
            <span className="mobile-nav__label">{item.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
