import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { api, ApiError } from "../api/client";
import type { AuthSession } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { formatDateTime } from "../lib/format";
import {
  EMPTY_CHANGE_PASSWORD,
  validateChangePasswordForm,
  type ChangePasswordErrors,
  type ChangePasswordState,
} from "../lib/authValidation";
import {
  IconClose,
  IconKey,
  IconLogOut,
  IconMonitor,
  IconRefresh,
} from "./Icons";

interface AccountDialogProps {
  open: boolean;
  onClose: () => void;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function describeDevice(userAgent?: string | null): string {
  if (!userAgent) {
    return "Неизвестное устройство";
  }

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Браузер";

  const system = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return system ? `${browser} · ${system}` : browser;
}

export function AccountDialog({ open, onClose }: AccountDialogProps) {
  const auth = useAuth();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsKey, setSessionsKey] = useState(0);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState<ChangePasswordState>(
    EMPTY_CHANGE_PASSWORD,
  );
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordErrors>(
    {},
  );
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    setSessionsError(null);

    api
      .listSessions()
      .then((records) => {
        if (!cancelled) {
          setSessions(records);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSessionsError(
            errorMessage(error, "Не удалось загрузить список сессий."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionsKey]);

  useEffect(() => {
    if (!open) {
      setPasswordForm(EMPTY_CHANGE_PASSWORD);
      setPasswordErrors({});
      setPasswordMessage(null);
      setPasswordError(null);
      setConfirmLogoutAll(false);
    }
  }, [open]);

  const reloadSessions = useCallback(
    () => setSessionsKey((value) => value + 1),
    [],
  );

  const updatePassword = (patch: Partial<ChangePasswordState>) => {
    setPasswordForm((current) => ({ ...current, ...patch }));
    setPasswordError(null);
    setPasswordMessage(null);
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateChangePasswordForm(passwordForm);
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await auth.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      setPasswordForm(EMPTY_CHANGE_PASSWORD);
      setPasswordMessage(
        "Пароль обновлён, остальные сессии завершены.",
      );
      reloadSessions();
    } catch (error) {
      setPasswordError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : errorMessage(error, "Не удалось изменить пароль."),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const revoke = async (sessionId: string, isCurrent: boolean) => {
    setRevokingId(sessionId);
    setSessionsError(null);
    try {
      await api.revokeSession(sessionId);
      if (isCurrent) {
        await auth.logout();
        return;
      }
      reloadSessions();
    } catch (error) {
      setSessionsError(
        errorMessage(error, "Не удалось завершить сессию."),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const logout = async () => {
    await auth.logout();
  };

  const logoutAll = async () => {
    if (!confirmLogoutAll) {
      setConfirmLogoutAll(true);
      return;
    }
    setLoggingOutAll(true);
    try {
      await auth.logoutAll();
    } finally {
      setLoggingOutAll(false);
    }
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
      >
        <header className="account-dialog__head">
          <div>
            <span className="eyebrow">
              <span className="eyebrow__dot" />
              Профиль
            </span>
            <h2 id="account-dialog-title">Аккаунт</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <IconClose />
          </button>
        </header>

        <div className="account-dialog__body">
          <section className="account-summary">
            <span className="account-summary__avatar" aria-hidden="true">
              {auth.user?.email.charAt(0).toUpperCase() ?? "?"}
            </span>
            <span className="account-summary__info">
              <strong>{auth.user?.email ?? ""}</strong>
              <small>
                В аккаунте с {formatDateTime(auth.user?.created_at)}
              </small>
            </span>
          </section>

          <section className="account-section">
            <div className="account-section__head">
              <h3>
                <IconKey />
                Смена пароля
              </h3>
            </div>

            <form className="account-form" onSubmit={submitPassword} noValidate>
              <label className="field">
                <span className="field__label">Текущий пароль</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  onChange={(event) =>
                    updatePassword({ currentPassword: event.target.value })
                  }
                />
                {passwordErrors.currentPassword ? (
                  <span className="field__error">
                    {passwordErrors.currentPassword}
                  </span>
                ) : null}
              </label>

              <label className="field">
                <span className="field__label">Новый пароль</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  onChange={(event) =>
                    updatePassword({ newPassword: event.target.value })
                  }
                />
                {passwordErrors.newPassword ? (
                  <span className="field__error">
                    {passwordErrors.newPassword}
                  </span>
                ) : (
                  <span className="field__hint">Не менее 8 символов.</span>
                )}
              </label>

              <label className="field">
                <span className="field__label">Повторите новый пароль</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  onChange={(event) =>
                    updatePassword({ confirmPassword: event.target.value })
                  }
                />
                {passwordErrors.confirmPassword ? (
                  <span className="field__error">
                    {passwordErrors.confirmPassword}
                  </span>
                ) : null}
              </label>

              {passwordError ? (
                <div className="auth-error" role="alert">
                  {passwordError}
                </div>
              ) : null}
              {passwordMessage ? (
                <div className="account-success" role="status">
                  {passwordMessage}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingPassword}
              >
                {savingPassword ? <span className="spinner" /> : null}
                Обновить пароль
              </button>
            </form>
          </section>

          <section className="account-section">
            <div className="account-section__head">
              <h3>
                <IconMonitor />
                Активные сессии
              </h3>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={reloadSessions}
                disabled={loadingSessions}
              >
                <IconRefresh className={loadingSessions ? "is-spinning" : undefined} />
                Обновить
              </button>
            </div>

            {sessionsError ? (
              <div className="auth-error" role="alert">
                {sessionsError}
              </div>
            ) : null}

            {loadingSessions && sessions.length === 0 ? (
              <div className="session-list" aria-busy="true">
                <div className="session-row">
                  <span className="skeleton" style={{ width: 38, height: 38 }} />
                  <span className="session-row__info">
                    <span className="skeleton" style={{ width: "52%", height: 13 }} />
                    <span className="skeleton" style={{ width: "34%", height: 10 }} />
                  </span>
                </div>
              </div>
            ) : sessions.length === 0 ? (
              <p className="account-empty">Активных сессий не осталось.</p>
            ) : (
              <ul className="session-list">
                {sessions.map((session) => (
                  <li key={session.id} className="session-row">
                    <span className="session-row__icon">
                      <IconMonitor />
                    </span>
                    <span className="session-row__info">
                      <span className="session-row__title">
                        {describeDevice(session.user_agent)}
                        {session.is_current ? (
                          <span className="pill session-row__badge">
                            это устройство
                          </span>
                        ) : null}
                      </span>
                      <span className="session-row__meta">
                        Вход {formatDateTime(session.created_at)} · активность{" "}
                        {formatDateTime(session.last_used_at)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm session-row__revoke"
                      onClick={() =>
                        void revoke(session.id, session.is_current)
                      }
                      disabled={revokingId === session.id}
                    >
                      {revokingId === session.id ? (
                        <span className="spinner" />
                      ) : null}
                      Завершить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="account-dialog__foot">
          <button type="button" className="btn btn--secondary" onClick={() => void logout()}>
            <IconLogOut />
            Выйти
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => void logoutAll()}
            disabled={loggingOutAll}
          >
            {loggingOutAll ? <span className="spinner" /> : null}
            {confirmLogoutAll
              ? "Подтвердить выход со всех устройств"
              : "Выйти со всех устройств"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
