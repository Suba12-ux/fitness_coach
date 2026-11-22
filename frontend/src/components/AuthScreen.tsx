import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../hooks/useTheme";
import {
  EMPTY_AUTH_FORM,
  normalizeEmail,
  validateAuthForm,
  type AuthFormErrors,
  type AuthFormState,
  type AuthMode,
} from "../lib/authValidation";
import { Brand } from "./Navigation";
import { IconAlert, IconMoon, IconSparkles, IconSun } from "./Icons";

export function AuthScreen() {
  const auth = useAuth();
  const { clearSessionExpired } = auth;
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthFormState>(EMPTY_AUTH_FORM);
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setErrors({});
    setServerError(null);
    setShowPassword(false);
  }, [mode]);

  const update = useCallback(
    (patch: Partial<AuthFormState>) => {
      setForm((current) => ({ ...current, ...patch }));
      setServerError(null);
      clearSessionExpired();
    },
    [clearSessionExpired],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearSessionExpired();
    const nextErrors = validateAuthForm(mode, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setServerError(null);
    const payload = {
      email: normalizeEmail(form.email),
      password: form.password,
      remember_me: form.rememberMe,
    };

    try {
      if (mode === "login") {
        await auth.login(payload);
      } else {
        await auth.register(payload);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setServerError("Проверьте корректность email и пароля.");
      } else {
        setServerError(
          error instanceof Error
            ? error.message
            : "Не удалось выполнить вход.",
        );
      }
      setSubmitting(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    if (next !== mode) {
      clearSessionExpired();
      setMode(next);
      setForm((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Brand />

        <div className="auth-aside__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            Персональный AI-тренер
          </span>
          <h1>
            Тренируйтесь <em>осознанно</em>, а не наугад.
          </h1>
          <p>
            Sensei собирает недельный план по вашим целям, опыту и
            ограничениям, а затем проверяет его на безопасность.
          </p>

          <ul className="auth-points">
            <li>
              <IconSparkles />
              <span>
                Мультиагентная подготовка плана
                <small>профиль, тренировки и проверка безопасности</small>
              </span>
            </li>
            <li>
              <IconAlert />
              <span>
                Личная история запусков
                <small>доступна только вам и защищена сессией</small>
              </span>
            </li>
          </ul>
        </div>

        <p className="auth-aside__foot">
          Учебный прототип. Не является медицинской рекомендацией.
        </p>
      </aside>

      <main className="auth-main">
        <button
          type="button"
          className="auth-theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={
            theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
          }
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>

        <section className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Вход или регистрация">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              onClick={() => switchMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "is-active" : ""}
              onClick={() => switchMode("register")}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-card__head">
            <h2>{mode === "login" ? "С возвращением" : "Создать аккаунт"}</h2>
            <p>
              {mode === "login"
                ? "Войдите, чтобы вернуться к своим планам и истории."
                : "Пара шагов — и можно собрать первый план тренировок."}
            </p>
          </div>

          {auth.sessionExpired ? (
            <div className="auth-notice" role="status">
              Сессия истекла. Войдите снова, чтобы продолжить.
            </div>
          ) : null}

          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="input"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                autoFocus
                value={form.email}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => update({ email: event.target.value })}
              />
              {errors.email ? (
                <span className="field__error">{errors.email}</span>
              ) : null}
            </label>

            <label className="field">
              <span className="field__label">Пароль</span>
              <span className="auth-password">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={form.password}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(event) => update({ password: event.target.value })}
                />
                <button
                  type="button"
                  className="auth-password__toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </span>
              {mode === "register" ? (
                <span className="field__hint">Не менее 8 символов.</span>
              ) : null}
              {errors.password ? (
                <span className="field__error">{errors.password}</span>
              ) : null}
            </label>

            {mode === "register" ? (
              <label className="field">
                <span className="field__label">Повторите пароль</span>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  onChange={(event) =>
                    update({ confirmPassword: event.target.value })
                  }
                />
                {errors.confirmPassword ? (
                  <span className="field__error">{errors.confirmPassword}</span>
                ) : null}
              </label>
            ) : null}

            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={form.rememberMe}
                onChange={(event) =>
                  update({ rememberMe: event.target.checked })
                }
              />
              <span>
                Запомнить меня
                <small>
                  Не выходить из аккаунта после закрытия браузера.
                </small>
              </span>
            </label>

            {serverError ? (
              <div className="auth-error" role="alert">
                {serverError}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn--primary btn--lg auth-submit"
              disabled={submitting}
            >
              {submitting ? <span className="spinner" /> : null}
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              type="button"
              onClick={() =>
                switchMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Создать" : "Войти"}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
